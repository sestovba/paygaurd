import { Zap } from 'lucide-react';
import { Chip, Switch } from './ui';
import { useTracker } from '../state/TrackerProvider';
import { money } from '../domain/format';
import { displayMonths, formatMonth, shortMonthName, todayMonth } from '../domain/months';
import { monthStatus, nearLimit } from '../domain/earnings';
import { extraPaycheckMonths } from '../domain/paySchedule';
import { benefitPhase } from '../domain/trialWork';
import type { MonthKey } from '../domain/types';

export function MonthGrid({ onOpenMonth }: { onOpenMonth: (month: MonthKey) => void }) {
  const { data, ui, setUi } = useTracker();
  const now = todayMonth();
  const phase = benefitPhase(data, `${ui.year}-12`);
  const extraPay = extraPaycheckMonths(data.streams, ui.year);
  const checked = ui.hideFuture;

  return (
    <section className="panel p-5 sm:p-6 xl:col-span-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h2 className="text-lg font-semibold">Monthly countable income</h2>
        <label className="flex items-center justify-between gap-3 text-base text-muted-foreground sm:justify-end">
          Hide future
          <Switch
            checked={checked}
            label="Hide future months"
            onChange={() => setUi({ hideFuture: !checked })}
          />
        </label>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-4">
        {displayMonths(ui.year, ui.hideFuture).map((month) => {
          const status = monthStatus(data, month);
          const empty = status.countable === 0;
          const extra = extraPay.get(month);
          const near = nearLimit(status, phase);
          const isNow = month === now;

          const over = phase === 'sga' && status.overSga;
          const spent = phase === 'trialWork' && status.isServiceMonth;

          const valueColor = over ? 'text-destructive' : spent ? 'text-warn' : empty ? 'text-muted-foreground/50' : 'text-foreground';
          // isNow only adds a ring, never overrides the semantic tint below —
          // otherwise today's tile could clash with its own extra-paycheck badge.
          const tileClass = (
            over
              ? 'border-destructive/30 bg-destructive/10'
              : spent
                ? 'border-warn/30 bg-warn-soft/60'
                : extra
                  ? 'border-info/40 bg-info-soft/40'
                  : isNow
                    ? 'border-primary/30 bg-accent/60'
                    : 'border-border bg-surface-2'
          ) + (isNow ? ' ring-1 ring-primary/15' : '');

          return (
            <button
              key={month}
              type="button"
              onClick={() => onOpenMonth(month)}
              aria-label={
                extra
                  ? `Enter ${formatMonth(month)}, ${extra.counts.join(' or ')} paychecks`
                  : `Enter ${formatMonth(month)}`
              }
              className={'relative rounded-lg border p-3 text-left transition-colors ' + tileClass}
            >
              {extra ? (
                <span className="absolute -top-2 -right-2 flex items-center gap-0.5 rounded-full bg-info px-2 py-0.5 text-[0.7rem] font-bold text-info-foreground">
                  <Zap className="size-3.5" />{extra.counts.join('/')}
                </span>
              ) : null}
              <p className="label-caps">{shortMonthName(month)}</p>
              <p className={'display-figure mt-1 text-xl sm:text-2xl ' + valueColor}>
                {empty ? '—' : money(status.countable)}
              </p>
              {near ? (
                <p className="mt-2">
                  <Chip tone={near.kind === 'sga' ? 'danger' : 'warn'}>
                    {money(near.room)} below {near.kind === 'trial' ? 'TWP' : 'SGA'}
                  </Chip>
                </p>
              ) : null}
            </button>
          );
        })}
      </div>
    </section>
  );
}
