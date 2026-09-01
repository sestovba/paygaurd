// The reason this app exists: a weekly/biweekly W-2 schedule quietly lands
// 3 or 5 paychecks in some calendar months instead of 2 or 4 — and that's
// usually the month closest to a TWP or SGA line.

import { Bell, Zap } from 'lucide-react';
import { useTracker } from '../state/TrackerProvider';
import { money } from '../domain/format';
import { monthsOfYear, shortMonthName, todayMonth } from '../domain/months';
import { extraPaycheckMonths, frequencyLabel, payPlan, weeksPerCheck } from '../domain/paySchedule';
import { activeThreshold } from '../domain/trialWork';
import { actionItems } from '../domain/notifications';
import type { MonthKey, Stream } from '../domain/types';

/** What one more paycheck from this job would add to a month, when we know
 *  enough about the job to say. Null is an honest answer here: a number made
 *  up to fill the slot is worse than no number in a panel whose entire job is
 *  to be believed. */
function extraCheckValue(stream: Stream): number | null {
  if (!stream.payFrequency) return null;
  if (stream.hourlyRate && stream.plannedHoursPerWeek) {
    return stream.hourlyRate * stream.plannedHoursPerWeek * weeksPerCheck(stream.payFrequency);
  }
  return null;
}

export function PaycheckRadar({
  onOpenMonth, onCheckNotifications, onSetPayday
}: {
  onOpenMonth: (month: MonthKey) => void;
  onCheckNotifications: () => void;
  /** Opens the payday field for one job. Optional — a layout without an
   *  editor still gets the explanation, it just cannot offer the fix. */
  onSetPayday?: (streamId: string) => void;
}) {
  const { data, ui } = useTracker();

  const w2Streams = data.streams.filter((s) => s.type === 'w2' && s.lifecycle === 'active');
  const frequent = w2Streams.filter((s) => s.payFrequency === 'weekly' || s.payFrequency === 'biweekly');
  if (!frequent.length) return null;

  const confirmed = frequent.filter((s) => s.anchorDate);

  const heavy = extraPaycheckMonths(confirmed, ui.year);
  const now = todayMonth();
  const upcoming = ui.focusMode
    ? monthsOfYear(ui.year).filter((m) => m === now)
    : monthsOfYear(ui.year).filter((m) => m >= now);

  const threshold = activeThreshold(data, now);

  const flags = Array.from(heavy.entries())
    .filter(([month]) => upcoming.includes(month))
    .map(([month, info]) => {
      const jobs = confirmed.filter((s) => {
        if (!s.anchorDate || !s.payFrequency) return false;
        const plan = payPlan(ui.year, s.payFrequency, s.anchorDate);
        return plan.heavyMonths.includes(Number(month.slice(5, 7)));
      });
      const values = jobs.map(extraCheckValue).filter((v): v is number => v !== null);
      const extraValue = values.length === jobs.length && values.length
        ? values.reduce((a, b) => a + b, 0)
        : null;
      return { month, counts: info.counts, streamNames: jobs.map((s) => s.name), extraValue };
    })
    .sort((a, b) => a.month.localeCompare(b.month));

  const items = actionItems(data, ui.year, ui.focusMode);
  const urgentCount = items.filter((i) => i.severity === 'warn').length;
  const importantCount = items.filter((i) => i.severity === 'info').length;

  return (
    <section className="panel p-5 sm:p-6 xl:col-span-6">
      <p className="flex items-center gap-2 text-lg font-semibold text-info">
        <Zap className="size-5" />
        Months that pay you extra
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
                  <p className="type-muted truncate">
                    {flag.extraValue
                      ? `About ${money(Math.round(flag.extraValue))} more than a normal month`
                      : flag.streamNames.join(', ')}
                  </p>
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
          <p className="text-base font-semibold">Every month ahead pays you the usual number of times</p>
        </div>
      ) : (
        <UnscheduledExplainer
          streams={frequent.filter((s) => !s.anchorDate)}
          limit={threshold?.amount ?? null}
          onSetPayday={onSetPayday}
        />
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

function UnscheduledExplainer({ streams, limit: _limit, onSetPayday }: {
  streams: Stream[];
  limit: number | null;
  onSetPayday?: (streamId: string) => void;
}) {
  const job = streams[0];
  if (!job || !job.payFrequency) return null;

  const usual = job.payFrequency === 'weekly' ? 4 : 2;
  const extra = usual + 1;

  return (
    <div className="mt-4 flex flex-col gap-3">
      <div className="rounded-lg border border-info/30 bg-info-soft/40 p-3 text-base">
        <p className="font-semibold text-foreground">
          {frequencyLabel(job.payFrequency)} jobs have 2 months each year with {extra} paychecks instead of {usual}.
        </p>
        <p className="type-muted mt-1 text-sm">
          An extra check can push you over your monthly limit even if your hours did not change.
        </p>
      </div>

      {onSetPayday ? (
        <button type="button" onClick={() => onSetPayday(job.id)} className="btn-primary self-start">
          Add any payday from your paystub
        </button>
      ) : null}
    </div>
  );
}
