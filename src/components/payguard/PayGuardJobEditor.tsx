import { useEffect, useState } from 'react';
import { ChevronDown, Lock, LockOpen, Sparkles, Trash2, Zap } from 'lucide-react';
import { useTracker } from '../../state/TrackerProvider';
import {
  activeMonthsInYear,
  countableFor,
  evenSplit,
  grossFor,
  hoursFor
} from '../../domain/earnings';
import {
  longMonthName,
  monthIndex,
  monthKey,
  monthsOfYear,
  parseMonth,
  shortMonthName,
  todayMonth
} from '../../domain/months';
import { knownYears, rulesFor, TWP_SELF_EMPLOYMENT_HOURS } from '../../domain/rules';
import { frequencyLabel, paycheckContextForMonth, payPlan } from '../../domain/paySchedule';
import { benefitPhase } from '../../domain/trialWork';
import { money } from '../../domain/format';
import type { PayFrequency, Stream } from '../../domain/types';
import { HelpSpread } from '../HelpSpread';
import { SectionHead } from './PayGuardPrimitives';

const FREQUENCIES: PayFrequency[] = ['weekly', 'biweekly', 'semimonthly', 'monthly'];

const LIFECYCLES = [
  { id: 'active', label: 'Ongoing' },
  { id: 'inactive', label: 'Paused' },
  { id: 'completed', label: 'Ended' }
] as const;

/** Right-aligned spreadsheet cell input, committing on blur. */
function CellInput({
  value, onCommit, ariaLabel, placeholder, disabled, prefix
}: {
  value: number | undefined;
  onCommit: (next: number | undefined) => void;
  ariaLabel: string;
  placeholder?: string;
  disabled?: boolean;
  prefix?: string;
}) {
  const [draft, setDraft] = useState(value == null || value === 0 ? '' : String(value));

  useEffect(() => {
    setDraft(value == null || value === 0 ? '' : String(value));
  }, [value]);

  function commit() {
    const trimmed = draft.trim();
    const next = trimmed ? Number(trimmed) : undefined;
    if (trimmed && (!Number.isFinite(next) || Number(next) < 0)) {
      setDraft(value == null || value === 0 ? '' : String(value));
      return;
    }
    const normalized = next == null ? undefined : Number(next);
    if (normalized !== value && !(normalized == null && value === 0)) onCommit(normalized);
  }

  return (
    <div className="relative flex h-full w-full items-stretch">
      {prefix ? (
        <span className="pg-mono pointer-events-none absolute left-2 top-1/2 -translate-y-1/2 text-xs pg-dim">
          {prefix}
        </span>
      ) : null}
      <input
        type="text"
        inputMode="decimal"
        aria-label={ariaLabel}
        placeholder={placeholder}
        disabled={disabled}
        value={draft}
        onFocus={(event) => event.currentTarget.select()}
        onChange={(event) => setDraft(event.target.value)}
        onBlur={commit}
        onKeyDown={(event) => {
          if (event.key === 'Enter' || event.key === 'Escape') event.currentTarget.blur();
        }}
        className={`pg-excel-input ${prefix ? 'pl-5' : ''}`}
      />
    </div>
  );
}

/**
 * A labelled control in a ruled row. Cells are separated by hairline insets
 * instead of each drawing its own box — a bordered box inside a bordered card
 * reads as two outlines.
 */
function FieldCell({ label, hint, children }: { label: string; hint: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5 p-3 shadow-[inset_1px_0_0_0_var(--pg-rule),inset_0_1px_0_0_var(--pg-rule)] sm:p-3.5">
      <span className="pg-label truncate">{label}</span>
      {children}
      <span className="text-[0.6875rem] leading-snug pg-muted">{hint}</span>
    </div>
  );
}

