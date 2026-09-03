import { useState } from 'react';
import type { ReactNode } from 'react';
import { Calendar, Check, ChevronDown, Lock, LockOpen, TriangleAlert, Trash2, Zap } from 'lucide-react';
import { useTracker } from '../state/TrackerProvider';
import { copyFor, periodLabel } from '../domain/copy';
import { money } from '../domain/format';
import { longMonthName, monthIndex, monthKey, monthsOfYear, parseMonth, shortMonthName, todayMonth } from '../domain/months';
import { knownYears, TWP_SELF_EMPLOYMENT_HOURS } from '../domain/rules';
import { activeMonthsInYear, evenSplit, grossFor, hoursFor } from '../domain/earnings';
import { frequencyLabel, paceWarning, payPlan } from '../domain/paySchedule';
import { activeThreshold } from '../domain/trialWork';
import { InfoNote } from './InfoNote';
import { NumericInput } from './NumericInput';
import { PayAmountField, PayBasisProvider, PayBasisSwitch, PAY_BASIS_WORDS, usePayBasis } from './PayAmount';
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
  const { ui, updateMonthEntries } = useTracker();
  const words = copyFor(ui.layout);
  const [helpOpen, setHelpOpen] = useState(false);
  const activeMonths = activeMonthsInYear(stream, year);
  const now = todayMonth();
  const eligibleMonths = activeMonths.filter((m) => m <= now);
  const isYearToDate = eligibleMonths.length > 0 && eligibleMonths.length < activeMonths.length;
  const ytdGross = round2(eligibleMonths.reduce((sum, m) => sum + grossFor(stream, m), 0));
  const ytdMiles = round2(eligibleMonths.reduce((sum, m) => sum + (stream.months[m]?.miles ?? 0), 0));
  const ytdHours = round2(eligibleMonths.reduce((sum, m) => sum + hoursFor(stream, m), 0));

  return (
    /* "What you earned" over three fields, one of which is miles and one of
       which is hours. The section is what this work brought in, and the money
       field says so on its own label — see the money words in domain/copy.ts.
       Nothing here asks for a before-tax figure, because gig work has no tax
       taken out of it and a "before taxes" question would invent a
       distinction the reader would then have to resolve. */
    <CollapsibleSection label="What this work brought in">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <span className="field-label">{periodLabel(year, isYearToDate)}</span>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setHelpOpen(true)}
            className="text-xs font-semibold text-accent-foreground hover:underline"
          >
            How Social Security counts this
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

      {/* Three labels that named database columns — Earned, Miles, Hours —
          on the three fields where naming the column is most expensive.
          "Miles" is the one that costs real money: personal miles do not come
          off, and a reader who types every mile they drove gets a deduction
          they are not owed. The unit moved out of the input prefix and into
          the label, where it can be a word rather than "mi". */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <label className="flex flex-col gap-1.5">
          <span className="field-label">{words.paidToYouAsk}</span>
          <NumericInput
            className="num field-input w-full"
            prefix="$"
            value={ytdGross}
            placeholder="Numbers only"
            disabled={!eligibleMonths.length}
            onCommit={(total) => {
              if (!eligibleMonths.length) return;
              updateMonthEntries(stream.id, evenSplit(total ?? 0, eligibleMonths.length)
                .map((gross, i) => ({ month: eligibleMonths[i], patch: { gross } })));
            }}
          />
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="field-label">{words.workMiles}</span>
          <NumericInput
            className="num field-input w-full"
            value={ytdMiles || undefined}
            placeholder="Numbers only"
            disabled={!eligibleMonths.length}
            onCommit={(total) => {
              if (!eligibleMonths.length) return;
              updateMonthEntries(stream.id, evenSplit(total ?? 0, eligibleMonths.length)
                .map((miles, i) => ({ month: eligibleMonths[i], patch: { miles } })));
            }}
          />
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="field-label">{words.hoursWorked}</span>
          <NumericInput
            className="num field-input w-full"
            value={ytdHours || undefined}
            placeholder="Numbers only"
            disabled={!eligibleMonths.length}
            onCommit={(total) => {
              if (!eligibleMonths.length) return;
              updateMonthEntries(stream.id, evenSplit(total ?? 0, eligibleMonths.length)
                .map((hours, i) => ({ month: eligibleMonths[i], patch: { hours } })));
            }}
          />
        </label>
      </div>

      {/* Was one sentence carrying two rules, opening with "Social Security
          rule:" and closing with "Trial Work Period months". Two rules are
          two sentences, and the reader is told what happens to them rather
          than which rule it is filed under. */}
      <InfoNote>
        {eligibleMonths.length
          ? `Your miles come off before anything counts. Whatever is left is what counts toward your monthly limit. Working more than ${TWP_SELF_EMPLOYMENT_HOURS} hours in one month uses 1 of your 9 trial work months, even if you earned very little.`
          : `No active months in ${year} yet to split this across.`}
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
  const { basis } = usePayBasis();
  const [mode, setMode] = useState<'monthly' | 'yearly'>('monthly');
  const activeMonths = activeMonthsInYear(stream, year);
  const now = todayMonth();
  const eligibleMonths = activeMonths.filter((m) => m <= now);
  const isYearToDate = eligibleMonths.length > 0 && eligibleMonths.length < activeMonths.length;
  const ytdGross = round2(eligibleMonths.reduce((sum, m) => sum + grossFor(stream, m), 0));
  const ytdNet = round2(eligibleMonths.reduce((sum, m) => sum + (stream.months[m]?.net ?? 0), 0));
  /* The year total stands in for twelve months, so it inherits their basis:
     if any of them came through the bank door, the total did too, and the
     paystub field must not offer a figure nobody entered. */
  const ytdBasis = eligibleMonths.some((m) => stream.months[m]?.basis === 'fromNet')
    ? 'fromNet' as const
    : undefined;

  if (stream.type === 'ten99') {
    return <TenNinetyNineIncomeSection stream={stream} year={year} onYearChange={onYearChange} />;
  }

  return (
    <CollapsibleSection label="Paychecks">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Segmented
          value={mode}
          onChange={setMode}
          options={[
            { id: 'monthly', label: 'Month by month' },
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

      {/* One door, asked once. The twelve fields below used to be twelve bare
          dollar boxes labelled with a month, and the only thing telling you
          which number went in them was a paragraph underneath saying "the pay
          before tax helps us most" — a request for the figure most people
          cannot find, made after they had already typed the one they had.
          See PayAmount.tsx: the switch says which number, the fields say it
          again on themselves, and the conversion happens in front of you. */}
      <PayBasisSwitch />

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
              <PayAmountField
                key={m}
                label={shortMonthName(m)}
                entry={stream.months[m]}
                disabled={disabled}
                className="num field-input min-w-0 w-full"
                onCommit={(patch) => {
                  if (patch.gross !== undefined) extendIfEarly();
                  updateMonthEntry(stream.id, m, patch);
                }}
              />
            );
          })}
        </div>
      ) : (
        <PayAmountField
          label={`${PAY_BASIS_WORDS[basis].field}, ${periodLabel(year, isYearToDate).toLowerCase()}`}
          entry={{ gross: ytdGross, net: ytdNet, basis: ytdBasis }}
          disabled={!eligibleMonths.length}
          className="num field-input w-40"
          onCommit={(patch) => {
            if (!eligibleMonths.length) return;
            const grossParts = evenSplit(patch.gross ?? 0, eligibleMonths.length);
            const netParts = evenSplit(patch.net ?? 0, eligibleMonths.length);
            updateMonthEntries(stream.id, eligibleMonths.map((month, i) => ({
              month,
              patch: {
                gross: patch.gross === undefined ? undefined : grossParts[i],
                net: patch.net === undefined ? undefined : netParts[i],
                basis: patch.basis
              }
            })));
          }}
        />
      )}

      {/* The gross/net half of this note is now on the control itself, which
          is where the decision is made. What is left is the one thing the
          fields cannot say about themselves: what happens to what you type
          when a real paycheck arrives later. */}
      <InfoNote>
        {mode === 'monthly'
          ? 'Real paychecks you enter later replace whatever you put here.'
          : eligibleMonths.length
            ? `Split evenly across the ${eligibleMonths.length} month${eligibleMonths.length === 1 ? '' : 's'} you have worked in ${year}. Switch to Month by month to change one of them.`
            : `No active months in ${year} yet to split this across.`}
      </InfoNote>
    </CollapsibleSection>
  );
}

