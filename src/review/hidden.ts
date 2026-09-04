// An element switched off on the page, and nothing else.
//
// This file used to be stow.ts, which carried four edge shelves, drag-to-drop
// repositioning and a placement model for putting things back somewhere new.
// Across 222 notes the shelves were used twice and the repositioning never;
// hiding — take it off the page and see whether you miss it — was used ten
// times and is the only one of them that answers a question you cannot answer
// by staring at the screen. So that is all that is left here.

import type { ReviewLayoutId } from './types';
import type { ReviewNote, ReviewNotes } from './types';
import { pageDocument } from './root';

/** Switched off on the page. Never a verdict, and it never touches the code:
 *  it is a light turned off to find out whether the room is better without
 *  it. The answer is a decision the reviewer still has to make. */
export function isHidden(note: ReviewNote): boolean {
  return Boolean(note.hidden);
}

export function safeQuery(selector?: string): HTMLElement | null {
  if (!selector) return null;
  try {
    return pageDocument().querySelector<HTMLElement>(selector);
  } catch {
    return null;
  }
}

/** Anything the reviewer picked by hand is React-managed markup we do not
 *  own, so it is taken out of view with an attribute rather than out of the
 *  tree — pulling it out would leave React updating a node that is gone. */
export function applyHiddenAttributes(
  notes: ReviewNotes,
  layout: ReviewLayoutId,
  reveal: boolean,
  /** One note to reveal whatever the mode — the element Locate is pointing
   *  at. Pointing at something and leaving it invisible is the failure this
   *  argument exists to stop. */
  peekId?: string | null
): void {
  pageDocument().querySelectorAll('[data-review-hidden]').forEach((el) => {
    el.removeAttribute('data-review-hidden');
  });

  for (const note of Object.values(notes)) {
    if (!isHidden(note) || note.anchor.layout !== layout) continue;
    const el = safeQuery(note.anchor.domPath);
    if (el) el.setAttribute('data-review-hidden', reveal || note.id === peekId ? 'preview' : 'true');
  }
}
