/*
 * The words, in one place.
 *
 * Review note: "we need common language and have language variable that goes
 * into every template so that only the language thing gets updated and all
 * get this update, we should allow theme overrides for labels so that each
 * thing has their own label override in the context of that theme."
 *
 * Ten layouts grew their own vocabulary for the same eight or nine things.
 * The list of jobs is "Income sources" in three of them, "Income" in one,
 * "Streams" in the state layer, "Jobs" on payguard's tab bar and "SOURCES" in
 * workrecord's caps. None of that is a design decision anyone made; it is
 * nine authors and no list. So fixing a word meant finding every copy of it,
 * which is why "Income sources" survived being called blank-making in one
 * layout while staying in five others.
 *
 * Two rules hold here.
 *
 *   One key, one meaning. If two things need different words they are two
 *   keys. A key that means two things is how the drift started.
 *
 *   Overrides are for register, never for meaning. A dense monospace layout
 *   may say "JOBS" where a roomy one says "Income"; neither may say something
 *   the other does not. The override table below is checked against that by
 *   its own type: every override is a partial of the same key set, so a
 *   layout can only ever restate a word this file already has.
 *
 * The abbreviations are deliberately absent. "I cant follow that title, its
 * jargon and abbreviations" and "I dont need to even hear about TWP anywhere"
 * are the same instruction, and the way to keep it is to have nowhere for
 * TWP or SGA to be typed. What the app says instead is "your limit" — which
 * is unambiguous precisely because the app never shows you the other one.
 *
 * ── The four questions a label has to answer ─────────────────────────────
 *
 * Added in the content audit, because most of what was wrong was not a bad
 * word but a missing one. A label that leaves any of these to be guessed at
 * is a place the reader can enter the wrong number and never find out:
 *
 *   WHICH NUMBER?  Before tax, or what reached the bank? These differ by
 *                  hundreds of dollars against a limit measured in hundreds.
 *                  "Earned", "Amount", "Pay" and "Total" answer nothing.
 *   WHICH PERIOD?  This month, this year, or since you started? "Total" and
 *                  "so far" were both used for all three.
 *   OF WHAT?       "$162 left" — of the safety target, or of the limit?
 *                  "Room" and "left" never travel alone here.
 *   SO WHAT?       "Over your limit" is a fact. "Earning this much can stop
 *                  your monthly payments" is the fact and the stake.
 */

import { money } from './format';
import type { LayoutMode } from '../state/storage';

export interface Vocabulary {
  /** The list of things that pay you. */
  income: string;
  /** One of them. */
  incomeOne: string;
  /** Adding one. */
  incomeAdd: string;
  /** A wage job. */
  w2: string;
  /** Self-employment. */
  selfEmployed: string;
  /** The monthly amount you must not cross. Never named as a rule. */
  limit: string;
  /** The number this app aims at, which sits under the limit.
   *
   *  As a LABEL this is "Target amount" — Sergey's wording, and it names the
   *  figure, which "What we aim for" and the earlier "Play it safe" did not.
   *  In a SENTENCE the same fact is still said as "the $1,000 we aim for"
   *  (see roomToTargetLine): one meaning, two registers, which is exactly
   *  what a tone is allowed to change. */
  target: string;
  /** Money that counts towards the limit. */
  countable: string;
  /** A month the pay calendar gives an extra check to. */
  extraPayMonth: string;
  /** The 9 months, while they are still running. Empty once they are not —
   *  see the one-limit rule above: this is the only key allowed to be blank,
   *  and callers must not render it when it is. */
  trialMonths: string;
  /** The grade on a figure. */
  precision: string;
  /** The screen you land on. */
  overview: string;
  /** The screen where the limit lives. */
  limits: string;

  /* The money words. These four were the audit's largest single finding: the
     app had eleven labels for two numbers, and the two numbers differ by
     enough to change the answer. Every field that takes money uses one of
     these, and neither of them is ever called "Amount". */

  /** Pay before anything is taken out. The figure SSA counts, and the one a
   *  lot of people cannot find. */
  gross: string;
  /** The same figure, asked as a question, for layouts with room for one. */
  grossAsk: string;
  /** What actually reached the bank. The figure people do have. */
  net: string;
  /** The same, asked as a question. */
  netAsk: string;
  /** Gig work: what the app or the client actually paid, before miles come
   *  off. Deliberately not `gross`: nothing is withheld from a delivery
   *  payout, so asking a driver for the figure "before taxes" is a
   *  distinction with no difference behind it — and one they would then try
   *  to resolve, on the screen where a wrong number costs the most. */
  paidToYou: string;
  /** The same, asked as a question. */
  paidToYouAsk: string;
  /** Hours worked. Never "hrs". */
  hoursWorked: string;
  /** Business miles. Never "mi", and never bare "Miles" — the word has to
   *  say *for work*, because personal miles do not come off. */
  workMiles: string;
}

