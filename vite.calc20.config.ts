import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';
import type { Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

/*
 * The standalone Calc20 export — `npm run build:calc20`.
 *
 * One HTML file in dist-calc20/, with the script, the stylesheet and any
 * asset inlined into it. It opens by double-click from the desktop, from a
 * USB stick, or off any static host, with no server, no build step and no
 * second file to lose on the way. That is the whole point of it: the thing
 * being handed over is a file, not a deployment.
 *
 * It is the same code as the layout inside the app, on the same localStorage
 * record — not a snapshot and not a fork. What it does not carry is the rest
 * of the app: no sign-in, no Firebase, no other layouts, no review console.
 * See src/standalone/calc20.tsx for what is left out and why.
 *
 * The main build is untouched: vite.config.ts still builds the whole app.
 */

const here = (path: string) => fileURLToPath(new URL(path, import.meta.url));

/* Read by calc20/SettingsSheet.tsx, which drops the layout-switcher row when
   it is set. Vite's loadEnv picks prefixed keys up from process.env, so
   setting it here means the flag travels with the config — running this
   config any other way still produces a correct export. */
process.env.VITE_STANDALONE = '1';

/**
 * Folds the emitted chunk and stylesheet into the HTML and throws if
 * anything is left over.
 *
 * The throw is the useful half. A "standalone" page that quietly emits a
 * second file is worse than a normal build, because it looks like one file
 * and breaks once it is moved — so the build fails instead.
 */
function singleFile(): Plugin {
  return {
    name: 'calc20-single-file',
    enforce: 'post',
    generateBundle(_options, bundle) {
      const htmlName = Object.keys(bundle).find((name) => name.endsWith('.html'));
      const html = htmlName ? bundle[htmlName] : undefined;
      if (!html || html.type !== 'asset') throw new Error('No HTML in the bundle to inline into.');

      let source = String(html.source);

      for (const [name, item] of Object.entries(bundle)) {
        if (name === htmlName) continue;

        if (item.type === 'chunk') {
          /* `</script` inside a string literal would end the tag early and
             drop the rest of the app into the page as text. */
          const code = item.code.replace(/<\/script/gi, '<\\/script');
          source = replaceTag(source, `<script[^>]*src="[^"]*${escapeRe(name)}"[^>]*>\\s*</script>`, `<script type="module">\n${code}\n</script>`, name);
          delete bundle[name];
        } else if (name.endsWith('.css')) {
          source = replaceTag(source, `<link[^>]*href="[^"]*${escapeRe(name)}"[^>]*>`, `<style>\n${String(item.source)}\n</style>`, name);
          delete bundle[name];
        }
      }

      const leftOver = Object.keys(bundle).filter((name) => name !== htmlName);
      if (leftOver.length) {
        throw new Error(`Not standalone — these would ship alongside the page: ${leftOver.join(', ')}`);
      }

      html.source = source;
    }
  };
}

function escapeRe(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** Replaces one tag, and says which asset it could not place rather than
 *  silently emitting a page that references a file it no longer has. */
function replaceTag(html: string, pattern: string, inlined: string, name: string): string {
  const tag = new RegExp(pattern);
  if (!tag.test(html)) throw new Error(`Could not find the tag for ${name} to inline.`);
  // A function replacement — $& and friends in minified code are literal.
  return html.replace(tag, () => inlined);
}

export default defineConfig({
  base: './',
  // Nothing in public/ belongs to this page: google-mark.svg is the sign-in
  // screen's, and the sign-in screen is not in this build.
  publicDir: false,
  plugins: [react(), tailwindcss(), singleFile()],
  resolve: {
    alias: [
      {
        find: /^firebase\/(app|auth|firestore)$/,
        replacement: here('./src/standalone/firebase-absent.ts')
      }
    ]
  },
  build: {
    outDir: 'dist-calc20',
    emptyOutDir: true,
    // Every asset becomes a data: URI rather than a file next to the page.
    assetsInlineLimit: Number.MAX_SAFE_INTEGER,
    cssCodeSplit: false,
    // No <link rel="modulepreload"> for a script that is already in the page.
    modulePreload: { polyfill: false },
    rollupOptions: {
      input: here('./calc20.html'),
      // One chunk, dynamic imports and all — there is nowhere to fetch a
      // second chunk from once this file is on someone's desktop.
      output: { inlineDynamicImports: true }
    }
  }
});
