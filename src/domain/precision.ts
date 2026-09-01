/**
 * How much the app is actually able to promise.
 *
 * Every figure this product states — "$1,340 this month", "3 of 9 trial
 * months used", "over by $310" — rests on what it has been told. With a
 * payday and a frequency it can name the exact months that land a third or
 * fifth paycheck. Without them it is dividing a year by twelve. Those two
 * answers look identical on screen, and one of them is a guess.
 *
 * So the answer carries its own grade. Three states, not a percentage: a
 * percentage invents precision about precision, and none of these are
 * degrees of the same thing — they are three different capabilities.
 *
 *   Estimated  Amounts only. `payPlan` cannot run, so no 3- or 5-paycheck
 *              month can be named before it happens.
 *   Scheduled  A payday and a frequency are on file. `extraPaycheckMonths`
 *              and `paceWarning` both work. This is the jump worth pushing.
 *   Exact      The real paychecks are recorded rather than projected, and
 *              1099 hours are in, so the 80-hour rule is actually running.
 *
 * A reading is only ever as good as its weakest stream: one job with no
 * payday means the month's total cannot be trusted, however complete the
 * others are.
 */

import type { MonthKey, Stream, TrackerData } from './types';
import { isActive } from './earnings';
import { yearOf } from './months';

export type Precision = 'estimated' | 'scheduled' | 'exact';

export const PRECISION_NAME: Record<Precision, string> = {
  estimated: 'Estimated',
  scheduled: 'Scheduled',
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
      missing: !stream.payFrequency && !stream.anchorDate ? 'a payday and how often'
        : stream.payFrequency ? 'a payday' : 'how often you are paid',
      cost: 'extra-paycheck months cannot be flagged before they land',
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
      missing: 'this month’s actual paychecks',
      cost: 'the total is projected from the schedule, not counted',
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
      cost: 'the 80-hour trial-work rule cannot be checked',
      level: 'estimated'
    };
  }
  return null;
}

/** What the app can promise about one month, and what would improve it. */
export function precisionFor(data: TrackerData, month: MonthKey): PrecisionReading {
  const now = `${yearOf(month)}-12`;
  const live = data.streams.filter((stream) => isActive(stream, month, now));
  if (!live.length) return { level: 'estimated', gaps: [], streams: 0 };

  const gaps: PrecisionGap[] = [];
  for (const stream of live) {
    const gap = stream.type === 'w2' ? w2Gap(stream, month) : ten99Gap(stream, month);
    if (gap) gaps.push(gap);
  }
  gaps.sort((a, b) => RANK[a.level] - RANK[b.level]);

  const level: Precision = gaps.length ? gaps[0].level : 'exact';
  return { level, gaps, streams: live.length };
}

/** The whole sentence, so every layout says it the same way. */
export function precisionSentence(reading: PrecisionReading): string {
  if (!reading.streams) return 'Add an income source to start tracking.';
  const gap = reading.gaps[0];
  if (!gap) return 'Every source has its schedule and its actual paychecks.';
  const more = reading.gaps.length - 1;
  return `${gap.streamName} is missing ${gap.missing}, so ${gap.cost}`
    + (more ? ` · ${more} more source${more === 1 ? '' : 's'} to fill in` : '');
}
