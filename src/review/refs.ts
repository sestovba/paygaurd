// The reference points a note can be filed against when it is not about a
// node on the screen.
//
// They are the headings of the markdown that already governs this project —
// CLAUDE.md, WORKING-WITH-SERGEY.md, DESIGN-SYSTEM.md, THE-THREAD.md, the
// console's own VOCABULARY.md, and each layout's README. Nothing here invents
// a topic list: a topic the reviewer types fresh is a topic only they can find
// again, and the rules already have names that both sides of this file use.
//
// Served by the dev plugin off disk per request, so a heading rewritten a
// minute ago is the heading offered.

export interface DocHeading {
  text: string;
  line: number;
  level: number;
}

export interface DocFile {
  file: string;
  title: string;
  scope: 'global' | 'layout';
  layout?: string;
  headings: DocHeading[];
}

let cache: DocFile[] | null = null;
let inFlight: Promise<DocFile[]> | null = null;

/** Fetched once per page load. The files change while the app is open, but a
 *  note is written in seconds and re-reading on every keystroke would put a
 *  request behind a menu that opens instantly today. */
export function loadRefs(): Promise<DocFile[]> {
  if (cache) return Promise.resolve(cache);
  if (inFlight) return inFlight;
  inFlight = fetch('/__review/refs')
    .then((response) => (response.ok ? response.json() : { docs: [] }))
    .then((body: { docs?: DocFile[] }) => {
      cache = body.docs ?? [];
      return cache;
    })
    .catch(() => {
      // No dev server: the console still works, it just cannot offer rules.
      cache = [];
      return cache;
    })
    .finally(() => { inFlight = null; });
  return inFlight;
}

/** The README for one layout, which is what a `layout`-scoped note points at
 *  when the reviewer has not chosen a particular heading in it. */
export function docForLayout(docs: DocFile[], layout: string): DocFile | undefined {
  return docs.find((doc) => doc.scope === 'layout' && doc.layout === layout);
}

export function globalDocs(docs: DocFile[]): DocFile[] {
  return docs.filter((doc) => doc.scope === 'global');
}

/** "CLAUDE.md › Who this is for" — one string, for a chip or a report line. */
export function refLabel(file: string, heading?: string): string {
  const name = file.split('/').pop() ?? file;
  const short = name === 'README.md' ? file.split('/').slice(-2).join('/') : name;
  return heading ? `${short} › ${heading}` : short;
}
