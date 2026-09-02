// The months that need you, and why.
//
// Three notes in the review say the same thing from three directions: the
// extra-paycheck month is "a column in a table you scroll to" on the ledger,
// "one row down from Month" on payguard, and the strip that does it properly
// on workrecord "should exist on all of them". They are one gap, so this is
// one answer — the logic lives here and each layout draws it in its own
// clothes.
//
// A month gets on the list for exactly three reasons: it has crossed a limit,
// it is close enough that coasting is not safe, or the pay calendar drops a
// third or fifth paycheck into it. A clean year produces an empty list, and
// the strip renders nothing at all.

import { money } from './format';
import { monthStatus, nearLimit } from './earnings';
import { extraPaycheckLabel, extraPaycheckMonths } from './paySchedule';
import { benefitPhase } from './trialWork';
import type { MonthKey, TrackerData } from './types';

export interface AttentionFlag {
  month: MonthKey;
  text: string;
  /** `over` — a limit is already crossed. `near` — not yet, but close.
   *  `pay` — the calendar rather than the money: an extra paycheck lands. */
  kind: 'over' | 'near' | 'pay';
}

/**
 * Flags for `months`, in the order given.
 *
 * The benefit phase is resolved per month rather than once for the year. A
 * Trial Work Period that completes in June means July is judged against SGA,
 * and asking for the phase at December would get every month before it wrong.
 * The two copies of this logic that existed before — one in workrecord, one
 * in calc20 — disagreed on exactly this point.
 */
export function attentionFlags(data: TrackerData, months: MonthKey[]): AttentionFlag[] {
  if (!months.length) return [];
  const year = Number(months[0].slice(0, 4));
  const extraPay = extraPaycheckMonths(data.streams, year);
  const flags: AttentionFlag[] = [];

  for (const month of months) {
    const status = monthStatus(data, month);
    const phase = benefitPhase(data, month);

    /* The words are the reader's, not SSA's. These four strings were "over
       SGA", "TWP used", "$162 to TWP" and "$162 to SGA" — every one of them
       an abbreviation, and the last two saying a distance without saying
       what it is a distance to. A chip is short, but "to SGA" is not short,
       it is unfinished. */
    if (phase === 'sga' && status.overSga) {
      flags.push({ month, text: 'over your limit', kind: 'over' });
    } else if (phase === 'trialWork' && status.isServiceMonth) {
      flags.push({ month, text: 'uses a trial work month', kind: 'over' });
    } else {
      const near = nearLimit(status, phase);
      if (near) {
        // Already the most urgent thing about this month. An extra-paycheck
        // chip beside it would split the reader's attention between the
        // warning and the reason for it.
        flags.push({
          month,
          text: `${money(near.room)} left before your limit`,
          kind: 'near'
        });
        continue;
      }
    }

    const extra = extraPay.get(month);
    if (extra) flags.push({ month, text: extraPaycheckLabel(extra.counts), kind: 'pay' });
  }

  return flags;
}
