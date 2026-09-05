/**
 * A capture run: the layouts, the states, the pictures and the ledger.
 *
 * One run answers one question — "what does this actually look like, in every
 * state I can reach from the front door" — and leaves the answer on disk in a
 * form the next session can read without being told anything.
 *
 * Reproducibility is the design constraint. Every state is reached by
 * replaying a path of clicks from a fresh load, never by accumulating clicks
 * in one long session, because a state nobody can get back to is a screenshot
 * with no address. It costs a page load per state and buys a report where
 * every image is labelled with the presses that produce it.
 */

import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { launch } from './chrome.mjs';
import { call, clickables, contentBottom, motionCss, motionState, press, refurl, settle, unfurl } from './page.mjs';
import { motionMarkdown, statesMarkdown } from './report.mjs';

/** The durations metrics.css actually offers. A number outside this set was
 *  decided in a layout stylesheet, which is the thing being looked for. */
const TOKEN_MS = [0, 150, 250, 400];

/** Chrome will not photograph a page taller than this, and a layout that
 *  reaches it has a scroll container that did not want to be opened. */
const MAX_SHOT = 16_000;

const slug = (text) => String(text).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 32) || 'x';

/* ------------------------------------------------------------------ */

/**
 * Put the reviewer's own record into the throwaway browser.
 *
 * Without this the capture is of an empty app: a fresh profile has no
 * `pg-data-v1`, `hasMeaningfulData` is false, and every screenshot is the
 * onboarding screen. The console posts a copy of what it is looking at and it
 * is re-applied on every document, so a navigation inside the app cannot lose
 * it.
 */
async function seedWith(page, seed, layout) {
  const ui = { ...(seed.ui ?? {}), layout };
  const script = `
    try {
      localStorage.setItem('pg-data-v1', ${JSON.stringify(JSON.stringify(seed.data ?? {}))});
      localStorage.setItem('pg-ui-v1', ${JSON.stringify(JSON.stringify(ui))});
    } catch (error) { /* private mode; the run continues on defaults */ }
  `;
  if (page.__seed) await page.send('Page.removeScriptToEvaluateOnNewDocument', { identifier: page.__seed });
  const { identifier } = await page.send('Page.addScriptToEvaluateOnNewDocument', { source: script });
  page.__seed = identifier;
}

/** Load the app fresh and wait until it has stopped moving. */
async function visit(page, url, settleMs) {
  await page.send('Page.navigate', { url });
  await page.once('Page.loadEventFired', undefined, 20_000);
  await call(page, settle, { quietMs: 90, capMs: settleMs });
}

/**
 * One PNG.
 *
 * `fold` is the device viewport exactly as it is — what a phone shows first,
 * which is the honest picture. `full` unfurls the app shell so the whole
 * layout is in one image, which is the readable picture and is measured
 * against a viewport height no device has. Both, always, because they answer
 * different questions and a run that offered only one would quietly answer
 * the wrong one.
 */
async function shoot(page, dir, name, device, { full }) {
  /* An explicit clip, because the default is not deterministic: the first run
   * produced 1140px-wide images from a 393px device because the capture took
   * its scale from the browser window rather than the emulation. Naming the
   * rectangle means the file is exactly the device, every time.
   *
   * `scale: 1`, and it has to be: the emulation's `deviceScaleFactor` has
   * already applied the density, and clip.scale multiplies on top of it. The
   * two together turned a 393px phone at 2× into 1572px files. */
  const write = async (suffix, height) => {
    const { data } = await page.send('Page.captureScreenshot', {
      format: 'png',
      captureBeyondViewport: true,
      clip: { x: 0, y: 0, width: device.w, height, scale: 1 }
    });
    const file = `${name}-${suffix}.png`;
    writeFileSync(resolve(dir, file), Buffer.from(data, 'base64'));
    return file;
  };

  const metrics = (height) => page.send('Emulation.setDeviceMetricsOverride', {
    width: device.w, height, deviceScaleFactor: device.dpr, mobile: device.w < 640
  });

  const out = { fold: await write('fold', device.h) };

  if (full) {
    await call(page, unfurl);
    /* Two passes. The first opens the shell and gives a height to reflow
     * against; the second asks how far the content actually reaches once it
     * has. One pass over-reports, because a container that has been let go of
     * its height still carries a min-height — which is a third of an image
     * of nothing. */
    let height = Math.min(Math.max(await call(page, contentBottom), device.h), MAX_SHOT);
    if (height > device.h + 8) {
      await metrics(height);
      await call(page, settle, { quietMs: 60, capMs: 900 });
      height = Math.min(Math.max(await call(page, contentBottom), device.h), MAX_SHOT);
      await metrics(height);
      await call(page, settle, { quietMs: 40, capMs: 400 });
      out.full = await write('full', height);
      out.fullHeight = height;
      await metrics(device.h);
    }
    await call(page, refurl);
  }

  return out;
}

