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
 */

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
  /** The number this app aims at, which sits under the limit. */
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
}

const BASE: Vocabulary = {
  income: 'Income',
  incomeOne: 'Job',
  incomeAdd: 'Add income',
  w2: 'W-2',
  selfEmployed: '1099',
  limit: 'Your limit',
  target: 'What we aim for',
  countable: 'Counted',
  extraPayMonth: 'Months that pay you extra',
  trialMonths: 'Trial work months',
  precision: 'How sure this is',
  overview: 'Overview',
  limits: 'Your limit'
};

/**
 * Per-layout register. Nothing here changes what a word means — only how
 * loudly it is said, which is the one thing a layout legitimately owns.
 *
 * The dense, monospace layouts (ledger, calc20, workrecord) are typeset in
 * capitals and short columns, so their words are shorter. The roomy ones take
 * the base vocabulary as written.
 */
const OVERRIDES: Partial<Record<LayoutMode, Partial<Vocabulary>>> = {
  ledger: {
    income: 'Income',
    countable: 'Countable',
    extraPayMonth: 'Extra paycheck months'
  },
  calc20: {
    income: 'Jobs',
    incomeAdd: 'Add',
    countable: 'Counted',
    extraPayMonth: 'Extra paychecks'
  },
  workrecord: {
    income: 'Jobs',
    extraPayMonth: 'Extra paychecks'
  },
  pocket: {
    // The small-screen layout says the fewest words of any of them.
    income: 'Jobs',
    incomeAdd: 'Add',
    extraPayMonth: 'Extra pay'
  }
};

/** The words for one layout. */
export function copyFor(layout: LayoutMode): Vocabulary {
  return { ...BASE, ...(OVERRIDES[layout] ?? {}) };
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
