// What needs a user's attention right now — computed fresh from live state,
// unlike ActivityEntry which is a log of what already happened.

import type { MonthKey, TrackerData } from './types';
import { formatMonth, monthsOfYear, todayMonth } from './months';
import { extraPaycheckMonths, paceWarning } from './paySchedule';
import { activeThreshold, benefitPhase } from './trialWork';

export interface ActionItem {
  id: string;
  message: string;
  severity: 'warn' | 'info';
  action:
    | { kind: 'setPayday'; streamId: string }
    | { kind: 'reviewStream'; streamId: string }
    | { kind: 'month'; month: MonthKey };
}

export function actionItems(data: TrackerData, year: number): ActionItem[] {
  const items: ActionItem[] = [];
  const now = todayMonth();

  const frequent = data.streams.filter((s) =>
    s.type === 'w2' && s.lifecycle === 'active'
    && (s.payFrequency === 'weekly' || s.payFrequency === 'biweekly'));
  const unconfirmed = frequent.filter((s) => !s.anchorDate);
  const confirmed = frequent.filter((s) => s.anchorDate);

  unconfirmed.forEach((s) => {
    items.push({
      id: `payday-${s.id}`,
      message: `Add a pay date from your paystub for ${s.name} to check for extra paychecks`,
      severity: 'warn',
      action: { kind: 'setPayday', streamId: s.id }
    });
  });

  const heavy = extraPaycheckMonths(confirmed, year);
  const upcoming = monthsOfYear(year).filter((m) => m >= now);
  Array.from(heavy.entries())
    .filter(([month]) => upcoming.includes(month))
    .sort(([a], [b]) => a.localeCompare(b))
    .forEach(([month, info]) => {
      items.push({
        id: `heavy-${month}`,
        message: `${formatMonth(month)} has ${info.counts.join(' or ')} paychecks (extra paycheck month)`,
        severity: 'info',
        action: { kind: 'month', month }
      });
    });

  const phase = benefitPhase(data, `${year}-12`);
  const threshold = activeThreshold(data, `${year}-12`);
  if (threshold) {
    data.streams
      .filter((s) => s.type === 'w2' && s.lifecycle === 'active')
      .forEach((s) => {
        const pw = paceWarning(s, threshold.amount, year);
        if (!pw) return;
        const limitName = phase === 'trialWork' ? 'Trial Work Period' : 'SGA';
        items.push({
          id: `pace-${s.id}`,
          message: pw.level === 'over'
            ? `In a month with ${pw.checks} paychecks, ${s.name} would earn over the ${limitName} limit`
            : `${s.name}'s estimated hours and wage put you close to the ${limitName} limit`,
          severity: pw.level === 'over' ? 'warn' : 'info',
          action: { kind: 'reviewStream', streamId: s.id }
        });
      });
  }

  const severityRank: Record<ActionItem['severity'], number> = { warn: 0, info: 1 };
  return items.sort((a, b) => severityRank[a.severity] - severityRank[b.severity]);
}
