import { useEffect, useState } from 'react';
import { ChevronDown, Lock, LockOpen, TriangleAlert, Zap } from 'lucide-react';
import { useTracker } from '../../state/TrackerProvider';
import {
  activeMonthsInYear, evenSplit, grossFor, hoursFor
} from '../../domain/earnings';
import {
  longMonthName, monthIndex, monthKey, listedMonths, parseMonth, shortMonthName, todayMonth
} from '../../domain/months';
import { knownYears, TWP_SELF_EMPLOYMENT_HOURS } from '../../domain/rules';
import { frequencyLabel, paycheckContextForMonth, payPlan } from '../../domain/paySchedule';
import type { PayFrequency, Stream } from '../../domain/types';
import { HelpSpread } from '../HelpSpread';
import { miles0, money2 } from './ledgerFormat';

const FREQUENCIES: PayFrequency[] = ['weekly', 'biweekly', 'semimonthly', 'monthly'];

/** Collapsible sections nested inside a job card. */
export type JobSection = 'settings' | 'ledger';
export const JOB_SECTIONS: JobSection[] = ['settings', 'ledger'];
/** Namespaced key so one collapsed-set in the parent can hold cards and sections. */
export const jobSectionKey = (streamId: string, section: JobSection) => `${streamId}::${section}`;

function LedgerNumberInput({
  value, onCommit, ariaLabel, placeholder, disabled, className = ''
}: {
  value: number | undefined;
  onCommit: (next: number | undefined) => void;
  ariaLabel: string;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
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
      className={className}
    />
  );
}

function SectionToggle({ label, meta, open, onToggle }: {
  label: string; meta?: string; open: boolean; onToggle: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      data-open={open}
      className="lg-section-toggle"
    >
      <ChevronDown className="size-5 shrink-0 transition-transform lg-chevron" data-collapsed={!open} />
      <span>{label}</span>
      {meta ? <span className="lg-section-toggle-meta">{meta}</span> : null}
    </button>
  );
}

function SettingTile({ label, help, children }: { label: string; help: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-1 flex-col gap-2 p-2.5 sm:p-3 lg-bg-surface lg-summary-tile">
      <span className="lg-label">{label}</span>
      {children}
      <span className="text-[0.8125rem] leading-snug lg-text-muted">{help}</span>
    </div>
  );
}

