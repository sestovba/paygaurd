/*
 * ONE state per note.
 *
 * The console used to carry two parallel answers to "where has this got to":
 * a lane the reviewer dragged (`status`) and a verdict the audit set
 * (`verdict`), plus four booleans — hidden, stow, placement, members — that
 * the report read in a priority cascade. A note could truthfully say UNSURE,
 * [x] Done and HIDDEN at the same time, and forty-nine of fifty-two notes
 * ended up filed as done when a third of them had never been acted on.
 *
 * The fix is not more labels. It is that the state is derived from one field
 * with one meaning, the transitions between states are checked, and the thing
 * that actually got lost — who owes the next move — is stored rather than
 * inferred by whoever is reading.
 */

import type { ReviewNote } from './types';

/**
 * Where a note has got to. Exactly one of these is true at a time.
 *
 * The machine is deliberately small — an inbox, not a project tracker:
 *
 *     new ─→ needsYou ─→ sent ─→ answered ─→ done
 *              ↑                     │
 *              └─────────────────────┘   (reopen)
 *
 *     later    from any open state, comes back to needsYou
 *     wontDo   terminal, and says so out loud
 */
export type NoteState =
  | 'new'       // nobody has looked at it yet
  | 'needsYou'  // looked at; the reviewer still has to say what they want
  | 'trial'     // switched off on the page to find out whether it is missed
  | 'sent'      // has an ask, and it is Claude's move
  | 'answered'  // Claude replied; the reviewer confirms or reopens
  | 'done'      // closed, and the work behind it actually happened
  | 'later'     // deliberately not now
  | 'wontDo';   // decided against

export const STATES: NoteState[] = ['new', 'needsYou', 'trial', 'sent', 'answered', 'done', 'later', 'wontDo'];

/* One word each, deliberately.
 *
 * A chip on a row is read at a glance and never twice; "Trying without it"
 * and "With Claude" made the reader parse a phrase to learn one fact, and at
 * narrow widths they wrapped or truncated into nonsense. Every label in this
 * file is a single word, and the sentence that explains it lives in
 * STATE_BLURB where there is room for it. */
export const STATE_NAME: Record<NoteState, string> = {
  new: 'New',
  needsYou: 'Yours',
  trial: 'Trying',
  sent: 'Sent',
  answered: 'Answered',
  done: 'Done',
  later: 'Later',
  wontDo: 'Kept'
};

/** One line each, shown under the group heading. The reviewer should never
 *  have to remember what a word meant last week. */
export const STATE_BLURB: Record<NoteState, string> = {
  new: 'Not looked at yet.',
  needsYou: 'Say what you want done.',
  trial: 'Off the page while you see whether you miss it.',
  sent: 'Handed over. Waiting on Claude.',
  answered: 'Claude replied — check it and close it.',
  done: 'Acted on and confirmed.',
  later: 'Parked on purpose. Nothing is owed.',
  wontDo: 'Looked at and kept as it is.'
};

/** Whose move it is. `null` means nobody's — the note is closed or parked.
 *  This is the whole "what should I do next" answer, and the only thing the
 *  inbox groups by. */
export type Owner = 'you' | 'claude' | null;

export const OWNER_OF: Record<NoteState, Owner> = {
  new: 'you',
  needsYou: 'you',
  // A trial is a question you asked yourself and have not answered. It stays
  // yours: the whole point is that it comes back and asks whether you missed
  // the thing, rather than sitting in a Hidden room nobody reopens.
  trial: 'you',
  sent: 'claude',
  answered: 'you',
  done: null,
  later: null,
  wontDo: null
};

/** The three groups the sidebar shows. Everything else is a filter inside
 *  them, never another section. */
export type Bucket = 'needsYou' | 'withClaude' | 'closed';

export const BUCKET_NAME: Record<Bucket, string> = {
  needsYou: 'Yours',
  withClaude: 'Claude',
  closed: 'Closed'
};

export function bucketOf(state: NoteState): Bucket {
  const owner = OWNER_OF[state];
  return owner === 'you' ? 'needsYou' : owner === 'claude' ? 'withClaude' : 'closed';
}

/* ------------------------------------------------------------------ */
/* What a note is asking for                                          */
/* ------------------------------------------------------------------ */

/**
 * Does this note contain an instruction someone could act on?
 *
 * Being able to answer this is what stops an empty note reaching the report.
 * A verdict, a written comment or an intent tag all count; a bare selection
 * with none of them is a thing you pointed at, not a thing you asked for.
 */
