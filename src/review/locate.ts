// Finding the element a note points at, and showing it to you.
//
// This is the half of the console that cannot be replaced by a text file, and
// it is the reason the tool exists: a note records where something was, and
// this gets you back there after the page has been rebuilt underneath it. It
// used to live inside a 3,900-line component; it is worth reading on its own.

import type { ReviewNote } from './types';
import { safeQuery } from './hidden';
import { pageDocument } from './root';

/** On the screen, as the browser understands it. `getClientRects()` was the
 *  test, and it answers 0 for any element with `display: contents` — which
 *  every wrapped section the review layer adds transparently has. So every
 *  one of those counted as "not on screen" whether it was there or not. */
export function onScreen(el: Element): boolean {
  return typeof el.checkVisibility === 'function'
    ? el.checkVisibility({ checkVisibilityCSS: true })
    : el.getClientRects().length > 0;
}

export function isReviewUi(node: EventTarget | null): boolean {
  return node instanceof Element && Boolean(node.closest('[data-review-ui]'));
}

/** Text as the reader sees it: one line, no case, no runs of space. Both
 *  sides of every comparison go through this, so "AUGUST  COUNTABLE" and
 *  "August countable" are the same string. */
function flatten(text: string): string {
  return text.replace(/\s+/g, ' ').trim().toLowerCase();
}

/**
 * Find the element a note points at, when the exact handles have failed.
 *
 * A recorded DOM path is exact and brittle: one wrapper div added anywhere
 * above the element and it resolves to nothing, which is most of what "Locate
 * does nothing" ever was. The text the reviewer actually saw survives that,
 * because restructuring a page rarely rewrites the words on it.
 *
 * So candidates are gathered from whatever handles exist and scored, rather
 * than tried in a fixed order and given up on. The smallest element that
 * contains the remembered text wins — a container that merely encloses it is
 * technically a match and useless to point at.
 */
function searchForNote(note: ReviewNote): HTMLElement | null {
  const wanted = flatten(note.anchor.text ?? '');
  const hooks = (note.anchor.hooks ?? '').split(' ').filter(Boolean);
  if (wanted.length < 4 && !hooks.length) return null;

  let best: { el: HTMLElement; score: number } | null = null;

  // Class hooks narrow the field enormously when they exist; otherwise the
  // sweep is over elements that carry their own text rather than every node.
  const pool = hooks.length
    ? pageDocument().querySelectorAll<HTMLElement>(hooks.map((h) => `.${CSS.escape(h)}`).join(''))
    : pageDocument().querySelectorAll<HTMLElement>('[class]');

  for (const el of pool) {
    if (isReviewUi(el) || !onScreen(el)) continue;
    const text = flatten(el.textContent ?? '');
    if (!text) continue;

    let score = 0;
    if (wanted) {
      if (text === wanted) score += 1;
      else if (text.startsWith(wanted) || wanted.startsWith(text)) score += 0.8;
      else if (text.includes(wanted)) score += 0.55;
      else {
        // Nothing shared at the start; fall back to how much of the
        // remembered opening line this element still carries.
        const words = wanted.split(' ').slice(0, 6);
        const hit = words.filter((w) => w.length > 2 && text.includes(w)).length;
        if (!hit) continue;
        score += 0.3 * (hit / words.length);
      }
    }
    if (hooks.length) {
      score += 0.3 * (hooks.filter((h) => el.classList.contains(h)).length / hooks.length);
    }
    // Prefer the tightest wrapper: an element ten times longer than the text
    // it was remembered by is a section, not the thing.
    if (wanted && text.length > wanted.length) {
      score -= Math.min(0.35, (text.length / Math.max(wanted.length, 1) - 1) * 0.05);
    }
    if (score > (best?.score ?? 0.34)) best = { el, score };
  }

  return best?.el ?? null;
}

