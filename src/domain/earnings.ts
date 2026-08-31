// Countable earnings.
//
// One rule holds throughout: a stream contributes nothing outside its own
// active window.

import type { MonthEntry, MonthKey, MonthStatus, Stream, TrackerData } from './types';
import {
  mileageRateFor, rulesFor, TWP_SELF_EMPLOYMENT_HOURS
} from './rules';
import { monthIndex, monthsOfYear, todayMonth, yearOf } from './months';
import type { BenefitPhase } from './trialWork';

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

/** Splits a dollar total evenly across `count` slots, penny-exact — the
 *  remainder cent goes to the earliest slots so the parts always sum back
 *  to the original total. Shared by every "enter one total, spread it
 *  across months" input (1099 YTD gross/miles, W-2 yearly-total entry). */
export function evenSplit(total: number, count: number): number[] {
  if (count <= 0) return [];
  const cents = Math.round(total * 100);
  const base = Math.floor(cents / count);
  let remainder = cents - base * count;
  return Array.from({ length: count }, () => {
    const extra = remainder > 0 ? 1 : 0;
    if (remainder > 0) remainder -= 1;
    return (base + extra) / 100;
  });
}

/**
 * A stream contributes nothing outside its own active window — and, for
 * any month from now on, nothing at all once it is Paused or Ended. That
 * is what actually keeps a stopped job out of future paycheck/threshold
 * projections, not just the label on its card. Already-entered history
 * before today stays exactly as entered, whatever the lifecycle says now.
 */
export function isActive(stream: Stream, month: MonthKey, now: MonthKey = todayMonth()): boolean {
  const i = monthIndex(month);
  if (i < monthIndex(stream.activeFrom)) return false;
  if (stream.activeTo && i > monthIndex(stream.activeTo)) return false;
  if (stream.lifecycle !== 'active' && i >= monthIndex(now)) return false;
  return true;
}

/** Active months of a stream that fall inside one calendar year. */
export function activeMonthsInYear(stream: Stream, year: number): MonthKey[] {
  return monthsOfYear(year).filter((m) => isActive(stream, m));
}

function entryFor(stream: Stream, month: MonthKey): MonthEntry {
  return stream.months[month] ?? {};
}

/** Mileage deduction for one month, at that month's year rate. */
export function mileageDeduction(stream: Stream, month: MonthKey): number {
  const miles = entryFor(stream, month).miles ?? 0;
  if (miles <= 0) return 0;
  return round2(miles * mileageRateFor(month));
}

/** True only when the user entered earnings/hours/miles for this month. */
export function hasEnteredDataForMonth(stream: Stream, month: MonthKey): boolean {
  const entry = stream.months[month];
  if (entry && Object.values(entry).some((value) => Number(value ?? 0) !== 0)) return true;
  return stream.checks.some((check) => check.month === month && !check.projected);
}

export function streamsMissingMonth(streams: Stream[], month: MonthKey): Stream[] {
  return streams.filter((stream) =>
    stream.lifecycle === 'active'
    && isActive(stream, month)
    && !hasEnteredDataForMonth(stream, month)
  );
}

/**
 * A default Gross for a month, from hours × hourly rate — a starting point
 * to overwrite when the paystub differs, not a substitute for it.
 */
export function estimatedGrossFromHours(stream: Stream, hours: number): number | undefined {
  if (stream.type !== 'w2' || !stream.hourlyRate || hours <= 0) return undefined;
  return round2(hours * stream.hourlyRate);
}

/** Gross before deductions, for one stream in one month. */
export function grossFor(stream: Stream, month: MonthKey): number {
  if (!isActive(stream, month)) return 0;

  if (stream.type === 'w2') {
    const entered = stream.checks.filter((c) => c.month === month && !c.projected);
    if (entered.length) {
      return round2(entered.reduce((sum, c) => sum + (c.gross || 0), 0));
    }
    const override = entryFor(stream, month).gross;
    if (typeof override === 'number') return round2(override);
    return 0;
  }

  // 1099 — a lump-sum entry (YTD or yearly total) is already split evenly
  // across months at entry time, so this just reads that month's share.
  return round2(entryFor(stream, month).gross ?? 0);
}

