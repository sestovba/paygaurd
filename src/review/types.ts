import type { LayoutMode } from '../state/storage';

/* One note, one shape.
 *
 * This file used to carry a second state vocabulary — five `ReviewLane`s with
 * their own names and their own `laneOf()` — running alongside the eight
 * `NoteState`s in state.ts, with `verdict` as a third axis and a derived Do
 * column as a fourth. `status` was typed as the lane, documented as the
 * state, stored lane values, and was translated on every read. Four
 * taxonomies, 61 labels, and five notes in the file carrying a `certainty`
 * value no enumeration defined.
 *
 * There is one now, it is defined here because it is part of the note's
 * shape, and state.ts owns what it means.
 */

export type ReviewKind = 'delete' | 'comment';

/**
 * Where a note has got to — which is the same question as whose move it is,
 * so it is stored once and answers both.
 *
 *     yours ──→ sent ──→ closed
 *       ↑        │          │
 *       └────────┘          │   (a reply comes back to you)
 *       └───────────────────┘   (reopen)
 *
 * `closed` covers every way a note stops asking for something: acted on,
 * deferred, or looked at and kept. Those were three states, and across 222
 * notes all 178 closed ones were the first — so the distinction was costing
 * three labels to record something nobody ever recorded.
 */
export type NoteState = 'yours' | 'sent' | 'closed';

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
  /** "src/components/TrackerV3.tsx:388" — resolved against the real file by
   *  the dev server on every write, because React's dev source positions
   *  count lines in the transformed module. */
  source?: string;
  /** Component stack, outermost last: "MonthGrid › OverviewPage". */
  components?: string;
  /** CSS-ish path, good enough to re-query the element in the same view. */
  domPath?: string;
  /** The wrapped section this sits in, when there is one. */
  reviewId?: string;
  /** Class names worth grepping (pg-card, wr-slab, …). */
  hooks?: string;
  /** First ~140 characters of visible text — a strong grep handle, though CSS
   *  has often uppercased or truncated it. */
  text?: string;
  /**
   * The source line as it actually read when the note was taken, trimmed.
   *
   * Written once, by the dev server, and then never touched again — it is
   * evidence, and evidence that updates itself is not evidence. It gives a
   * code pass the one thing nothing else here does: a way to tell "this
   * element moved" from "this element is gone".
   */
  sourceLine?: string;
}

/** Back-and-forth on one note. The app writes 'you'; a code pass writes
 *  'claude' straight into review-notes.json (bump updatedAt) and it shows up
 *  in the app on the next load. */
export interface ReviewReply {
  from: 'you' | 'claude';
  text: string;
  at: string;
}

export interface ReviewNote {
  id: string;
  kind: ReviewKind;
  /** 'suggested' = an AI-proposed change. 'user' = the reviewer picked this
   *  element themselves. */
  origin: 'suggested' | 'user';
  /** Short human name for the thing. */
  label: string;
  /** Why the AI proposed it (suggested notes only). */
  reason?: string;
  /** The reviewer's own words. The most valuable field in the file, and the
   *  one the console should be fastest at collecting. */
  comment?: string;
  /** What kind of change this is — 'cut', 'move', 'reword', 'redesign'. Prose
   *  says what is wanted; these say what shape it is, so a screenful can be
   *  sorted without reading every one. */
  tags?: string[];
  /** Switched off on the page to see whether the page is better without it.
   *  Not a verdict, and it never touches the code. */
  hidden?: boolean;
  thread?: ReviewReply[];
  /** Whose move it is. Either side writes it. */
  status: NoteState;
  /** Set by the dev server on every write, never by the app: whether the
   *  element this note points at can still be found in the source.
   *  Read it with `claimCheck()`. */
  found?: 'present' | 'absent' | 'unknown';
  anchor: ReviewAnchor;
  createdAt: string;
  updatedAt: string;
}

export type ReviewNotes = Record<string, ReviewNote>;
