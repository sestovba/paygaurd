// Stowing is storage, not deletion: the element leaves the page into one of
// the four edge trays, the note keeps enough of it to bring it back, and
// nothing in src/ changes until a code pass acts on a verdict.

import type { LayoutMode } from '../state/storage';
import type { ReviewNote, ReviewNotes, ReviewPlacement } from './types';

export function isStowed(note: ReviewNote): boolean {
  return Boolean(note.stow);
}

/** Switched off on the page. Not the archive: the archive is where things
 *  you carried away are kept, and this is a light left off. */
export function isHidden(note: ReviewNote): boolean {
  return Boolean(note.hidden);
}

/** Either reason the element is not on the page right now. */
export function isOffPage(note: ReviewNote): boolean {
  return isStowed(note) || isHidden(note);
}

export function stowedIn(notes: ReviewNotes, layout: LayoutMode): ReviewNote[] {
  return Object.values(notes)
    .filter((note) => isStowed(note) && note.anchor.layout === layout)
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

export function safeQuery(selector?: string): HTMLElement | null {
  if (!selector) return null;
  try {
    return document.querySelector<HTMLElement>(selector);
  } catch {
    return null;
  }
}

/** Sections the audit wrapped unmount themselves. Anything the reviewer picked
 *  by hand is React-managed markup we do not own, so it is taken out of view
 *  with an attribute instead — pulling it out of the tree would leave React
 *  updating a node that is no longer there. */
export function applyStowAttributes(
  notes: ReviewNotes,
  layout: LayoutMode,
  reveal: boolean,
  /** One note to reveal whatever the mode — the element Locate is pointing
   *  at. Pointing at something and leaving it invisible is the failure this
   *  argument exists to stop: most notes in a mature review are off the page,
   *  so "Locate" appeared to do nothing at all unless the audit happened to
   *  be open. */
  peekId?: string | null
): void {
  document.querySelectorAll('[data-review-stowed]').forEach((el) => {
    el.removeAttribute('data-review-stowed');
  });

  for (const note of Object.values(notes)) {
    // Stowed sections the audit wrapped take themselves out of the tree, so
    // only hand-picked markup needs the attribute. Hiding is a switch on
    // anything at all, so it applies either way.
    const byStow = isStowed(note) && note.origin === 'user';
    if (!byStow && !isHidden(note)) continue;
    if (note.anchor.layout !== layout) continue;
    const el = safeQuery(note.anchor.domPath);
    if (el) el.setAttribute('data-review-stowed', reveal || note.id === peekId ? 'preview' : 'true');
  }
}

/** A drop inside the element's own container is a reorder, and CSS order can
 *  honour it live. Anything else is recorded for the code pass instead. */
export function applyPlacements(notes: ReviewNotes, layout: LayoutMode): void {
  // Undoing a move has to undo it on the page too, so every pass starts from
  // the layout's own order rather than leaving the last one baked in.
  clearPlacementStyles();

  for (const note of Object.values(notes)) {
    const placement = note.placement;
    if (!placement?.applied || note.anchor.layout !== layout) continue;

    const moved = (note.anchor.reviewId
      ? document.querySelector<HTMLElement>(`[data-review-id="${note.anchor.reviewId}"]`)
      : null) ?? safeQuery(note.anchor.domPath);
    const anchor = safeQuery(placement.anchor);
    if (!moved || !anchor || moved.parentElement !== anchor.parentElement) continue;

    const siblings = Array.from(moved.parentElement?.children ?? []) as HTMLElement[];
    const without = siblings.filter((el) => el !== moved);
    const at = without.indexOf(anchor);
    if (at < 0) continue;
    without.splice(placement.position === 'before' ? at : at + 1, 0, moved);
    without.forEach((el, index) => {
      el.style.order = String(index);
      el.setAttribute('data-review-ordered', '');
    });
  }
}

/** Only the order this file set: an app that sets `order` itself keeps it. */
export function clearPlacementStyles(): void {
  document.querySelectorAll<HTMLElement>('[data-review-ordered]').forEach((el) => {
    el.style.removeProperty('order');
    el.removeAttribute('data-review-ordered');
  });
}

export interface DropTarget {
  anchor: HTMLElement;
  position: 'before' | 'after';
  /** Where to draw the insertion line, in viewport pixels. */
  line: { top: number; left: number; width: number; vertical: boolean; height: number };
}

/** What is under the pointer, resolved to a gap between two siblings. */
export function dropTargetAt(x: number, y: number): DropTarget | null {
  const hit = document.elementFromPoint(x, y);
  if (!(hit instanceof HTMLElement)) return null;
  if (hit.closest('[data-review-ui]')) return null;

  // Resolve to something a person would call "a thing on the page". Dropping
  // inside an audited section means next to that section; otherwise climb out
  // of wrappers that add no position of their own.
  let anchor: HTMLElement = hit;
  while (anchor.parentElement && anchor.getBoundingClientRect().height < 8) {
    anchor = anchor.parentElement;
  }

  const section = anchor.closest('[data-review-id]');
  if (section instanceof HTMLElement) {
    anchor = section;
  } else {
    for (let climbs = 0; climbs < 6; climbs += 1) {
      const parent = anchor.parentElement;
      if (!parent || parent === document.body || parent.id === 'root') break;
      const alone = parent.children.length < 2;
      const sameBox = parent.getBoundingClientRect().height - anchor.getBoundingClientRect().height < 8;
      if (!alone && !sameBox) break;
      anchor = parent;
    }
  }

  if (anchor === document.body || anchor === document.documentElement) return null;

  const rect = anchor.getBoundingClientRect();
  const parent = anchor.parentElement;
  const flow = parent ? getComputedStyle(parent) : null;
  const horizontal = Boolean(
    flow && flow.display.includes('flex') && flow.flexDirection.startsWith('row')
  );

  if (horizontal) {
    const before = x < rect.left + rect.width / 2;
    return {
      anchor,
      position: before ? 'before' : 'after',
      line: {
        top: rect.top,
        left: before ? rect.left - 3 : rect.right + 1,
        width: 3,
        height: rect.height,
        vertical: true
      }
    };
  }

  const before = y < rect.top + rect.height / 2;
  return {
    anchor,
    position: before ? 'before' : 'after',
    line: {
      top: before ? rect.top - 3 : rect.bottom + 1,
      left: rect.left,
      width: rect.width,
      height: 3,
      vertical: false
    }
  };
}

export function placementFor(
  target: DropTarget,
  anchorPath: string,
  anchorLabel: string,
  sameContainer: boolean
): ReviewPlacement {
  return {
    anchor: anchorPath,
    anchorLabel,
    position: target.position,
    applied: sameContainer
  };
}
