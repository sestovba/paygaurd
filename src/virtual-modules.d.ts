/**
 * The layout registry, built at compile time from each layout's own README by
 * vite.layouts-plugin.ts. See that file for why it is a virtual module rather
 * than a glob of raw markdown.
 */
declare module 'virtual:pg-layouts' {
  export const LAYOUTS: ReadonlyArray<{
    id: string;
    label: string;
    description: string;
    group: string;
    order: number;
    doc: string;
  }>;
}
