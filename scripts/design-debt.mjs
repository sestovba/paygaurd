#!/usr/bin/env node
/*
 * The control ratchet.
 * ====================
 *
 * The problem this solves is not that the codebase has 334 hand-rolled
 * buttons. It is that it had 48 button classes and 24 control heights and
 * nothing noticed, over eight layouts and however many sessions. A rule that
 * only lives in CLAUDE.md is a rule that gets re-litigated by whoever reads
 * it next; the palette proved the other way round — it drifted for months and
 * has not drifted once since theme:check started failing builds over it.
 *
 * Banning the old code outright would fail every build until eight layouts
 * are rewritten, which means the ban gets switched off within a day. So this
 * is a ratchet instead:
 *
 *   - `design-debt.json` records what each file owes today.
 *   - A count going UP fails the build.
 *   - A file not in the baseline having any debt at all fails the build,
 *     which is the case that actually matters: a new layout cannot start by
 *     inventing a forty-ninth button.
 *   - A count going DOWN is the point. Run `--update` to bank it.
 *
 * WHAT IS COUNTED
 *
 *   raw-button    A <button> element written by hand instead of the shared
 *                 Button / IconButton. This is the one that produced 48
 *                 classes and 24 heights.
 *   literal-size  A control dimension hardcoded in CSS — block-size,
 *                 height, min-height — rather than a --t-control-h token.
 *   literal-radius / literal-text
 *                 Same, for the shape and type scales.
 *
 * WHAT IS DELIBERATELY NOT COUNTED
 *
 * Padding. There are 224 distinct values and most are layout spacing, not
 * control spacing — a card's inset is a real design decision and does not
 * belong to a control. Counting it would drown the signal in the thing that
 * is allowed to vary. The controls' own padding is fixed in controls.css and
 * that is where it mattered.
 */
import { readFileSync, writeFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const BASELINE = 'scripts/design-debt.json';
const update = process.argv.includes('--update');

/** Files that ARE the shared layer, and so are allowed to spell a control. */
const SOURCE_OF_TRUTH = new Set([
  'src/styles/metrics.css',
  'src/styles/controls.css',
  'src/styles/palette.css',
  'src/components/ui/Button.tsx',
  'src/components/ui/Field.tsx'
]);

/** The dev-only review console. Not a product surface, never shipped, and
 *  deliberately does not follow the user's palette — see theme-check.mjs. */
const NOT_A_PRODUCT_SURFACE = (f) => f.startsWith('src/review/');

const strip = (s) => s.replace(/\/\*[\s\S]*?\*\//g, '');

function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) walk(full, out);
    else if (/\.(tsx|css)$/.test(name)) out.push(full);
  }
  return out;
}

/* A control dimension. `height: 100%`, `1px` and `auto` are not control
 * sizing, and neither is anything already reading a token. */
const SIZE = /(?:^|[\s;{])(?:block-size|height|min-height|min-block-size)\s*:\s*([^;}]+)/g;
const RADIUS = /border-radius\s*:\s*([^;}]+)/g;
const TEXT = /font-size\s*:\s*([^;}]+)/g;

const isTokened = (v) => /var\(\s*--/.test(v);
const isTrivial = (v) => /^\s*(0|auto|100%|inherit|unset|initial|1px|none)\s*$/.test(v);

/*
 * literal-size is CONTROL debt, not arbitrary geometry debt.
 *
 * A previous broad pass charged viewport shells, chart caps, pips, meter
 * rails, sheet grips and swatches simply because they had a `height`.
 * That encouraged meaningless tokens and contradicted this script's own
 * definition of the category.
 *
 * Radius and type remain intentionally global; size is selector-aware.
 */
const CONTROL_WORD =
  /(?:^|[-_])(?:btn|button|control|field|input|select|tab|toggle|switch|action|step|seg|segmented|chip|filter|close|cta|lock|scope|trigger|picker|prompt|quest|hotbar|year-select|signin|modal-btn|source-trash|add-job|add-button|log|do)(?:$|[-_])/i;

const NON_CONTROL_PART =
  /(?:^|[-_])(?:shell|divider|dot|mark|thumb|lead|grip|swatch|count|plus|row|chest)(?:$|[-_])/i;

const TEXT_ENTRY_HINT =
  /(?:field|entry|cell|num|signin-input|year-select|textarea)/i;

function selectorAt(css, index) {
  const open = css.lastIndexOf('{', index);
  if (open < 0) return '';

  const previousClose = css.lastIndexOf('}', open);
  const previousOpen = css.lastIndexOf('{', open - 1);
  const boundary = Math.max(previousClose, previousOpen);

  return css
    .slice(boundary + 1, open)
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .trim();
}

function isControlName(name) {
  return CONTROL_WORD.test(name) && !NON_CONTROL_PART.test(name);
}

function terminalCompound(branch) {
  const cleaned = branch
    .replace(/::?[a-z-]+(?:\([^)]*\))?/gi, '')
    .trim();

  return cleaned.split(/\s+|>|\+|~/).filter(Boolean).at(-1) ?? '';
}

