#!/usr/bin/env node
/*
 * Fails if the palette has started drifting again.
 *
 * The old system fell apart by omission, not by anyone writing anything
 * wrong: five variants declared as partial patches over `paper`, so a
 * variant that never mentioned --pg-warn quietly wore paper's, and the only
 * way to know what `slate` actually was involved resolving nine selector
 * blocks by hand. Three of the five were missing more than half the palette.
 *
 * So the rule is completeness, and this checks it:
 *
 *   1. Every variant answers every colour choice `paper` answers — same
 *      names, same order. No inheritance, no omissions.
 *   2. Every theme that answers any SHAPE choice in metrics.css answers all
 *      of them. Same rule, same reason, on the file that owns size.
 *   3. Nothing outside palette.css and metrics.css declares a --t-* value.
 *   4. The layout stylesheets that map --t-* onto their own names contain
 *      aliases only — `--pg-x: var(--t-x)` — never a literal colour, which
 *      is how a second source of truth starts.
 *
 * Run by `npm run theme:check`, and by `npm run build` before vite.
 *
 * The other half of the same job is `scripts/design-debt.mjs`, which ratchets
 * the hand-rolled controls this file cannot see: a --t-* token nobody uses is
 * not drift a stylesheet checker can catch.
 */
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const STYLES = 'src/styles';
const PALETTE = join(STYLES, 'palette.css');
const METRICS = join(STYLES, 'metrics.css');
const strip = (s) => s.replace(/\/\*[\s\S]*?\*\//g, '');

/* The two files allowed to SET a --t-* value. palette.css owns every colour;
 * metrics.css owns every size, space and shape. Everything else may read them
 * and may alias them onto its own names, and may not choose. */
const TOKEN_FILES = new Set(['palette.css', 'metrics.css']);

/* Shape, and the three chrome tokens a variant may speak about outside its
 * choices — see the DERIVED note in palette.css. Everything else a variant
 * sets has to exist on `paper` first, or it is a colour only one variant
 * has and the next person cannot find. */
const OVERRIDABLE = new Set([
  'shadow-sm', 'shadow', 'shadow-md', 'shadow-lg',
  'topbar', 'topbar-fg', 'topbar-accent', 'topbar-accent-w'
]);
const errors = [];

/** Every stylesheet this rule applies to, as [label, RAW text].
 *  Raw, because the `@override` marker lives in a comment — stripping first
 *  is exactly what would make every block look unmarked. */
function files() {
  const out = [['src/index.css', readFileSync('src/index.css', 'utf8')]];
  for (const f of readdirSync(STYLES)) {
    if (f.endsWith('.css')) out.push([`${STYLES}/${f}`, readFileSync(join(STYLES, f), 'utf8')]);
  }
  return out;
}

/**
 * A copy of the source with every comment's INSIDE blanked to spaces, so
 * brace-matching can run over it while every offset still lines up with the
 * original text.
 *
 * This exists because of a real, silent failure. overlay.css explains a past
 * bug in prose and quotes a selector while doing it:
 *
 *     ... That block is `.pg-payguard {`, a LAYOUT scope, not the root.
 *
 * That brace is inside a comment and means nothing, but the scanner below
 * counted it. One unbalanced brace on line 8 shifted every block boundary in
 * the remaining 490 lines by one, so the `@override` marker on the elevation
 * block stopped being found and two correctly-marked shadows were reported as
 * unmarked. The failure mode is the bad one: the checker did not crash, it
 * confidently blamed the wrong lines, and the fix it suggested would have
 * been wrong. A file gets more prose over time, so this was going to happen —
 * it is a checker that reads CSS badly, not a comment that was written badly.
 */
function maskComments(src) {
  return src.replace(/\/\*[\s\S]*?\*\//g, (c) => '/*' + ' '.repeat(c.length - 4) + '*/');
}

/**
 * Top-level rule blocks as [selector, body, preceding-comment].
 *
 * Brace positions come from the masked copy; the text at those positions is
 * sliced out of the ORIGINAL, because the `@override` marker lives in a
 * comment and stripping first is what would make every block look unmarked.
 * Nested at-rules (@media, @supports) are walked into so a block inside one
 * is still checked.
 */
function topLevelBlocks(src, masked = maskComments(src)) {
  const out = [];
  let i = 0;
  while (i < src.length) {
    const open = masked.indexOf('{', i);
    if (open === -1) break;
    let depth = 1, j = open + 1;
    while (j < masked.length && depth > 0) {
      if (masked[j] === '{') depth++;
      else if (masked[j] === '}') depth--;
      j++;
    }
    const head = src.slice(i, open);
    const selector = head.replace(/\/\*[\s\S]*?\*\//g, '').trim().replace(/\s+/g, ' ');
    const body = src.slice(open + 1, j - 1);
    const comments = head.match(/\/\*[\s\S]*?\*\//g) ?? [];
    if (/^@(media|supports|layer|container)/.test(selector)) {
      out.push(...topLevelBlocks(body, masked.slice(open + 1, j - 1)));
    } else if (selector) {
      out.push([selector, body.replace(/\/\*[\s\S]*?\*\//g, ''), comments.join('\n')]);
    }
    i = j;
  }
  return out;
}


const css = strip(readFileSync(PALETTE, 'utf8'));

/** [selector, [tokenName, ...]] for every block, in source order. */
const blocks = [...css.matchAll(/([^{}]+)\{([^{}]*)\}/g)].map(([, sel, body]) => [
  sel.trim().replace(/\s+/g, ' '),
  [...body.matchAll(/--t-([a-z0-9-]+)\s*:/g)].map((m) => m[1]),
  body
]);

const variantBlocks = blocks.filter(([sel]) => /\[data-palette='[a-z0-9]+'\]$/.test(sel));
const reference = variantBlocks.find(([sel]) => sel === "[data-palette='paper']");
if (!reference) errors.push(`${PALETTE}: no [data-palette='paper'] block — that is the reference every variant is checked against.`);

const CHOICES = reference ? reference[1] : [];
const named = new Set();

for (const [sel, tokens] of variantBlocks) {
  const variant = /\[data-palette='([a-z0-9]+)'\]/.exec(sel)[1];
  named.add(variant);
  // The shape/elevation blocks legitimately set a subset; only blocks that
  // set any CHOICE are held to the full list.
  if (!tokens.some((t) => CHOICES.includes(t))) continue;
  const missing = CHOICES.filter((t) => !tokens.includes(t));
  const extra = tokens.filter((t) => !CHOICES.includes(t) && !OVERRIDABLE.has(t));
  if (missing.length) errors.push(`${sel}: missing ${missing.map((t) => '--t-' + t).join(', ')}`);
  if (extra.length) errors.push(`${sel}: sets ${extra.map((t) => '--t-' + t).join(', ')}, which 'paper' does not — add it to paper first, or it is a colour only one variant has.`);
  const order = tokens.filter((t) => CHOICES.includes(t));
  if (order.join() !== CHOICES.filter((t) => tokens.includes(t)).join()) {
    errors.push(`${sel}: choices are out of order. Keep every variant in paper's order so two blocks can be read side by side.`);
  }
}

// Each named variant needs a light and a dark form, unless it declares
// itself single-ink with `color-scheme: dark` and no `.dark` partner.
for (const v of named) {
  const light = blocks.find(([sel]) => sel === `[data-palette='${v}']`);
  const dark = blocks.some(([sel]) => sel === `.dark[data-palette='${v}']`);
  // Single-ink variants (carbon) declare `color-scheme: dark` in their own
  // LIGHT block and have no dark partner. Read it off that block rather than
  // searching the file, or `.dark[data-palette='x']` matches the same
  // substring and every variant looks single-ink.
  // Read it off THAT block, found by exact selector. Searching the file by
  // substring finds the shared elevation block first, whose grouped selector
  // also contains `[data-palette='carbon']`.
  const singleInk = /color-scheme:\s*dark/.test(light ? light[2] : '');
  if (light && !dark && !singleInk) {
    errors.push(`[data-palette='${v}']: has no dark form and does not declare 'color-scheme: dark', so it will render light ink on a dark page.`);
  }
  if (light && dark && singleInk) {
    errors.push(`[data-palette='${v}']: declares 'color-scheme: dark' in its light block but also has a dark form — pick one.`);
  }
}


/*
 * 2 — metrics.css: a theme answers every SHAPE choice, or none of them.
 *
 * Not the same rule as the palette's, and the difference is the point. A
 * colour variant must answer all 39 because a variant silently wearing
 * another's warn amber is invisible-wrong. Size is not like that: a theme
 * that wants paper's 4dp grid should say nothing and get it, and forcing it
 * to restate every value would bury the one line that actually differs.
 *
 * So: silence is fine, and a partial answer is not. A block that sets three
 * of the fourteen is the partial-patch failure that took palette.css nine
 * selector blocks to unpick, and it is the shape of every bug this whole
 * system exists to stop.
 */
{
  const mcss = strip(readFileSync(METRICS, 'utf8'));
  const mblocks = [...mcss.matchAll(/([^{}]+)\{([^{}]*)\}/g)].map(([, sel, body]) => [
    sel.trim().replace(/\s+/g, ' '),
    [...body.matchAll(/--t-([a-z0-9-]+)\s*:/g)].map((m) => m[1])
  ]);
  const ref = mblocks.find(([sel]) => sel === "[data-palette='paper']");
  if (!ref) {
    errors.push(`${METRICS}: no [data-palette='paper'] block — that is the reference every theme's shape is checked against.`);
  } else {
    const SHAPE = ref[1];
    for (const [sel, tokens] of mblocks) {
      if (!/^\[data-palette='[a-z0-9]+'\]$/.test(sel)) continue;
      const answered = tokens.filter((t) => SHAPE.includes(t));
      if (answered.length === 0) continue;
      const missing = SHAPE.filter((t) => !tokens.includes(t));
      const extra = tokens.filter((t) => !SHAPE.includes(t));
      if (missing.length) {
        errors.push(`${METRICS} ${sel}: answers ${answered.length} of ${SHAPE.length} shape choices, missing ${missing.map((t) => '--t-' + t).join(', ')}. Answer all of them or none — a partial block is how the old palette drifted.`);
      }
      if (extra.length) {
        errors.push(`${METRICS} ${sel}: sets ${extra.map((t) => '--t-' + t).join(', ')}, which 'paper' does not. Add it to paper first, or it is a value only one theme has and the next person cannot find.`);
      }
      if (answered.join() !== SHAPE.filter((t) => tokens.includes(t)).join()) {
        errors.push(`${METRICS} ${sel}: shape choices are out of order. Keep every theme in paper's order so two blocks can be read side by side.`);
      }
    }
    // A theme with colour but no shape is fine (it inherits the defaults); a
    // shape block for a theme that has no palette is a typo in the id.
    for (const [sel] of mblocks) {
      const m = /^\[data-palette='([a-z0-9]+)'\]$/.exec(sel);
      if (m && !named.has(m[1])) {
        errors.push(`${METRICS} ${sel}: no such palette. palette.css declares [${[...named].sort().join(', ')}].`);
      }
    }
  }
}

/*
 * 3 — index.html's SINGLE_INK list must match the palettes that declare
 * themselves dark. That list is a duplicate of what palette.css says, and it
 * has to be: the pre-paint script runs before any stylesheet has parsed, so
 * it cannot ask. A duplicate that is checked is fine; one that is not is how
 * the old system drifted.
 */
{
  const singleInk = variantBlocks
    .filter(([sel, , body]) => /^\[data-palette='[a-z0-9]+'\]$/.test(sel) && /color-scheme:\s*dark/.test(body))
    .map(([sel]) => /'([a-z0-9]+)'/.exec(sel)[1])
    .sort();
  const html = readFileSync('index.html', 'utf8');
  const listed = /SINGLE_INK\s*=\s*\[([^\]]*)\]/.exec(html);
  if (!listed) {
    errors.push("index.html: no SINGLE_INK list found — the pre-paint script needs one for palettes with no light form.");
  } else {
    const names = [...listed[1].matchAll(/'([a-z0-9]+)'/g)].map((m) => m[1]).sort();
    if (names.join() !== singleInk.join()) {
      errors.push(`index.html: SINGLE_INK is [${names}] but palette.css declares [${singleInk}] dark with no light form. They must match, or those palettes flash light on first paint.`);
    }
  }
}

/*
 * 4 + 5 — no second source of truth.
 *
 * Outside palette.css a stylesheet may MAP the palette onto its own token
 * names as much as it likes, but it may not PICK a colour — unless the block
 * is marked `@override` in the comment above it, which is how a layout says
 * "this one is mine, and here is why". That marker is the whole contract:
 * an exception you had to write a sentence for is an exception someone can
 * find, and the five palettes this replaced were all unmarked.
 */
/**
 * Does this value CHOOSE a colour, as opposed to deriving one?
 *
 * `color-mix(in oklab, var(--t-safe) 10%, transparent)` picks nothing — it is
 * a tint of a palette choice, and it moves when the palette moves. What makes
 * a second source of truth is a hardcoded colour, so var() references and the
 * keywords are removed first and only what is left over counts.
 */
function picksAColour(value) {
  const derived = value
    .replace(/var\(\s*--[a-z0-9-]+\s*(,[^()]*)?\)/g, ' ')
    .replace(/\b(transparent|currentColor|inherit|none|unset|initial)\b/g, ' ');
  return /#[0-9a-f]{3,8}\b|\b(rgba?|hsla?|oklch|oklab|lab|lch)\(\s*[\d.]/i.test(derived);
}

/** color-mix() uses, counted — NOT a ban.
 *
 *  This used to say color-mix() was banned outright for old WebViews. That
 *  rule is gone from CLAUDE.md and was already dead when it was written: the
 *  eight stylesheets held 144 uses between them, including in the two layouts
 *  the rule named as its own reference. The standing rule is that the flat
 *  value ships and the better one goes in an `@supports` block, which this
 *  script cannot judge. So the count is reported as information and nothing
 *  more — a file with a rising number is worth a look, not a failure. */
const COUNTED = /color-mix\(/;

/** review.css dresses the dev-only review console, which is not a product
 *  surface and deliberately does not follow the user's palette. */
const NOT_A_THEME = new Set(['review.css']);

/** Files still carrying their own palette. Reported, not fatal, so the debt
 *  stays visible without blocking a build. Remove a name when it migrates. */
const PENDING = new Set(['calc20.css']);

const pending = [];
const banned = [];
for (const [label, text] of files()) {
  const base = label.split('/').pop();
  if (TOKEN_FILES.has(base) || NOT_A_THEME.has(base)) continue;
  for (const m of strip(text).matchAll(/(--t-[a-z0-9-]+)\s*:\s*([^;]+);/g)) {
    errors.push(`${label}: declares ${m[1]}. Only palette.css (colour) and metrics.css (size, space, shape) may set a --t-* value.`);
  }
  for (const [selector, body, lead] of topLevelBlocks(text)) {
    if (/@override/.test(lead)) continue;
    for (const m of body.matchAll(/(--[a-z0-9-]+)\s*:\s*([^;]+);/g)) {
      const value = m[2].trim();
      if (COUNTED.test(value)) banned.push(`${label}: ${selector} ${m[1]}`);
      if (!picksAColour(value)) continue;
      const msg = `${label}: ${selector} sets ${m[1]} to a literal colour (${value.slice(0, 40)}). `
        + `Map it from the palette, or mark the block '@override <layout> — <why>'.`;
      (PENDING.has(base) ? pending : errors).push(msg);
    }
  }
}

if (banned.length) {
  console.warn(`theme:check — ${banned.length} color-mix() uses (informational; each needs a flat value outside its @supports block):`);
  const byFile = new Map();
  for (const b of banned) byFile.set(b.split(':')[0], (byFile.get(b.split(':')[0]) ?? 0) + 1);
  for (const [f, n] of byFile) console.warn(`  ${f}: ${n}`);
  console.warn('');
}

if (pending.length) {
  console.warn(`theme:check — ${pending.length} colour${pending.length > 1 ? 's' : ''} still picked outside palette.css in files not yet migrated:`);
  const byFile = new Map();
  for (const m of pending) {
    const f = m.split(':')[0];
    byFile.set(f, (byFile.get(f) ?? 0) + 1);
  }
  for (const [f, n] of byFile) console.warn(`  ${f}: ${n}`);
  console.warn('');
}

/* ---------------------------------------------------------------------------
 * Filled chips have to be readable
 *
 * A palette pairs a fill with a foreground — --t-info with --t-info-fg, and so
 * on. Nothing checked that the pair was legible, so it stayed true only for as
 * long as nobody moved a fill. Moving --t-info from a sky blue to a true blue
 * darkened it past the point where black text works, and shipped month chips
 * at 4.06:1 on the one card that names the months most likely to catch
 * somebody out. It was spotted by eye, which is the wrong instrument: this
 * audience includes partially sighted readers and the check is arithmetic.
 *
 * WCAG AA for normal text. Both inks, every variant, every pair.
 * ------------------------------------------------------------------------ */
const CHIP_PAIRS = [
  ['--t-info', '--t-info-fg'],
  ['--t-safe', '--t-safe-fg'],
  ['--t-warn', '--t-warn-fg'],
  ['--t-over', '--t-over-fg'],
  ['--t-primary', '--t-primary-fg'],
  ['--t-head', '--t-head-fg'],
  ['--t-invert', '--t-invert-fg']
];

function srgbToLinear(channel) {
  const c = channel / 255;
  return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
}

function luminance(hex) {
  const m = /^#([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return null;
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(m[1].slice(i, i + 2), 16));
  return 0.2126 * srgbToLinear(r) + 0.7152 * srgbToLinear(g) + 0.0722 * srgbToLinear(b);
}

function contrast(a, b) {
  const la = luminance(a);
  const lb = luminance(b);
  if (la === null || lb === null) return null;
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}

for (const [blockName, , body] of blocks) {
  if (!/\[data-palette=/.test(blockName)) continue;
  const values = new Map(
    [...body.matchAll(/(--t-[a-z0-9-]+)\s*:\s*(#[0-9a-fA-F]{6})/g)].map((m) => [m[1], m[2]])
  );
  for (const [fillKey, inkKey] of CHIP_PAIRS) {
    const fill = values.get(fillKey);
    const ink = values.get(inkKey);
    if (!fill || !ink) continue;
    const ratio = contrast(fill, ink);
    if (ratio === null) continue;
    if (ratio < 4.5) {
      errors.push(
        `${blockName}: ${fillKey} ${fill} on ${inkKey} ${ink} is ${ratio.toFixed(2)}:1 — `
        + 'below 4.5:1. Pick the other ink, or move the fill.'
      );
    }
  }
}

if (errors.length) {
  console.error(`theme:check failed — ${errors.length} problem${errors.length > 1 ? 's' : ''}\n`);
  for (const e of errors) console.error('  ' + e);
  process.exit(1);
}
console.log(`theme:check ok — ${CHOICES.length} colour choices \u00d7 ${named.size} variants, shape complete.`);
