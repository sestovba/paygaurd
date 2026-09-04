#!/usr/bin/env node
/*
 * Regenerates review/REVIEW-NOTES.md from review/review-notes.json.
 *
 *   node scripts/review-report.mjs            # write the report
 *   node scripts/review-report.mjs --check    # print the summary, write nothing
 *
 * The app already does this, on every note change — but only while the dev
 * server is running, and the server is exactly what you are told to stop
 * before touching these files. That left the report stale whenever anything
 * edited the JSON directly, which is how a code pass answers notes.
 *
 * It runs the app's OWN generator rather than a copy: src/review/markdown.ts
 * bundled through esbuild (already present, vite depends on it), so there is
 * no second implementation of the queue rules to drift.
 */
import { build } from 'esbuild';
import { readFileSync, writeFileSync } from 'node:fs';

const SOURCE = 'review/review-notes.json';
const TARGET = 'review/REVIEW-NOTES.md';
const check = process.argv.includes('--check');

const bundled = await build({
  entryPoints: ['src/review/markdown.ts'],
  bundle: true,
  format: 'esm',
  write: false,
  platform: 'node',
  logLevel: 'silent'
});

const { notesToMarkdown } = await import(
  'data:text/javascript;base64,' + Buffer.from(bundled.outputFiles[0].text).toString('base64')
);

const notes = JSON.parse(readFileSync(SOURCE, 'utf8'));
const markdown = notesToMarkdown(notes);

/* The one line that says whether the queue is moving. Printed either way,
   because that is the number anyone runs this for. */
const summary = markdown.split('\n').find((line) => / note\(s\) · /.test(line));

if (check) {
  const current = readFileSync(TARGET, 'utf8');
  console.log(summary ?? '(no summary line)');
  console.log(current === markdown ? 'report is up to date' : 'report is STALE — run without --check');
  process.exit(current === markdown ? 0 : 1);
}

writeFileSync(TARGET, markdown);
console.log(summary ?? '(no summary line)');
console.log(`wrote ${TARGET}`);
