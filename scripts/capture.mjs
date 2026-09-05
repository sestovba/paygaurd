/**
 * `npm run capture` — the same run the console's button starts, from a shell.
 *
 * The button is the point of the feature and this is how it gets tested,
 * how a whole-product sweep gets started without sitting through it, and how
 * a run happens at all on a machine where nobody has the app open.
 *
 * It needs the dev server up, because it photographs the dev server. It does
 * not start one: a script that launches a second Vite behind your back is a
 * script that captures a different port than the one you are looking at.
 */

import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { capture } from './capture/run.mjs';
import { findChrome } from './capture/chrome.mjs';

const root = process.cwd();
const args = process.argv.slice(2);

const flag = (name, fallback) => {
  const hit = args.find((arg) => arg.startsWith(`--${name}=`));
  return hit ? hit.slice(name.length + 3) : fallback;
};

/** Layout ids, taken from the folders that carry a README — the same registry
 *  the switcher and the console build their lists from, so this cannot drift. */
function allLayouts() {
  return readdirSync(resolve(root, 'src/components'), { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && existsSync(resolve(root, 'src/components', entry.name, 'README.md')))
    .map((entry) => entry.name)
    .sort();
}

const named = args.filter((arg) => !arg.startsWith('--'));
const layouts = named.length ? named : ['beautiful'];

const [w, h] = flag('device', '393x852').split('x').map(Number);
const origin = flag('origin', 'http://localhost:5173');

/* A run seeded with nothing photographs the onboarding screen nine times.
   `--seed=<file>` takes a JSON `{ data, ui }` — which is what the console
   posts, and what `review/captures/seed.json` is for when running by hand. */
const seedFile = flag('seed', 'review/captures/seed.json');
let seed = {};
if (existsSync(resolve(root, seedFile))) {
  try { seed = JSON.parse(readFileSync(resolve(root, seedFile), 'utf8')); } catch { seed = {}; }
}

if (!findChrome()) {
  console.error('No Chrome found. Install Google Chrome, or set PG_CHROME to a Chromium binary.');
  process.exit(1);
}

const reachable = await fetch(origin, { method: 'HEAD' }).then(() => true).catch(() => false);
if (!reachable) {
  console.error(`Nothing is answering at ${origin}. Start it with \`npm run dev\`, or pass --origin=…`);
  process.exit(1);
}

console.log(`Capturing ${layouts.join(', ')} at ${w}×${h} from ${origin}`);

const result = await capture({
  root,
  origin,
  device: { w, h, dpr: Number(flag('dpr', '2')) },
  layouts: layouts[0] === 'all' ? allLayouts() : layouts,
  seed,
  crawl: !args.includes('--no-crawl'),
  maxStates: Number(flag('max', '20')),
  depth: Number(flag('depth', '2')),
  motion: args.includes('--reduced-motion') ? 'reduce' : 'no-preference',
  onProgress: ({ layout, state, done, of }) => {
    process.stdout.write(`  ${layout} · ${done}/${of} · ${state}\n`);
  }
});

console.log(`\n${result.shots} screens → ${result.dir}`);
console.log(`  ${result.dir}/STATES.md   the index`);
console.log(`  ${result.dir}/MOTION.md   the animation ledger, written to paste into a chat`);
