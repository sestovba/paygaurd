import { useState } from 'react';
import type { ReactNode } from 'react';
import { Calendar, Check, ChevronDown, Lock, LockOpen, TriangleAlert, Trash2, Zap } from 'lucide-react';
import { useTracker } from '../state/TrackerProvider';
import { money } from '../domain/format';
import { longMonthName, monthIndex, monthKey, monthsOfYear, parseMonth, shortMonthName, todayMonth } from '../domain/months';
import { knownYears } from '../domain/rules';
import { activeMonthsInYear, evenSplit, grossFor } from '../domain/earnings';
import { frequencyLabel, paceWarning, payPlan } from '../domain/paySchedule';
import { activeThreshold, benefitPhase } from '../domain/trialWork';
import { InfoNote } from './InfoNote';
import { NumericInput } from './NumericInput';
import { Sheet } from './Sheet';
import { Segmented } from './ui';
import { HelpSpread } from './HelpSpread';
import type { PayFrequency, Stream } from '../domain/types';

const FREQUENCIES: PayFrequency[] = ['weekly', 'biweekly', 'semimonthly', 'monthly'];

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

function CollapsibleSection({ label, children }: { label: string; children: ReactNode }) {
  const [open, setOpen] = useState(true);
  return (
    <div className="flex flex-col gap-4">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex items-center gap-3 text-left"
      >
        <span className="label-caps shrink-0 text-accent-foreground">{label}</span>
        <div className="rule-line flex-1" />
        <ChevronDown className={'size-5 shrink-0 text-muted-foreground transition-transform ' + (open ? '' : '-rotate-90')} />
      </button>
      {open ? <div className="flex flex-col gap-4">{children}</div> : null}
    </div>
  );
}

function TenNinetyNineIncomeSection({ stream, year, onYearChange }: {
  stream: Stream;
  year: number;
  onYearChange: (year: number) => void;
}) {
  const { updateMonthEntries } = useTracker();
  const [helpOpen, setHelpOpen] = useState(false);
  const activeMonths = activeMonthsInYear(stream, year);
  const now = todayMonth();
  const eligibleMonths = activeMonths.filter((m) => m <= now);
  const isYearToDate = eligibleMonths.length > 0 && eligibleMonths.length < activeMonths.length;
  const ytdGross = round2(eligibleMonths.reduce((sum, m) => sum + grossFor(stream, m), 0));
  const ytdMiles = round2(eligibleMonths.reduce((sum, m) => sum + (stream.months[m]?.miles ?? 0), 0));

  return (
    <CollapsibleSection label="What you earned">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <span className="field-label">{isYearToDate ? `Year to date, ${year}` : `Total for ${year}`}</span>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setHelpOpen(true)}
            className="text-xs font-semibold text-accent-foreground hover:underline"
          >
            How spread works
          </button>
          <select
            className="field-input w-28"
            value={year}
            onChange={(e) => onYearChange(Number(e.target.value))}
          >
            {knownYears().map((y) => <option key={y} value={y}>{y}</option>)}
          </select>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <label className="flex flex-col gap-1.5">
          <span className="field-label">{isYearToDate ? 'YTD Gross' : 'Gross'}</span>
          <NumericInput
            className="num field-input w-full"
            prefix="$"
            value={ytdGross}
            placeholder="0"
            disabled={!eligibleMonths.length}
            onCommit={(total) => {
              if (!eligibleMonths.length) return;
              updateMonthEntries(stream.id, evenSplit(total ?? 0, eligibleMonths.length)
                .map((gross, i) => ({ month: eligibleMonths[i], patch: { gross } })));
            }}
          />
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="field-label">{isYearToDate ? 'YTD Miles' : 'Miles'}</span>
          <NumericInput
            className="num field-input w-full"
            prefix="mi"
            value={ytdMiles}
            placeholder="0"
            disabled={!eligibleMonths.length}
            onCommit={(total) => {
              if (!eligibleMonths.length) return;
              updateMonthEntries(stream.id, evenSplit(total ?? 0, eligibleMonths.length)
                .map((miles, i) => ({ month: eligibleMonths[i], patch: { miles } })));
            }}
          />
        </label>
      </div>

      <InfoNote>
        {eligibleMonths.length
          ? `Splits evenly across the ${eligibleMonths.length} month${eligibleMonths.length === 1 ? '' : 's'} ${isYearToDate ? 'elapsed so far' : 'active'} in ${year} for the monthly limit checks. Only Gross, minus mileage, counts toward the thresholds.`
          : `No elapsed active months in ${year} yet to split this across.`}
      </InfoNote>
      {helpOpen ? <HelpSpread onClose={() => setHelpOpen(false)} /> : null}
    </CollapsibleSection>
  );
}