export function LedgerJobEditor({
  stream, year, open: cardOpen, onToggleOpen, sectionOpen, onToggleSection
}: {
  stream: Stream;
  year: number;
  /** Lifted to the parent so "Collapse All" can control every card at once. */
  open: boolean;
  onToggleOpen: () => void;
  /** Also lifted, so "Expand All" cascades into the sections nested in each card. */
  sectionOpen: (section: JobSection) => boolean;
  onToggleSection: (section: JobSection) => void;
}) {
  const { ui, updateStream, updateMonthEntry, updateMonthEntries } = useTracker();
  const settingsOpen = sectionOpen('settings');
  const ledgerOpen = sectionOpen('ledger');
  const [helpOpen, setHelpOpen] = useState(false);

  const now = todayMonth();
  /* The twelve-field entry grid is the calendar this layout puts on its main
     screen, so focus mode leaves the one month you are in. Turning focus off
     brings the year back. */
  const months = listedMonths(year, false, ui.focusMode);
  const activeMonths = activeMonthsInYear(stream, year);
  const eligibleMonths = activeMonths.filter((m) => m <= now);
  const isYearToDate = eligibleMonths.length > 0 && eligibleMonths.length < activeMonths.length;
  const ytdGross = eligibleMonths.reduce((sum, month) => sum + grossFor(stream, month), 0);
  const ytdMiles = eligibleMonths.reduce((sum, month) => sum + (stream.months[month]?.miles ?? 0), 0);
  const ytdHours = eligibleMonths.reduce((sum, month) => sum + hoursFor(stream, month), 0);

  const plan = stream.payFrequency && stream.anchorDate ? payPlan(year, stream.payFrequency, stream.anchorDate) : null;
  const scheduleSummary = stream.payFrequency
    ? frequencyLabel(stream.payFrequency) + ' · ' + (stream.lifecycle === 'active' && !stream.activeTo ? 'Active all year' : 'Date range set')
    : 'Not scheduled';

  return (
    <div className="lg-job-card" data-type={stream.type}>
      {/* header */}
      <div className="lg-job-card-header flex flex-wrap items-center gap-2.5 px-3.5 py-3 sm:px-4" data-open={cardOpen}>
        <button
          type="button"
          onClick={onToggleOpen}
          aria-label={cardOpen ? 'Collapse' : 'Expand'}
          className="grid size-8 shrink-0 place-items-center lg-text-muted"
        >
          <ChevronDown className="size-5 transition-transform lg-chevron" data-collapsed={!cardOpen} />
        </button>
        {/* Review note: "I understand the importance of the lock icon but is
            it really that important to be there always?" No — when the card
            is unlocked the lock is a control you might use, and it was drawn
            as a bordered button competing with the job's own name. It keeps
            its box only when it is locked, where it is not a control but the
            reason every field below is disabled. It is still always present:
            on a touch screen there is no hover to reveal it, and a lock you
            cannot find is how somebody loses an edit they meant to make. */}
        <button
          type="button"
          onClick={() => updateStream(stream.id, { locked: !stream.locked })}
          aria-label={stream.locked ? 'Unlock' : 'Lock'}
          data-locked={stream.locked || undefined}
          className="grid size-8 shrink-0 place-items-center lg-lock-btn"
        >
          {stream.locked ? <LockOpen className="size-4" /> : <Lock className="size-4" />}
        </button>
        <span className="lg-type-badge" data-type={stream.type}>
          {stream.type === 'w2' ? 'W-2' : '1099'}
        </span>
        <input
          aria-label={`${stream.type === 'w2' ? 'W-2' : '1099'} stream name`}
          value={stream.name}
          disabled={stream.locked}
          onChange={(e) => updateStream(stream.id, { name: e.target.value })}
          className="lg-name-input lg-name-input-visible lg-sans min-w-0 flex-1 text-lg font-semibold disabled:cursor-not-allowed disabled:opacity-60 lg-text-fg"
        />
        <div className="flex shrink-0 flex-col items-end gap-0.5">
          <span className="lg-label">{isYearToDate ? 'YTD Gross' : `${year} Gross`}</span>
          <span className="text-lg font-semibold">{money2(ytdGross)}</span>
        </div>
      </div>

      {cardOpen ? (
      <>
      {/* status row */}
      <div className="flex flex-wrap items-center gap-2 px-3 py-2 sm:px-4 lg-border-b-soft">
        <div className="lg-seg">
          {(['active', 'inactive', 'completed'] as const).map((lifecycle) => (
            <button
              key={lifecycle}
              type="button"
              disabled={stream.locked}
              data-on={stream.lifecycle === lifecycle}
              className="lg-seg-item disabled:cursor-not-allowed disabled:opacity-45"
              onClick={() => updateStream(stream.id, {
                lifecycle,
                activeTo: lifecycle === 'completed'
                  ? (stream.activeTo ?? todayMonth())
                  : lifecycle === 'active' ? null : stream.activeTo
              })}
            >
              {lifecycle === 'active' ? 'Ongoing' : lifecycle === 'inactive' ? 'Paused' : 'Ended'}
            </button>
          ))}
        </div>
        <label className="flex items-center gap-1.5 text-[0.8125rem] lg-text-muted">
          Since
          <input
            type="month"
            value={stream.activeFrom}
            max={todayMonth()}
            disabled={stream.locked}
            onChange={(e) => e.target.value && updateStream(stream.id, { activeFrom: e.target.value })}
            className="lg-field lg-field-compact"
          />
        </label>
        {stream.lifecycle === 'completed' ? (
          <label className="flex items-center gap-1.5 text-[0.8125rem] lg-text-muted">
            Ended
            <select
              value={parseMonth(stream.activeTo ?? todayMonth()).month1}
              disabled={stream.locked}
              onChange={(e) => updateStream(stream.id, {
                activeTo: monthKey(parseMonth(stream.activeTo ?? todayMonth()).year, Number(e.target.value))
              })}
              className="lg-field lg-field-compact"
            >
              {Array.from({ length: 12 }, (_, i) => (
                <option key={i} value={i + 1}>{longMonthName(monthKey(2000, i + 1))}</option>
              ))}
            </select>
            <select
              value={parseMonth(stream.activeTo ?? todayMonth()).year}
              disabled={stream.locked}
              onChange={(e) => updateStream(stream.id, {
                activeTo: monthKey(Number(e.target.value), parseMonth(stream.activeTo ?? todayMonth()).month1)
              })}
              className="lg-field lg-field-compact"
            >
              {knownYears().map((y) => <option key={y} value={y}>{y}</option>)}
            </select>
          </label>
        ) : null}
        {stream.lifecycle === 'completed' ? (
          <span className="ml-auto flex items-center gap-1 text-[0.75rem] uppercase tracking-wider lg-text-warn">
            <TriangleAlert className="size-4" /> Needs a new anchor payday if it resumes
          </span>
        ) : null}
      </div>

      {stream.type === 'w2' ? (
        <>
          <SectionToggle label="Settings & date range" meta={scheduleSummary} open={settingsOpen} onToggle={() => onToggleSection('settings')} />
          {settingsOpen ? (
            <div className="flex flex-wrap lg-settings-grid">
              <SettingTile label="Pay Cycle" help="How often this job pays.">
                <select
                  value={stream.payFrequency}
                  disabled={stream.locked}
                  onChange={(e) => updateStream(stream.id, { payFrequency: e.target.value as PayFrequency })}
                  className="lg-field"
                >
                  {FREQUENCIES.map((f) => <option key={f} value={f}>{frequencyLabel(f)}</option>)}
                </select>
              </SettingTile>
              <SettingTile
                label="Recent Payday"
                help={stream.anchorDate ? 'Payday set. Used to forecast extra check dates.' : 'From paystub preferred — needed to find extra check months.'}
              >
                <input
                  type="date"
                  value={stream.anchorDate ?? ''}
                  disabled={stream.locked}
                  onChange={(e) => updateStream(stream.id, { anchorDate: e.target.value })}
                  className="lg-field"
                />
              </SettingTile>
              <SettingTile label="Estimated Wage & Hours" help="Optional — forecasts your pay in 3-paycheck months.">
                <div className="grid grid-cols-2 gap-1.5">
                  <span className="lg-field flex min-w-0 items-center gap-1">
                    <span className="lg-text-muted">$</span>
                    <LedgerNumberInput
                      ariaLabel="Hourly rate"
                      value={stream.hourlyRate}
                      placeholder="0.00"
                      disabled={stream.locked}
                      onCommit={(hourlyRate) => updateStream(stream.id, { hourlyRate })}
                      className="min-w-0 flex-1 bg-transparent text-right outline-none"
                    />
                    <span className="text-[0.625rem] lg-text-muted">/hr</span>
                  </span>
                  <span className="lg-field flex min-w-0 items-center gap-1">
                    <LedgerNumberInput
                      ariaLabel="Planned hours per week"
                      value={stream.plannedHoursPerWeek}
                      placeholder="0"
                      disabled={stream.locked}
                      onCommit={(plannedHoursPerWeek) => updateStream(stream.id, { plannedHoursPerWeek })}
                      className="min-w-0 flex-1 bg-transparent text-right outline-none"
                    />
                    <span className="text-[0.625rem] lg-text-muted">h/wk</span>
                  </span>
                </div>
              </SettingTile>
              <SettingTile
                label={'Paychecks in ' + year}
                help={plan ? (plan.heavyMonths.length ? `${plan.heavyMonths.length} month(s) have extra checks.` : 'Consistent schedule.') : 'Set payday to forecast.'}
              >
                <span className="text-lg font-semibold">{plan ? plan.total : '—'}</span>
              </SettingTile>
            </div>
          ) : null}
          {settingsOpen && plan && plan.heavyMonths.length ? (
            <div className="flex items-center gap-2 px-3 py-2 text-[0.75rem] font-medium sm:px-4 lg-warn-banner">
              <Zap className="size-3.5 shrink-0" />
              {plan.typicalCount + 1} paychecks in {plan.heavyMonths.length} month{plan.heavyMonths.length === 1 ? '' : 's'} this year
            </div>
          ) : null}

          <SectionToggle
            label={year + ' monthly ledger'}
            meta={activeMonths.length + ' of 12 months'}
            open={ledgerOpen}
            onToggle={() => onToggleSection('ledger')}
          />
          {ledgerOpen ? (
            <div className="overflow-x-auto">
              <div className="lg-ledger-scroll">
                <div className="lg-ledger-head flex">
                  <div className="lg-label w-24 shrink-0 border-r px-2 py-2 lg-label-border">Month</div>
                  <div className="lg-label flex-1 border-r px-2 py-2 text-right lg-label-border">Hours</div>
                  <div className="lg-label flex-[1.3] border-r px-2 py-2 text-right lg-label-border">Gross Income</div>
                  <div className="lg-label w-14 shrink-0 px-2 py-2 text-center">Clear</div>
                </div>

                {months.map((m) => {
                  const blockedByLifecycle = stream.lifecycle !== 'active' && monthIndex(m) >= monthIndex(todayMonth());
                  const blockedByEnd = stream.activeTo != null && monthIndex(m) > monthIndex(stream.activeTo);
                  const disabled = stream.locked || blockedByLifecycle || blockedByEnd;
                  const extendIfEarly = () => {
                    if (monthIndex(m) < monthIndex(stream.activeFrom)) updateStream(stream.id, { activeFrom: m });
                  };
                  const context = paycheckContextForMonth([stream], m);
                  const gross = grossFor(stream, m);
                  const hrs = hoursFor(stream, m);

                  return (
                    <div key={m} className="lg-ledger-row">
                      <div className="lg-ledger-cell w-24 shrink-0 flex-col !items-start gap-0.5">
                        <span>{shortMonthName(m)}</span>
                        {context.length ? (
                          <span className="text-[0.5625rem] font-medium uppercase leading-tight lg-text-warn">
                            {context[0].count} paychecks
                          </span>
                        ) : null}
                      </div>
                      <div className="lg-ledger-cell lg-ledger-cell-field flex-1">
                        <LedgerNumberInput
                          ariaLabel={`${longMonthName(m)} hours`}
                          placeholder="—"
                          disabled={disabled}
                          value={hrs || undefined}
                          onCommit={(next) => {
                            if (next !== undefined) extendIfEarly();
                            updateMonthEntry(stream.id, m, { hours: next });
                          }}
                          className="lg-ledger-input"
                        />
                      </div>
                      <div className="lg-ledger-cell lg-ledger-cell-field flex-[1.3]">
                        <LedgerNumberInput
                          ariaLabel={`${longMonthName(m)} gross income`}
                          placeholder="0.00"
                          disabled={disabled}
                          value={gross || undefined}
                          onCommit={(next) => {
                            if (next !== undefined) extendIfEarly();
                            updateMonthEntry(stream.id, m, { gross: next });
                          }}
                          className="lg-ledger-input"
                        />
                      </div>
                      <div className="flex w-14 shrink-0 items-stretch">
                        <button
                          type="button"
                          disabled={disabled}
                          onClick={() => updateMonthEntry(stream.id, m, { gross: undefined, hours: undefined })}
                          className="w-full text-[0.625rem] font-medium uppercase tracking-wider disabled:opacity-30 lg-text-muted"
                        >
                          Clear
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
          <SectionToggle label="What you earned" meta={isYearToDate ? `Year to date, ${year}` : `Total for ${year}`} open={ledgerOpen} onToggle={() => onToggleSection('ledger')} />
          {ledgerOpen ? (
            <div className="flex flex-wrap gap-3 p-3 sm:p-4">
              <label className="flex min-w-40 flex-1 flex-col gap-1.5">
                <span className="lg-label">{isYearToDate ? 'YTD Gross' : 'Gross'}</span>
                <span className="lg-field flex items-center gap-1">
                  <span className="lg-text-muted">$</span>
                  <LedgerNumberInput
                    ariaLabel={isYearToDate ? '1099 year-to-date gross' : `1099 gross for ${year}`}
                    placeholder="0.00"
                    disabled={stream.locked || !eligibleMonths.length}
                    value={ytdGross || undefined}
                    onCommit={(next) => {
                      if (!eligibleMonths.length) return;
                      updateMonthEntries(stream.id, evenSplit(next ?? 0, eligibleMonths.length)
                        .map((gross, i) => ({ month: eligibleMonths[i], patch: { gross } })));
                    }}
                    className="min-w-0 flex-1 bg-transparent text-right outline-none"
                  />
                </span>
              </label>
              <label className="flex min-w-40 flex-1 flex-col gap-1.5">
                <span className="lg-label">{isYearToDate ? 'YTD Miles' : 'Miles'}</span>
                <span className="lg-field flex items-center gap-1">
                  <LedgerNumberInput
                    ariaLabel={isYearToDate ? '1099 year-to-date business miles' : `1099 business miles for ${year}`}
                    placeholder="0"
                    disabled={stream.locked || !eligibleMonths.length}
                    value={ytdMiles || undefined}
                    onCommit={(next) => {
                      if (!eligibleMonths.length) return;
                      updateMonthEntries(stream.id, evenSplit(next ?? 0, eligibleMonths.length)
                        .map((miles, i) => ({ month: eligibleMonths[i], patch: { miles } })));
                    }}
                    className="min-w-0 flex-1 bg-transparent text-right outline-none"
                  />
                  <span className="text-[0.625rem] lg-text-muted">mi</span>
                </span>
              </label>
              <label className="flex min-w-40 flex-1 flex-col gap-1.5">
                <span className="lg-label">{isYearToDate ? 'YTD Hours' : 'Hours'}</span>
                <span className="lg-field flex items-center gap-1">
                  <LedgerNumberInput
                    ariaLabel={isYearToDate ? '1099 year-to-date hours worked' : `1099 hours worked for ${year}`}
                    placeholder="0"
                    disabled={stream.locked || !eligibleMonths.length}
                    value={ytdHours || undefined}
                    onCommit={(next) => {
                      if (!eligibleMonths.length) return;
                      updateMonthEntries(stream.id, evenSplit(next ?? 0, eligibleMonths.length)
                        .map((hours, i) => ({ month: eligibleMonths[i], patch: { hours } })));
                    }}
                    className="min-w-0 flex-1 bg-transparent text-right outline-none"
                  />
                  <span className="text-[0.625rem] lg-text-muted">h</span>
                </span>
              </label>
              <div className="flex w-full items-center justify-between pt-1">
                <button
                  type="button"
                  onClick={() => setHelpOpen(true)}
                  className="text-xs font-semibold hover:underline lg-text-w2"
                >
                  How spread &amp; mileage deductions work →
                </button>
              </div>
              <p className="w-full text-[0.8125rem] leading-relaxed lg-text-muted">
                {eligibleMonths.length
                  ? `Splits each total evenly across the ${eligibleMonths.length} month${eligibleMonths.length === 1 ? '' : 's'} ${isYearToDate ? 'elapsed so far' : 'active'} in ${year}. Countable income is Gross minus mileage (${miles0(ytdMiles)} logged); more than ${TWP_SELF_EMPLOYMENT_HOURS} self-employment hours in one month can also use a TWP month.`
                  : `No elapsed active months in ${year} yet to split this across.`}
              </p>
            </div>
          ) : null}
        </>
      )}
      </>
      ) : null}

      {helpOpen ? <HelpSpread onClose={() => setHelpOpen(false)} /> : null}
    </div>
  );
}
