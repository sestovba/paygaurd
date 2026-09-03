// Turns a DOM element into something an AI can find again from a text file.

import type { ReviewAnchor, ReviewLayoutId, ReviewTheme } from './types';

/** Class names that identify a section in this codebase, versus the hundreds
 *  of Tailwind utilities that identify nothing. */
const MEANINGFUL_CLASS = /^(pg|wr|lg|v3|v2|ledger|card|panel|sheet|tracker|stat|month|stream|twp|sga)[-_]/;

function usefulClasses(el: Element): string[] {
  return Array.from(el.classList).filter((name) => MEANINGFUL_CLASS.test(name));
}

/** React keeps the JSX source position on the fiber in dev builds. This is the
 *  single most useful thing in a note, so it is worth the private-field poke. */
function reactInfo(el: Element): { source?: string; components?: string } {
  const key = Object.keys(el).find((k) => k.startsWith('__reactFiber$'));
  if (!key) return {};
  let fiber = (el as unknown as Record<string, any>)[key];
  let source: string | undefined;
  const components: string[] = [];

  for (let hops = 0; fiber && hops < 30; hops += 1) {
    if (!source && fiber._debugSource?.fileName) {
      const { fileName, lineNumber } = fiber._debugSource;
      const rel = String(fileName).replace(/^.*?\/(src\/)/, '$1');
      // The review layer wraps what it inspects, so its own frames would
      // otherwise win and every note would point back at this folder.
      if (!rel.startsWith('src/review/')) {
        source = lineNumber ? `${rel}:${lineNumber}` : rel;
      }
    }
    const name = typeof fiber.type === 'function'
      ? (fiber.type.displayName || fiber.type.name)
      : undefined;
    if (name && !name.startsWith('Review') && !components.includes(name) && components.length < 4) {
      components.push(name);
    }
    fiber = fiber.return;
  }

  return { source, components: components.join(' › ') || undefined };
}

function domPath(el: Element): string {
  const parts: string[] = [];
  let node: Element | null = el;

  while (node && node !== document.body && parts.length < 8) {
    let part = node.tagName.toLowerCase();
    if (node.id) {
      parts.unshift(`${part}#${node.id}`);
      break;
    }
    const classes = usefulClasses(node).slice(0, 2);
    if (classes.length) part += `.${classes.join('.')}`;
    const parent: HTMLElement | null = node.parentElement;
    if (parent) {
      const twins = Array.from(parent.children).filter((c) => c.tagName === node!.tagName);
      if (twins.length > 1) part += `:nth-of-type(${twins.indexOf(node) + 1})`;
    }
    parts.unshift(part);
    node = parent;
  }

  return parts.join(' > ');
}

/** Something the reader can actually see. A layout that keeps its phone nav
 *  in the tree at desktop width still marks a tab `aria-current`, and that
 *  hidden tab would otherwise name every note's page wrongly. */
function visible(el: Element): boolean {
  return el.getClientRects().length > 0;
}

/** The tab or nav item currently lit up, so a note says which page it is on. */
function currentPage(): string | undefined {
  const marker = Array.from(document.querySelectorAll('[aria-current="page"]')).find(visible);
  if (!marker) return undefined;
  // Nav items stack an icon, a label and sometimes an amount; the accessible
  // name is the only one of those that reads like a page name.
  const text = (marker.getAttribute('aria-label') ?? marker.textContent ?? '')
    .replace(/\s+/g, ' ')
    .trim();
  return text ? text.slice(0, 40) : undefined;
}

/** Layouts carry their own palette on the root node; the app-wide light/dark
 *  toggle sits on <html>. Both are worth restoring when returning to a note. */
function currentTheme(): ReviewTheme | undefined {
  const host = document.querySelector('[data-palette]');
  const sub = host?.getAttribute('data-palette') ?? undefined;
  const dark = document.documentElement.classList.contains('dark');
  return sub || dark ? { sub, dark } : undefined;
}

export function describeElement(el: Element, layout: ReviewLayoutId): ReviewAnchor {
  const text = (el as HTMLElement).innerText?.replace(/\s+/g, ' ').trim();
  const hooks = usefulClasses(el).join(' ');
  return {
    layout,
    page: currentPage(),
    theme: currentTheme(),
    reviewId: el.closest('[data-review-id]')?.getAttribute('data-review-id') ?? undefined,
    ...reactInfo(el),
    domPath: domPath(el),
    hooks: hooks || undefined,
    text: text ? text.slice(0, 140) : undefined
  };
}

/** The caption sitting beside a value — "Active monthly avg" for "$1,689" —
 *  so a note on one number still says which number it was. */
const CAPTION_CLASS = /label|caps|title|heading|dim|muted|meta/i;

function caption(el: Element): string | undefined {
  let node: Element | null = el;
  for (let hops = 0; node && hops < 3; hops += 1) {
    for (const sibling of [node.previousElementSibling, node.nextElementSibling]) {
      if (!sibling || !CAPTION_CLASS.test(sibling.className?.toString() ?? '')) continue;
      const text = sibling.textContent?.replace(/\s+/g, ' ').trim();
      if (text && text.length <= 40) return text;
    }
    node = node.parentElement;
  }
  return undefined;
}