/*
 * ── Tone ─────────────────────────────────────────────────────────────────
 *
 * Review note, from Sergey, while this audit was running: "We need voice and
 * tone, each layout is different, so I wonder if we can have variants so each
 * layout can get option on how it reads" — and, on how strict to be about it:
 * "we can do military, all labels are the same, but then we can have
 * variants."
 *
 * That is the whole design, and the two halves of it pull in opposite
 * directions on purpose:
 *
 *   MILITARY   The key set is fixed and every tone is a *complete*
 *              Vocabulary, not a patch. A tone cannot quietly drop a label,
 *              cannot invent one, and cannot leave a gap that falls through
 *              to another voice. The type enforces it — this is the
 *              discipline that stops ten layouts drifting apart again.
 *
 *   VARIANTS   Within that, a layout reads in the voice that suits it. A
 *              monospace column of twelve months and a phone screen with one
 *              question on it should not be made to say the same sentence,
 *              and forcing them to was how "Income sources" ended up called
 *              blank-making in one layout and shipped in five others.
 *
 * The line between them is meaning. A tone may change the register, the
 * length, the person and the punctuation. It may never change the fact, the
 * subject or the number. "Reached your bank", "Into your bank" and "How much
 * reached your bank?" are one meaning in three voices; "Pay" and "Amount"
 * are not a voice, they are a missing answer to *which number*.
 */

export type Tone =
  /** Full sentences, second person, warm. The roomy layouts. */
  | 'plain'
  /** The shortest complete label. Dense monospace columns, where a label
   *  shares a row with eleven others — short, but never unfinished. */
  | 'compact'
  /** Questions, one idea a line, the fewest words of any of them. The phone
   *  and the flagship: "How much did they pay you?" rather than a noun. */
  | 'spoken';

/** Which layout reads in which voice. One line, so the answer to "why does
 *  this screen sound like that" is in one place rather than in the screen. */
export const LAYOUT_TONE: Record<LayoutMode, Tone> = {
  overview: 'plain',
  horizon: 'plain',
  ledger: 'compact',
  payguard: 'compact',
  workrecord: 'compact',
  calc20: 'compact',
  pocket: 'spoken',
  plan: 'spoken'
};

/*
 * ── The master vocabulary ────────────────────────────────────────────────
 *
 * "but we do need master vocabulary" — and this is it. Two halves:
 *
 *   The KEY SET, above, is the master list of things this product has words
 *   for. One key, one meaning. Adding a concept means adding a key, which
 *   every tone must then answer — that is the military half, and it is the
 *   type system's job rather than a convention anyone has to remember.
 *
 *   PLAIN, below, is the master RENDERING: the canonical way to say each of
 *   them. The other tones are read against this one. When two tones disagree
 *   about what a key means, PLAIN is the tie-break, and one of them is wrong.
 *
 * Exported as MASTER so a doc, a test or a future lint can point at the
 * canonical wording rather than re-typing it.
 */
const PLAIN: Vocabulary = {
  income: 'Income',
  incomeOne: 'Job',
  incomeAdd: 'Add income',
  w2: 'A job that pays me',
  selfEmployed: 'Work I do for myself',
  limit: 'Your limit',
  target: 'Target amount',
  countable: 'Counted',
  extraPayMonth: 'Months that pay you extra',
  trialMonths: 'Trial work months',
  precision: 'How sure this is',
  overview: 'Overview',
  limits: 'Your limit',

  gross: 'Pay before taxes',
  grossAsk: 'What were you paid before taxes?',
  net: 'Money that reached your bank',
  netAsk: 'How much reached your bank?',
  paidToYou: 'Money they paid you',
  paidToYouAsk: 'How much did they pay you?',
  hoursWorked: 'Hours you worked',
  workMiles: 'Miles you drove for work'
};

/*
 * The short voice. Every entry here is the shortest form that still answers
 * its question — which is why "Gross" is not in it. Shortening is allowed to
 * drop words the row already supplies (a column under a job's name need not
 * repeat "you"); it is not allowed to drop the word that says which number.
 */
