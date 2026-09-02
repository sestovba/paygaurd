/**
 * How much the app is actually able to promise.
 *
 * Every figure this product states — "$1,340 this month", "3 of 9 trial
 * months used", "over by $310" — rests on what it has been told. With a
 * payday and a frequency it can name the exact months that land a third or
 * fifth paycheck. Without them it is dividing a year by twelve. Those two
 * answers look identical on screen, and one of them is a guess.
 *
 * So the answer carries its own grade. Three states, not a percentage:
 *
 *   Estimated  Amounts only. No pay schedule, so 3- or 5-paycheck months cannot be predicted.
 *   Scheduled  A payday and pay schedule are on file. We can predict extra paycheck months.
 *   Exact      Actual paystub amounts are entered, and 1099 hours are recorded.
 */

import type { MonthKey, Stream, TrackerData } from './types';
import { isActive } from './earnings';
import { yearOf } from './months';

export type Precision = 'estimated' | 'scheduled' | 'exact';

/* One word each. The three pips beside them carry the scale now, so the name
   only has to say which rung this is — "Pay Schedule Set" and "Exact (From
   Paystubs)" were explaining the rung as well as naming it.

   "Scheduled" was the odd one and the content audit took it out: it named a
   state of our data ("a pay schedule is on file") rather than a state of the
   reader's number, so on a scale about how sure a figure is, the middle rung
   was answering a different question from the two either side. Three words,
   three distinct meanings, all of them about the figure: it was guessed, it
   was worked out from your pay days, or it came off your paystubs. */
export const PRECISION_NAME: Record<Precision, string> = {
  estimated: 'Guessed',
  scheduled: 'Predicted',
  exact: 'Exact'
};

/** Which field is missing — so a layout can send you to the fastest way of
 *  filling it in rather than to the whole editor every time. */
export type PrecisionGapKind = 'schedule' | 'checks' | 'hours';

/** One thing the app has not been told, and what it costs. */
export interface PrecisionGap {
  streamId: string;
  streamName: string;
  kind: PrecisionGapKind;
  /** What is missing, as you would ask for it. */
  missing: string;
  /** What cannot be done without it. Never a scolding — a trade. */
  cost: string;
  /** The level this stream is stuck at until it is filled in. */
  level: Precision;
}

export interface PrecisionReading {
  /** The weakest level among the streams active this month. */
  level: Precision;
  /** Weakest first, so the one worth asking for is gaps[0]. */
  gaps: PrecisionGap[];
  /** Streams active in the month. Zero means there is nothing to grade. */
  streams: number;
  /** Every fact this month's figure could rest on, whether we have it or not:
   *  two per W-2 job (a pay schedule, and this month's real paystub), one per
   *  1099 job (hours worked). */
  details: number;
  /** How many of those we actually have. */
  filled: number;
  /** `details - filled`. The number of things that would sharpen the figure,
   *  which is the count worth showing someone — nobody wants to be told what
   *  is already known. */
  missing: number;
  /** filled / details as a whole percentage.
   *
   *  Derived from the same count as `missing`, deliberately, so the gauge and
   *  the sentence beside it can never disagree. It is a real fraction of real
   *  facts rather than a rung mapped onto a number — this app does not invent
   *  figures to fill a slot, and a confidence score is the last place to
   *  start. It moves in visible steps, and that is honest: with one job there
   *  genuinely are only three answers. */
  confidence: number;
}

const RANK: Record<Precision, number> = { estimated: 0, scheduled: 1, exact: 2 };

/** A W-2 stream can name its paycheck months once it has both halves of a
 *  schedule; one without the other is no schedule at all. */
