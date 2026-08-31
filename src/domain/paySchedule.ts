// Pay schedule. An anchor date plus a frequency generates every check date
// for a year, which is the only way to know that a biweekly schedule gives
// two months three paychecks instead of two — the single most important
// cash-flow signal this app exists to surface.
//
// This is a cash-flow stress signal. SSA earned-month attribution still comes
// from the pay period, so this schedule never becomes countable income by itself.

import type { DateKey, MonthKey, PayFrequency, Stream } from './types';
import { monthKey, yearOf } from './months';
import { isActive } from './earnings';

export interface ScheduledCheck {
  date: DateKey;
  month: MonthKey;
}

export interface PayPlan {
  checks: ScheduledCheck[];
  /** Check count per calendar month, index 0 = January. */
  countByMonth: number[];
  /** The usual number of checks in a month for this schedule. */
  typicalCount: number;
  /** Months with more checks than typical, as 1-indexed month numbers. */
  heavyMonths: number[];
  total: number;
}

function toDateKey(d: Date): DateKey {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return y + '-' + m + '-' + day;
}

function parseDateKey(key: DateKey): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(key);
  if (!m) return null;
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  return isNaN(d.getTime()) ? null : d;
}

/**
 * Every pay date falling inside `year`.
 *
 * Weekly and biweekly walk forward and backward from the anchor, so an anchor
 * in a later year still produces correct dates for an earlier one.
 * Semimonthly pays the 15th and the last day. Monthly pays the anchor's
 * day-of-month, clamped to short months.
 */
export function payPlan(
  year: number,
  frequency: PayFrequency,
  anchor: DateKey
): PayPlan {
  const checks: ScheduledCheck[] = [];
  const anchorDate = parseDateKey(anchor);

  if (frequency === 'weekly' || frequency === 'biweekly') {
    const stepDays = frequency === 'weekly' ? 7 : 14;
    const base = anchorDate ?? new Date(year, 0, 1);

    const yearStart = new Date(year, 0, 1);
    const dayMs = 86400000;
    const stepMs = stepDays * dayMs;
    let cursorMs = base.getTime();

    const stepsBack = Math.ceil((cursorMs - yearStart.getTime()) / stepMs);
    cursorMs -= stepsBack * stepMs;
    while (cursorMs < yearStart.getTime()) cursorMs += stepMs;

    const yearEnd = new Date(year, 11, 31, 23, 59, 59).getTime();
    while (cursorMs <= yearEnd) {
      const d = new Date(cursorMs);
      checks.push({ date: toDateKey(d), month: monthKey(year, d.getMonth() + 1) });
      cursorMs += stepMs;
    }
  } else if (frequency === 'semimonthly') {
    for (let m = 0; m < 12; m += 1) {
      const mid = new Date(year, m, 15);
      const end = new Date(year, m + 1, 0);
      checks.push({ date: toDateKey(mid), month: monthKey(year, m + 1) });
      checks.push({ date: toDateKey(end), month: monthKey(year, m + 1) });
    }
  } else {
    const day = anchorDate ? anchorDate.getDate() : 1;
    for (let m = 0; m < 12; m += 1) {
      const lastDay = new Date(year, m + 1, 0).getDate();
      const d = new Date(year, m, Math.min(day, lastDay));
      checks.push({ date: toDateKey(d), month: monthKey(year, m + 1) });
    }
  }

  const countByMonth = Array(12).fill(0);
  checks.forEach((c) => {
    const m = Number(c.month.slice(5, 7)) - 1;
    countByMonth[m] += 1;
  });

  const tally = new Map<number, number>();
  countByMonth.forEach((c) => {
    if (c > 0) tally.set(c, (tally.get(c) ?? 0) + 1);
  });
  let typicalCount = 0;
  let best = -1;
  tally.forEach((freq, count) => {
    if (freq > best || (freq === best && count < typicalCount)) {
      best = freq;
      typicalCount = count;
    }
  });

  const heavyMonths: number[] = [];
  countByMonth.forEach((c, i) => {
    if (c > typicalCount) heavyMonths.push(i + 1);
  });

  return { checks, countByMonth, typicalCount, heavyMonths, total: checks.length };
}

/** Months that get an extra paycheck on a weekly/biweekly W-2 schedule. */
export interface ExtraPayMonth {
  counts: number[];
}

function streamCovers(stream: Stream, month: MonthKey): boolean {
  return isActive(stream, month);
}

/**
 * Which calendar months in `year` are 3- or 5-paycheck months, across every
 * W-2 stream that has a payday. This is the headline risk this app exists
 * to surface: a weekly/biweekly schedule silently produces an extra check
 * in some months, and that's usually the month closest to a limit.
 */