export function hasAsk(note: ReviewNote): boolean {
  return Boolean(
    note.verdict
    || note.comment?.trim()
    || note.tags?.length
    || note.placement
    || note.kind === 'choice'
  );
}

/**
 * Is the ask one that only a code pass can satisfy? A cut, a move, a rewrite
 * — those are Claude's. Deciding to keep something as it is, or switching a
 * layer off to look at the page without it, is finished the moment the
 * reviewer decides it, and must never sit in "With Claude" waiting forever.
 *
 * A written comment counts even with no verdict attached, because "I could
 * not decide, so here is what I noticed" is the most common useful note there
 * is — and the console previously had nowhere to put it but `unsure`, a
 * verdict that reads like a decision and is not one.
 */
export function needsCode(note: ReviewNote): boolean {
  if (note.verdict === 'rejected') return false;      // keeping it: already settled
  if (note.kind === 'choice') return true;            // a winning variant has to be applied
  return Boolean(
    note.verdict === 'approved' || note.verdict === 'revise'
    || note.comment?.trim() || note.placement
  );
}

/** Has Claude answered since the reviewer last spoke? */
export function hasReply(note: ReviewNote): boolean {
  const last = note.thread?.[note.thread.length - 1];
  return last?.from === 'claude';
}

/**
 * Why this note cannot be sent yet, in the words the reviewer needs to fix
 * it. Empty array means it is ready to hand over.
 *
 * This is the "prevent a combination of confusing choices" rule: the console
 * refuses to produce an item that a code pass would have to guess at, and
 * says which of the two things is missing rather than failing silently.
 */
export function blockers(note: ReviewNote): string[] {
  const missing: string[] = [];
  if (!hasAsk(note)) missing.push('Say what should change — a comment, or pick Cut / Keep / Rework.');
  if (!note.anchor.source && !note.anchor.text && !note.anchor.domPath) {
    missing.push('Nothing identifies this element, so it cannot be found in the code.');
  }
  return missing;
}

/* ------------------------------------------------------------------ */
/* Reading the state                                                  */
/* ------------------------------------------------------------------ */

/**
 * The note's state, reading the stored field when it is one this version
 * knows and falling back to the old two-system layout otherwise.
 *
 * The fallback is not just migration politeness — it is the audit. A note
 * filed `done` under the old model while still carrying an unanswered ask for
 * Claude was never done, and comes back as `sent`, which is where it always
 * belonged. That single rule reclassifies the whole phantom-done backlog
 * without anyone re-triaging it by hand.
 */
export function stateOf(note: ReviewNote): NoteState {
  const stored = note.status as string;

  /* `done` is never taken at face value — not on the way in from the file,
   * and not from the console's own writes either.
   *
   * It is the one state that is a claim about the world rather than about the
   * reviewer: it says the code changed. Three things write this file — the
   * app, a code pass, and a person with an editor — and only one of them can
   * see the code. So the claim is checked against the evidence every time it
   * is read: an item that still owes a change, and has no reply saying the
   * change was made, is not done however it got labelled.
   *
   * This is what re-opened the fourteen notes that had been filed as finished
   * with nothing behind them, and it keeps them from being filed that way
   * again. Every other state is the reviewer's own business and is trusted. */
  if (stored !== 'done' && STATES.includes(stored as NoteState)) return stored as NoteState;

  if (note.verdict === 'rejected') return 'wontDo';
  if (stored === 'parked') return 'later';

  // Switched off on the page and no decision recorded yet: that is a trial in
  // progress, whatever lane it had been dragged into. Hiding is half of an
  // agreement to cut — the half that has not come back yet — so it belongs in
  // front of the reviewer with its own question, not filed as done.
  if (note.hidden && !note.verdict && !note.comment?.trim()) return 'trial';

  const owed = needsCode(note);
  if (stored === 'done') {
    if (!owed) return 'done';
    return hasReply(note) ? 'done' : 'sent';
  }
  if (stored === 'commented' || stored === 'second') {
    if (hasReply(note)) return 'answered';
    return owed ? 'sent' : 'needsYou';
  }
  // 'open', an unknown value, or nothing at all.
  if (hasReply(note)) return 'answered';
  if (owed) return 'sent';
  return hasAsk(note) ? 'needsYou' : 'new';
}

export function ownerOf(note: ReviewNote): Owner {
  return OWNER_OF[stateOf(note)];
}