function IncomeEntrySection({ stream, year, onYearChange }: {
  stream: Stream;
  year: number;
  onYearChange: (year: number) => void;
}) {
  const { updateMonthEntry, updateMonthEntries, updateStream } = useTracker();
  const [mode, setMode] = useState<'monthly' | 'yearly'>('monthly');
  const activeMonths = activeMonthsInYear(stream, year);
  const now = todayMonth();
  const eligibleMonths = activeMonths.filter((m) => m <= now);
  const isYearToDate = eligibleMonths.length > 0 && eligibleMonths.length < activeMonths.length;
  const ytdGross = round2(eligibleMonths.reduce((sum, m) => sum + grossFor(stream, m), 0));

  if (stream.type === 'ten99') {
    return <TenNinetyNineIncomeSection stream={stream} year={year} onYearChange={onYearChange} />;
  }

  return (
    <CollapsibleSection label="What you earned">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Segmented
          value={mode}
          onChange={setMode}
          options={[
            { id: 'monthly', label: 'By month' },
            { id: 'yearly', label: 'Yearly total' }
          ]}
        />
        <select
          className="field-input w-28"
          value={year}
          onChange={(e) => onYearChange(Number(e.target.value))}
        >
          {knownYears().map((y) => <option key={y} value={y}>{y}</option>)}
        </select>
      </div>

      {mode === 'monthly' ? (
        <div className="month-year-grid grid grid-cols-2 gap-x-3 gap-y-3">
          {monthsOfYear(year).map((m) => {
            const blockedByLifecycle = stream.lifecycle !== 'active' && monthIndex(m) >= monthIndex(todayMonth());
            const blockedByEnd = stream.activeTo != null && monthIndex(m) > monthIndex(stream.activeTo);
            const disabled = blockedByLifecycle || blockedByEnd;
            const extendIfEarly = () => {
              if (monthIndex(m) < monthIndex(stream.activeFrom)) updateStream(stream.id, { activeFrom: m });
            };
            return (
              <div key={m} className="flex flex-col gap-1">
                <span className="field-label px-0.5">{shortMonthName(m)}</span>
                <NumericInput
                  className="num field-input min-w-0 w-full"
                  prefix="$"
                  value={stream.months[m]?.gross}
                  placeholder="0"
                  disabled={disabled}
                  onCommit={(next) => {
                    if (next !== undefined) extendIfEarly();
                    updateMonthEntry(stream.id, m, { gross: next });
                  }}
                />
              </div>
            );
          })}
        </div>
      ) : (
        <label className="flex flex-col gap-1.5">
          <span className="field-label">
            {isYearToDate ? `Total gross so far in ${year}` : `Total gross for ${year}`}
          </span>
          <NumericInput
            className="num field-input w-40"
            prefix="$"
            value={ytdGross}
            placeholder="0"
            disabled={!eligibleMonths.length}
            onCommit={(total) => {
              if (!eligibleMonths.length) return;
              updateMonthEntries(stream.id, evenSplit(total ?? 0, eligibleMonths.length)
                .map((gross, i) => ({ month: eligibleMonths[i], patch: { gross } })));
            }}
          />
        </label>
      )}

      <InfoNote>
        {mode === 'monthly'
          ? 'Only Gross counts toward the thresholds. Real paychecks take priority over this grid.'
          : eligibleMonths.length
            ? `Splits evenly across the ${eligibleMonths.length} month${eligibleMonths.length === 1 ? '' : 's'} ${isYearToDate ? 'elapsed so far' : 'active'} in ${year}. Switch to By month to fine-tune.`
            : `No elapsed active months in ${year} yet to split this across.`}
      </InfoNote>
    </CollapsibleSection>
  );
}

