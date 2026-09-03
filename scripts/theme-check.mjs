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
 *   1. Every variant answers every choice `paper` answers — same names,
 *      same order. No inheritance, no omissions.
 *   2. Nothing outside palette.css declares a --t-* value.
 *   3. The layout stylesheets that map --t-* onto their own names contain
 *      aliases only — `--pg-x: var(--t-x)` — never a literal colour, which
 *      is how a second source of truth starts.
 *
 * Run by `npm run theme:check`, and by `npm run build` before vite.
 */
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const STYLES = 'src/styles';
const PALETTE = join(STYLES, 'palette.css');
const strip = (s) => s.replace(/\/\*[\s\S]*?\*\//g, '');

/* Shape, and the three chrome tokens a variant may speak about outside its
 * choices — see the DERIVED note in palette.css. Everything else a variant
 * sets has to exist on `paper` first, or it is a colour only one variant
 * has and the next person cannot find. */
const OVERRIDABLE = new Set([
  'radius-xl', 'radius', 'radius-md', 'radius-sm', 'radius-xs',
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
 * Top-level rule blocks as [selector, body, preceding-comment].
 *
 * Runs over the ORIGINAL text, not the stripped copy, because the marker
 * lives in the comment — stripping first is what would make every block look
 * unmarked. Nested at-rules (@media, @supports) are walked into so a block
 * inside one is still checked.
 */
function topLevelBlocks(src) {
  const out = [];
  let i = 0;
  while (i < src.length) {
    const open = src.indexOf('{', i);
    if (open === -1) break;
    let depth = 1, j = open + 1;
    while (j < src.length && depth > 0) {
      if (src[j] === '{') depth++;
      else if (src[j] === '}') depth--;
      j++;
    }
    const head = src.slice(i, open);
    const selector = head.replace(/\/\*[\s\S]*?\*\//g, '').trim().replace(/\s+/g, ' ');
    const body = src.slice(open + 1, j - 1);
    const comments = head.match(/\/\*[\s\S]*?\*\//g) ?? [];
    if (/^@(media|supports|layer|container)/.test(selector)) {
      out.push(...topLevelBlocks(body));
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
 * 4 — index.html's SINGLE_INK list must match the palettes that declare
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
 * 2 + 3 — no second source of truth.
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

/** color-mix() is on the banned list at the top of CLAUDE.md — an old Android
 *  WebView drops the whole declaration, so a soft fill silently becomes
 *  transparent. Reported, not fatal: it predates the palette and the palette
 *  now supplies real values for most of what used to need it. */
const BANNED = /color-mix\(/;

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
  if (base === 'palette.css' || NOT_A_THEME.has(base)) continue;
  for (const m of strip(text).matchAll(/(--t-[a-z0-9-]+)\s*:\s*([^;]+);/g)) {
    errors.push(`${label}: declares ${m[1]}. Only palette.css may set a --t-* value.`);
  }
  for (const [selector, body, lead] of topLevelBlocks(text)) {
    if (/@override/.test(lead)) continue;
    for (const m of body.matchAll(/(--[a-z0-9-]+)\s*:\s*([^;]+);/g)) {
      const value = m[2].trim();
      if (BANNED.test(value)) banned.push(`${label}: ${selector} ${m[1]}`);
      if (!picksAColour(value)) continue;
      const msg = `${label}: ${selector} sets ${m[1]} to a literal colour (${value.slice(0, 40)}). `
        + `Map it from the palette, or mark the block '@override <layout> — <why>'.`;
      (PENDING.has(base) ? pending : errors).push(msg);
    }
  }
}

if (banned.length) {
  console.warn(`theme:check — ${banned.length} color-mix() uses left (banned for old WebViews; the palette supplies real values for most of these now):`);
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

if (errors.length) {
  console.error(`theme:check failed — ${errors.length} problem${errors.length > 1 ? 's' : ''}\n`);
  for (const e of errors) console.error('  ' + e);
  process.exit(1);
}
console.log(`theme:check ok — ${CHOICES.length} choices, ${named.size} variants, all complete.`);
