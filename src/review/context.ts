// The context lives apart from the provider so the layouts — which import
// ReviewTarget — do not drag the whole console into the main bundle. The
// heavy half is loaded lazily, and only on a dev host.

import { createContext, useContext } from 'react';
import type { LayoutMode } from '../state/storage';
import type { ReviewNotes, ReviewVerdict, TrayEdge } from './types';
import type { Certainty } from './state';

export type ReviewMode = 'off' | 'audit' | 'pick' | 'variants';

export interface SuggestedTarget {
  id: string;
  label: string;
  reason: string;
  /** How sure the proposal is. See state.ts. */
  certainty?: Certainty;
  layout: LayoutMode;
}

export interface ReviewContextValue {
  mode: ReviewMode;
  notes: ReviewNotes;
  /** Lets the dock report what this screen is proposing — the reason travels
   *  too, so the toolbar can answer a proposal without the page's own
   *  buttons being on screen. */
  register: (id: string, label: string, reason: string, certainty?: Certainty) => () => void;
  /** Variant sets announce themselves so the A/B control stays hidden on
   *  screens with no alternatives to compare. */
  registerVariants: (id: string) => () => void;
  /** Approve / reject an audit suggestion. Clicking the same verdict twice
   *  clears it, so nothing is ever stuck on a wrong answer. */
  decide: (target: SuggestedTarget, verdict: ReviewVerdict, el: Element | null) => void;
  /** Comment on anything — a suggestion, a variant, or a plain element. */
  commentOn: (label: string, el: Element | null, opts?: { id?: string; reason?: string }) => void;
  /** Record which alternative won an A/B. */
  chooseVariant: (
    target: { id: string; label: string; layout: LayoutMode },
    option: string,
    options: string[],
    el: Element | null
  ) => void;
  /** Put a stowed element back where it came from. */
  restore: (id: string) => void;
  /** The proposal currently being walked through, if any. */
  focusId?: string | null;
  /** Focus a proposal by id. */
  focusProposal?: (id: string | null) => void;
  /** Step forward (+1) or backward (-1) through proposals. */
  stepProposal?: (direction: 1 | -1) => void;
  /** True while this element is parked in an edge tray. */
  isStowed: (id: string) => boolean;
  /** Switched off on the page — a layer eye, not the archive. */
  isHidden: (id: string) => boolean;
  /** Switch it off, or back on, from wherever you are looking at it. The
   *  same eye the journal row has: deciding whether a thing should go is
   *  mostly a matter of seeing the page without it. */
  setHidden: (target: SuggestedTarget, hidden: boolean, el: Element | null) => void;
  /** Park an element in an edge tray — storage only, no verdict. Stashes
   *  exactly what it is given; `section` widens to the audited card around
   *  it, which is always the reviewer's explicit choice. */
  stow: (el: Element, edge: TrayEdge, opts?: { label?: string; section?: boolean }) => void;
}

export const ReviewContext = createContext<ReviewContextValue | null>(null);

export function useReview(): ReviewContextValue | null {
  return useContext(ReviewContext);
}