export function StreamSheet({
  streamId, onClose, variant = 'sheet', backLabel = 'Income sources'
}: {
  streamId: string;
  onClose: () => void;
  variant?: 'sheet' | 'inline';
  backLabel?: string;
}) {
  const { data, ui, setUi, updateStream, removeStream } = useTracker();
  const stream = data.streams.find((s) => s.id === streamId);
  if (!stream) return null;

  const plan = stream.payFrequency && stream.anchorDate
    ? payPlan(ui.year, stream.payFrequency, stream.anchorDate)
    : null;

  const phase = benefitPhase(data, `${ui.year}-12`);
  const threshold = activeThreshold(data, `${ui.year}-12`);
  const pace = threshold ? paceWarning(stream, threshold.amount, ui.year) : null;

  return (
    <Sheet
      title={stream.name}
      eyebrow={stream.type === 'w2' ? 'W-2 job' : '1099 work'}
      size="lg"
      variant={variant === 'inline' ? 'inline' : 'modal'}
      backLabel={variant === 'inline' ? backLabel : undefined}
      onClose={onClose}
      headerActions={
        <>
          <button
            type="button"
            onClick={() => updateStream(stream.id, { locked: !stream.locked })}
            aria-label={stream.locked ? 'Unlock' : 'Lock'}
            title={stream.locked ? 'Unlock' : 'Lock'}
            className="icon-btn grid text-muted-foreground hover:bg-muted"
          >
            {stream.locked ? <LockOpen className="size-5" /> : <Lock className="size-5" />}
          </button>
          <button
            type="button"
            disabled={stream.locked}
            onClick={() => { removeStream(stream.id); onClose(); }}
            aria-label="Remove"
            title={stream.locked ? 'Unlock this job to remove it' : 'Remove'}
            className="icon-btn grid text-destructive hover:bg-destructive/10 disabled:pointer-events-none disabled:opacity-30"
          >
            <Trash2 className="size-5" />
          </button>
        </>
      }
      footer={
        <button type="button" onClick={onClose} className="btn-primary ml-auto">
          Done
        </button>
      }
    >
      <CollapsibleSection label="This job">
        <label className="flex flex-col gap-1.5">
          <span className="field-label">Name</span>
          <input
            className="field-input"
            type="text"
            value={stream.name}
            onChange={(e) => updateStream(stream.id, { name: e.target.value })}
          />
        </label>

        <div className="grid gap-4 sm:grid-cols-2">
          <label className="flex flex-col gap-1.5">
            <span className="field-label">Active since</span>
            <input
              className="field-input"
              type="month"
              value={stream.activeFrom}
              max={todayMonth()}
              onChange={(e) => e.target.value && updateStream(stream.id, { activeFrom: e.target.value })}
            />
          </label>

          <div className="flex flex-col gap-1.5">
            <span className="field-label">Status</span>
            <Segmented
              value={stream.lifecycle}
              columns={3}
              onChange={(lifecycle) => updateStream(stream.id, {
                lifecycle,
                activeTo: lifecycle === 'completed' ? (stream.activeTo ?? todayMonth()) : stream.activeTo
              })}
              options={[
                { id: 'active', label: 'Ongoing' },
                { id: 'inactive', label: 'Paused' },
                { id: 'completed', label: 'Ended' }
              ]}
            />
          </div>
        </div>

        <InfoNote>
          {stream.lifecycle === 'inactive'
            ? 'Paused work stays out of future paycheck and threshold projections, but keeps its history.'
            : stream.lifecycle === 'completed'
              ? 'Ended work stops counting after the date below. Past months keep whatever was already entered.'
              : 'Ongoing work counts toward this month and every future one.'}
        </InfoNote>

        {stream.lifecycle === 'completed' ? (
          <div className="grid grid-cols-2 gap-3">
            <label className="flex flex-col gap-1.5">
              <span className="field-label">Ended — month</span>
              <select
                className="field-input"
                value={parseMonth(stream.activeTo ?? todayMonth()).month1}
                onChange={(e) => updateStream(stream.id, {
                  activeTo: monthKey(parseMonth(stream.activeTo ?? todayMonth()).year, Number(e.target.value))
                })}
              >
                {Array.from({ length: 12 }, (_, i) => (
                  <option key={i} value={i + 1}>{longMonthName(monthKey(2000, i + 1))}</option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-1.5">
              <span className="field-label">Ended — year</span>
              <select
                className="field-input"
                value={parseMonth(stream.activeTo ?? todayMonth()).year}
                onChange={(e) => updateStream(stream.id, {
                  activeTo: monthKey(Number(e.target.value), parseMonth(stream.activeTo ?? todayMonth()).month1)
                })}
              >
                {knownYears().map((y) => <option key={y} value={y}>{y}</option>)}
              </select>
            </label>
          </div>
        ) : null}
      </CollapsibleSection>

      {stream.type === 'w2' ? (
        <CollapsibleSection label="When you get paid">
          <div className="flex flex-col gap-1.5">
            <span className="field-label">How often</span>
            <Segmented
              value={stream.payFrequency}
              columns={4}
              onChange={(payFrequency) => updateStream(stream.id, { payFrequency })}
              options={FREQUENCIES.map((f) => ({ id: f, label: frequencyLabel(f) }))}
            />
          </div>

          <div className={
            'flex flex-col gap-2 rounded-lg border p-4 '
            + (stream.anchorDate ? 'border-good/30 bg-good-soft/40' : 'border-warn/40 bg-warn-soft/60')
          }>
            <div className="flex items-center justify-between gap-2">
              <span className="flex items-center gap-1.5 text-base font-semibold">
                <Calendar className="size-5 shrink-0" />
                Last known payday
              </span>
              {stream.anchorDate ? (
                <span className="flex shrink-0 items-center gap-1 text-base font-semibold text-good">
                  <Check className="size-4" /> Set
                </span>
              ) : (
                <span className="flex shrink-0 items-center gap-1 text-base font-semibold text-warn-foreground">
                  <TriangleAlert className="size-4" /> Needed
                </span>
              )}
            </div>
            <input
              className="field-input bg-surface"
              type="date"
              value={stream.anchorDate ?? ''}
              onChange={(e) => updateStream(stream.id, { anchorDate: e.target.value })}
            />
            <p className="type-muted">
              One real payday is enough. From that date we can see which months land an extra check.
            </p>
          </div>

          {plan && plan.heavyMonths.length ? (
            <div className="flex items-center gap-2 rounded-lg bg-info-soft px-3 py-3 text-base font-semibold text-info">
              <Zap className="size-5" />
              {plan.typicalCount + 1} paychecks in {plan.heavyMonths.length} month{plan.heavyMonths.length === 1 ? '' : 's'} this year
            </div>
          ) : null}
        </CollapsibleSection>
      ) : null}

      <IncomeEntrySection stream={stream} year={ui.year} onYearChange={(year) => setUi({ year })} />

      {stream.type === 'w2' ? (
        <CollapsibleSection label="Planning numbers">
          <div className="flex flex-wrap gap-3">
            <label className="flex w-full flex-col gap-1.5 sm:w-40">
              <span className="field-label">Hourly rate</span>
              <NumericInput
                className="num field-input w-full"
                prefix="$"
                value={stream.hourlyRate}
                placeholder="0"
                onCommit={(next) => updateStream(stream.id, { hourlyRate: next })}
              />
            </label>
            <label className="flex w-full flex-col gap-1.5 sm:w-40">
              <span className="field-label">Hours / week</span>
              <NumericInput
                className="num field-input w-full"
                value={stream.plannedHoursPerWeek}
                placeholder="0"
                onCommit={(next) => updateStream(stream.id, { plannedHoursPerWeek: next })}
              />
            </label>
          </div>

          {pace ? (
            <div className={
              'flex items-start gap-2.5 rounded-lg border p-3 text-base '
              + (pace.level === 'over' ? 'border-destructive/30 bg-destructive/10' : 'border-warn/30 bg-warn-soft/60')
            }>
              <TriangleAlert className={'mt-0.5 size-5 shrink-0 ' + (pace.level === 'over' ? 'text-destructive' : 'text-warn-foreground')} />
              <p className="leading-relaxed">
                <span className="font-semibold">
                  {pace.level === 'over'
                    ? `At this rate, a ${pace.checks}-paycheck month would earn about ${money(pace.amount)} — over the ${phase === 'trialWork' ? 'Trial Work Period' : 'SGA'} limit${threshold ? ` of ${money(threshold.amount)}` : ''}.`
                    : `At this rate, a normal month would earn about ${money(pace.amount)}, close to the ${phase === 'trialWork' ? 'Trial Work Period' : 'SGA'} limit${threshold ? ` of ${money(threshold.amount)}` : ''}.`}
                </span>
                {' '}This is a planning estimate. Enter real Gross each month for the figure that counts.
              </p>
            </div>
          ) : null}
        </CollapsibleSection>
      ) : null}
    </Sheet>
  );
}
