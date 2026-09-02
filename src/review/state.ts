/*
 * What a note's state means. The state itself is in types.ts, because it is
 * part of the note's shape; this file owns the reading, the moving and the
 * one rule that is not the reviewer's to assert.
 *
 * There were two of these once — five lanes here, eight states there, a
 * verdict as a third axis and a derived Do column as a fourth — and a note
 * could truthfully say UNSURE, Done and HIDDEN at the same time. The fix was
 * never more labels. It is that whose-move-it-is is stored, once, and
 * everything else is derived from the note's own contents.
 */

import type { NoteState, ReviewNote } from './types';

export const STATES: NoteState[] = ['yours', 'sent', 'closed'];

/** One word each. The sentence that explains it lives in STATE_BLURB, where
 *  there is room for it — a chip on a row is read at a glance and never
 *  twice. */
export const STATE_NAME: Record<NoteState, string> = {
  yours: 'Yours',
  sent: 'Sent',
  closed: 'Closed'
};

export const STATE_BLURB: Record<NoteState, string> = {
  yours: 'Say what you want done.',
  sent: 'Handed over. Waiting on Claude.',
  closed: 'Settled. Still findable.'
};

/* ------------------------------------------------------------------ */
/* What a note is asking for                                          */
/* ------------------------------------------------------------------ */

/**
 * Does this note contain something someone could act on?
 *
 * Being able to answer this is what stops an empty note reaching the report.
 * Written words or an intent tag count; a bare selection with neither is a
 * thing you pointed at, not a thing you asked for.
 *
 * This used to be two functions — `hasAsk` and `needsCode` — which differed
 * only in whether a `rejected` verdict was present. With the verdict gone,
 * "keeping it as it is" is `closed`, a state, and the two collapse into one.
 */
export function hasAsk(note: ReviewNote): boolean {
  return Boolean(note.comment?.trim() || note.tags?.length);
}

/** A path to a real file in this repository. */
const NAMES_A_FILE = /\b(?:src|review|docs|public)\/[\w.-]+(?:\/[\w.-]+)*\.\w+/;

/** Has Claude answered since the reviewer last spoke? */
export function hasReply(note: ReviewNote): boolean {
  return note.thread?.[note.thread.length - 1]?.from === 'claude';
}

/**
 * Does the last reply say which code changed?
 *
 * This is the evidence the "done is earned" rule asks for, made checkable.
 * `hasReply` only knows who spoke last; any answer at all — including "I
 * could not find it" — would otherwise read as the work having happened.
 */
export function replyNamesChange(note: ReviewNote): boolean {
  const last = note.thread?.[note.thread.length - 1];
  return last?.from === 'claude' && NAMES_A_FILE.test(last.text);
}

/**
 * Why this note cannot be sent yet, in the words the reviewer needs to fix
 * it. Empty array means it is ready to hand over.
 */
export function blockers(note: ReviewNote): string[] {
  const missing: string[] = [];
  if (!hasAsk(note)) missing.push('Say what should change — a few words, or pick a tag.');
  if (!note.anchor.source && !note.anchor.text && !note.anchor.domPath) {
    missing.push('Nothing identifies this element, so it cannot be found in the code.');
  }
  return missing;
}

/* ------------------------------------------------------------------ */
/* Reading the state                                                  */
/* ------------------------------------------------------------------ */

/** Values written by older versions of the console, and by hand. Mapped
 *  rather than dropped: an unrecognised state must never make a note vanish
 *  off the board, so anything unknown lands in `yours` where it can be seen. */
const LEGACY: Record<string, NoteState> = {
  new: 'yours',
  needsYou: 'yours',
  trial: 'yours',
  open: 'yours',
  answered: 'yours',
  commented: 'sent',
  second: 'sent',
  done: 'closed',
  later: 'closed',
  wontDo: 'closed',
  parked: 'closed'
};