/* "Off the page" deliberately has no definition here. It lives in stow.ts as
 * `isOffPage`, and one copy is the point: it is a fact about where an element
 * is, never a state and never a verdict. The old model let a stow silently
 * promote a note to Done, which is where much of the phantom backlog came
 * from — so nothing in this module reads it when deciding whose move it is. */

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
 * May this note move to `next`? The rules are few and each one exists because
 * its absence produced a note nobody could act on:
 *
 *  1. Only Claude closes Claude's work. The reviewer marking "remove this"
 *     as Done is how forty-nine notes came to claim work that never happened.
 *     They can park it, drop it, or reopen it — but Done is a statement about
 *     the code, and only a reply is evidence for it.
 *  2. Nothing is sent empty. An item with no ask is a thing you pointed at.
 *  3. Everything can always be parked or dropped. An escape hatch that is
 *     never blocked is what keeps this an inbox rather than a process.
 */
export function canMove(note: ReviewNote, next: NoteState): Move {
  const from = stateOf(note);
  if (from === next) return { ok: true };

  if (next === 'later' || next === 'wontDo') return { ok: true };

  if (next === 'sent') {
    const missing = blockers(note);
    if (missing.length) return { ok: false, why: missing[0] };
    return { ok: true };
  }

  if (next === 'done') {
    // A trial has not concluded anything yet. Closing it would file "I was
    // still looking at this" as a finished piece of work, which is the exact
    // shape of the mistake this module exists to stop.
    if (from === 'trial') {
      return {
        ok: false,
        why: 'This one is still off the page on trial. Answer it: Cut, or Restore.'
      };
    }
    if (!needsCode(note)) return { ok: true };
    if (hasReply(note)) return { ok: true };
    return {
      ok: false,
      why: 'This one is waiting on Claude. Send it, or settle it with Keep — Done means the code changed.'
    };
  }

  return { ok: true };
}

/**
 * The single button each state offers, so the row never shows five verbs of
 * which four are wrong. `null` where the state is genuinely terminal.
 */
export function nextStep(note: ReviewNote): { to: NoteState; verb: string; hint: string } | null {
  switch (stateOf(note)) {
    case 'new':
      return { to: 'needsYou', verb: 'Review', hint: 'Look at it and say what you want' };
    case 'needsYou':
      return needsCode(note)
        ? { to: 'sent', verb: 'Send', hint: 'Hand this over as an action item' }
        : { to: 'done', verb: 'Close', hint: 'Your decision — nothing is owed' };
    // A trial has two honest endings and the row shows both, because
    // "did you miss it?" is a yes/no question and neither answer is a default.
    case 'trial':
      return { to: 'sent', verb: 'Cut', hint: 'You did not miss it — hand the removal to Claude' };
    case 'sent':
      return null;
    case 'answered':
      return { to: 'done', verb: 'Close', hint: 'Claude answered and you have checked it' };
    case 'done':
    case 'wontDo':
      return { to: 'needsYou', verb: 'Reopen', hint: 'Put it back in the queue' };
    case 'later':
      return { to: 'needsYou', verb: 'Reopen', hint: 'Bring it back into the queue' };
  }
}

/** The second answer, where the state has one. Shown beside `nextStep` so a
 *  trial never has to be resolved by hunting for a control somewhere else. */
export function altStep(note: ReviewNote): { to: NoteState; verb: string; hint: string } | null {
  if (stateOf(note) !== 'trial') return null;
  return { to: 'wontDo', verb: 'Restore', hint: 'You missed it — keep it as it is' };
}

/** Vocabulary for the decisions, in the reviewer's own terms. Nothing here
 *  deletes anything: approving a cut queues it for a code pass and stays
 *  reversible until that pass runs, which is what "Cut it" has to convey
 *  without sounding like the row is about to disappear. */
export const VERDICT_NAME: Record<string, string> = {
  approved: 'Cut',
  rejected: 'Keep',
  revise: 'Rework',
  // Retained only so notes written under the old vocabulary still render.
  // Nothing offers it any more: an undecided note with something to say is a
  // comment, and one with nothing to say is not a finding.
  unsure: 'Note'
};

/* ------------------------------------------------------------------ */
/* The decision set — one list, every surface                         */
/* ------------------------------------------------------------------ */

/**
 * There are four places to answer a note: the badge on the element in audit
 * mode, the card in Go Through, a row in the inbox, and the toolbar after a
 * selection. They used to offer four different vocabularies on two different
 * axes — Remove / Kept / Note / Unsure in one, Keep As-Is / Remove / Request
 * changes / Done in the next, five lanes in the third. Same note, same
 * question, four answers that did not line up.
 *
 * So the answers live here, once, and every surface renders this list. A
 * surface may show fewer of them; it may never invent one, rename one, or put
 * them in a different order.
 */
