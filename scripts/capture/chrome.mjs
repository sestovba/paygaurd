/**
 * A browser the dev server can drive, in as little code as that can be done.
 *
 * There is no dependency here on purpose. Playwright is the obvious answer
 * and it is a 150MB download and a build dependency in a project whose whole
 * measured argument is leanness — and everything this needs is already on the
 * machine: Chrome is installed, and Node has had a global `WebSocket` since
 * v21, so the DevTools protocol is reachable with no client library at all.
 * What is left is a spawn, a socket, and a promise per request.
 *
 * Why a second browser rather than the reviewer's own tab: the crawl clicks
 * things. In this app clicking things opens sheets, adds jobs and writes to
 * `pg-data-v1` — so a crawl in the live tab would edit the record it was
 * meant to photograph. This one is thrown away afterwards, and gets the
 * reviewer's data by being handed a copy of it.
 */

import { spawn } from 'node:child_process';
import { existsSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

/** Where Chrome is, in the order worth looking. `PG_CHROME` wins, so a
 *  machine with it somewhere unusual needs no code change. */
const CANDIDATES = [
  process.env.PG_CHROME,
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/Applications/Chromium.app/Contents/MacOS/Chromium',
  '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',
  '/usr/bin/google-chrome',
  '/usr/bin/chromium',
  '/usr/bin/chromium-browser'
].filter(Boolean);

export function findChrome() {
  return CANDIDATES.find((path) => existsSync(path)) ?? null;
}

/**
 * Launch, and hand back a page session.
 *
 * `--hide-scrollbars` is not cosmetic: a scrollbar drawn down the right of
 * every screenshot is 15px of chrome in an image meant to be about the app,
 * and on a phone frame it is 4% of the width.
 */
export async function launch({ headless = true, timeout = 20_000 } = {}) {
  const bin = findChrome();
  if (!bin) {
    throw new Error(
      'No Chrome found. Install Google Chrome, or point PG_CHROME at a Chromium binary.'
    );
  }

  const profile = mkdtempSync(join(tmpdir(), 'pg-capture-'));
  const child = spawn(bin, [
    ...(headless ? ['--headless=new'] : []),
    '--remote-debugging-port=0',
    `--user-data-dir=${profile}`,
    '--hide-scrollbars',
    '--mute-audio',
    '--no-first-run',
    '--no-default-browser-check',
    '--disable-extensions',
    '--disable-background-timer-throttling',
    '--disable-renderer-backgrounding',
    '--disable-backgrounding-occluded-windows',
    // The capture is of a dev server on localhost with a self-signed nothing;
    // a certificate interstitial in place of the app is not a finding.
    '--allow-insecure-localhost',
    'about:blank'
  ], { stdio: ['ignore', 'pipe', 'pipe'] });

  const endpoint = await new Promise((resolve, reject) => {
    let out = '';
    const timer = setTimeout(() => reject(new Error('Chrome did not report a debugging port')), timeout);
    const onData = (chunk) => {
      out += String(chunk);
      const hit = /DevTools listening on (ws:\/\/\S+)/.exec(out);
      if (!hit) return;
      clearTimeout(timer);
      child.stderr.off('data', onData);
      resolve(hit[1]);
    };
    child.stderr.on('data', onData);
    child.once('error', (error) => { clearTimeout(timer); reject(error); });
    child.once('exit', (code) => { clearTimeout(timer); reject(new Error(`Chrome exited (${code})`)); });
  });

  const browser = await connect(endpoint);

  const { targetId } = await browser.send('Target.createTarget', { url: 'about:blank' });
  const { sessionId } = await browser.send('Target.attachToTarget', { targetId, flatten: true });

  const page = {
    /** Every call is scoped to the one page; nothing here ever wants the
     *  browser-level session, so the sessionId is not a parameter. */
    send: (method, params) => browser.send(method, params, sessionId),
    on: (event, fn) => browser.on(event, fn, sessionId),
    once: (event, timeoutMs) => browser.once(event, sessionId, timeoutMs),
    async close() {
      try { await browser.send('Browser.close'); } catch { /* already going */ }
      browser.socket.close();
      // SIGKILL rather than a graceful wait: `Browser.close` has already been
      // asked for, and a capture run that hangs on a dead child is worse than
      // an orphaned temp profile.
      try { child.kill('SIGKILL'); } catch { /* gone */ }
      try { rmSync(profile, { recursive: true, force: true }); } catch { /* gone */ }
    }
  };

  return page;
}

/** The protocol itself: an id per request, a promise per id, events fanned
 *  out to whoever asked for them. Sixty lines, and it is the whole client. */
function connect(endpoint) {
  return new Promise((resolve, reject) => {
    const socket = new WebSocket(endpoint);
    const pending = new Map();
    const listeners = new Set();
    let nextId = 0;

    socket.addEventListener('message', (event) => {
      let message;
      try { message = JSON.parse(event.data); } catch { return; }

      if (message.id !== undefined) {
        const settle = pending.get(message.id);
        if (!settle) return;
        pending.delete(message.id);
        if (message.error) settle.reject(new Error(`${message.error.message} (${settle.method})`));
        else settle.resolve(message.result ?? {});
        return;
      }

      for (const listener of [...listeners]) {
        if (listener.event !== message.method) continue;
        if (listener.sessionId && listener.sessionId !== message.sessionId) continue;
        listener.fn(message.params ?? {});
      }
    });

    socket.addEventListener('error', () => reject(new Error('Could not reach the browser')));
    socket.addEventListener('close', () => {
      for (const settle of pending.values()) settle.reject(new Error('Browser went away'));
      pending.clear();
    });

    socket.addEventListener('open', () => resolve({
      socket,
      send(method, params = {}, sessionId) {
        const id = (nextId += 1);
        return new Promise((res, rej) => {
          pending.set(id, { resolve: res, reject: rej, method });
          socket.send(JSON.stringify(sessionId ? { id, method, params, sessionId } : { id, method, params }));
        });
      },
      on(event, fn, sessionId) {
        const listener = { event, fn, sessionId };
        listeners.add(listener);
        return () => listeners.delete(listener);
      },
      /** One event, with a deadline. Used for load, where waiting forever on
       *  a page that failed to come up is the same as hanging. */
      once(event, sessionId, timeoutMs = 15_000) {
        return new Promise((res) => {
          const timer = setTimeout(() => { off(); res(null); }, timeoutMs);
          const listener = {
            event,
            sessionId,
            fn: (params) => { clearTimeout(timer); off(); res(params); }
          };
          const off = () => listeners.delete(listener);
          listeners.add(listener);
        });
      }
    }));
  });
}
