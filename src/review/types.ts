import type { LayoutMode, LegacyLayoutId, OverviewShell } from '../state/storage';

/**
 * The layout a note was taken in.
 *
 * Wider than LayoutMode on purpose: classic, v2 and responsive became one
 * `overview` layout with a shell option, but 103 notes are anchored to the
 * old names and WHICH of the three a note was written against is part of
 * what it says. The ids stay; App.tsx translates one into a layout plus a
 * shell when you follow a note.
 */
export type ReviewLayoutId = LayoutMode | LegacyLayoutId;

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

/**
 * What a note is *about* — which is not always a thing on the screen.
 *
 * The console was built on one assumption: you point at a node, then you say
 * something about it. That is the common case and it is not the only one.
 * "Default should be rest of the year on all layouts" is not a note about the
 * scope picker in workrecord; it is a note about the product. Filed against
 * the one element that happened to be under the cursor, it reads as a local
 * tweak, gets fixed locally, and comes back on the next layout.
 *
 *   element  a node on the screen. The anchor is the DOM/source position.
 *   layout   this whole layout. The anchor is its README.
 *   global   the whole product. The anchor is a rule in the docs.
 *
 * Absent means `element`: every note written before this existed pointed at
 * something, and none of them have to be migrated to keep meaning what they
 * meant.
 */
export type ReviewScope = 'element' | 'layout' | 'global';

/**
 * The reference point for a note that is not about a node.
 *
 * Deliberately a heading in a markdown file that already exists, rather than
 * a free-text topic. The rules of this product are already written down and
 * already have names — "Who this is for", "Round down, always", "The device
 * is the constraint" — and a note filed against one of those lands in the
 * same vocabulary the answer will be written in. A topic the reviewer types
 * fresh is a topic only they can find again.
 *
 * `line` is where the heading was when the note was taken. It is refreshed on
 * every write, like `source` — a heading that moved is still the same rule,
 * and unlike `sourceLine` there is no ambiguity to preserve: the heading text
 * IS the evidence.
 */
export interface DocRef {
  /** Repo-relative: "CLAUDE.md", "docs/WORKING-WITH-SERGEY.md". */
  file: string;
  /** The heading's own text, without its #s. Absent means the whole file. */
  heading?: string;
  line?: number;
}

/**
 * The window the note was written at.
 *
 * Captured on every note, whatever its scope, because a third of the open
 * queue says "taller in mobile" and not one of those notes records how wide
 * the screen was. Without it "taller" is an instruction nobody can check they
 * have carried out.
 *
 * The bands are the app's own breakpoints, not the device's: what matters is
 * which set of CSS rules the reviewer was looking at.
 */
export interface Viewport {
  w: number;
  h: number;
  band: 'mobile' | 'tablet' | 'desktop';
}

/** The palette a note was taken under, so returning to it looks the same. */
export interface ReviewTheme {
  /** Sub-palette id: paper / slate / ledger / carbon / calc20. */
  sub?: string;
  dark?: boolean;
}

/** Where a note points, captured at the moment it was made. Everything here
 *  exists so an AI pass can find the element again from the file alone. */
export interface ReviewAnchor {
  /** What this note is about. Absent means `element` — see ReviewScope. */
  scope?: ReviewScope;
  /** The reference point, when the scope is `layout` or `global`. */
  doc?: DocRef;
  /** The window it was written at. Set for every scope. */
  viewport?: Viewport;
  /** Layout ("theme") the note was taken in.
   *
   *  Recorded even on a `global` note: "I was on payguard when I noticed
   *  this" is evidence about where a project-wide problem shows itself, and
   *  throwing it away to express "this is not about payguard" would lose it.
   *  `scope` says what the note is about; this says where it was seen. */
  layout: ReviewLayoutId;
  /** Which shell, when the layout is `overview`. A note about the workspace's
   *  pane deck is not a note about the same screen as one scroll — the old
   *  ids said this by being three different layouts, and this is where that
   *  information lives now. */
  shell?: OverviewShell;
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
  /** Screenshots pasted, dropped or picked onto this note, as repo-relative
   *  paths ("review/shots/…png"). The picture lives on disk; only its name
   *  lives in the notes file. */
  shots?: string[];
  thread?: ReviewReply[];
  /**
   * Set when the reviewer sends a settled note back — "you say it's done, I
   * say it's not". Newer than the last answer means the note is owed again,
   * even with nothing typed, so disagreeing never requires writing an essay.
   * The next answer supersedes it. See hasAnswer() in state.ts.
   */
  reopenedAt?: string;
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
