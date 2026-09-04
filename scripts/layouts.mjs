#!/usr/bin/env node
/*
 * Which layout has what — derived from the code, not from a list.
 *
 * Written because "compare these two layouts" kept turning into a fresh audit:
 * read eight folders, follow the shared imports, remember which of them draws a
 * chart. That is a lookup, and a lookup should take a second.
 *
 *   npm run layouts                 the whole matrix, scored
 *   npm run layouts -- plan pocket  just those two, and what differs
 *   npm run layouts -- --json       for anything that wants to read it
 *
 * The detection is a pattern match over each layout's own files PLUS the shared
 * components it imports, so a layout is credited with what it actually renders
 * rather than with what happens to live in its folder. That matters: scanning
 * only the root file finds almost nothing, because the features live in
 * children.
 *
 * Tiers are a judgement and the only subjective part of this file. The matrix
 * is not — if a row here is wrong, the regex is wrong, and it is one line.
 */

import { readdirSync, readFileSync, existsSync, statSync } from 'node:fs';
import { join } from 'node:path';

const COMPONENTS = 'src/components';
const STYLES = 'src/styles';

const LAYOUTS = ['overview', 'ledger', 'payguard', 'workrecord', 'calc20', 'horizon', 'pocket', 'charm', 'plan', 'beautiful'];