export function StreamSheet({
  streamId, onClose, variant = 'sheet', backLabel
}: {
  streamId: string;
  onClose: () => void;
  variant?: 'sheet' | 'inline';
  backLabel?: string;
}) {
  const { data, ui, setUi, updateStream, removeStream } = useTracker();
  /* The default back label is the name of the list you came from, and that
     name belongs to the layout you are in — see src/domain/copy.ts. */
  const backTo = backLabel ?? copyFor(ui.layout).income;
  const stream = data.streams.find((s) => s.id === streamId);
  if (!stream) return null;

  const plan = stream.payFrequency && stream.anchorDate
    ? payPlan(ui.year, stream.payFrequency, stream.anchorDate)
    : null;

  const threshold = activeThreshold(data, `${ui.year}-12`);
  const pace = threshold ? paceWarning(stream, threshold.amount, ui.year) : null;

  return (
    <Sheet
      title={stream.name}
      eyebrow={stream.type === 'w2' ? 'A job that pays me' : 'Work I do for myself'}
      size="lg"
      variant={variant === 'inline' ? 'inline' : 'modal'}
      backLabel={variant === 'inline' ? backTo : undefined}
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
      <CollapsibleSection label="About this job">
        <label className="flex flex-col gap-1.5">
          <span className="field-label">Name</span>
          <input
            className="field-input"
            type="text"
            value={stream.name}
            onChange={(e) => updateStream(stream.id, { name: e.target.value })}
          />
        </label>

        {/* Not a two-column grid. Half of a sheet is not enough for three
            segments, so the status control was being squeezed to 47px a
            side and stacking its labels a word at a time. These sit side by
            side while both of them fit and stack when they do not — the
            status control asks for the room three labels actually need. */}
        <div className="flex flex-wrap gap-4">
          <label className="flex min-w-[9rem] flex-1 flex-col gap-1.5">
            <span className="field-label">Started</span>
            <input
              className="field-input"
              type="month"
              value={stream.activeFrom}
              max={todayMonth()}
              onChange={(e) => e.target.value && updateStream(stream.id, { activeFrom: e.target.value })}
            />
          </label>

          <div className="flex min-w-[19rem] flex-1 flex-col gap-1.5">
            <span className="field-label">Are you still doing this work?</span>
            <Segmented
              value={stream.lifecycle}
              columns={3}
              onChange={(lifecycle) => updateStream(stream.id, {
                lifecycle,
                activeTo: lifecycle === 'completed' ? (stream.activeTo ?? todayMonth()) : stream.activeTo
              })}
              options={[
                { id: 'active', label: 'Current' },
                { id: 'inactive', label: 'Paused' },
                { id: 'completed', label: 'Ended' }
              ]}
            />
          </div>
        </div>

        <InfoNote>
          {stream.lifecycle === 'inactive'
            ? 'Paused jobs stay in your records but do not count toward future month estimates.'
            : stream.lifecycle === 'completed'
              ? 'Ended jobs stop counting after the date below. Past months keep whatever was entered.'
              /* The control's options are Current, Paused and Ended. This
                 line said "Active", sending the reader to look for a button
                 that is not there. */
              : 'Money from this job counts in the months you earned it. Current means we also expect more of it in the months ahead.'}
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
        <CollapsibleSection label="Pay days">
          <div className="flex flex-col gap-1.5">
            <span className="field-label">How often you are paid</span>
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
                Any one payday — from a paystub if you have one
              </span>
              {stream.anchorDate ? (
                <span className="flex shrink-0 items-center gap-1 text-base font-semibold text-good-text">
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
              Enter any payday from a paystub. We calculate all other paydays to warn you before extra paycheck months.
            </p>
          </div>

          {plan && plan.heavyMonths.length ? (
            <div className="flex items-center gap-2 rounded-lg bg-info-soft px-3 py-3 text-base font-semibold text-info-text">
              <Zap className="size-5" />
              {plan.typicalCount + 1} paychecks in {plan.heavyMonths.length} month{plan.heavyMonths.length === 1 ? '' : 's'} this year
            </div>
          ) : null}
        </CollapsibleSection>
      ) : null}

      {/* One switch for the whole editor, not one per field: somebody who
          has paystubs has them for every month, and asking that question
          twelve times is twelve chances to answer it differently. */}
      <PayBasisProvider>
        <IncomeEntrySection stream={stream} year={ui.year} onYearChange={(year) => setUi({ year })} />
      </PayBasisProvider>

      {stream.type === 'w2' ? (
        <CollapsibleSection label="Hourly pay">
          <div className="flex flex-wrap gap-3">
            <label className="flex w-full flex-col gap-1.5 sm:w-40">
              <span className="field-label">Hourly wage</span>
              <NumericInput
                className="num field-input w-full"
                prefix="$"
                value={stream.hourlyRate}
                placeholder="0"
                onCommit={(next) => updateStream(stream.id, { hourlyRate: next })}
              />
            </label>
            <label className="flex w-full flex-col gap-1.5 sm:w-40">
              <span className="field-label">Hours in a usual week</span>
              <NumericInput
                className="num field-input w-full"
                value={stream.plannedHoursPerWeek}
                placeholder="0"
                onCommit={(next) => updateStream(stream.id, { plannedHoursPerWeek: next })}
              />
            </label>
          </div>

          <p className="type-muted">
            Hours move about. A rough number is fine — we only use it to guess a paycheck.
          </p>

          {pace ? (
            <div className={
              'flex items-start gap-2.5 rounded-lg border p-3 text-base '
              + (pace.level === 'over' ? 'border-destructive/30 bg-destructive/10' : 'border-warn/30 bg-warn-soft/60')
            }>
              <TriangleAlert className={'mt-0.5 size-5 shrink-0 ' + (pace.level === 'over' ? 'text-destructive' : 'text-warn-foreground')} />
              <p className="leading-relaxed">
                <span className="font-semibold">
                  {pace.level === 'over'
                    /* One limit at a time, and it is never named after the
                       rule it came from. This printed "over the Trial Work
                       Period limit" or "over the SGA limit" depending on the
                       phase — the one place left in this file where the app
                       told the reader which of Social Security's two rules
                       it was quoting at them. */
                    ? `In a month with ${pace.checks} paychecks, you would earn about ${money(pace.amount)}. That is over your monthly limit${threshold ? ` of ${money(threshold.amount)}` : ''}.`
                    : `In a normal month, you would earn about ${money(pace.amount)}. That is close to your monthly limit${threshold ? ` of ${money(threshold.amount)}` : ''}.`}
                </span>
                {' '}This is a planning estimate. Type the exact amount from your paystubs each month for the number that counts.
              </p>
            </div>
          ) : null}
        </CollapsibleSection>
      ) : null}
    </Sheet>
  );
}
