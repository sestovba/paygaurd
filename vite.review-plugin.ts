import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import type { Plugin } from 'vite';
import { notesToMarkdown } from './src/review/markdown';
import type { ReviewNote, ReviewNotes } from './src/review/types';

/**
 * React's dev source positions count lines in the *transformed* module, so
 * they sit ~19 lines below the truth. The file itself is right here, so pin
 * the note to a line that actually exists: the review id, then a scrap of the
 * text the reviewer saw, then a class hook.
 */
function resolveSource(root: string, note: ReviewNote): string | undefined {
  const source = note.anchor.source;
  if (!source) return undefined;
  const [file] = source.split(':');
  let lines: string[];
  try {
    lines = readFileSync(resolve(root, file), 'utf8').split('\n');
  } catch {
    return source;
  }

  const at = (index: number) => `${file}:${index + 1}`;

  const byId = lines.findIndex((line) => line.includes(`id="${note.id}"`));
  if (byId >= 0) return at(byId);

  const words = (note.anchor.text ?? '').split(' ').filter(Boolean);
  for (let take = Math.min(6, words.length); take >= 2; take -= 1) {
    const needle = words.slice(0, take).join(' ').toLowerCase();
    const hit = lines.findIndex((line) => line.toLowerCase().includes(needle));
    if (hit >= 0) return at(hit);
  }

  for (const hook of (note.anchor.hooks ?? '').split(' ').filter(Boolean)) {
    const hit = lines.findIndex((line) => line.includes(hook));
    if (hit >= 0) return at(hit);
  }

  return `${file} (near line ${source.split(':')[1] ?? '?'}, unverified)`;
}

function withResolvedSources(root: string, notes: ReviewNotes): ReviewNotes {
  const out: ReviewNotes = {};
  for (const [id, note] of Object.entries(notes)) {
    out[id] = { ...note, anchor: { ...note.anchor, source: resolveSource(root, note) } };
  }
  return out;
}

const JSON_PATH = 'review/review-notes.json';
const MD_PATH = 'review/REVIEW-NOTES.md';

/**
 * Dev-only bridge for the in-app review console: the browser POSTs its notes
 * here and this writes them into the repo, so marking a section for deletion
 * or leaving a comment lands in a file the next AI pass can just read.
 */
export function reviewNotes(): Plugin {
  return {
    name: 'paycheck-guard:review-notes',
    apply: 'serve',
    config(userConfig) {
      // Notes are written while the app is open; watching them would reload
      // the page out from under the review. Absolute, so it cannot also
      // silence src/review/, which is ordinary source and must hot-reload.
      const root = userConfig.root ?? process.cwd();
      return { server: { watch: { ignored: [resolve(root, 'review', '**')] } } };
    },
    configureServer(server) {
      const jsonFile = resolve(server.config.root, JSON_PATH);
      const mdFile = resolve(server.config.root, MD_PATH);

      server.middlewares.use('/__review/notes', (req, res) => {
        if (req.method === 'GET') {
          let body = '{}';
          try {
            body = readFileSync(jsonFile, 'utf8');
          } catch {
            // No notes written yet.
          }
          res.setHeader('content-type', 'application/json');
          res.end(body);
          return;
        }

        if (req.method !== 'POST') {
          res.statusCode = 405;
          res.end();
          return;
        }

        const chunks: Buffer[] = [];
        req.on('data', (chunk: Buffer) => chunks.push(chunk));
        req.on('end', () => {
          try {
            const raw = JSON.parse(Buffer.concat(chunks).toString('utf8')) as ReviewNotes;
            const notes = withResolvedSources(server.config.root, raw);
            const json = `${JSON.stringify(notes, null, 2)}\n`;
            let previous = '';
            try {
              previous = readFileSync(jsonFile, 'utf8');
            } catch {
              // First note.
            }
            if (json !== previous) {
              mkdirSync(dirname(jsonFile), { recursive: true });
              writeFileSync(jsonFile, json);
              writeFileSync(mdFile, notesToMarkdown(notes));
            }
            res.setHeader('content-type', 'application/json');
            res.end(JSON.stringify({ ok: true, count: Object.keys(notes).length, file: MD_PATH }));
          } catch (error) {
            res.statusCode = 400;
            res.end(JSON.stringify({ ok: false, error: String(error) }));
          }
        });
      });
    }
  };
}