export type DecisionId = 'cut' | 'rework' | 'trial' | 'note' | 'keep' | 'later';

export interface Decision {
  id: DecisionId;
  /** The button. A verb, always — what pressing it does. */
  verb: string;
  /** The one-line explanation, for the tooltip and the empty states. */
  hint: string;
  /** Where the note lands. */
  to: NoteState;
  /** The verdict recorded with it, when there is one. */
  verdict?: 'approved' | 'rejected' | 'revise';
  /** True when the console must collect prose before it can be filed —
   *  the surface opens the composer rather than acting immediately. */
  needsWords?: boolean;
  /** True when this switches the element off on the page (display: none). */
  hides?: boolean;
}

export const DECISIONS: Decision[] = [
  {
    id: 'cut',
    verb: 'Cut',
    hint: 'Agree it should go. Queued for a code pass — nothing is deleted here.',
    to: 'sent',
    verdict: 'approved'
  },
  {
    id: 'rework',
    verb: 'Rework',
    hint: 'Keep it, but change it. Say what you want.',
    to: 'sent',
    verdict: 'revise',
    needsWords: true
  },
  {
    id: 'trial',
    // The reviewer's own word for it, and the mechanism: the element gets
    // display:none. Pressing Hide puts the note into Trying.
    verb: 'Hide',
    hint: 'Take it off the page and see whether you miss it. Comes back to ask.',
    to: 'trial',
    hides: true
  },
  {
    id: 'note',
    // Not "Note": the panel is Notes, every row in it is a note, and a button
    // called Note on a note says nothing. This one hands the thing over as a
    // question instead of a decision, which is what "Ask" means.
    verb: 'Ask',
    hint: 'Something to say, no decision yet. Goes to Claude as a question.',
    to: 'sent',
    needsWords: true
  },
  {
    id: 'keep',
    verb: 'Keep',
    hint: 'Looked at, staying as it is. Closes the item.',
    to: 'wontDo',
    verdict: 'rejected'
  },
  {
    id: 'later',
    verb: 'Later',
    hint: 'Not now. Comes back when you unpark it.',
    to: 'later'
  }
];

export const DECISION: Record<DecisionId, Decision> =
  Object.fromEntries(DECISIONS.map((d) => [d.id, d])) as Record<DecisionId, Decision>;

/**
 * Which decisions a surface offers, given where the note already is.
 *
 * A trial has already been taken off the page, so offering "Try without it"
 * again is a control that does nothing; what it needs is the two answers to
 * the question it asked. Everything else gets the full set — the same six, in
 * the same order, wherever you are.
 */
export function decisionsFor(note: ReviewNote): Decision[] {
  if (stateOf(note) === 'trial') {
    return [DECISION.cut, DECISION.rework, DECISION.keep, DECISION.later];
  }
  return DECISIONS;
}

/* ------------------------------------------------------------------ */
/* Progress                                                           */
/* ------------------------------------------------------------------ */

export interface Progress {
  total: number;
  needsYou: number;
  withClaude: number;
  closed: number;
  /** 0–1, closed over total. The one number in the header. */
  ratio: number;
}

export function progressOf(notes: ReviewNote[]): Progress {
  let needsYou = 0;
  let withClaude = 0;
  let closed = 0;
  for (const note of notes) {
    const bucket = bucketOf(stateOf(note));
    if (bucket === 'needsYou') needsYou += 1;
    else if (bucket === 'withClaude') withClaude += 1;
    else closed += 1;
  }
  const total = notes.length;
  return { total, needsYou, withClaude, closed, ratio: total ? closed / total : 1 };
}

/* ------------------------------------------------------------------ */
/* How sure I am                                                      */
/* ------------------------------------------------------------------ */

/**
 * The certainty attached to a proposal I made.
 *
 * Every AI suggestion used to arrive at the same volume. "This stat tile is
 * printed again three rows below it" and "this chart may not earn its height"
 * were both just `reason` text, so the reviewer had to re-derive how much to
 * trust each one — which is the work the proposal was supposed to save.
 *
 * Three levels, because two is a coin flip and four invites splitting hairs:
 *
 *   sure    Checkable from the code or the screen. Duplication, a control in
 *           two places, a stat that contradicts another. Little judgement.
 *   likely  A real argument, but it leans on how the product is used. The
 *           default, and the honest answer most of the time.
 *   hunch   A question wearing a proposal's clothes. Yours to call; I would
 *           not act on this without you.
 */