function w2Gap(stream: Stream, month: MonthKey): PrecisionGap | null {
  if (!stream.payFrequency || !stream.anchorDate) {
    return {
      streamId: stream.id,
      streamName: stream.name,
      kind: 'schedule',
      missing: !stream.payFrequency && !stream.anchorDate ? 'a payday and pay schedule'
        : stream.payFrequency ? 'a payday from your paystub' : 'how often you are paid',
      cost: 'we cannot predict months with an extra paycheck',
      level: 'estimated'
    };
  }
  // Scheduled, but the month is still a projection until real checks land.
  const paid = stream.checks.some((check) => check.date.startsWith(month) && !check.projected);
  if (!paid) {
    return {
      streamId: stream.id,
      streamName: stream.name,
      kind: 'checks',
      missing: 'your actual paystub amount for this month',
      cost: 'this total is estimated, not from a real paystub',
      level: 'scheduled'
    };
  }
  return null;
}

/** For 1099 the binding constraint under TWP is not the money, it is the
 *  80 hours — and hours are the one field nothing else can infer. */
function ten99Gap(stream: Stream, month: MonthKey): PrecisionGap | null {
  const entry = stream.months[month];
  if (entry?.hours === undefined) {
    return {
      streamId: stream.id,
      streamName: stream.name,
      kind: 'hours',
      missing: 'hours worked this month',
      /* "the 80-hour Trial Work rule" names a rule the reader has never been
         shown and puts a number on it that means nothing without it. What
         they need to know is what the app cannot tell them. */
      cost: 'we cannot tell you whether your hours use a trial work month',
      level: 'estimated'
    };
  }
  return null;
}

/** What the app can promise about one month, and what would improve it. */
export function precisionFor(data: TrackerData, month: MonthKey): PrecisionReading {
  const now = `${yearOf(month)}-12`;
  const live = data.streams.filter((stream) => isActive(stream, month, now));
  if (!live.length) {
    return { level: 'estimated', gaps: [], streams: 0, details: 0, filled: 0, missing: 0, confidence: 0 };
  }

  const gaps: PrecisionGap[] = [];
  for (const stream of live) {
    const gap = stream.type === 'w2' ? w2Gap(stream, month) : ten99Gap(stream, month);
    if (gap) gaps.push(gap);
  }
  gaps.sort((a, b) => RANK[a.level] - RANK[b.level]);

  /* Counted separately from `gaps`, and not derived from it: a stream reports
     only its weakest gap, so a W-2 job with no schedule yields one gap while
     two facts are actually missing. The gauge has to count facts. */
  let details = 0;
  let filled = 0;
  for (const stream of live) {
    if (stream.type === 'w2') {
      details += 2;
      if (stream.payFrequency && stream.anchorDate) filled += 1;
      if (stream.checks.some((check) => check.date.startsWith(month) && !check.projected)) filled += 1;
    } else {
      details += 1;
      if (stream.months[month]?.hours !== undefined) filled += 1;
    }
  }

  const level: Precision = gaps.length ? gaps[0].level : 'exact';
  return {
    level,
    gaps,
    streams: live.length,
    details,
    filled,
    missing: details - filled,
    confidence: details ? Math.round((filled / details) * 100) : 0
  };
}

/** The whole sentence, so every layout says it the same way.
 *
 *  It used to hang the consequence in brackets — "Cafe shift is missing your
 *  actual paystub amount for this month (this total is estimated, not from a
 *  real paystub)" — and end with "2 more jobs to complete", which reads as an
 *  instruction to finish something rather than a count. A bracket is where a
 *  reader's eye goes last, and the consequence is the half worth reading, so
 *  it is joined on with "so" and the count says what it is counting. */
export function precisionSentence(reading: PrecisionReading): string {
  if (!reading.streams) return 'Add a job to start tracking.';
  const gap = reading.gaps[0];
  if (!gap) return 'Every amount here came off a real paystub.';
  const more = reading.gaps.length - 1;
  return `${gap.streamName} is missing ${gap.missing}, so ${gap.cost}.`
    + (more ? ` ${more} other job${more === 1 ? '' : 's'} ${more === 1 ? 'is' : 'are'} missing something too.` : '');
}