/**
 * The note's state.
 *
 * Two things are decided here rather than trusted, and both are about the one
 * state that is a claim about the world rather than about the reviewer:
 *
 *  1. **Closed is never asserted, only earned.** Three things write this file
 *     — the app, a code pass, and a person with an editor — and only one of
 *     them can see the code. A note that still owes a change and has no reply
 *     saying it was made is not closed, whoever typed the word. This is what
 *     reopened the phantom-done backlog and keeps it from re-forming.
 *
 *  2. **Work asked for and received is not the reviewer's to file.** A note
 *     whose reply names the file it changed does not belong in anybody's
 *     queue. It is marked as closed by Claude, not hidden, so it can be
 *     spot-checked and reopened in one press.
 */
export function stateOf(note: ReviewNote): NoteState {
  const stored = note.status as string;
  const state: NoteState = STATES.includes(stored as NoteState)
    ? stored as NoteState
    : LEGACY[stored] ?? 'yours';

  const owed = hasAsk(note);

  if (state === 'closed') {
    if (!owed) return 'closed';
    return replyNamesChange(note) ? 'closed' : 'sent';
  }

  // Answered with evidence, from either side of the board.
  if (owed && replyNamesChange(note)) return 'closed';
  if (state === 'sent' && hasReply(note)) return 'yours';
  return state;
}

/** Closed by the work rather than by the reviewer — so the row can say so. */
export function closedByClaude(note: ReviewNote): boolean {
  return note.status !== 'closed' && hasAsk(note) && replyNamesChange(note);
}

/* ------------------------------------------------------------------ */
/* Changing the state                                                 */
/* ------------------------------------------------------------------ */

export interface Refusal {
  ok: false;
  /** Said to the reviewer as-is, so it has to name the way out. */
  why: string;
}
export type Move = { ok: true } | Refusal;

/**
 * May this note move to `next`?
 *
 * Two rules, each here because its absence produced a note nobody could act
 * on: nothing is sent empty, and only a reply closes work that was handed
 * over. Everything else is always allowed — an escape hatch that is never
 * blocked is what keeps this an inbox rather than a process.
 */
export function canMove(note: ReviewNote, next: NoteState): Move {
  if (stateOf(note) === next) return { ok: true };

  if (next === 'sent') {
    const missing = blockers(note);
    return missing.length ? { ok: false, why: missing[0] } : { ok: true };
  }

  if (next === 'closed' && hasAsk(note) && !hasReply(note)) {
    return {
      ok: false,
      why: 'This one still asks for a change. Send it, or clear what it asks for — Closed means it was dealt with.'
    };
  }

  return { ok: true };
}

/** The single button a state offers, so a row never shows three verbs of
 *  which two are wrong. */
export function nextStep(note: ReviewNote): { to: NoteState; verb: string; hint: string } | null {
  switch (stateOf(note)) {
    case 'yours':
      return hasAsk(note)
        ? { to: 'sent', verb: 'Send', hint: 'Hand it over' }
        : { to: 'closed', verb: 'Close', hint: 'Nothing is owed' };
    case 'sent':
      return { to: 'closed', verb: 'Close', hint: 'Checked the reply — settled' };
    default:
      return { to: 'yours', verb: 'Reopen', hint: 'Put it back in your queue' };
  }
}

/* ------------------------------------------------------------------ */
/* What you can do to a note                                          */
/* ------------------------------------------------------------------ */

export type DecisionId = 'cut' | 'say' | 'hide' | 'close';

export interface Decision {
  id: DecisionId;
  /** The button. A verb, always — what pressing it does. */
  verb: string;
  hint: string;
  /** Where the note lands. */
  to: NoteState;
  /** Recorded as the kind of change being asked for. */
  tag?: string;
  /** True when the console must collect words before it can file this. */
  needsWords?: boolean;
  /** True when this switches the element off on the page. */
  hides?: boolean;
}

/**
 * Four, down from six.
 *
 * Cut and Say both hand the note over and differ only in whether the reviewer
 * has to type — a proposal already said what it wanted, so agreeing to one
 * needs no words. Keep and Later both meant "nobody's move" and neither was
 * ever used: across 222 notes, every closed one was closed as done. So they
 * are one button, and it says what it does.
 */
