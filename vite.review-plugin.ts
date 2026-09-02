import { mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import type { Plugin } from 'vite';
import { notesToMarkdown } from './src/review/markdown';
import type { ReviewNote, ReviewNotes } from './src/review/types';

/**
 * React's dev source positions count lines in the *transformed* module, so
 * they sit ~19 lines below the truth. The file itself is right here, so pin
 * the note to a line that actually exists: the review id, then a scrap of the
 * text the reviewer saw, then a class hook.
 *
 * Returns the line's *text* alongside its number, because a number alone
 * rots. `sourceLine` is what lets the next pass tell "this moved" from "this
 * is gone", and it is captured here rather than in the browser for the reason
 * this function exists at all: the browser only knows the transformed line,
 * and the file is sitting right here.
 */
function resolveSource(root: string, note: ReviewNote): { source: string; line?: string } {
  const source = note.anchor.source;
  if (!source) return { source: '' };
  const [file] = source.split(':');
  let lines: string[];
  try {
    lines = readFileSync(resolve(root, file), 'utf8').split('\n');
  } catch {
    return { source };
  }

  const at = (index: number) => ({
    source: `${file}:${index + 1}`,
    line: lines[index]?.trim() || undefined
  });

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

  /* The component the element came out of, which the fiber walk already
   * recorded and nothing was reading.
   *
   * It is the handle that works when the visible text is a prop rather than a
   * literal — a segmented control whose label says "Ended" is declared in
   * ui.tsx, which contains that word nowhere. Innermost first: `components`
   * is built walking up from the element, so the first name is the closest
   * thing to it. */
  for (const name of (note.anchor.components ?? '').split('›').map((part) => part.trim())) {
    if (!/^[A-Z][A-Za-z0-9_]*$/.test(name)) continue;
    const declared = new RegExp(`\\b(?:function|const|class)\\s+${name}\\b`);
    const hit = lines.findIndex((line) => declared.test(line));
    if (hit >= 0) return at(hit);
  }

  /* Nothing in the file matched. Deliberately no `line`: capturing one here
   * would freeze a guess as evidence, which is the failure this whole check
   * exists to prevent. */
  return { source: `${file} (near line ${source.split(':')[1] ?? '?'}, unverified)` };
}

/** Every .ts/.tsx under src, read once per write. Fifty files is a couple of
 *  milliseconds and it is the only way to answer "is this still in the code". */
function sourceFiles(root: string, dir = 'src', out: string[] = []): string[] {
  let entries;
  try {
    entries = readdirSync(resolve(root, dir), { withFileTypes: true });
  } catch {
    return out;
  }
  for (const entry of entries) {
    const path = `${dir}/${entry.name}`;
    if (entry.isDirectory()) sourceFiles(root, path, out);
    else if (/\.tsx?$/.test(entry.name)) out.push(path);
  }
  return out;
}

/**
 * Is the thing this note points at still in the code?
 *
 * This exists because a note can claim to be Done and be wrong, and until now
 * nothing checked. Three answers, and `unknown` is used freely — a guess
 * dressed as a verdict is exactly the failure being fixed here.
 *
 *   present  a handle for this element was found in the source
 *   absent   the note had a usable handle and it is no longer there
 *   unknown  no handle worth searching for; nothing can be concluded
 */
function locate(corpus: string, note: ReviewNote): 'present' | 'absent' | 'unknown' {
  // The id, when the element is wrapped by ReviewTarget. The strongest handle
  // there is: it is written in the source on purpose and survives reformatting.
  if (corpus.includes(`id="${note.id}"`)) return 'present';

  /* The source line as it read when the note was taken. Exact, and immune to
   * the CSS that uppercases half the rendered text.
   *
   * A line only counts as a handle if it is distinctive. `<div className="flex
   * items-center">` is thirty characters and says nothing about which element
   * this is; treating its disappearance as evidence would report `absent` for
   * a note whose element never moved. So a line that occurs more than a few
   * times in the corpus is not evidence either way, and falls through to the
   * weaker checks below rather than answering with a guess. */
  const line = note.anchor.sourceLine?.trim();
  if (line && line.length > 12) {
    let seen = 0;
    for (let at = corpus.indexOf(line); at >= 0 && seen < 4; at = corpus.indexOf(line, at + 1)) seen += 1;
    if (seen === 1) return 'present';
    if (seen === 0) return 'absent';
  }

  // Rendered text is a weak handle — CSS transforms it — so it only ever
  // confirms presence here, never absence.
  const words = (note.anchor.text ?? '').split(/\s+/).filter(Boolean);
  if (words.length >= 3) {
    const needle = words.slice(0, 4).join(' ').toLowerCase();
    if (corpus.toLowerCase().includes(needle)) return 'present';
  }

  if (note.id.startsWith('el-')) return 'unknown';
  return corpus.includes(note.id) ? 'present' : 'unknown';
}

function withResolvedSources(root: string, notes: ReviewNotes): ReviewNotes {
  const corpus = sourceFiles(root)
    .map((file) => { try { return readFileSync(resolve(root, file), 'utf8'); } catch { return ''; } })
    .join('\n');

  const out: ReviewNotes = {};
  for (const [id, note] of Object.entries(notes)) {
    const { source, line } = resolveSource(root, note);
    out[id] = {
      ...note,
      /* Checked against the line the note already carried, never the one just
       * read out of the file — otherwise every write would re-capture the
       * current text and the check would confirm itself forever. */
      found: locate(corpus, note),
      anchor: {
        ...note.anchor,
        source: source || note.anchor.source,
        /* Written once and then left alone. It is the line as it read when
         * the note was taken; a note whose element has since moved must keep
         * the old text or there is nothing left to notice the move with. */
        sourceLine: note.anchor.sourceLine ?? line
      }
    };
  }
  return out;
}

const JSON_PATH = 'review/review-notes.json';
const MD_PATH = 'review/REVIEW-NOTES.md';
const BACKUP_PATH = 'review/review-notes.backup.json';

/** The app is the only writer, so a post that arrives holding fewer notes
 *  than the file already has is either a real deletion or a browser whose
 *  storage was cleared — and from here the two look identical. Keep the last
 *  larger version either way: a reply written into this file from the other
 *  side exists nowhere else. */
function keepShrinkingCopy(jsonFile: string, backupFile: string, incoming: ReviewNotes): void {
  let previous: ReviewNotes;
  try {
    previous = JSON.parse(readFileSync(jsonFile, 'utf8')) as ReviewNotes;
  } catch {
    return;
  }
  const lost = Object.keys(previous).filter((id) => !(id in incoming));
  if (!lost.length) return;
  writeFileSync(backupFile, `${JSON.stringify(previous, null, 2)}\n`);
}

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
              keepShrinkingCopy(jsonFile, resolve(server.config.root, BACKUP_PATH), notes);
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
