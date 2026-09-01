// Countable earnings.
//
// One rule holds throughout: a stream contributes nothing outside its own
// active window.

import type { MonthEntry, MonthKey, MonthStatus, Stream, TrackerData } from './types';
import {
  mileageRateFor, rulesFor, safeTargetFor, TWP_SELF_EMPLOYMENT_HOURS
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

export interface NearLimit {
  kind: 'trial' | 'sga';
  /** Dollars still available before the real limit. */
  room: number;
}

/**
 * A month that has not crossed a line yet, but is past the point where
 * coasting is safe.
 *
 * The trigger used to be a flat $200 from the cliff. That is too late to be
 * useful: a fortnightly schedule can drop a whole extra paycheck into a month
 * — several hundred dollars — after which $200 of warning is a warning you
 * receive on the way past. The trigger is now the safety line (see
 * SAFE_MONTHLY), which is where the room to absorb that extra paycheck starts
 * running out.
 *
 * `room` still reports the distance to the real limit, because that is the
 * figure every layout prints beside it and it is the one that is true.
 */
export function nearLimit(status: MonthStatus, phase: BenefitPhase): NearLimit | null {
  if (status.countable === 0) return null;
  const rules = rulesFor(yearOf(status.month));

  if (phase === 'trialWork') {
    if (status.isServiceMonth) return null;
    if (status.countable <= safeTargetFor(rules.trialWork)) return null;
    return { kind: 'trial', room: round2(rules.trialWork - status.countable) };
  }
  if (phase === 'sga') {
    if (status.overSga) return null;
    if (status.countable <= safeTargetFor(rules.sga)) return null;
    return { kind: 'sga', room: round2(rules.sga - status.countable) };
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

/*
 * Working backwards from the number people actually know.
 *
 * Social Security counts gross pay — the figure before anything is taken
 * out. That number lives on a document a lot of people do not have to hand,
 * cannot find, or were never taught to read. The number they do know is what
 * landed in the bank, because it is in their banking app.
 *
 * So this estimates gross from net. It is deliberately conservative and
 * deliberately explained rather than silently applied:
 *
 * FICA is 7.65% of gross (6.2% Social Security + 1.45% Medicare) and is the
 * one deduction almost every W-2 worker has. Below roughly $15k a year — the
 * band nearly everyone tracking against these limits is in — federal income
 * tax withholding is often little or nothing, because the standard deduction
 * covers it. State tax, insurance, union dues and retirement all vary and
 * cannot be guessed from one number.
 *
 * That makes the result a FLOOR, not an estimate in the middle: real gross is
 * at least this, and more if anything else is withheld. A floor is the safe
 * direction to be wrong in here, because under-reporting income to a benefits
 * tracker is what causes an overpayment the person then has to repay.
 */
export const FICA_RATE = 0.0765;

/*
 * A padded rate, used for the estimate we actually show.
 *
 * FICA alone is the floor. In practice a low-wage W-2 worker usually has a
 * little federal withholding on top, and state tax in most states, so total
 * withholding of 10–15% is more typical than 7.65%. Twelve per cent sits in
 * that band.
 *
 * The direction of the padding is the part that matters, and it is not a
 * coin toss:
 *
 *   Guess gross too LOW  → the app says you are under the limit when you are
 *                          over it → you keep working → SSA later calls it an
 *                          overpayment and asks for the money back. A debt.
 *   Guess gross too HIGH → the app says you are nearer the limit than you
 *                          are → you work fewer hours than you safely could.
 *                          Lost income, which is bad, but not a debt and it
 *                          corrects the moment a real figure is entered.
 *
 * So the estimate leans high on purpose. For a benefits tracker, cautious and
 * slightly wrong beats optimistic and slightly wrong.
 */
export const TYPICAL_WITHHOLDING = 0.12;

/**
 * Estimate gross pay from what actually reached the bank.
 *
 * `floor: true` uses FICA only, which is the least gross could possibly be.
 * The default pads for typical withholding, which is the number worth
 * showing — and which must always be recorded as an estimate, never as an
 * entered figure. See MonthEntry.basis and precisionFor.
 */
export function grossFromNet(net: number, opts?: { floor?: boolean }): number | undefined {
  if (!Number.isFinite(net) || net <= 0) return undefined;
  const rate = opts?.floor ? FICA_RATE : TYPICAL_WITHHOLDING;
  return round2(net / (1 - rate));
}

/*
 * How much room a guess costs you.
 *
 * A figure worked out from what reached the bank could be off by a fair
 * margin: withholding varies with state, filing status, insurance, dues and
 * retirement, and none of that can be recovered from one number. Twenty per
 * cent covers the realistic spread.
 *
 * The important design decision is where that uncertainty goes. It would be
 * easy to show the same "$162 left" and add "this is an estimate" underneath
 * — and nobody reads the underneath. Someone about to pick up an extra shift
 * reads the number, not the caveat.
 *
 * So the uncertainty is taken out of the room instead. When a month's pay was
 * guessed, the app assumes it could be 20% higher than it looks and reports
 * the room that is left after assuming the worst. The caveat still appears,
 * but the number itself is already honest — and the way to get the room back
 * is the same as the way to make the app accurate: enter the real figure.
 */
export const ESTIMATE_UNCERTAINTY = 0.20;

/** Was any of this month's pay worked out rather than entered? */
export function isEstimatedMonth(data: TrackerData, month: MonthKey): boolean {
  return data.streams.some((stream) => (
    isActive(stream, month) && Boolean(stream.months[month]?.basis)
    && stream.months[month]?.basis !== 'entered'
  ));
}

/**
 * Countable pay for the month, raised to the top of its uncertainty band when
 * the figure was a guess. Use this for anything that answers "how much more
 * can I earn"; use `monthStatus().countable` for reporting what was recorded.
 */
export function cautiousCountable(data: TrackerData, month: MonthKey): number {
  const actual = monthTotal(data, month);
  return isEstimatedMonth(data, month)
    ? round2(actual * (1 + ESTIMATE_UNCERTAINTY))
    : actual;
}