export function extraPaycheckMonths(
  streams: Stream[],
  year: number
): Map<MonthKey, ExtraPayMonth> {
  const byMonth = new Map<MonthKey, Set<number>>();

  for (const stream of streams) {
    if (stream.type !== 'w2') continue;
    const freq = stream.payFrequency;
    if ((freq !== 'weekly' && freq !== 'biweekly') || !stream.anchorDate) continue;
    const plan = payPlan(year, freq, stream.anchorDate);
    for (const month1 of plan.heavyMonths) {
      const key = monthKey(year, month1);
      if (!streamCovers(stream, key)) continue;
      const count = plan.countByMonth[month1 - 1];
      let set = byMonth.get(key);
      if (!set) {
        set = new Set();
        byMonth.set(key, set);
      }
      set.add(count);
    }
  }

  const out = new Map<MonthKey, ExtraPayMonth>();
  byMonth.forEach((counts, key) => {
    out.set(key, { counts: [...counts].sort((a, b) => a - b) });
  });
  return out;
}

export interface StreamPaycheckContext {
  streamId: string;
  streamName: string;
  count: number;
  typical: number;
}

/**
 * Which specific W-2 jobs land an extra check in this month, and how many —
 * so a badge can say "3 paychecks · Acme Corp" instead of leaving a reader to
 * guess which job it came from when more than one is active.
 */
export function paycheckContextForMonth(streams: Stream[], month: MonthKey): StreamPaycheckContext[] {
  const year = yearOf(month);
  const month1 = Number(month.slice(5, 7));
  const out: StreamPaycheckContext[] = [];

  for (const stream of streams) {
    if (stream.type !== 'w2') continue;
    const freq = stream.payFrequency;
    if ((freq !== 'weekly' && freq !== 'biweekly') || !stream.anchorDate) continue;
    if (!streamCovers(stream, month)) continue;
    const plan = payPlan(year, freq, stream.anchorDate);
    const count = plan.countByMonth[month1 - 1];
    if (count > plan.typicalCount) {
      out.push({ streamId: stream.id, streamName: stream.name, count, typical: plan.typicalCount });
    }
  }

  return out;
}

export function extraPaycheckLabel(counts: number[]): string {
  if (counts.length === 1) return counts[0] + ' checks';
  return counts.join(' / ') + ' checks';
}

export function checksPerYear(frequency: PayFrequency): number {
  if (frequency === 'weekly') return 52;
  if (frequency === 'biweekly') return 26;
  if (frequency === 'semimonthly') return 24;
  return 12;
}

/** How many weeks one check on this schedule represents — turns an hourly
 *  rate and planned hours/week into a per-check dollar estimate. */
export function weeksPerCheck(frequency: PayFrequency): number {
  return 52 / checksPerYear(frequency);
}

export function frequencyLabel(frequency: PayFrequency): string {
  if (frequency === 'weekly') return 'Weekly';
  if (frequency === 'biweekly') return 'Every two weeks';
  if (frequency === 'semimonthly') return 'Twice a month';
  return 'Monthly';
}

export interface PaceWarning {
  level: 'over' | 'near';
  amount: number;
  checks: number;
}

/**
 * A pace warning from hourly rate × planned hours alone, before a single
 * paycheck is entered — the one shared calculation StreamSheet's card and
 * the notifications list both read from, so they can't drift apart.
 */
export function paceWarning(stream: Stream, thresholdAmount: number, year: number): PaceWarning | null {
  if (stream.type !== 'w2' || !stream.payFrequency || !stream.hourlyRate || !stream.plannedHoursPerWeek) return null;
  const plan = stream.anchorDate ? payPlan(year, stream.payFrequency, stream.anchorDate) : null;
  const perCheck = stream.hourlyRate * stream.plannedHoursPerWeek * weeksPerCheck(stream.payFrequency);
  const typicalCount = plan?.typicalCount
    ?? (stream.payFrequency === 'weekly' ? 4 : stream.payFrequency === 'biweekly' ? 2 : stream.payFrequency === 'semimonthly' ? 2 : 1);
  const typicalMonthly = perCheck * typicalCount;
  const heavyMonthly = perCheck * (typicalCount + 1);
  if (heavyMonthly > thresholdAmount) return { level: 'over', amount: heavyMonthly, checks: typicalCount + 1 };
  if (typicalMonthly > thresholdAmount * 0.85) return { level: 'near', amount: typicalMonthly, checks: typicalCount };
  return null;
}
