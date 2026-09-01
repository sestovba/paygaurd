import type { LayoutMode } from '../state/storage';

export type ReviewKind = 'delete' | 'comment' | 'choice' | 'stow';

/** The board's lanes, in the order a note is cycled through them. 'parked'
 *  is the honest answer to most triage — not "this never happened", which is
 *  what deleting the note would say, but "I am not looking at this now". */
export type ReviewLane = 'open' | 'commented' | 'second' | 'done' | 'parked';

export const LANES: ReviewLane[] = ['open', 'commented', 'second', 'done', 'parked'];

export const LANE_NAME: Record<ReviewLane, string> = {
  open: 'To do',
  commented: 'Commented',
  second: 'Second look',
  done: 'Done',
  parked: 'Not now'
};

/** Lanes still asking for something. Work left, as opposed to work filed. */
export const LANE_OPEN: ReviewLane[] = ['open', 'commented', 'second'];

/** Both sides write this field, and one of them is a text editor. A value
 *  the app does not know must not make a note vanish off the board — it
 *  lands back in To do, where it can be seen and moved. */
export function laneOf(note: { status?: string }): ReviewLane {
  return LANES.includes(note.status as ReviewLane) ? note.status as ReviewLane : 'open';
}

/** What the user decided about something the audit proposed. 'rejected' is
 *  worth storing too — it stops the same section being proposed again. */
export type ReviewVerdict = 'approved' | 'rejected' | 'revise';

/** The palette a note was taken under, so returning to it looks the same. */
export interface ReviewTheme {
  /** Sub-palette id: paper / slate / ledger / carbon / calc20. */
  sub?: string;
  dark?: boolean;
}

/** Where a note points, captured at the moment it was made. Everything here
 *  exists so an AI pass can find the element again from the file alone. */
export interface ReviewAnchor {
  /** Layout ("theme") the note was taken in. */
  layout: LayoutMode;
  /** Best-effort page/tab name inside that layout. */
  page?: string;
  theme?: ReviewTheme;
  /** "src/components/TrackerV3.tsx:388" — from React's dev source map. */
  source?: string;
  /** Component stack, outermost last: "MonthGrid › OverviewPage". */
  components?: string;
  /** CSS-ish path, good enough to re-query the element in the same view. */
  domPath?: string;
  /** The wrapped section this sits in, when there is one. */
  reviewId?: string;
  /** Class names worth grepping (pg-card, wr-slab, …). */
  hooks?: string;
  /** First ~140 characters of visible text — the strongest grep handle. */
  text?: string;
}

/** Where the reviewer dropped a stowed element when putting it back. The app
 *  can only satisfy this when it is a reorder inside one container; otherwise
 *  it is an instruction for the next code pass. */
export interface ReviewPlacement {
  /** DOM path of the element it was dropped against. */
  anchor: string;
  anchorLabel?: string;
  position: 'before' | 'after';
  /** True when the running app could actually put it there. */
  applied: boolean;
}

export type TrayEdge = 'left' | 'right' | 'top' | 'bottom';

/** Storage, not judgement: which edge tray the element is parked in. Stowing
 *  something says nothing about whether it should go — the verdict does. */
export interface ReviewStow {
  edge: TrayEdge;
  at: string;
}

/** Back-and-forth on one note. The app writes 'you'; a code pass writes
 *  'claude' straight into review-notes.json (bump updatedAt) and it shows up
 *  in the app on the next load. */
export interface ReviewReply {
  from: 'you' | 'claude';
  text: string;
  at: string;
}

export type TraySort = 'newest' | 'oldest' | 'label' | 'flagged';

/** Per-side stash settings, kept on that side's group note so they persist
 *  and travel with everything else in review-notes.json. */
export interface TraySettings {
  name?: string;
  color?: string;
  sort?: TraySort;
  /** Collapsed to a handle by the reviewer. Undefined means open. */
  open?: boolean;
  /** Where along its edge the shelf was dragged, in pixels from the top (for
   *  the side shelves) or from the left (for the flat ones). Undefined is the
   *  shelf's home position. */
  offset?: number;
}

export interface ReviewNote {
  id: string;
  kind: ReviewKind;
  /** 'suggested' = an AI-proposed deletion the user approved.
   *  'user' = the user picked this element themselves. */
  origin: 'suggested' | 'user';
  /** Short human name for the thing. */
  label: string;
  /** Why the AI proposed deleting it (suggested deletes only). */
  reason?: string;
  /** The user's comment (comment notes only). */
  comment?: string;
  /** Short intent tags picked in the composer — 'cut', 'reword', 'spacing'.
   *  Prose says what they mean; these say what kind of change it is, so a
   *  code pass can sort a screenful of notes without reading every one. */
  tags?: string[];
  /** Which alternative won, and what it was up against (choice notes only). */
  choice?: string;
  options?: string[];
  verdict?: ReviewVerdict;
  /** Parked out of the page. Independent of the verdict. */
  stow?: ReviewStow;
  /** Taken off the page to see whether the page is better without it — a
   *  layer switched off, nothing more. Distinct from `stow`: stowing carries
   *  the thing into a shelf you can drag it back out of, and hiding just
   *  turns it off where it stands. Neither is a verdict, and neither touches
   *  the code. */
  hidden?: boolean;
  /** For a tray-group note: what was parked on that side when it was written. */
  members?: string[];
  tray?: TraySettings;
  thread?: ReviewReply[];
  /** Set when the element was restored by dropping it somewhere new. */
  placement?: ReviewPlacement;
  /** Which lane of the board this sits in. Not an inbox to be cleared — a
   *  to-do that gets moved: said, answered, worth another look, done, or
   *  deliberately not now. Either side can move it. */
  status: ReviewLane;
  anchor: ReviewAnchor;
  createdAt: string;
  updatedAt: string;
}

export type ReviewNotes = Record<string, ReviewNote>;
