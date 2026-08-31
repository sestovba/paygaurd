// The reason this app exists: a weekly/biweekly W-2 schedule quietly lands
// 3 or 5 paychecks in some calendar months instead of 2 or 4 — and that's
// usually the month closest to a TWP or SGA line.

import { Bell, Zap } from 'lucide-react';
import { useTracker } from '../state/TrackerProvider';
import { monthsOfYear, shortMonthName, todayMonth } from '../domain/months';
import { extraPaycheckMonths, payPlan } from '../domain/paySchedule';
import { actionItems } from '../domain/notifications';
import type { MonthKey } from '../domain/types';

export function PaycheckRadar({
  onOpenMonth, onCheckNotifications
}: {
  onOpenMonth: (month: MonthKey) => void;
  onCheckNotifications: () => void;
}) {
  const { data, ui } = useTracker();

  const w2Streams = data.streams.filter((s) => s.type === 'w2' && s.lifecycle === 'active');
  const frequent = w2Streams.filter((s) => s.payFrequency === 'weekly' || s.payFrequency === 'biweekly');
  if (!frequent.length) return null;

  const confirmed = frequent.filter((s) => s.anchorDate);

  const heavy = extraPaycheckMonths(confirmed, ui.year);
  const now = todayMonth();
  const upcoming = monthsOfYear(ui.year).filter((m) => m >= now);

  const flags = Array.from(heavy.entries())
    .filter(([month]) => upcoming.includes(month))
    .map(([month, info]) => {
      const streamNames = confirmed
        .filter((s) => {
          if (!s.anchorDate || !s.payFrequency) return false;
          const plan = payPlan(ui.year, s.payFrequency, s.anchorDate);
          return plan.heavyMonths.includes(Number(month.slice(5, 7)));
        })
        .map((s) => s.name);
      return { month, counts: info.counts, streamNames };
    })
    .sort((a, b) => a.month.localeCompare(b.month));

  // Same facts the bell shows, summarized as a single line here instead of
  // repeated inline — one place to act, not a card per thing.
  const items = actionItems(data, ui.year);
  const urgentCount = items.filter((i) => i.severity === 'warn').length;
  const importantCount = items.filter((i) => i.severity === 'info').length;

  return (
    <section className="panel p-5 sm:p-6 xl:col-span-6">
      <p className="flex items-center gap-2 text-lg font-semibold text-info">
        <Zap className="size-5" />
        3- &amp; 5-paycheck months
      </p>

      {flags.length ? (
        <div className="mt-4 space-y-2.5">
          {flags.map((flag) => (
            <div
              key={flag.month}
              className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 rounded-lg border border-info/25 bg-info-soft/50 p-3 sm:p-4"
            >
              <div className="flex min-w-0 items-center gap-3">
                <span className="num grid size-11 shrink-0 place-items-center rounded-lg bg-info text-sm font-bold text-info-foreground">
                  {shortMonthName(flag.month).toUpperCase()}
                </span>
                <div className="min-w-0">
                  <p className="truncate text-base font-semibold">{flag.counts.join(' or ')} paychecks</p>
                  <p className="type-muted truncate">{flag.streamNames.join(', ')}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => onOpenMonth(flag.month)}
                className="btn-primary shrink-0 px-3 py-2 text-sm"
              >
                Open
              </button>
            </div>
          ))}
        </div>
      ) : confirmed.length ? (
        <div className="mt-4 rounded-lg border border-good/30 bg-good-soft/60 p-3 sm:p-4">
          <p className="text-base font-semibold">No 3- or 5-paycheck months ahead this year</p>
        </div>
      ) : (
        <p className="type-muted mt-4">
          Add one known payday to find 3- and 5-paycheck months.
        </p>
      )}

      {items.length ? (
        <button
          type="button"
          onClick={onCheckNotifications}
          className="mt-3 flex flex-wrap items-center gap-x-1.5 gap-y-1 text-base hover:underline"
        >
          <Bell className="size-4 shrink-0 text-muted-foreground" />
          {urgentCount ? <span className="font-semibold text-destructive">{urgentCount} urgent</span> : null}
          {urgentCount && importantCount ? <span className="text-muted-foreground">,</span> : null}
          {importantCount ? <span className="font-semibold text-info">{importantCount} important</span> : null}
          <span className="text-muted-foreground">— check notifications</span>
        </button>
      ) : null}
    </section>
  );
}