const COMPACT: Vocabulary = {
  ...PLAIN,
  income: 'Jobs',
  incomeAdd: 'Add',
  w2: 'Employer',
  selfEmployed: 'Gig work',
  extraPayMonth: 'Extra paychecks',
  precision: 'How sure',

  gross: 'Before taxes',
  grossAsk: 'Pay before taxes',
  net: 'Reached your bank',
  netAsk: 'Reached your bank',
  paidToYou: 'Paid to you',
  paidToYouAsk: 'Paid to you',
  hoursWorked: 'Hours worked',
  workMiles: 'Work miles'
};

/*
 * The spoken voice. Asks rather than labels, wherever there is a question to
 * ask — the rule from the foot of TrackerPocket.tsx: "a label names a
 * database column; a question tells you what to do."
 */
const SPOKEN: Vocabulary = {
  ...PLAIN,
  income: 'Jobs',
  incomeOne: 'Job',
  incomeAdd: 'Add',
  countable: 'Counts toward your limit',
  extraPayMonth: 'Extra pay',
  trialMonths: 'Trial work months',
  precision: 'How sure this is',

  gross: 'Before taxes',
  grossAsk: 'What did your paystub say before taxes?',
  net: 'Into your bank',
  netAsk: 'How much went into your bank?',
  paidToYou: 'Paid to you',
  paidToYouAsk: 'How much did they pay you?',
  hoursWorked: 'How many hours did you work?',
  workMiles: 'How many miles did you drive for work?'
};

/** The canonical rendering of every key. See the master block above. */
export const MASTER: Vocabulary = PLAIN;

/**
 * The anti-vocabulary: words that must not reach a screen, and what to say
 * instead.
 *
 * A master vocabulary that only lists what to say is half a vocabulary. Every
 * one of these was on screen when the content audit started, and each one is
 * banned for a stated reason rather than a preference — three of them can
 * cost the reader money, and the rest cost them the thread.
 *
 * Kept as data, not prose, so it can be checked rather than believed.
 */
export const NEVER: ReadonlyArray<{ word: string; say: string; because: string }> = [
  { word: 'TWP', say: 'trial work months', because: 'An abbreviation of a rule the reader never agreed to learn.' },
  { word: 'SGA', say: 'your monthly limit', because: 'Same, and it names the limit that does not apply half the time.' },
  { word: 'Substantial Gainful Activity', say: 'your monthly limit', because: 'Explaining Social Security back to the reader.' },
  { word: 'Trial Work Period', say: 'trial work months', because: 'A proper noun for a thing the reader experiences as a count of months.' },
  { word: 'YTD', say: 'so far this year', because: 'An abbreviation, and it hides which months are in the total.' },
  { word: 'IRWE', say: 'work costs your disability makes you pay', because: 'Four letters for a sentence.' },
  { word: 'Gross', say: 'pay before taxes', because: 'The single most common way this kind of form is filled in wrong.' },
  { word: 'Net', say: 'what reached your bank', because: 'Same, from the other side.' },
  { word: 'Countable', say: 'counted toward your limit', because: 'Names a calculation rather than a consequence.' },
  { word: 'Earned', say: 'paid to you, before taxes', because: 'Does not say which number, on a field that takes money.' },
  { word: 'Amount', say: 'the money word that applies', because: 'Answers none of the four questions.' },
  { word: 'Room', say: 'left before your limit', because: 'A distance with no destination.' },
  { word: 'hrs', say: 'hours', because: 'A unit is the last word to abbreviate — it says what the number is.' },
  { word: 'mi', say: 'miles', because: 'Same.' },
  { word: 'on track', say: 'the literal fact', because: 'An idiom, on a screen read by people told there would be none.' },
  { word: 'on course', say: 'the literal fact', because: 'Same.' },
  { word: 'burn', say: 'uses', because: 'A metaphor for spending a trial work month.' },
  { word: 'runway', say: 'the months ahead', because: 'Same.' }
];

const TONES: Record<Tone, Vocabulary> = {
  plain: PLAIN,
  compact: COMPACT,
  spoken: SPOKEN
};

/**
 * The local layer: one layout, one word, where its tone is not quite right
 * for it.
 *
 * Global first, then local. The tone above says how a whole family of screens
 * reads; this is the exception a single screen has earned. Kept deliberately
 * thin — an entry here claims this one layout needs a word the others in its
 * voice do not, and most of the time that claim is false and the tone was the
 * thing that wanted changing.
 *
 * Still partial, still typed against the master key set, so a layout can only
 * ever restate a word that already exists.
 */