/** The element itself, or null when it is not on this screen. */
export function elementForNote(note: ReviewNote): HTMLElement | null {
  const byId = note.anchor.reviewId
    ? pageDocument().querySelector(`[data-review-id="${note.anchor.reviewId}"]`)
    : pageDocument().querySelector(`[data-review-id="${note.id}"]`);
  // Exact handles first, then the search — which is what keeps Locate working
  // after the layout it was recorded against has been rebuilt.
  const found = byId ?? safeQuery(note.anchor.domPath) ?? searchForNote(note);
  if (!(found instanceof HTMLElement)) return null;
  const resolved = (found.getAttribute('data-review-transparent') && found.firstElementChild instanceof HTMLElement)
    ? found.firstElementChild
    : found;
  // In the tree but not on the screen — inside a shut accordion, on a tab
  // that is not showing — is the same as absent for the purpose of pointing
  // at it, and flashing it would flash nothing.
  return onScreen(resolved) ? found : null;
}

/**
 * The visible part of where a note lives.
 *
 * When the thing itself is not showing, the container that holds it usually
 * is, and pointing at that is the difference between a click that does
 * nothing and a click that says "in here". Walks up the recorded DOM path,
 * shortest hop first.
 */
export function nearestVisible(note: ReviewNote): HTMLElement | null {
  const exact = note.anchor.reviewId
    ? pageDocument().querySelector(`[data-review-id="${note.anchor.reviewId}"]`)
    : safeQuery(note.anchor.domPath);
  // Found but hidden: its own ancestors are the best answer there is.
  if (exact instanceof HTMLElement) {
    let node: HTMLElement | null = exact.parentElement;
    while (node && node !== pageDocument().body) {
      if (onScreen(node) && !node.closest('[data-review-ui]')) return node;
      node = node.parentElement;
    }
  }
  // Not in the tree at all: shorten the recorded path a step at a time.
  const parts = (note.anchor.domPath ?? '').split(' > ');
  for (let take = parts.length - 1; take > 0; take -= 1) {
    const found = safeQuery(parts.slice(0, take).join(' > '));
    if (found && onScreen(found)) return found;
  }
  return null;
}

/**
 * Say "this one" out loud: scroll to it and flash it, every time, even when
 * it is already on screen.
 */
export function flashElement(target: HTMLElement, tone: 'exact' | 'near' = 'exact'): void {
  const mark = tone === 'exact' ? 'review-flash' : 'review-flash-near';
  const el = (target.getAttribute('data-review-transparent') && target.firstElementChild instanceof HTMLElement)
    ? target.firstElementChild
    : target;
  el.scrollIntoView({ block: 'center', behavior: 'smooth' });
  el.classList.remove(mark);
  void el.offsetWidth; // restart the animation on a repeat click
  el.classList.add(mark);
  // The near miss holds longer: it is asking you to look for something inside
  // it, which takes longer than being shown the thing itself.
  window.setTimeout(() => el.classList.remove(mark), tone === 'near' ? 2600 : 1600);
}

/** Outline whatever a row is about, for as long as the row is under the
 *  pointer. Not a flash: a flash answers "where is it" once, and this answers
 *  "what am I looking at" continuously, which is the question you have while
 *  sweeping a list of twelve. */
export function showPeek(note: ReviewNote | null): void {
  pageDocument().querySelectorAll('[data-review-peek]').forEach((el) => {
    el.removeAttribute('data-review-peek');
  });
  if (!note) return;
  const exact = elementForNote(note);
  const el = exact ?? nearestVisible(note);
  if (el) el.setAttribute('data-review-peek', exact ? 'exact' : 'near');
}

/** Layouts keep their own page state, so the only honest way in from here is
 *  to press the same nav control the reader would press. */
export function openPage(page: string): boolean {
  const wanted = page.trim().toLowerCase();
  const controls = Array.from(pageDocument().querySelectorAll<HTMLElement>(
    'nav button, nav a, [role="tab"], .pg-bottom-nav-item, .pg-tab, .v2-nav-item'
  ));
  const hit = controls.find((el) => {
    if (el.closest('[data-review-ui]')) return false;
    if (el.getAttribute('aria-current') === 'page') return false;
    // A layout that keeps its phone tab bar mounted at desktop width would
    // otherwise be navigated by a control the reader cannot even see.
    if (!el.getClientRects().length) return false;
    const name = (el.getAttribute('aria-label') ?? el.textContent ?? '')
      .replace(/\s+/g, ' ')
      .trim()
      .toLowerCase();
    return name === wanted || name.startsWith(wanted);
  });
  hit?.click();
  return Boolean(hit);
}
