// The context lives apart from the provider so the layouts — which import
// ReviewTarget — do not drag the whole console into the main bundle. The
// heavy half is loaded lazily, and only on a dev host.

import { createContext, useContext } from 'react';
import type { ReviewLayoutId, ReviewNotes } from './types';

/** Pointing, or not. There were four — the other two were an A/B switcher
 *  that one note in 222 ever used, and a separate "audit" walk that is the
 *  same act of pointing at something with a proposal already attached. */
export type ReviewMode = 'off' | 'pick';

/**
 * How the framed page is set up.
 *
 * `w` and `h` are CSS pixels and are the whole point: the frame is a real
 * viewport, so these are the numbers the app's media queries answer to. A
 * preset fills them in; dragging the frame's edge overrides the width, which
 * is the only way to find the width at which something actually breaks.
 *
 * `fullHeight` is a real choice rather than a detail. The device height is the
 * honest one — it is where the fold is, and this app has ten rules keyed on
 * `100dvh` — but a full-height frame shows a whole layout at once without
 * scrolling, which is what you want when reading it rather than checking what
 * a phone shows first.
 *
 * `round` is off by default. A rounded corner is what a device does to the
 * page, not what the page does, and a note about something clipped by a
 * simulated bezel would be a note about the simulation.
 */
export interface FrameSetup {
  on: boolean;
  w: number;
  h: number;
  fullHeight: boolean;
  round: boolean;
}

export interface SuggestedTarget {
  id: string;
  label: string;
  reason: string;
  layout: ReviewLayoutId;
}

export interface ReviewContextValue {
  mode: ReviewMode;
  notes: ReviewNotes;
  /** Lets a wrapped section report what it is proposing, so the console can
   *  answer it without the page's own buttons being on screen. */
  register: (id: string, label: string, reason: string) => () => void;
  /** Comment on anything — a proposal or a plain element. */
  commentOn: (label: string, el: Element | null, opts?: { id?: string; reason?: string }) => void;
  /** The proposal currently being walked through, if any. */
  focusId?: string | null;
  focusProposal?: (id: string | null) => void;
  /** Switched off on the page — a light left off, not a decision. */
  isHidden: (id: string) => boolean;
  /** Switch it off, or back on, from wherever you are looking at it.
   *  Deciding whether a thing should go is mostly a matter of seeing the
   *  page without it. */
  setHidden: (target: SuggestedTarget, hidden: boolean, el: Element | null) => void;
}

export const ReviewContext = createContext<ReviewContextValue | null>(null);

export function useReview(): ReviewContextValue | null {
  return useContext(ReviewContext);
}