/** A readable name for the hover/selection chip and for the notes list. */
export function labelFor(el: Element): string {
  const aria = el.getAttribute('aria-label')?.replace(/\s+/g, ' ').trim();
  if (aria) return aria.slice(0, 48);

  const heading = el.querySelector('h1, h2, h3, h4, [class*="label"]')
    ?.textContent?.replace(/\s+/g, ' ').trim();
  if (heading) return heading.slice(0, 48);

  const own = (el as HTMLElement).innerText?.replace(/\s+/g, ' ').trim();
  if (own) {
    const above = caption(el);
    const short = own.slice(0, 48);
    return above && !short.toLowerCase().includes(above.toLowerCase())
      ? `${above} · ${short}`.slice(0, 64)
      : short;
  }

  /* A field has no text of its own, so notes on one were being filed as
     "input" — a title that says nothing in a list of two hundred. What the
     reviewer was looking at when they pointed at it is its label, then the
     caption above it, then whatever the empty box itself says. */
  if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement || el instanceof HTMLSelectElement) {
    // innerText rather than textContent: a label wrapping a caption and a
    // hint has no whitespace between them in the markup, and "Miles
    // driven76¢ per mile" is not a name.
    const label = el.labels?.[0] as HTMLElement | undefined;
    const named = (label?.innerText ?? label?.textContent)?.replace(/\s+/g, ' ').trim()
      || caption(el)
      || el.getAttribute('placeholder')?.trim()
      || el.getAttribute('name')?.trim();
    if (named) return named.slice(0, 48);
  }

  const hooks = usefulClasses(el)[0];
  return hooks || el.tagName.toLowerCase();
}

/** "div.pg-stat" — enough to tell two siblings apart in the picker's path. */
export function shortName(el: Element): string {
  const tag = el.tagName.toLowerCase();
  const hook = usefulClasses(el)[0];
  return hook ? `${tag}.${hook}` : tag;
}

/** The chain from the audited section (or a few levels up) down to the
 *  element, so a selection can be widened or narrowed by eye instead of by
 *  guessing which arrow key lands where. */
export function elementPath(el: Element): HTMLElement[] {
  const chain: HTMLElement[] = [];
  let node: Element | null = el;
  while (node instanceof HTMLElement && node !== document.body && chain.length < 7) {
    chain.unshift(node);
    if (node.hasAttribute('data-review-id')) break;
    node = node.parentElement;
  }
  return chain;
}

/** Stable across reloads for the same element in the same layout, so marking
 *  something twice updates one note instead of piling up duplicates. */
export function anchorId(anchor: ReviewAnchor): string {
  // Visible values change constantly in this app (month names, earnings,
  // thresholds). They are useful when locating an old note, but must not be
  // part of its identity or the same element becomes a second journal row
  // every time its value changes.
  const seed = `${anchor.layout}|${anchor.source ?? ''}|${anchor.domPath ?? ''}|${anchor.hooks ?? ''}`;
  let hash = 5381;
  for (let i = 0; i < seed.length; i += 1) hash = ((hash * 33) ^ seed.charCodeAt(i)) >>> 0;
  return `el-${hash.toString(36)}`;
}

/* --- Widening and narrowing the aim ----------------------------------------
 * The arrow keys walk the DOM one node at a time, which is exact and slow: a
 * card in this app is usually four or five nested elements that all draw the
 * same box, so four presses can change nothing you can see. `[` and `]` move
 * in *visible* steps instead — the next ancestor or descendant whose box is
 * actually a different size — so one press is one change on the screen.
 */

/** Same box to the eye. Sub-pixel layout means these are never exactly equal. */
function sameBox(a: DOMRect, b: DOMRect): boolean {
  return Math.abs(a.width - b.width) < 1 && Math.abs(a.height - b.height) < 1;
}

/** Out to the first ancestor that is bigger than `el`. Falls back to the plain
 *  parent when everything above draws the same box, so the key always moves. */
export function widerThan(el: Element): Element | null {
  const box = el.getBoundingClientRect();
  let node = el.parentElement;
  let wrapper: Element | null = null;
  while (node && node !== document.body) {
    if (node.closest('[data-review-ui]')) return null;
    if (!sameBox(node.getBoundingClientRect(), box)) return node;
    wrapper = wrapper ?? node;
    node = node.parentElement;
  }
  return wrapper;
}

/** In to the first thing inside `el` that is smaller than it. Used only when
 *  there is no remembered way back down — a selection that was never widened. */
export function insideOf(el: Element): Element | null {
  const box = el.getBoundingClientRect();
  let node: Element | null = el.firstElementChild;
  let wrapper: Element | null = null;
  while (node && !node.closest('[data-review-ui]')) {
    if (!sameBox(node.getBoundingClientRect(), box)) return node;
    wrapper = wrapper ?? node;
    node = node.firstElementChild;
  }
  return wrapper;
}