export function PayGuardJobEditor({
  stream, year, open: cardOpen, onToggleOpen, onRemove
}: {
  stream: Stream;
  year: number;
  open: boolean;
  onToggleOpen: () => void;
  onRemove?: () => void;
}) {
  const { data, updateStream, updateMonthEntry, updateMonthEntries } = useTracker();
  const [settingsOpen, setSettingsOpen] = useState(true);
  const [ledgerOpen, setLedgerOpen] = useState(true);
  const [helpOpen, setHelpOpen] = useState(false);

  const now = todayMonth();
  const months = monthsOfYear(year);
  const rules = rulesFor(year);
  const activeMonths = activeMonthsInYear(stream, year);
  const eligibleMonths = activeMonths.filter((m) => m <= now);
  const isYearToDate = eligibleMonths.length > 0 && eligibleMonths.length < activeMonths.length;
  const ytdGross = eligibleMonths.reduce((sum, month) => sum + grossFor(stream, month), 0);
  const ytdMiles = eligibleMonths.reduce((sum, month) => sum + (stream.months[month]?.miles ?? 0), 0);
  const ytdHours = eligibleMonths.reduce((sum, month) => sum + hoursFor(stream, month), 0);

  const plan = stream.payFrequency && stream.anchorDate ? payPlan(year, stream.payFrequency, stream.anchorDate) : null;
  const scheduleSummary = stream.payFrequency
    ? `${frequencyLabel(stream.payFrequency)} · ${stream.lifecycle === 'active' && !stream.activeTo ? 'Active all year' : 'Date range set'}`
    : 'Not scheduled';

  function autofillRemainingMonths() {
    if (!stream.hourlyRate || stream.hourlyRate <= 0 || !stream.plannedHoursPerWeek || stream.plannedHoursPerWeek <= 0) {
      alert('Please enter a planning hourly rate and hours/week first.');
      return;
    }
    const weeklyGross = stream.hourlyRate * stream.plannedHoursPerWeek;
    const updates = months.flatMap((m) => {
      const existing = stream.months[m]?.gross;
      if (existing != null && existing > 0) return [];
      const context = paycheckContextForMonth([stream], m);
      const checkCount = context.length > 0
        ? context[0].count
        : stream.payFrequency === 'monthly' ? 1
          : stream.payFrequency === 'semimonthly' ? 2
            : stream.payFrequency === 'biweekly' ? 2.17 : 4.33;
      const estGross = Math.round(weeklyGross * (
        stream.payFrequency === 'biweekly' ? checkCount * 2
          : stream.payFrequency === 'monthly' ? 4.33 : checkCount
      ));
      return [{ month: m, patch: { gross: estGross, hours: Math.round(stream.plannedHoursPerWeek! * 4.33) } }];
    });

    if (updates.length === 0) {
      alert('All months already have income entered.');
      return;
    }
    if (confirm(`Autofill ${updates.length} empty month(s) based on $${stream.hourlyRate}/hr at ${stream.plannedHoursPerWeek} hrs/wk?`)) {
      updateMonthEntries(stream.id, updates);
    }
  }

  const selfEmploymentFields = [
    {
      key: 'gross' as const,
      label: isYearToDate ? 'YTD gross earnings' : 'Annual gross earnings',
      hint: 'Total 1099 receipts before expenses.',
      prefix: '$',
      placeholder: '0.00',
      value: ytdGross
    },
    {
      key: 'miles' as const,
      label: isYearToDate ? 'YTD business miles' : 'Annual business miles',
      hint: 'Standard mileage deduction applies.',
      placeholder: '0',
      value: ytdMiles
    },
    {
      key: 'hours' as const,
      label: isYearToDate ? 'YTD work hours' : 'Annual work hours',
      hint: `Over ${TWP_SELF_EMPLOYMENT_HOURS} hrs/mo uses a TWP month.`,
      placeholder: '0',
      value: ytdHours
    }
  ];

  return (
    <div id={`pg-job-${stream.id}`} className="pg-card scroll-mt-20 overflow-hidden">
      <h2 className="sr-only">{stream.name}</h2>
      {/* ---------------- Job header ---------------- */}
      <div className="flex flex-wrap items-center justify-between gap-x-2.5 gap-y-2 pg-rule-b px-2.5 py-2.5 sm:px-3.5 sm:py-3">
        <div className="flex min-w-0 flex-1 items-center gap-1.5 sm:gap-2">
          <button
            type="button"
            onClick={onToggleOpen}
            aria-expanded={cardOpen}
            aria-label={cardOpen ? 'Collapse job details' : 'Expand job details'}
            className="pg-icon-btn"
          >
            <ChevronDown className={`size-4 transition-transform duration-150 ${cardOpen ? '' : '-rotate-90'}`} />
          </button>
          <button
            type="button"
            onClick={() => updateStream(stream.id, { locked: !stream.locked })}
            aria-pressed={stream.locked}
            title={stream.locked ? 'Unlock job' : 'Lock job'}
            aria-label={stream.locked ? 'Unlock job to make edits' : 'Lock job to prevent edits'}
            className="pg-icon-btn pg-icon-btn-bordered"
          >
            {stream.locked
              ? <Lock className="size-3.5 pg-text-warn" />
              : <LockOpen className="size-3.5" />}
          </button>
          <span className={`pg-badge ${stream.type === 'w2' ? 'pg-badge-w2' : 'pg-badge-se'}`}>
            {stream.type === 'w2' ? 'W-2' : '1099'}
          </span>
          <input
            aria-label={`${stream.type === 'w2' ? 'W-2' : '1099'} job name`}
            value={stream.name}
            disabled={stream.locked}
            onChange={(e) => updateStream(stream.id, { name: e.target.value })}
            className="min-w-0 flex-1 pg-focus-underline pg-fg bg-transparent px-1 text-sm font-bold outline-none sm:text-base"
          />
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <span className="hidden items-baseline gap-2 xs:flex">
            <span className="pg-label">YTD gross</span>
            <span className="pg-figure pg-figure-md">{money(ytdGross)}</span>
          </span>
          {onRemove ? (
            <button
              type="button"
              onClick={onRemove}
              aria-label={`Remove ${stream.name}`}
              title={`Remove ${stream.name}`}
              className="pg-icon-btn pg-icon-btn-bordered pg-btn-danger pg-touch-target"
            >
              <Trash2 className="size-3.5" />
            </button>
          ) : null}
        </div>
      </div>

      {cardOpen ? (
        <>
          {/* ---------------- Status row ---------------- */}
          <div className="flex flex-wrap items-center gap-2 pg-rule-b pg-surface-quiet px-2.5 py-2.5 sm:px-3.5">
            <div className="pg-seg" role="group" aria-label="Employment status">
              {LIFECYCLES.map(({ id, label }) => (
                <button
                  key={id}
                  type="button"
                  disabled={stream.locked}
                  data-on={stream.lifecycle === id}
                  aria-pressed={stream.lifecycle === id}
                  onClick={() => updateStream(stream.id, {
                    lifecycle: id,
                    activeTo: id === 'completed'
                      ? (stream.activeTo ?? todayMonth())
                      : id === 'active' ? null : stream.activeTo
                  })}
                  className="pg-seg-item"
                >
                  {label}
                </button>
              ))}
            </div>

            <label className="pg-field">
              <span className="pg-field-label">Since</span>
              <input
                type="month"
                aria-label="First active month"
                value={stream.activeFrom}
                max={todayMonth()}
                disabled={stream.locked}
                onChange={(e) => e.target.value && updateStream(stream.id, { activeFrom: e.target.value })}
              />
            </label>

            {stream.lifecycle === 'completed' ? (
              <span className="pg-field">
                <span className="pg-field-label">Ended</span>
                <select
                  aria-label="Ended month"
                  value={parseMonth(stream.activeTo ?? todayMonth()).month1}
                  disabled={stream.locked}
                  onChange={(e) => updateStream(stream.id, {
                    activeTo: monthKey(parseMonth(stream.activeTo ?? todayMonth()).year, Number(e.target.value))
                  })}
                >
                  {Array.from({ length: 12 }, (_, i) => (
                    <option key={i} value={i + 1}>{longMonthName(monthKey(2000, i + 1))}</option>
                  ))}
                </select>
                <select
                  aria-label="Ended year"
                  value={parseMonth(stream.activeTo ?? todayMonth()).year}
                  disabled={stream.locked}
                  onChange={(e) => updateStream(stream.id, {
                    activeTo: monthKey(Number(e.target.value), parseMonth(stream.activeTo ?? todayMonth()).month1)
                  })}
                >
                  {knownYears().map((y) => <option key={y} value={y}>{y}</option>)}
                </select>
              </span>
            ) : null}
          </div>

          {stream.type === 'w2' ? (
            <>
              <SectionHead
                label="Settings & date range"
                meta={scheduleSummary}
                open={settingsOpen}
                onToggle={() => setSettingsOpen((v) => !v)}
              />

              {settingsOpen ? (
                <>
                  <div className="grid grid-cols-1 pg-rule-b sm:grid-cols-2 lg:grid-cols-4">
                    <FieldCell label="Pay cycle" hint="How often this job pays.">
                      <select
                        aria-label="Pay frequency"
                        value={stream.payFrequency}
                        disabled={stream.locked}
                        onChange={(e) => updateStream(stream.id, { payFrequency: e.target.value as PayFrequency })}
                        className="pg-select w-full"
                      >
                        {FREQUENCIES.map((f) => <option key={f} value={f}>{frequencyLabel(f)}</option>)}
                      </select>
                    </FieldCell>

                    <FieldCell
                      label="Anchor payday"
                      hint={stream.anchorDate ? 'Anchor date locked in.' : 'Not set — extra-check months hidden.'}
                    >
                      <input
                        type="date"
                        aria-label="Anchor payday"
                        value={stream.anchorDate ?? ''}
                        disabled={stream.locked}
                        onChange={(e) => updateStream(stream.id, { anchorDate: e.target.value })}
                        className="pg-input w-full"
                      />
                    </FieldCell>

                    <FieldCell label="Planning rate" hint="Used for projections and quick autofill.">
                      <div className="grid grid-cols-2 gap-2">
                        <span className="pg-field">
                          <span className="pg-mono pg-dim">$</span>
                          <input
                            type="text"
                            inputMode="decimal"
                            placeholder="0.00"
                            aria-label="Hourly rate"
                            value={stream.hourlyRate ?? ''}
                            disabled={stream.locked}
                            onChange={(e) => updateStream(stream.id, { hourlyRate: e.target.value ? Number(e.target.value) : undefined })}
                            className="pg-mono w-full text-right"
                          />
                          <span className="pg-mono text-[0.625rem] pg-dim">/hr</span>
                        </span>
                        <span className="pg-field">
                          <input
                            type="text"
                            inputMode="decimal"
                            placeholder="0"
                            aria-label="Planned hours per week"
                            value={stream.plannedHoursPerWeek ?? ''}
                            disabled={stream.locked}
                            onChange={(e) => updateStream(stream.id, { plannedHoursPerWeek: e.target.value ? Number(e.target.value) : undefined })}
                            className="pg-mono w-full text-right"
                          />
                          <span className="pg-mono text-[0.625rem] pg-dim">h/wk</span>
                        </span>
                      </div>
                    </FieldCell>

                    <FieldCell
                      label={`Paychecks in ${year}`}
                      hint={plan?.heavyMonths.length
                        ? `${plan.heavyMonths.length} three-check month${plan.heavyMonths.length === 1 ? '' : 's'}.`
                        : 'Set an anchor date to compute.'}
                    >
                      <span className="pg-figure pg-figure-md">{plan ? `${plan.total} checks` : '—'}</span>
                    </FieldCell>
                  </div>

                  {plan && plan.heavyMonths.length ? (
                    <div className="flex items-start gap-2 border-b px-3 py-2 text-xs font-semibold sm:px-4 pg-callout-warn">
                      <Zap className="mt-0.5 size-3.5 shrink-0" />
                      <span>
                        <strong>Extra paycheck month:</strong>{' '}
                        {plan.typicalCount + 1} paychecks expected in{' '}
                        {plan.heavyMonths.map((m) => longMonthName(monthKey(year, m))).join(' and ')} this year.
                      </span>
                    </div>
                  ) : null}
                </>
              ) : null}

              {/* ---------------- Monthly ledger ---------------- */}
              <SectionHead
                label={`${year} monthly ledger`}
                meta={`${activeMonths.length} of 12 active`}
                open={ledgerOpen}
                onToggle={() => setLedgerOpen((v) => !v)}
                action={ledgerOpen && !stream.locked ? (
                  <button
                    type="button"
                    onClick={autofillRemainingMonths}
                    className="pg-btn pg-btn-sm pg-btn-ghost pg-accent"
                    title="Autofill remaining empty months from the planning rate"
                  >
                    <Sparkles className="size-3.5" />
                    <span className="hidden sm:inline">Autofill empty months</span>
                    <span className="sm:hidden">Autofill</span>
                  </button>
                ) : undefined}
              />

              {ledgerOpen ? (
                <div
                  className="pg-scroll-x"
                  role="region"
                  aria-label={`${year} monthly earnings for ${stream.name}`}
                  tabIndex={0}
                  onScroll={(e) => e.currentTarget.classList.toggle('pg-scrolled', e.currentTarget.scrollLeft > 0)}
                >
                  <div role="table" aria-label={`${stream.name} monthly earnings ledger`}>
                  <div className="pg-ledger-grid pg-table-head" role="row">
                    <div className="pg-frozen pg-rule-r px-2.5 py-2" role="columnheader">Month</div>
                    <div className="pg-rule-r px-2.5 py-2 text-right" role="columnheader">Hours</div>
                    <div className="pg-rule-r px-2.5 py-2 text-right" role="columnheader">Gross</div>
                    <div className="pg-rule-r px-2.5 py-2 text-right" role="columnheader">Countable</div>
                    <div className="pg-rule-r px-2 py-2 text-center" role="columnheader">Status</div>
                    <div className="px-1 py-2 text-center" role="columnheader"><span className="sr-only">Clear month</span>—</div>
                  </div>

                  {months.map((m, idx) => {
                    const blockedByLifecycle = stream.lifecycle !== 'active' && monthIndex(m) >= monthIndex(todayMonth());
                    const blockedByEnd = stream.activeTo != null && monthIndex(m) > monthIndex(stream.activeTo);
                    const disabled = stream.locked || blockedByLifecycle || blockedByEnd;
                    const extendIfEarly = () => {
                      if (monthIndex(m) < monthIndex(stream.activeFrom)) updateStream(stream.id, { activeFrom: m });
                    };
                    const context = paycheckContextForMonth([stream], m);
                    const gross = grossFor(stream, m);
                    const hrs = hoursFor(stream, m);
                    const countable = countableFor(stream, m);
                    const phase = benefitPhase(data, m);
                    const isOver = countable > (phase === 'trialWork' ? rules.trialWork : rules.sga);
                    const isHeavy = context.length > 0 && context[0].count > (stream.payFrequency === 'biweekly' ? 2 : 4);

                    return (
                      <div
                        key={m}
                        className="pg-ledger-grid pg-table-row"
                        data-stripe={idx % 2 === 1}
                        data-over={isOver}
                        role="row"
                      >
                        <div
                          className="pg-frozen flex flex-col justify-center gap-0.5 pg-rule-r px-2.5 py-1.5"
                          data-stripe={idx % 2 === 1}
                          data-over={isOver}
                          role="rowheader"
                        >
                          <span className="flex items-center justify-between gap-1">
                            <span className="text-xs font-semibold pg-fg">{shortMonthName(m)}</span>
                            {isHeavy ? (
                              <span className="pg-badge pg-badge-warn px-1 py-0" title={`${context[0].count} paychecks this month`}>
                                {context[0].count}×
                              </span>
                            ) : null}
                          </span>
                          {isOver ? (
                            <span className="text-[0.625rem] font-bold pg-text-over">
                              Over {phase === 'trialWork' ? 'TWP' : 'SGA'}
                            </span>
                          ) : null}
                        </div>

                        <div className="pg-rule-r p-0.5" role="cell">
                          <CellInput
                            ariaLabel={`${longMonthName(m)} hours`}
                            placeholder="—"
                            disabled={disabled}
                            value={hrs || undefined}
                            onCommit={(next) => {
                              if (next !== undefined) extendIfEarly();
                              updateMonthEntry(stream.id, m, { hours: next });
                            }}
                          />
                        </div>

                        <div className="pg-rule-r p-0.5" role="cell">
                          <CellInput
                            prefix="$"
                            ariaLabel={`${longMonthName(m)} gross income`}
                            placeholder="0.00"
                            disabled={disabled}
                            value={gross || undefined}
                            onCommit={(next) => {
                              if (next !== undefined) extendIfEarly();
                              updateMonthEntry(stream.id, m, { gross: next });
                            }}
                          />
                        </div>

                        <div className="pg-mono flex items-center justify-end pg-rule-r px-2.5 py-2 text-xs font-bold pg-fg" role="cell">
                          {countable > 0 ? money(countable) : <span className="pg-dim">—</span>}
                        </div>

                        <div className="flex items-center justify-center pg-rule-r px-1 py-2" role="cell">
                          {countable > 0 ? (
                            <span className={`pg-badge ${isOver ? 'pg-badge-over' : phase === 'trialWork' && countable > rules.trialWork ? 'pg-badge-twp' : 'pg-badge-safe'}`}>
                              {isOver ? 'Over' : 'Below'}
                            </span>
                          ) : (
                            <span className="text-[0.625rem] pg-dim">—</span>
                          )}
                        </div>

                        <div className="flex items-center justify-center p-1" role="cell">
                          <button
                            type="button"
                            disabled={disabled || (!gross && !hrs)}
                            onClick={() => updateMonthEntry(stream.id, m, { gross: undefined, hours: undefined })}
                            aria-label={`Clear ${longMonthName(m)}`}
                            title={`Clear ${longMonthName(m)}`}
                            className="pg-icon-btn pg-btn-danger pg-touch-target size-7 text-[0.625rem] font-bold uppercase tracking-wider"
                          >
                            ✕
                          </button>
                        </div>
                      </div>
                    );
                  })}
                  </div>
                </div>
              ) : null}
            </>
          ) : (
            <>
              {/* ---------------- 1099 self-employment ---------------- */}
              <SectionHead
                label="Self-employment earnings & expenses"
                meta={isYearToDate ? `Year to date, ${year}` : `Total for ${year}`}
                open={ledgerOpen}
                onToggle={() => setLedgerOpen((v) => !v)}
              />

              {ledgerOpen ? (
                <>
                  <div className="grid grid-cols-1 sm:grid-cols-3">
                    {selfEmploymentFields.map((field) => (
                      <FieldCell key={field.key} label={field.label} hint={field.hint}>
                        <div className="pg-field w-full px-0">
                          <CellInput
                            prefix={field.prefix}
                            ariaLabel={`1099 ${field.label}`}
                            placeholder={field.placeholder}
                            disabled={stream.locked || !eligibleMonths.length}
                            value={field.value || undefined}
                            onCommit={(next) => {
                              if (!eligibleMonths.length) return;
                              updateMonthEntries(stream.id, evenSplit(next ?? 0, eligibleMonths.length)
                                .map((amount, i) => ({ month: eligibleMonths[i], patch: { [field.key]: amount } })));
                            }}
                          />
                        </div>
                      </FieldCell>
                    ))}
                  </div>

                  <div className="pg-rule-t pg-surface-inset flex flex-col items-start gap-2 p-3 sm:p-3.5">
                    <p className="text-xs leading-relaxed pg-muted">
                      {eligibleMonths.length
                        ? `SSA rules split your net annual self-employment profit evenly across the ${eligibleMonths.length} month${eligibleMonths.length === 1 ? '' : 's'} ${isYearToDate ? 'elapsed so far' : 'active'} in ${year}. Net countable income is gross minus business mileage expenses (${ytdMiles.toLocaleString()} miles logged).`
                        : `No elapsed active months in ${year} yet to split this across.`}
                    </p>
                    <button
                      type="button"
                      onClick={() => setHelpOpen(true)}
                      className="text-xs font-semibold pg-accent hover:underline"
                    >
                      How SSA self-employment income spread &amp; mileage deductions work →
                    </button>
                  </div>
                </>
              ) : null}
            </>
          )}
        </>
      ) : null}

      {helpOpen ? <HelpSpread onClose={() => setHelpOpen(false)} /> : null}
    </div>
  );
}
