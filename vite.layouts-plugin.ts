import { readdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import type { Plugin } from 'vite';

/**
 * The layout list, read out of the layouts themselves.
 *
 * It used to be `LAYOUT_GROUPS` — a hand-written array in LayoutSwitcher.tsx
 * naming ten layouts, their labels and their one-line descriptions. Every
 * rename, every new layout and every reworded description was a second edit
 * in a file the layout does not live in, and the review console's own menu
 * had already drifted: it listed six of the ten, Plan among the missing, and
 * nothing about looking at it said so.
 *
 * A layout is a folder under src/components with a README.md. That README
 * already opens with the layout's name and a bold sentence saying what it is
 * — written for a person, kept current because it is the file you read when
 * you work on that layout. So the list is derived from it:
 *
 *     src/components/pocket/README.md   →  id "pocket"
 *     # Pocket                          →  label
 *     **The smallest screen …**         →  description
 *     <!-- registry: group="…" -->      →  which heading it sits under
 *
 * Adding a layout is adding its folder and its README. Nothing central needs
 * touching, which is the whole point.
 *
 * Why a virtual module rather than an `import.meta.glob('?raw')`: the globbed
 * version inlines eight whole READMEs — about 45KB of prose — into a bundle
 * that ships to a cheap Android on slow data, to use four fields from each.
 * This parses at build time and emits roughly 700 bytes.
 */

const ID = 'virtual:pg-layouts';
const RESOLVED = `\0${ID}`;

/** Ids the app's own union type knows. A folder that is not one of these is a
 *  component directory, not a layout — the check lives here so a typo in a
 *  folder name fails visibly instead of adding a dead menu row. */
const KNOWN = new Set([
  'overview', 'ledger', 'payguard', 'workrecord', 'calc20', 'horizon', 'pocket', 'charm', 'plan', 'beautiful'
]);

export interface LayoutEntry {
  id: string;
  label: string;
  description: string;
  group: string;
  /** Where it sits in the menu. Group order is its lowest member's, so the
   *  headings need no list of their own either. */
  order: number;
  /** Repo-relative path of the README, so a note can point at it. */
  doc: string;
}

/** The first `# Heading`, the first bold sentence under it, and the group. */
function parse(md: string): { label?: string; description?: string; group?: string; order?: number } {
  const label = /^#\s+(.+?)\s*$/m.exec(md)?.[1];
  const group = /registry:[^>]*?group="([^"]+)"/.exec(md)?.[1];
  const order = Number(/registry:[^>]*?order="(\d+)"/.exec(md)?.[1]);

  /* The lead sentence: the first bold run after the title, plus the rest of
     the paragraph it opens. Bounded at the blank line on purpose — overview's
     lead is followed by three more sentences of history, and a menu row is
     one line. */
  const lead = (md.split(/^##\s/m)[0] ?? '').replace(/^#\s+.*$/m, '');
  const paragraph = lead
    .split(/\n\s*\n/)
    .map((block) => block.trim())
    .find((block) => block.startsWith('**') && !block.startsWith('<!--'));
  const description = paragraph
    ? paragraph.replace(/\*\*/g, '').replace(/`/g, '').replace(/\s+/g, ' ').trim().slice(0, 180)
    : undefined;
  return { label, description, group, order: Number.isFinite(order) ? order : undefined };
}

export function readLayouts(root: string): LayoutEntry[] {
  const base = resolve(root, 'src/components');
  let dirs: string[];
  try {
    dirs = readdirSync(base, { withFileTypes: true })
      .filter((entry) => entry.isDirectory() && KNOWN.has(entry.name))
      .map((entry) => entry.name);
  } catch {
    return [];
  }

  const out: LayoutEntry[] = [];
  for (const id of dirs) {
    const doc = `src/components/${id}/README.md`;
    let md: string;
    try {
      md = readFileSync(resolve(root, doc), 'utf8');
    } catch {
      continue;
    }
    const { label, description, group, order } = parse(md);
    out.push({
      id,
      label: label ?? id,
      description: description ?? '',
      group: group ?? 'Layouts',
      /* A README with no order sorts last rather than first: a layout that
         has not said where it goes should not silently take the top of the
         menu from one that has. */
      order: order ?? 900,
      doc
    });
  }
  return out.sort((a, b) => a.order - b.order || a.label.localeCompare(b.label));
}

export function pgLayouts(): Plugin {
  let root = process.cwd();
  return {
    name: 'paycheck-guard:layouts',
    configResolved(config) { root = config.root; },
    resolveId(id) { return id === ID ? RESOLVED : null; },
    load(id) {
      if (id !== RESOLVED) return null;
      return `export const LAYOUTS = ${JSON.stringify(readLayouts(root))};`;
    },
    /* Editing a README is editing the menu, so the page updates the way any
       other source change does. Without this the list is only as fresh as the
       last dev-server restart, which is the babysitting this replaces. */
    configureServer(server) {
      server.watcher.on('all', (_event, file) => {
        if (!/src[/\\]components[/\\][^/\\]+[/\\]README\.md$/.test(file)) return;
        const mod = server.moduleGraph.getModuleById(RESOLVED);
        if (mod) server.moduleGraph.invalidateModule(mod);
        server.ws.send({ type: 'full-reload' });
      });
    }
  };
}