/** feature → [pattern, tier]. P primary · S secondary · N nice · B bonus. */
const FEATURES = {
  'Which limit applies':        [/trialWorkStatus|benefitPhase/, 'P'],
  'Mileage comes off':          [/mileageDeduction/, 'P'],
  'The 80-hour cliff':          [/TWP_SELF_EMPLOYMENT_HOURS/, 'P'],
  'Net → before-tax':           [/grossFromNet|PayAmount/, 'P'],
  'Answers in hours':           [/capacityFor/, 'P'],
  'Record a month':             [/updateMonthEntry/, 'P'],
  'Extra-paycheck warning':     [/extraPaycheckMonths|paycheckContext/, 'P'],
  'How sure this is':           [/precisionFor|PrecisionLine/, 'P'],
  'Months that need you':       [/actionItems|attentionFlags/, 'S'],
  'Work-hours simulator':       [/SafeWorkSimulator/, 'S'],
  'Per-job editor':             [/JobEditor|StreamSheet|StreamSettingsSheet/, 'S'],
  'Status quiz':                [/TwpWizard|TwpStatusForm|TwpStatusControl|TwpStatusPicker/, 'S'],
  'Twelve-month view':          [/MonthGrid|TotalsByMonth|MonthSquares|monthsOfYear/, 'S'],
  'Month scope picker':         [/MonthScopePicker/, 'S'],
  'Year navigation':            [/year \+ 1|year - 1|setUi\(\{ year/, 'S'],
  'Individual paychecks':       [/addPaycheck/, 'N'],
  'Notifications':              [/NotificationsBell/, 'N'],
  'Chart':                      [/Chart/, 'N'],
  'Lock a job':                 [/locked/, 'N'],
  'Undo':                       [/undoCount/, 'N'],
  'Work expenses':              [/setIrwe|irweFor/, 'B'],
  'Duplicate a job':            [/duplicate/, 'B'],
  'Expression input':           [/evalAmount|NumericExprInput/, 'B'],
  'Density controls':           [/glassStrength|density/, 'B']
};

const WEIGHT = { P: 10, S: 5, N: 2, B: 1 };
const TIER_NAME = { P: 'Primary (10)', S: 'Secondary (5)', N: 'Nice to have (2)', B: 'Bonus (1)' };

/** A layout's own files, plus one hop of shared components it imports. */
function sourcesFor(layout) {
  const dir = join(COMPONENTS, layout);
  if (!existsSync(dir)) return [];
  const own = readdirSync(dir).filter((f) => f.endsWith('.tsx') || f.endsWith('.ts')).map((f) => join(dir, f));
  const all = new Set(own);
  for (const file of own) {
    const src = readFileSync(file, 'utf8');
    for (const [, name] of src.matchAll(/from '\.\.\/([A-Za-z0-9]+)'/g)) {
      const shared = join(COMPONENTS, `${name}.tsx`);
      if (existsSync(shared)) all.add(shared);
    }
  }
  return [...all];
}

function linesOf(layout) {
  let n = 0;
  for (const f of sourcesFor(layout).filter((f) => f.startsWith(join(COMPONENTS, layout)))) {
    n += readFileSync(f, 'utf8').split('\n').length;
  }
  const css = join(STYLES, `${layout}.css`);
  if (existsSync(css)) n += readFileSync(css, 'utf8').split('\n').length;
  return n;
}

function scan(layout) {
  const blob = sourcesFor(layout).map((f) => readFileSync(f, 'utf8')).join('\n');
  const has = {};
  for (const [name, [re]] of Object.entries(FEATURES)) has[name] = re.test(blob);
  return has;
}

const data = {};
for (const l of LAYOUTS) {
  const has = scan(l);
  const lines = linesOf(l);
  const points = Object.entries(has).reduce((s, [n, y]) => s + (y ? WEIGHT[FEATURES[n][1]] : 0), 0);
  const primaries = Object.entries(has).filter(([n, y]) => y && FEATURES[n][1] === 'P').length;
  data[l] = { has, lines, points, primaries, per1k: +(points / (lines / 1000)).toFixed(1) };
}

const args = process.argv.slice(2);

if (args.includes('--json')) {
  console.log(JSON.stringify({ features: Object.fromEntries(Object.entries(FEATURES).map(([k, v]) => [k, v[1]])), layouts: data }, null, 2));
  process.exit(0);
}

const pair = args.filter((a) => LAYOUTS.includes(a));

if (pair.length >= 2) {
  const [a, b] = pair;
  console.log(`\n  ${a}  vs  ${b}\n`);
  const rows = Object.keys(FEATURES).filter((n) => data[a].has[n] !== data[b].has[n]);
  const same = Object.keys(FEATURES).filter((n) => data[a].has[n] && data[b].has[n]);
  console.log(`  DIFFERENT (${rows.length})`);
  for (const n of rows) {
    const who = data[a].has[n] ? a : b;
    console.log(`    ${FEATURES[n][1]}  ${n.padEnd(26)} only ${who}`);
  }
  console.log(`\n  BOTH (${same.length})  ${same.join(' · ')}`);
  console.log('');
  for (const l of [a, b]) {
    console.log(`  ${l.padEnd(11)} ${String(data[l].points).padStart(3)} pts   ${data[l].primaries}/8 primary   ${String(data[l].per1k).padStart(5)}/1k   ${data[l].lines} lines`);
  }
  console.log('');
  process.exit(0);
}

/* full matrix */
const head = 'FEATURE'.padEnd(26) + LAYOUTS.map((l) => l.slice(0, 4).toUpperCase().padEnd(6)).join('');
console.log('\n  ' + head);
console.log('  ' + '─'.repeat(head.length));
let tier = '';
for (const [name, [, t]] of Object.entries(FEATURES)) {
  if (t !== tier) { tier = t; console.log(`\n  ${TIER_NAME[t]}`); }
  console.log('  ' + name.padEnd(26) + LAYOUTS.map((l) => (data[l].has[name] ? '  ●   ' : '  ·   ')).join(''));
}
console.log('\n  ' + 'SCORE'.padEnd(26) + LAYOUTS.map((l) => String(data[l].points).padEnd(6)).join(''));
console.log('  ' + 'PRIMARIES (of 8)'.padEnd(26) + LAYOUTS.map((l) => `${data[l].primaries}/8`.padEnd(6)).join(''));
console.log('  ' + 'PER 1K LINES'.padEnd(26) + LAYOUTS.map((l) => String(data[l].per1k).padEnd(6)).join(''));
console.log('\n  Breadth, not fitness — see each layout\'s README for what it is FOR.');
console.log('  pocket is last on points and is the heart of the product.\n');