/**
 * What SSA counts for one stream in one month. W-2 counts gross wages;
 * 1099 counts net earnings, so mileage comes off. Never negative.
 */
export function countableFor(stream: Stream, month: MonthKey): number {
  const gross = grossFor(stream, month);
  if (gross <= 0) return 0;
  if (stream.type === 'w2') return gross;
  return round2(Math.max(0, gross - mileageDeduction(stream, month)));
}

export function hoursFor(stream: Stream, month: MonthKey): number {
  if (!isActive(stream, month)) return 0;
  const entered = stream.checks.filter((c) => c.month === month && !c.projected);
  if (entered.length) return entered.reduce((s, c) => s + (c.hours || 0), 0);
  return entryFor(stream, month).hours ?? 0;
}

/** Impairment-related work expenses entered for one month. */
export function irweFor(data: TrackerData, month: MonthKey): number {
  return data.irwe[month] ?? 0;
}

/**
 * Countable earnings across all streams for one month, after IRWE.
 */
export function monthTotal(data: TrackerData, month: MonthKey): number {
  const gross = data.streams.reduce((sum, s) => sum + countableFor(s, month), 0);
  return round2(Math.max(0, gross - irweFor(data, month)));
}

export function monthStatus(data: TrackerData, month: MonthKey): MonthStatus {
  const countable = monthTotal(data, month);
  const rules = rulesFor(yearOf(month));
  const selfEmploymentHours = data.streams
    .filter((stream) => stream.type === 'ten99')
    .reduce((sum, stream) => sum + hoursFor(stream, month), 0);
  const isServiceMonth = countable > rules.trialWork
    || selfEmploymentHours > TWP_SELF_EMPLOYMENT_HOURS;
  const overSga = countable > rules.sga;

  return {
    month,
    countable,
    isServiceMonth,
    overSga,
    roomToTrialWork: isServiceMonth ? null : round2(rules.trialWork - countable),
    roomToSga: overSga ? null : round2(rules.sga - countable)
  };
}

/** Dollars away from a limit, at or under which a month counts as "near" it. */
export const NEAR_LIMIT_MARGIN = 200;

export interface NearLimit {
  kind: 'trial' | 'sga';
  room: number;
}

/**
 * A month that hasn't crossed a line yet, but is close enough that it is
 * not safe to coast — being near SGA or a TWP month is a real risk.
 */
export function nearLimit(status: MonthStatus, phase: BenefitPhase): NearLimit | null {
  if (status.countable === 0) return null;
  if (phase === 'trialWork' && !status.isServiceMonth
    && status.roomToTrialWork !== null && status.roomToTrialWork <= NEAR_LIMIT_MARGIN) {
    return { kind: 'trial', room: status.roomToTrialWork };
  }
  if (phase === 'sga' && !status.overSga
    && status.roomToSga !== null && status.roomToSga <= NEAR_LIMIT_MARGIN) {
    return { kind: 'sga', room: status.roomToSga };
  }
  return null;
}

/** Year total of countable earnings across all streams. */
export function yearTotal(data: TrackerData, year: number): number {
  return round2(monthsOfYear(year).reduce((sum, m) => sum + monthTotal(data, m), 0));
}

/** One stream's countable total for a year. */
export function streamYearTotal(stream: Stream, year: number): number {
  return round2(
    monthsOfYear(year).reduce((sum, m) => sum + countableFor(stream, m), 0)
  );
}

export function streamYearGross(stream: Stream, year: number): number {
  return round2(monthsOfYear(year).reduce((sum, m) => sum + grossFor(stream, m), 0));
}

export function streamYearMiles(stream: Stream, year: number): number {
  return monthsOfYear(year).reduce(
    (sum, m) => sum + (isActive(stream, m) ? (stream.months[m]?.miles ?? 0) : 0),
    0
  );
}

export function streamYearHours(stream: Stream, year: number): number {
  return monthsOfYear(year).reduce((sum, m) => sum + hoursFor(stream, m), 0);
}

/** Whether to show the app rather than the empty state. */
export function hasMeaningfulData(data: TrackerData): boolean {
  return data.streams.length > 0 || data.priorTrialMonths.length > 0;
}