/**
 * What a click changed, of the things that were able to change.
 *
 * The first run of this listed forty elements that had "appeared" after every
 * press, which was true and useless: pressing a wizard button replaces the
 * whole screen, so everything on the new one is new. That is a navigation,
 * not an animation, and burying the one row that actually transitioned under
 * thirty-nine that merely arrived is the opposite of the point.
 *
 * So a wholesale swap is named as a swap and counted, and what gets listed is
 * the motion: elements that were there before and after and are drawn
 * differently now. A reveal — a sheet, a menu, a row that became a field —
 * still lists what appeared, because there the arrival IS the interaction.
 */
function motionDiff(before, after) {
  const was = new Map(before.map((entry) => [entry.handle, entry]));
  const now = new Set(after.map((entry) => entry.handle));

  const moved = [];
  const appeared = new Map();

  for (const entry of after) {
    const then = was.get(entry.handle);
    if (!then) {
      const key = entry.cls ?? entry.name;
      appeared.set(key, (appeared.get(key) ?? 0) + 1);
      continue;
    }
    const props = Object.keys(entry.draw).filter((key) => entry.draw[key] !== then.draw[key]);
    if (!props.length) continue;
    moved.push({
      name: entry.cls ?? entry.name,
      what: props.map((key) => `${key}: ${then.draw[key] ?? 'unset'} → ${entry.draw[key] ?? 'unset'}`),
      transition: entry.transition,
      animation: entry.animation
    });
  }

  const left = before.filter((entry) => !now.has(entry.handle)).length;
  const arrived = [...appeared.values()].reduce((sum, n) => sum + n, 0);
  /* More than half of both sides replaced is a different screen, not a
     changed one. Below that it is a reveal, and worth listing. */
  const swap = before.length > 4 && left > before.length * 0.5 && arrived > after.length * 0.5;

  return {
    swap: swap || undefined,
    left: left || undefined,
    moved: moved.slice(0, 16),
    appeared: swap ? undefined : [...appeared].map(([cls, n]) => ({ cls, n })).slice(0, 12)
  };
}

/* ------------------------------------------------------------------ */

/**
 * @param {object} options
 * @param {string} options.root       repo root — where `review/captures` goes
 * @param {string} options.origin     the dev server, e.g. http://localhost:5173
 * @param {object} options.device     { w, h, dpr }
 * @param {string[]} options.layouts  layout ids to walk
 * @param {object} options.seed       { data, ui } — the reviewer's own record
 * @param {boolean} options.crawl     press things, or only photograph the front door
 * @param {number} options.maxStates  ceiling per layout
 * @param {number} options.depth      1 = one press from the front door; 2 also
 *                                    presses what that press revealed
 */