const OVERRIDES: Partial<Record<LayoutMode, Partial<Vocabulary>>> = {
  ledger: {
    // The one screen that says "Countable" out loud: its own table has had a
    // column of that name since it was written. Every other screen says
    // "Counted".
    countable: 'Countable',
    extraPayMonth: 'Extra paycheck months'
  },
  pocket: {
    // The smallest screen there is, one step shorter than its own voice.
    extraPayMonth: 'Extra pay'
  }
};

/** The voice a layout reads in. */
export function toneFor(layout: LayoutMode): Tone {
  return LAYOUT_TONE[layout];
}

/** The words for one layout: its tone, then its own exceptions. */
export function copyFor(layout: LayoutMode): Vocabulary {
  return { ...TONES[toneFor(layout)], ...(OVERRIDES[layout] ?? {}) };
}

/**
 * What the limit in force is called, wherever one has to be named in a
 * sentence — never "TWP" or "SGA".
 *
 * It is a constant rather than a function of the regime, and that is the
 * whole point: both regimes are "your limit" to the person reading, because
 * the app never shows them the other one. Anything that took the regime as an
 * argument would be an invitation to start distinguishing them again.
 */
export const LIMIT_NAME = 'your monthly limit';

/*
 * ── Sentences ────────────────────────────────────────────────────────────
 *
 * The phrases below repeat across layouts with a number dropped into them.
 * They live here for the reason the words above do: "$162 left" was printed
 * by six files, and in four of them nothing said what it was left *of*.
 *
 * Every one of these names the thing the number is measured against. That is
 * not verbosity — it is the difference between a reader who knows they have
 * $162 of headroom and one who thinks they have $162 of income.
 */

/** Room before the limit. Never "$162 left" on its own. */
export function roomLine(room: number): string {
  return `${money(room)} left before ${LIMIT_NAME}`;
}

/** Past the limit. The one line that must never be softened. */
export function overLine(over: number): string {
  return `${money(over)} over ${LIMIT_NAME}`;
}

/** Room before the figure the app aims at, which is under the limit. Said
 *  with the limit beside it, because a reader told they have room to a number
 *  they have never seen will assume it is the limit. */
export function roomToTargetLine(room: number, target: number, limit: number): string {
  return `${money(room)} left before the ${money(target)} we aim for. ${money(limit)} is the limit.`;
}

/** How many of the nine are gone. Always "of your 9", never a bare count and
 *  never "TWP". */
export function trialMonthsLine(used: number, total: number): string {
  return `${used} of your ${total} trial work months used`;
}

/**
 * What a column of money covers. "Total" and "so far" were each doing duty
 * for three different windows; this says which one.
 */
export function periodLabel(year: number, isPartialYear: boolean): string {
  return isPartialYear ? `So far in ${year}` : `All of ${year}`;
}

/**
 * How the two kinds of income are offered to somebody choosing between them.
 *
 * Not "W-2 employee" and "1099 contract". Those are categories on a tax form,
 * and somebody delivering for DoorDash does not know they are the second one
 * — so they pick the first, and lose the mileage deduction that only the
 * second one has. That is not a wording preference: CLAUDE.md puts $1,000 of
 * delivery pay at under $300 countable once the miles come off, so picking
 * the wrong door here can be the difference between safe and over.
 *
 * It lives in one place because it was written twice with different words —
 * ui.tsx offered the plain pair while the workspace's own Add income sheet
 * offered the tax-form pair, on the same decision.
 */
export const SOURCE_CHOICE: Record<'w2' | 'ten99', { label: string; description: string }> = {
  w2: {
    label: 'A job that pays me',
    description: 'An employer pays you, and takes tax out before you get it.'
  },
  ten99: {
    label: 'Delivery or gig work',
    description: 'Driving, deliveries, or work you invoice for. Nothing is taken out.'
  }
};

/**
 * The same pair, one word each, for a chip or a table cell.
 *
 * "W-2" and "1099" are the tax-form names and were on screen in nine places.
 * A reader who does not know which one they are cannot be helped by a badge
 * that assumes they do.
 */
export const SOURCE_SHORT: Record<'w2' | 'ten99', string> = {
  w2: 'Employer',
  ten99: 'Gig work'
};