function isControlSelector(selector) {
  const utility = selector.match(/^@utility\s+([a-z0-9_-]+)/i);

  if (utility) return isControlName(utility[1]);

  return selector.split(',').some((branch) => {
    const terminal = terminalCompound(branch);

    if (/\b(?:button|input|select|textarea)\b/i.test(terminal)) {
      return true;
    }

    const classes = [
      ...terminal.matchAll(/\.([a-z0-9_-]+)/gi),
    ].map((m) => m[1]);

    return classes.some(isControlName);
  });
}

function literalPx(value) {
  const m = value.trim().match(/^(-?(?:\d+(?:\.\d+)?|\.\d+))(px|rem)$/i);
  if (!m) return null;

  const n = Number(m[1]);
  return m[2].toLowerCase() === 'rem' ? n * 16 : n;
}

function countControlSizes(css) {
  let n = 0;

  for (const m of css.matchAll(SIZE)) {
    const value = m[1].trim();

    if (isTokened(value) || isTrivial(value)) continue;

    const selector = selectorAt(css, m.index ?? 0);

    if (!isControlSelector(selector)) continue;

    /*
     * Tiny native inputs here are checkbox/radio marks, not the hit target.
     * Text-entry controls carry a field/entry/cell/etc. semantic name.
     */
    const px = literalPx(value);

    if (
      px !== null &&
      px < 28 &&
      /\binput\b/i.test(selector) &&
      !TEXT_ENTRY_HINT.test(selector)
    ) {
      continue;
    }

    n++;
  }

  return n;
}

function measure(file) {
  const raw = readFileSync(file, 'utf8');
  const debt = {};

  if (file.endsWith('.tsx')) {
    const n = (raw.match(/<button[\s>]/g) ?? []).length;
    if (n) debt['raw-button'] = n;
  } else {
    const css = strip(raw);
    const count = (re) => {
      let n = 0;
      for (const m of css.matchAll(re)) {
        const v = m[1].trim();
        if (!isTokened(v) && !isTrivial(v)) n++;
      }
      return n;
    };
    const size = countControlSizes(css);
    const radius = count(RADIUS);
    const text = count(TEXT);
    if (size) debt['literal-size'] = size;
    if (radius) debt['literal-radius'] = radius;
    if (text) debt['literal-text'] = text;
  }
  return debt;
}

const current = {};
for (const file of walk('src')) {
  if (SOURCE_OF_TRUTH.has(file) || NOT_A_PRODUCT_SURFACE(file)) continue;
  const debt = measure(file);
  if (Object.keys(debt).length) current[file] = debt;
}

if (update) {
  const sorted = Object.fromEntries(Object.keys(current).sort().map((k) => [k, current[k]]));
  writeFileSync(BASELINE, JSON.stringify(sorted, null, 2) + '\n');
  const total = Object.values(sorted).reduce(
    (a, d) => a + Object.values(d).reduce((x, y) => x + y, 0), 0);
  console.log(`design-debt baseline written — ${Object.keys(sorted).length} files, ${total} items.`);
  process.exit(0);
}

let baseline;
try {
  baseline = JSON.parse(readFileSync(BASELINE, 'utf8'));
} catch {
  console.error(`design-debt: no baseline at ${BASELINE}. Run \`npm run debt:update\` once to record where things stand.`);
  process.exit(1);
}

const errors = [];
const KINDS = ['raw-button', 'literal-size', 'literal-radius', 'literal-text'];
const ADVICE = {
  'raw-button': 'use <Button> / <IconButton>, or <ButtonBase> for a layout-owned skin',
  'literal-size': 'use var(--t-control-h) — see styles/metrics.css',
  'literal-radius': 'use var(--t-radius*) — see styles/metrics.css',
  'literal-text': 'use var(--t-text-*) — see styles/metrics.css'
};

let banked = 0;

/* Compare the union of baseline + current files. A file disappears from
 * `current` when its final debt item reaches zero, and that payoff still
 * needs to be counted and banked. */
const measuredFiles = new Set([
  ...Object.keys(baseline),
  ...Object.keys(current)
]);

for (const file of [...measuredFiles].sort()) {
  const debt = current[file] ?? {};
  const was = baseline[file];

  if (!was) {
    for (const kind of KINDS) {
      if (debt[kind]) {
        errors.push(`${file}: ${debt[kind]} × ${kind} in a file with no baseline — ${ADVICE[kind]}.`);
      }
    }
    continue;
  }

  for (const kind of KINDS) {
    const now = debt[kind] ?? 0;
    const before = was[kind] ?? 0;

    if (now > before) {
      errors.push(`${file}: ${kind} went ${before} → ${now}. The ratchet only turns one way — ${ADVICE[kind]}.`);
    } else if (now < before) {
      banked += before - now;
    }
  }
}

const total = Object.values(current).reduce(
  (a, d) => a + Object.values(d).reduce((x, y) => x + y, 0), 0);

if (errors.length) {
  console.error(`design-debt failed — ${errors.length} problem${errors.length > 1 ? 's' : ''}\n`);
  for (const e of errors) console.error('  ' + e);
  console.error('');
  process.exit(1);
}

if (banked) {
  console.log(`design-debt ok — ${total} items left, ${banked} paid off since the baseline.`);
  console.log('  Run `npm run debt:update` to bank it so it cannot come back.\n');
} else {
  console.log(`design-debt ok — ${total} items, none added.`);
}