export type Certainty = 'sure' | 'likely' | 'hunch';

export const CERTAINTY: Certainty[] = ['sure', 'likely', 'hunch'];

export const CERTAINTY_NAME: Record<Certainty, string> = {
  sure: 'Sure',
  likely: 'Likely',
  hunch: 'Hunch'
};

export const CERTAINTY_BLURB: Record<Certainty, string> = {
  sure: 'Checkable from the code. Little judgement involved.',
  likely: 'A real argument, but it depends on how the product is used.',
  hunch: 'A question more than a claim. Your call entirely.'
};

/** Sure first. Clearing the checkable ones is quick and builds the sense of
 *  progress the queue exists to give; the hunches are where the thinking is,
 *  and they deserve a reviewer who is not still warming up. */
export const CERTAINTY_RANK: Record<Certainty, number> = { sure: 0, likely: 1, hunch: 2 };

export function certaintyOf(note: ReviewNote): Certainty | null {
  const value = note.certainty;
  return value && CERTAINTY.includes(value) ? value : null;
}

/* ------------------------------------------------------------------ */
/* How big the change is                                              */
/* ------------------------------------------------------------------ */

/**
 * The size of the work a proposal implies.
 *
 * Certainty says how sure I am the diagnosis is right. Effort says how much
 * it costs to act on. They are different axes and both are mine to estimate —
 * I am the one who would do it — and together they answer "what next" better
 * than either does alone:
 *
 *                  Small            Large
 *      Sure    do it now        worth planning
 *      Hunch   cheap to try     usually skip
 *
 * Words chosen so they cannot be misread as certainty when the two chips sit
 * side by side: Sure / Likely / Hunch are about truth, Small / Medium / Large
 * are about size, and no word appears in both scales.
 */
export type Effort = 'small' | 'medium' | 'large';

export const EFFORTS: Effort[] = ['small', 'medium', 'large'];

export const EFFORT_NAME: Record<Effort, string> = {
  small: 'Small',
  medium: 'Medium',
  large: 'Large'
};

export const EFFORT_BLURB: Record<Effort, string> = {
  small: 'A contained edit — one element, one file.',
  medium: 'Several files, or one that needs care.',
  large: 'Touches a shape the rest of the app relies on.'
};

export const EFFORT_RANK: Record<Effort, number> = { small: 0, medium: 1, large: 2 };

export function effortOf(note: ReviewNote): Effort | null {
  const value = note.effort;
  return value && EFFORTS.includes(value) ? value : null;
}

/**
 * The order to work in: certain-and-small first, uncertain-and-large last.
 * Summing the two ranks is deliberately blunt — a Sure/Large and a
 * Hunch/Small both land in the middle, which is honest, because choosing
 * between those two is a judgement rather than an arithmetic.
 */
export function priorityOf(note: ReviewNote): number {
  return CERTAINTY_RANK[certaintyOf(note) ?? 'likely'] + EFFORT_RANK[effortOf(note) ?? 'medium'];
}

/* ------------------------------------------------------------------ */
/* Checking the claim                                                 */
/* ------------------------------------------------------------------ */

export type Claim = 'ok' | 'suspect' | 'unchecked';

/**
 * Does the record agree with the code?
 *
 * `stateOf` already refuses to call something Done while a change is still
 * owed and unanswered. That catches the bookkeeping error. It cannot catch
 * the other one: a note that was answered — "Removed the stat tile" — where
 * the tile is still there. Only the source can settle that, so the dev server
 * looks for the element on every write and leaves the result in `found`.
 *
 *   suspect    filed as a cut that is finished, and the element is still in
 *              the source. Someone is wrong, and it is worth knowing which.
 *   ok         the element is gone, which is what a finished cut looks like.
 *   unchecked  no handle worth searching for. Most notes, honestly — see
 *              `anchor.sourceLine`, which exists to raise that number.
 *
 * Only cuts are checked. "Reword this" leaves the element in place, so its
 * still being there says nothing at all.
 */
export function claimCheck(note: ReviewNote): Claim {
  const cutting = note.verdict === 'approved' || note.tags?.includes('remove');
  if (!cutting) return 'unchecked';
  if (stateOf(note) !== 'done') return 'unchecked';
  if (note.found === 'present') return 'suspect';
  if (note.found === 'absent') return 'ok';
  return 'unchecked';
}
