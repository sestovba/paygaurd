// What needs a user's attention right now — computed fresh from live state,
// unlike ActivityEntry which is a log of what already happened.

import type { MonthKey, TrackerData } from './types';
import { formatMonth, monthsOfYear, todayMonth } from './months';
import { extraPaycheckMonths, paceWarning } from './paySchedule';
import { activeThreshold } from './trialWork';

export interface ActionItem {
  id: string;
  message: string;
  severity: 'warn' | 'info';
  action:
    | { kind: 'setPayday'; streamId: string }
    | { kind: 'reviewStream'; streamId: string }
    | { kind: 'month'; month: MonthKey };
}

/** `focus` narrows the calendar warnings to the month you are in — see
 *  UiState.focusMode. A heads-up about November cannot be acted on in
 *  September, and focus mode is the switch that says so. */
export function actionItems(
  data: TrackerData,
  year: number,
  focus = false
): ActionItem[] {
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
      /* Review note: "too wordy". The banner's own button reads Add payday,
         so the line only has to say which job and what it buys.

         "has no payday on file" is a filing-cabinet sentence about the app,
         and "extra-paycheck months" is a term the reader has not been taught
         yet. Both are replaced by the plain fact and the plain consequence. */
      message: `We do not know when ${s.name} pays you, so we cannot tell you which months pay you extra`,
      severity: 'warn',
      action: { kind: 'setPayday', streamId: s.id }
    });
  });

  const heavy = extraPaycheckMonths(confirmed, year);
  const upcoming = focus
    ? monthsOfYear(year).filter((m) => m === now)
    : monthsOfYear(year).filter((m) => m >= now);
  Array.from(heavy.entries())
    .filter(([month]) => upcoming.includes(month))
    .sort(([a], [b]) => a.localeCompare(b))
    .forEach(([month, info]) => {
      items.push({
        id: `heavy-${month}`,
        message: `${formatMonth(month)} pays you ${info.counts.join(' or ')} times, which is more than usual`,
        severity: 'info',
        action: { kind: 'month', month }
      });
    });

  const threshold = activeThreshold(data, `${year}-12`);
  if (threshold) {
    data.streams
      .filter((s) => s.type === 'w2' && s.lifecycle === 'active')
      .forEach((s) => {
        const pw = paceWarning(s, threshold.amount, year);
        if (!pw) return;
        items.push({
          id: `pace-${s.id}`,
          /* "on course to" is a figure of speech, and this file is read by
             people who were told not to be given any. It says what the pay
             does, not where it is sailing. */
          message: pw.level === 'over'
            ? `${pw.checks} paychecks in one month would put ${s.name} over your monthly limit`
            : `${s.name} pays enough to bring you close to your monthly limit`,
          severity: pw.level === 'over' ? 'warn' : 'info',
          action: { kind: 'reviewStream', streamId: s.id }
        });
      });
  }

  const severityRank: Record<ActionItem['severity'], number> = { warn: 0, info: 1 };
  return items.sort((a, b) => severityRank[a.severity] - severityRank[b.severity]);
}
