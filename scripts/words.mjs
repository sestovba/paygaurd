#!/usr/bin/env node
/*
 * The banned words, checked instead of believed.
 *
 * `docs/DESIGN-SYSTEM.md` says the anti-vocabulary is "kept as data, not
 * prose, so it can be checked rather than believed". Until this file existed,
 * nothing checked it — the list was data that no one read. A content audit
 * found "TWP", "YTD", "hrs" and "W2" scattered across layouts months after the
 * rule banning them was written down.
 *
 *   npm run words           report every banned word in a user-visible string
 *   npm run words -- --check  same, but exit non-zero (for build / CI)
 *
 * It reads `NEVER` out of `src/domain/copy.ts`, so the list has exactly one
 * home and adding a word there starts enforcing it here.
 *
 * KNOWN LIMIT, and it matters: this reads source, and source is not the
 * screen. A string built by concatenation, formatted by `Intl`, or typed by
 * the user will not appear here. Twice in one session a grep said a surface
 * was clean and the running app disagreed. Treat a clean run as "nothing
 * obvious left in the source", never as "the screen is clean" — for that,
 * open the app and read the rendered text.
 */

import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = 'src';
const SELF = join('src', 'domain', 'copy.ts');       // defines the list
const EXEMPT = [SELF, join('src', 'review')];         // console is not user-facing

/* ── the list, read from its one home ─────────────────────────────────── */
const copy = readFileSync(SELF, 'utf8');
const block = copy.slice(copy.indexOf('export const NEVER'));
/* Two severities, and the difference is the whole usefulness of this file.
 *
 * HARD — jargon and abbreviations. Wrong in any sentence, anywhere. "TWP" does
 * not become acceptable by being in a paragraph.
 *
 * LABEL — ordinary English words banned as *labels*, because a bare "Amount"
 * or "Room" answers none of the four questions a label has to answer. The same
 * word inside a sentence that qualifies it ("type the amount before anything
 * was taken out") is correct, and flagging it would train people to ignore
 * this report. So label words are only reported on short strings — 5 words or
 * fewer, which is what a label is. */
const LABEL_ONLY = new Set(['Gross', 'Net', 'Countable', 'Earned', 'Amount', 'Room']);

const NEVER = [...block.slice(0, block.indexOf('\n];')).matchAll(
  /\{ word: '([^']+)', say: '([^']+)'/g
)].map(([, word, say]) => ({
  word,
  say,
  labelOnly: LABEL_ONLY.has(word),
  re: new RegExp(`(^|[^A-Za-z])${word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}($|[^A-Za-z])`, 'i')
}));

/* ── walk the source ──────────────────────────────────────────────────── */
function files(dir, out = []) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (EXEMPT.some((e) => p.startsWith(e))) continue;
    if (statSync(p).isDirectory()) files(p, out);
    else if (/\.tsx?$/.test(p)) out.push(p);
  }
  return out;
}

/* Strings a reader could actually see: quoted literals that read like prose,
 * and JSX text between tags. Deliberately excludes anything shaped like code —
 * a className, an import path, a css var, an object key, a data attribute. */
const CODEY = /^[a-z0-9_$-]+$|^[./#@]|--|^[A-Z_]+$|\s*[:;{}]\s*$/;

/* A class list is not copy. "pg-badge pg-badge-twp" and "flex items-center
 * gap-1.5 pg-text-twp" are CSS hooks — the reader never sees them, and having
 * them in the report is how a report gets ignored. Every token kebab-cased or
 * utility-shaped means it is markup, not a sentence. */
const CLASSLIST = (s) => s.split(/\s+/).every((t) => /^[a-z][a-z0-9]*(-[a-z0-9.]+)+$|^[a-z]+-\[/.test(t));

/* Strings on props that never reach the reader. The audit annotations that
 * live in the layouts are written FOR this project and name the rules by their
 * real names on purpose — that is correct in a note and wrong on a screen. */
const INTERNAL = /\b(reason|note|why|rationale|id|key|testId|data-[a-z-]+|className|aria-controls)\s*[:=]\s*$/;

function visibleStrings(src) {
  const out = [];
  const clean = src
    .replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ' '))
    .replace(/\/\/[^\n]*/g, '');
  const lines = clean.split('\n');
  lines.forEach((line, i) => {
    if (/^\s*(import|export \{)/.test(line)) return;
    for (const [, s] of line.matchAll(/'([^'\\]{3,})'|"([^"\\]{3,})"|`([^`$\\]{3,})`/g)) { /* noop */ }
    for (const m of line.matchAll(/'([^'\n\\]{2,})'|"([^"\n\\]{2,})"|`([^`\n$\\]{2,})`/g)) {
      const s = m[1] ?? m[2] ?? m[3];
      const before = line.slice(0, m.index);
      if (CODEY.test(s) || CLASSLIST(s) || INTERNAL.test(before)) continue;
      out.push({ line: i + 1, text: s });
    }
    for (const m of line.matchAll(/>([^<>{}\n]{2,})</g)) {
      const s = m[1].trim();
      if (s && !CODEY.test(s)) out.push({ line: i + 1, text: s });
    }
  });
  return out;
}

const hits = [];
for (const file of files(ROOT)) {
  const src = readFileSync(file, 'utf8');
  for (const { line, text } of visibleStrings(src)) {
    const words = text.trim().split(/\s+/).length;
    for (const n of NEVER) {
      if (n.labelOnly && words > 5) continue;
      if (n.re.test(text)) hits.push({ file, line, word: n.word, say: n.say, text, labelOnly: n.labelOnly });
    }
  }
}

/* ── report ───────────────────────────────────────────────────────────── */
const byWord = {};
for (const h of hits) (byWord[h.word] ??= []).push(h);

if (!hits.length) {
  console.log(`\n  ✓ ${NEVER.length} banned words, none found in a visible string.`);
} else {
  console.log(`\n  ${hits.length} in ${new Set(hits.map((h) => h.file)).size} files\n`);
  for (const [word, list] of Object.entries(byWord).sort((a, b) => b[1].length - a[1].length)) {
    const kind = list[0].labelOnly ? 'as a label' : 'anywhere';
    console.log(`  "${word}" → say "${list[0].say}"   (${list.length}, banned ${kind})`);
    for (const h of list) console.log(`      ${h.file}:${h.line}  ${h.text.slice(0, 62)}`);
    console.log('');
  }
}
console.log('  Source only. A clean run is not a clean screen — open the app.\n');
process.exit(process.argv.includes('--check') && hits.length ? 1 : 0);