export const DECISIONS: Decision[] = [
  {
    id: 'cut',
    verb: 'Cut',
    hint: 'Agree it should go. Queued for a code pass — nothing is deleted here.',
    to: 'sent',
    tag: 'cut'
  },
  {
    id: 'say',
    verb: 'Say',
    hint: 'Say what you want changed. Goes to Claude.',
    to: 'sent',
    needsWords: true
  },
  {
    id: 'hide',
    verb: 'Hide',
    hint: 'Take it off the page and see whether you miss it. Reversible, no code touched.',
    to: 'yours',
    hides: true
  },
  {
    id: 'close',
    verb: 'Close',
    hint: 'Nothing more owed on this one.',
    to: 'closed'
  }
];

export const DECISION: Record<DecisionId, Decision> =
  Object.fromEntries(DECISIONS.map((d) => [d.id, d])) as Record<DecisionId, Decision>;

/** The same four, in the same order, wherever you are — except that a note
 *  already off the page has nothing to hide. */
export function decisionsFor(note: ReviewNote): Decision[] {
  return note.hidden ? DECISIONS.filter((d) => d.id !== 'hide') : DECISIONS;
}

/* ------------------------------------------------------------------ */
/* Tags — what kind of change this is                                 */
/* ------------------------------------------------------------------ */

/** Four, and they earn their place: each one changes how a code pass reads
 *  the note before a word of the prose is read. Trimmed from eight — the
 *  other four were either synonyms of these or descriptions of a feeling. */
export const TAGS = ['cut', 'move', 'reword', 'redesign'] as const;

export type Tag = typeof TAGS[number];

export const TAG_NAME: Record<Tag, string> = {
  cut: 'Cut',
  move: 'Move',
  reword: 'Reword',
  redesign: 'Redesign'
};

/** What the four absorbed. 'remove' was the old name for a cut and is on more
 *  notes than 'cut' itself, so it is read as one rather than being lost;
 *  'confusing' and 'bug' described how the reviewer felt about the element
 *  rather than what should happen to it, which the prose already says
 *  better. */
const TAG_ALIAS: Record<string, Tag> = { remove: 'cut', architecture: 'redesign' };

/** A note's tags in the current vocabulary, with anything unrecognised
 *  dropped rather than rendered as a chip nobody can filter by. */
export function tagsOf(note: ReviewNote): Tag[] {
  const out: Tag[] = [];
  for (const raw of note.tags ?? []) {
    const tag = TAGS.includes(raw as Tag) ? raw as Tag : TAG_ALIAS[raw];
    if (tag && !out.includes(tag)) out.push(tag);
  }
  return out;
}

/* ------------------------------------------------------------------ */
/* Progress                                                           */
/* ------------------------------------------------------------------ */

export interface Progress {
  total: number;
  yours: number;
  sent: number;
  closed: number;
  /** 0–1, closed over total. The one number in the header. */
  ratio: number;
}

export function progressOf(notes: ReviewNote[]): Progress {
  let yours = 0;
  let sent = 0;
  let closed = 0;
  for (const note of notes) {
    const state = stateOf(note);
    if (state === 'yours') yours += 1;
    else if (state === 'sent') sent += 1;
    else closed += 1;
  }
  const total = notes.length;
  return { total, yours, sent, closed, ratio: total ? closed / total : 0 };
}

/* ------------------------------------------------------------------ */
/* Does the record agree with the code?                               */
/* ------------------------------------------------------------------ */

export type Claim = 'ok' | 'suspect' | 'unchecked';

/**
 * `stateOf` already refuses to call something closed while a change is owed
 * and unanswered. That catches the bookkeeping error. It cannot catch the
 * other one: a note answered with "Removed the stat tile" where the tile is
 * still there. Only the source can settle that, so the dev server looks for
 * the element on every write and leaves the result in `found`.
 *
 *   suspect    filed as a finished cut, and the element is still in the
 *              source. Someone is wrong, and it is worth knowing which.
 *   ok         the element is gone, which is what a finished cut looks like.
 *   unchecked  no handle worth searching for.
 *
 * Only cuts are checked. "Reword this" leaves the element in place, so its
 * still being there says nothing at all.
 */
export function claimCheck(note: ReviewNote): Claim {
  if (!tagsOf(note).includes('cut')) return 'unchecked';
  if (stateOf(note) !== 'closed') return 'unchecked';
  if (note.found === 'present') return 'suspect';
  if (note.found === 'absent') return 'ok';
  return 'unchecked';
}
