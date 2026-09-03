#!/usr/bin/env node
/*
 * Flattens a built site into one self-contained HTML file.
 *
 *   node scripts/flatten.mjs <project-dir> [out.html]
 *
 * Runs the project's own build, then folds every emitted script, stylesheet
 * and asset into dist/index.html as inline text or a data: URI, and throws
 * if anything is still referenced from outside the file. The throw is the
 * point: a page that looks standalone and breaks once it is moved is worse
 * than one that never claimed to be.
 *
 * Same contract as vite.calc20.config.ts's singleFile(), but applied to a
 * foreign project (a Figma Make export) whose vite config we do not own.
 *
 * Never write the output back over <project>/index.html. That file is Vite's
 * ENTRY — 440 bytes of <script src="/src/main.tsx"> — and overwriting it makes
 * the next build silently re-bundle the previous export instead of the source.
 * Default output goes to a sibling exports/ for exactly that reason.
 */
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, writeFileSync, statSync, mkdirSync } from 'node:fs';
import { resolve, join, dirname, extname, basename } from 'node:path';

const [projectArg, outArg] = process.argv.slice(2);
if (!projectArg) {
  console.error('usage: node scripts/flatten.mjs <project-dir> [out.html]');
  process.exit(1);
}

const project = resolve(projectArg);
const slug = basename(project).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
const out = outArg ? resolve(outArg) : join(dirname(project), 'exports', `${slug}.html`);

if (out === join(project, 'index.html')) {
  throw new Error('Refusing to write over the Vite entry — pick an output path outside the project.');
}

const MIME = {
  '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg', '.gif': 'image/gif', '.webp': 'image/webp',
  '.avif': 'image/avif', '.ico': 'image/x-icon', '.woff': 'font/woff',
  '.woff2': 'font/woff2', '.ttf': 'font/ttf', '.otf': 'font/otf',
  '.mp4': 'video/mp4', '.webm': 'video/webm', '.json': 'application/json'
};

function run(cmd, args) {
  console.log(`  $ ${cmd} ${args.join(' ')}`);
  execFileSync(cmd, args, { cwd: project, stdio: 'inherit' });
}

/* npm, not pnpm: the export ships a pnpm-lock.yaml but pnpm is not on this
   machine, and the lockfile only pins what package.json already ranges. */
if (!existsSync(join(project, 'node_modules'))) run('npm', ['install', '--no-audit', '--no-fund']);
run('npm', ['run', 'build']);

const dist = join(project, 'dist');
const htmlPath = join(dist, 'index.html');
if (!existsSync(htmlPath)) throw new Error(`No dist/index.html in ${project} — did the build emit somewhere else?`);

let html = readFileSync(htmlPath, 'utf8');

/** dist-relative path for a URL as written in the HTML ("/assets/x.js", "./assets/x.js"). */
const asset = (url) => join(dist, url.replace(/^[.]?\//, '').split(/[?#]/)[0]);

// 1. <script src> -> inline module. `</script` inside a string literal would
//    end the tag early and drop the rest of the app into the page as text.
html = html.replace(/<script\b[^>]*\bsrc="([^"]+)"[^>]*><\/script>/gi, (tag, url) => {
  const file = asset(url);
  if (!existsSync(file)) return tag;
  const code = readFileSync(file, 'utf8').replace(/<\/script/gi, '<\\/script');
  return `<script type="module">\n${code}\n</script>`;
});

// 2. <link rel=stylesheet> -> inline <style>, with its own url() refs folded in.
html = html.replace(/<link\b[^>]*rel="stylesheet"[^>]*>/gi, (tag) => {
  const url = /href="([^"]+)"/i.exec(tag)?.[1];
  if (!url) return tag;
  const file = asset(url);
  if (!existsSync(file)) return tag;
  return `<style>\n${inlineCssUrls(readFileSync(file, 'utf8'), dirname(file))}\n</style>`;
});

// 3. <link rel=modulepreload> for a script that is now in the page: drop it.
html = html.replace(/<link\b[^>]*rel="modulepreload"[^>]*>\s*/gi, '');

/* Steps 4 and 5 must not see the bundle. Minified JS is full of text that
   looks like src="…" — template-literal seams, error-message fragments — and
   neither rewriting nor auditing those means anything. So lift the inline
   script/style blocks out, work on the markup between them, and put them back. */
const blocks = [];
html = html.replace(/<(script|style)\b[^>]*>[\s\S]*?<\/\1>/gi, (block) => `__FLATTEN_BLOCK_${blocks.push(block) - 1}__`);

// 4. Everything left in the markup that points at a local file -> data: URI.
html = html.replace(/\b(src|href)="((?!data:|https?:|mailto:|#)[^"]+)"/gi, (attr, name, url) => {
  const file = asset(url);
  if (!existsSync(file)) return attr;
  return `${name}="${dataUri(file)}"`;
});

// 5. The check that makes the claim mean something — markup only, before the write.
const leftOver = [...html.matchAll(/\b(?:src|href)="((?!data:|https?:|mailto:|#)[^"]+)"/gi)].map((m) => m[1]);
if (leftOver.length) throw new Error(`Not self-contained — still points outside the file: ${[...new Set(leftOver)].join(', ')}`);

html = html.replace(/__FLATTEN_BLOCK_(\d+)__/g, (_m, i) => blocks[Number(i)]);

function inlineCssUrls(css, base) {
  return css.replace(/url\((['"]?)((?!data:|https?:|#)[^'")]+)\1\)/gi, (whole, _q, url) => {
    const file = resolve(base, url.split(/[?#]/)[0]);
    return existsSync(file) ? `url(${dataUri(file)})` : whole;
  });
}

function dataUri(file) {
  const type = MIME[extname(file).toLowerCase()] || 'application/octet-stream';
  if (type === 'image/svg+xml') {
    // Readable and smaller than base64 for the icon sprites these exports use.
    const svg = readFileSync(file, 'utf8').replace(/\s+/g, ' ').trim();
    return `data:image/svg+xml,${encodeURIComponent(svg).replace(/'/g, '%27').replace(/"/g, '%22')}`;
  }
  return `data:${type};base64,${readFileSync(file).toString('base64')}`;
}

mkdirSync(dirname(out), { recursive: true });
writeFileSync(out, html);

console.log(`\n  ${basename(out)} — ${(statSync(out).size / 1024).toFixed(0)} KB, one file`);
/* A remote @import is the one thing these pages still reach for. Not a
   failure — it degrades to a system font — but say so, rather than let
   "self-contained" quietly mean "self-contained except offline". */
const fonts = [...html.matchAll(/@import\s*["']?(https?:\/\/[^"')\s;]+)/gi)].map((m) => m[1]);
if (fonts.length) console.log(`  online-only, falls back to a system font: ${[...new Set(fonts)].join(', ')}`);