export async function capture({
  root,
  origin,
  device = { w: 393, h: 852, dpr: 2 },
  layouts = ['beautiful'],
  seed = {},
  crawl = true,
  maxStates = 20,
  depth = 2,
  settleMs = 2500,
  /** 'no-preference' (the default) or 'reduce' — see setEmulatedMedia below. */
  motion = 'no-preference',
  onProgress = () => {}
}) {
  const runId = `${new Date().toISOString().slice(0, 16).replace(/[:T]/g, '-')}-${device.w}w`;
  const dir = resolve(root, 'review/captures', runId);
  mkdirSync(dir, { recursive: true });

  const page = await launch({});
  const report = {
    id: runId,
    at: new Date().toISOString(),
    device,
    motion,
    theme: seed.ui?.theme === 'dark' ? 'dark' : 'light',
    layouts: [],
    motionCss: null
  };

  try {
    await page.send('Page.enable');
    await page.send('Runtime.enable');
    await page.send('Emulation.setDeviceMetricsOverride', {
      width: device.w, height: device.h, deviceScaleFactor: device.dpr, mobile: device.w < 640
    });

    /* Pin the media state rather than inheriting whatever the machine running
     * the capture happens to prefer.
     *
     * `prefers-reduced-motion` is the one that matters and it is not a
     * theoretical worry: metrics.css ends with a global safeguard that clamps
     * every duration in the app to 0.01ms under `reduce`, so a run that
     * inherits that setting reports "nothing animates" about an app full of
     * animation — a false finding, in the one report whose whole subject is
     * motion. A capture that wants the reduced-motion behaviour should ask
     * for it out loud, which is what `motion: 'reduce'` does.
     *
     * The colour scheme is pinned for the same reason: the seed says which
     * theme this record is in, and a dark screenshot of a light preference is
     * a picture of neither. */
    await page.send('Emulation.setEmulatedMedia', {
      features: [
        { name: 'prefers-reduced-motion', value: motion === 'reduce' ? 'reduce' : 'no-preference' },
        { name: 'prefers-color-scheme', value: seed.ui?.theme === 'dark' ? 'dark' : 'light' }
      ]
    });

    const url = `${origin}/?frame=1`;

    for (const layout of layouts) {
      const here = resolve(dir, layout);
      mkdirSync(here, { recursive: true });
      await seedWith(page, seed, layout);

      onProgress({ layout, state: 'the front door', done: 0, of: maxStates });
      await visit(page, url, settleMs);

      const states = [];
      const base = await shoot(page, here, '00-front-door', device, { full: true });
      states.push({ name: 'The front door', path: [], presses: [], files: base });

      // The CSS inventory is per-layout because the stylesheets in effect are
      // per-layout: one chunk per layout is the whole point of the split.
      if (!report.motionCss) report.motionCss = await call(page, motionCss, TOKEN_MS);

      if (crawl) {
        const found = await call(page, clickables, maxStates * 2);
        const baseHandles = new Set(found.map((entry) => entry.handle));
        /** Each item is the list of presses that reaches the state. */
        const queue = found.slice(0, maxStates).map((entry) => [entry]);

        let n = 0;
        while (queue.length && states.length <= maxStates) {
          const path = queue.shift();
          const last = path[path.length - 1];
          n += 1;
          onProgress({ layout, state: last.label, done: states.length, of: maxStates + 1 });

          await visit(page, url, settleMs);
          // Everything but the last press is replay: getting back to where
          // this state was found. Only the last one is being measured.
          let reached = true;
          for (const step of path.slice(0, -1)) {
            const done = await call(page, press, step.handle);
            if (!done.ok) { reached = false; break; }
            await call(page, settle, { quietMs: 80, capMs: 1200 });
          }
          if (!reached) continue;

          const before = await call(page, motionState, 300);
          const done = await call(page, press, last.handle);
          if (!done.ok) continue;

          await call(page, settle, { quietMs: 80, capMs: 1600 });
          const after = await call(page, motionState, 300);

          const name = `${String(n).padStart(2, '0')}-${slug(last.label)}`;
          const files = await shoot(page, here, name, device, { full: true });

          states.push({
            name: last.label,
            presses: path.map((step) => step.label),
            control: `${last.tag}${last.role ? `[role=${last.role}]` : ''}`,
            files,
            inFlight: done.inFlight,
            changed: motionDiff(before, after)
          });

          /* Anything that was not on the screen before this press is what the
             press revealed — a sheet, a menu, a row that turned into a field.
             That is the only thing worth going a level deeper into; pressing
             the same nav bar again from every state would be a combinatorial
             walk over one screen. */
          if (path.length < depth) {
            const now = await call(page, clickables, 40);
            for (const entry of now) {
              if (baseHandles.has(entry.handle)) continue;
              if (queue.length + states.length > maxStates) break;
              queue.push([...path, entry]);
            }
          }
        }
      }

      report.layouts.push({ id: layout, states });
    }
  } finally {
    await page.close();
  }

  /* The JSON is the record and the two documents are the read. Written here
     rather than by a separate step because a run whose report is generated
     later is a run that can exist without one. */
  writeFileSync(resolve(dir, 'capture.json'), `${JSON.stringify(report, null, 2)}\n`);
  writeFileSync(resolve(dir, 'STATES.md'), statesMarkdown(report));
  writeFileSync(resolve(dir, 'MOTION.md'), motionMarkdown(report));

  return {
    dir: `review/captures/${runId}`,
    shots: report.layouts.reduce((sum, layout) => sum + layout.states.length, 0),
    report
  };
}
