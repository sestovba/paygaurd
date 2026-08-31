// Trial work period.
//
// Nine service months within any rolling 60-month window. Not nine ever, and
// not nine per calendar year. The window is why this file exists: months used
// long enough ago fall out of it and the capacity returns, so a stored count
// cannot answer the question.

import type { MonthKey, TrackerData } from './types';
import {
  addMonths, monthIndex, monthsOfYear, fromIndex, todayMonth
} from './months';
import { monthStatus } from './earnings';
import { rulesFor } from './rules';

export const TRIAL_MONTH_LIMIT = 9;
export const ROLLING_WINDOW = 60;

/** The `count` most recent months strictly before `now`, oldest first —
 *  for turning a self-reported count of trial-work months already used
 *  into actual months, since the rolling window needs real months to age
 *  out correctly, not just a number. */
export function recentMonths(count: number, now: MonthKey = todayMonth()): MonthKey[] {
  const out: MonthKey[] = [];
  for (let i = count - 1; i >= 0; i -= 1) out.push(addMonths(now, -1 - i));
  return out;
}

export type BenefitPhase = 'unknown' | 'trialWork' | 'verifyComplete' | 'sga';

export interface TrialWorkStatus {
  serviceMonths: MonthKey[];
  inWindow: MonthKey[];
  used: number;
  remaining: number;
  complete: boolean;
  completedOn: MonthKey | null;
  windowStart: MonthKey;
  nextExpiry: MonthKey | null;
}

/** Service months computed from entered earnings, across every year present. */
export function computedServiceMonths(data: TrackerData): MonthKey[] {
  const years = new Set<number>();
  data.streams.forEach((s) => {
    const from = Number(s.activeFrom.slice(0, 4));
    const to = s.activeTo ? Number(s.activeTo.slice(0, 4)) : from;
    for (let y = from; y <= to; y += 1) years.add(y);
    Object.keys(s.months).forEach((m) => years.add(Number(m.slice(0, 4))));
  });

  const out: MonthKey[] = [];
  Array.from(years).sort((a, b) => a - b).forEach((year) => {
    monthsOfYear(year).forEach((month) => {
      if (monthStatus(data, month).isServiceMonth) out.push(month);
    });
  });
  return out;
}

/** All service months, prior and computed, deduplicated and sorted. */
export function allServiceMonths(data: TrackerData): MonthKey[] {
  const set = new Set<MonthKey>([...data.priorTrialMonths, ...computedServiceMonths(data)]);
  return Array.from(set).sort();
}

export function trialWorkStatus(
  data: TrackerData,
  asOf: MonthKey = todayMonth()
): TrialWorkStatus {
  const serviceMonths = allServiceMonths(data);
  const end = monthIndex(asOf);
  const startIndex = end - (ROLLING_WINDOW - 1);
  const throughAsOf = serviceMonths.filter((m) => monthIndex(m) <= end);

  const rollingMonths = throughAsOf.filter((m) => {
    const i = monthIndex(m);
    return i >= startIndex && i <= end;
  });

  let completedOn: MonthKey | null = null;
  let completedWindow: MonthKey[] = [];
  for (let n = TRIAL_MONTH_LIMIT - 1; n < throughAsOf.length; n += 1) {
    const ninth = throughAsOf[n];
    const first = throughAsOf[n - (TRIAL_MONTH_LIMIT - 1)];
    if (monthIndex(ninth) - monthIndex(first) < ROLLING_WINDOW) {
      completedOn = ninth;
      completedWindow = throughAsOf.slice(n - (TRIAL_MONTH_LIMIT - 1), n + 1);
      break;
    }
  }

  const complete = completedOn !== null;
  const inWindow = complete ? completedWindow : rollingMonths;
  const used = complete ? TRIAL_MONTH_LIMIT : inWindow.length;

  return {
    serviceMonths,
    inWindow,
    used,
    remaining: complete ? 0 : Math.max(0, TRIAL_MONTH_LIMIT - used),
    complete,
    completedOn,
    windowStart: fromIndex(Math.max(0, startIndex)),
    nextExpiry: !complete && inWindow.length
      ? fromIndex(monthIndex(inWindow[0]) + ROLLING_WINDOW)
      : null
  };
}

export function benefitPhase(
  data: TrackerData,
  asOf: MonthKey = todayMonth()
): BenefitPhase {
  if (data.twpAssessment.state === 'unknown') return 'unknown';
  if (data.twpAssessment.state === 'complete') return 'sga';
  return trialWorkStatus(data, asOf).complete ? 'verifyComplete' : 'trialWork';
}

/** Which threshold matters right now. */
export function activeThreshold(
  data: TrackerData,
  asOf: MonthKey = todayMonth()
): { kind: 'trialWork' | 'sga'; amount: number } | null {
  const phase = benefitPhase(data, asOf);
  const rules = rulesFor(Number(asOf.slice(0, 4)));
  if (phase === 'trialWork') return { kind: 'trialWork', amount: rules.trialWork };
  if (phase === 'sga') return { kind: 'sga', amount: rules.sga };
  return null;
}
