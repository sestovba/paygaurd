// What needs a user's attention right now — computed fresh from live state,
// unlike ActivityEntry which is a log of what already happened. The same
// facts PaycheckRadar used to nag about inline now live only here, behind
// the notifications bell — one calm place instead of a pulsating card per
// unconfirmed job on the dashboard itself.

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
      message: `Set a payday for ${s.name}`,
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
        message: `${formatMonth(month)} lands ${info.counts.join(' or ')} paychecks`,
        severity: 'info',
        action: { kind: 'month', month }
      });
    });

  // The same hourly-rate × planned-hours pace warning StreamSheet shows
  // inline — surfaced here too, since a risk buried in one job's editor
  // isn't actually surfaced at all until someone happens to open it.
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
            ? `${s.name}'s planned pace would cross the ${limitName} limit on a ${pw.checks}-paycheck month`
            : `${s.name}'s planned pace is close to the ${limitName} limit`,
          severity: pw.level === 'over' ? 'warn' : 'info',
          action: { kind: 'reviewStream', streamId: s.id }
        });
      });
  }

  // Warn is objectively more urgent than info — every consumer (the bell,
  // the activity pane) lists items top-to-bottom, so that ordering has to
  // carry the priority itself, not just the color. Stable sort keeps each
  // severity group in the order it was built above.
  const severityRank: Record<ActionItem['severity'], number> = { warn: 0, info: 1 };
  return items.sort((a, b) => severityRank[a.severity] - severityRank[b.severity]);
}
