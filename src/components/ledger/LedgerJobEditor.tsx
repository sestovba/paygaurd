import { useEffect, useState, type ReactNode } from 'react';
import { ChevronDown, Lock, LockOpen, TriangleAlert, Zap } from 'lucide-react';
import { useMonthScope, useTracker } from '../../state/TrackerProvider';
import {
  activeMonthsInYear, countableFor, evenSplit, grossFor, hoursFor, mileageDeduction
} from '../../domain/earnings';
import {
  longMonthName, monthIndex, monthKey, parseMonth, shortMonthName, todayMonth
} from '../../domain/months';
import { knownYears, TWP_SELF_EMPLOYMENT_HOURS } from '../../domain/rules';
import { frequencyLabel, paycheckContextForMonth, payPlan } from '../../domain/paySchedule';
import type { MonthEntry, MonthKey, PayFrequency, Stream } from '../../domain/types';
import { HelpSpread } from '../HelpSpread';
import {
  PayBasisProvider, PayBasisSwitch, PAY_BASIS_WORDS, payPatchFor, payValueFor, usePayBasis
} from '../PayAmount';
import { miles0, money2 } from './ledgerFormat';
import { ButtonBase } from '../../design-system';
import { periodLabel } from '../../domain/copy';

const FREQUENCIES: PayFrequency[] = ['weekly', 'biweekly', 'semimonthly', 'monthly'];

/** Collapsible sections nested inside a job card. */
export type JobSection = 'settings' | 'history';
export const JOB_SECTIONS: JobSection[] = ['settings', 'history'];
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
    <ButtonBase
      type="button"
      onClick={onToggle}
      aria-expanded={open}
      data-open={open}
      className="lg-section-toggle"
    >
      <span className="lg-toggle-lead" aria-hidden="true">
        <ChevronDown className="lg-chevron" data-collapsed={!open} />
      </span>
      <span>{label}</span>
      {meta ? <span className="lg-section-toggle-meta">{meta}</span> : null}
    </ButtonBase>
  );
}

/* `help` is optional on purpose. It was required, which meant a tile whose
   label already says everything had to invent a sentence to satisfy the type
   — and "Pay Cycle" above "How often this job pays" is the label explained
   twice. Where there is nothing to add, the row is not drawn at all. */
function SettingTile({ label, help, children }: { label: string; help?: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-1 flex-col gap-2 lg-bg-surface lg-summary-tile">
      <span className="lg-label">{label}</span>
      {children}
      {help ? <span className="lg-type-body leading-snug lg-text-muted">{help}</span> : null}
    </div>
  );
}

/** W2 month rows — bank vs paystub via shared PayAmount helpers.
 *  Hours are optional on a W-2 (they decide nothing about countable pay),
 *  so the Worked column stays out until a month has hours or the reader
 *  asks for it — otherwise every cell is an em dash and a right-aligned
 *  "HOURS WORKED" header crops to "ORKED" on a narrow pane. */
function W2MonthLedger({
  stream, months, locked, onExtend, onUpdate, onClear
}: {
  stream: Stream;
  months: MonthKey[];
  locked: boolean;
  onExtend: (m: MonthKey) => void;
  onUpdate: (m: MonthKey, patch: Partial<MonthEntry>) => void;
  onClear: (m: MonthKey) => void;
}) {
  const { basis } = usePayBasis();
  const anyHours = months.some((m) => hoursFor(stream, m) > 0);
  /* Offer once asked for — clearing the last hour must not yank the column
     mid-edit. */
  const [offerHours, setOfferHours] = useState(false);
  const showHours = offerHours || anyHours;

  return (
    <div className="overflow-x-auto">
      <div className="lg-pay-basis">
        <PayBasisSwitch />
        {!showHours ? (
          <ButtonBase
            type="button"
            className="lg-add-hours"
            disabled={locked}
            onClick={() => setOfferHours(true)}
          >
            Add hours
          </ButtonBase>
        ) : null}
      </div>
      <div className="lg-ledger-scroll" data-hours={showHours || undefined}>
        <table className="lg-ledger-table">
          <colgroup>
            <col className="lg-col-month" />
            <col className="lg-col-amount" />
            {showHours ? <col className="lg-col-hours" /> : null}
            <col className="lg-col-clear" />
          </colgroup>
          <thead>
            <tr>
              <th scope="col" className="lg-label lg-ledger-hcell lg-ledger-hcell--month">Month</th>
              <th scope="col" className="lg-label lg-ledger-hcell lg-ledger-hcell--num">{PAY_BASIS_WORDS[basis].field}</th>
              {showHours ? (
                <th scope="col" className="lg-label lg-ledger-hcell lg-ledger-hcell--num">Hours</th>
              ) : null}
              <th scope="col" className="lg-label lg-ledger-hcell lg-ledger-hcell--clear">Clear</th>
            </tr>
          </thead>
          <tbody>
            {months.map((m) => {
              const blockedByLifecycle = stream.lifecycle !== 'active' && monthIndex(m) >= monthIndex(todayMonth());
              const blockedByEnd = stream.activeTo != null && monthIndex(m) > monthIndex(stream.activeTo);
              const disabled = locked || blockedByLifecycle || blockedByEnd;
              const context = paycheckContextForMonth([stream], m);
              const entry = stream.months[m];
              const amount = payValueFor(entry, basis);
              const hrs = hoursFor(stream, m);
              const converted = basis === 'bank' && amount ? payPatchFor('bank', amount).gross : undefined;

              return (
                <tr
                  key={m}
                  className="lg-ledger-row"
                  aria-current={m === todayMonth() ? 'date' : undefined}
                  data-current-month={m === todayMonth() || undefined}
                >
                  <td className="lg-ledger-cell lg-ledger-cell--month">
                    <span>{shortMonthName(m)}</span>
                    {context.length ? (
                      <span className="lg-type-micro font-medium uppercase leading-tight lg-text-warn">
                        {context[0].count} paychecks
                      </span>
                    ) : null}
                  </td>
                  <td className="lg-ledger-cell lg-ledger-cell-field lg-ledger-cell--num">
                    <LedgerNumberInput
                      ariaLabel={`${longMonthName(m)} ${PAY_BASIS_WORDS[basis].field.toLowerCase()}`}
                      placeholder="0.00"
                      disabled={disabled}
                      value={amount || undefined}
                      onCommit={(next) => {
                        if (next !== undefined) onExtend(m);
                        onUpdate(m, payPatchFor(basis, next));
                      }}
                      className="lg-ledger-input"
                    />
                    {converted ? (
                      <span className="lg-ledger-hint">
                        About {money2(converted)} before taxes
                      </span>
                    ) : null}
                  </td>
                  {showHours ? (
                    <td className="lg-ledger-cell lg-ledger-cell-field lg-ledger-cell--num">
                      <LedgerNumberInput
                        ariaLabel={`${longMonthName(m)} hours`}
                        placeholder="—"
                        disabled={disabled}
                        value={hrs || undefined}
                        onCommit={(next) => {
                          if (next !== undefined) onExtend(m);
                          onUpdate(m, { hours: next });
                        }}
                        className="lg-ledger-input"
                      />
                    </td>
                  ) : null}
                  <td className="lg-ledger-cell lg-ledger-cell--clear">
                    <ButtonBase
                      type="button"
                      disabled={disabled}
                      onClick={() => onClear(m)}
                      className="lg-quiet-action"
                    >
                      Clear
                    </ButtonBase>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}


export function LedgerJobEditor({
  stream, year, open: cardOpen, onToggleOpen, sectionOpen, onToggleSection, afterIncome
}: {
  stream: Stream;
  year: number;
  /** Lifted to the parent so "Collapse All" can control every card at once. */
  open: boolean;
  onToggleOpen: () => void;
  /** Also lifted, so "Expand All" cascades into the sections nested in each card. */
  sectionOpen: (section: JobSection) => boolean;
  onToggleSection: (section: JobSection) => void;
  /** Not ongoing chips — sit inside the card after the Income table. */
  afterIncome?: ReactNode;
}) {
  const { updateStream, updateMonthEntry, updateMonthEntries } = useTracker();
  const settingsOpen = sectionOpen('settings');
  const historyOpen = sectionOpen('history');
  const [helpOpen, setHelpOpen] = useState(false);

  const now = todayMonth();
  /* The twelve-field entry grid is the calendar this layout puts on its
     main screen, so it lists exactly what the header's month dropdown says
     — one month, the months behind you, the months ahead, or all twelve. */
  const { months } = useMonthScope('many');
  const activeMonths = activeMonthsInYear(stream, year);
  const eligibleMonths = activeMonths.filter((m) => m <= now);
  const isYearToDate = eligibleMonths.length > 0 && eligibleMonths.length < activeMonths.length;
  const ytdGross = eligibleMonths.reduce((sum, month) => sum + grossFor(stream, month), 0);
  const ytdMiles = eligibleMonths.reduce((sum, month) => sum + (stream.months[month]?.miles ?? 0), 0);
  const ytdHours = eligibleMonths.reduce((sum, month) => sum + hoursFor(stream, month), 0);
  const ytdMileageOff = eligibleMonths.reduce((sum, month) => sum + mileageDeduction(stream, month), 0);
  const ytdCountable = eligibleMonths.reduce((sum, month) => sum + countableFor(stream, month), 0);

  const plan = stream.payFrequency && stream.anchorDate ? payPlan(year, stream.payFrequency, stream.anchorDate) : null;
  const scheduleSummary = stream.payFrequency
    ? frequencyLabel(stream.payFrequency) + ' · ' + (stream.lifecycle === 'active' && !stream.activeTo ? 'Active all year' : 'Date range set')
    : 'No schedule';
  const historySection = afterIncome ? (
    <>
      <SectionToggle label="History" open={historyOpen} onToggle={() => onToggleSection('history')} />
      {historyOpen ? afterIncome : null}
    </>
  ) : null;

  return (
    <PayBasisProvider>
    <div className="lg-job-card" data-type={stream.type}>
      {/* header */}
      <div className="lg-job-card-header" data-open={cardOpen}>
        <ButtonBase
          type="button"
          onClick={onToggleOpen}
          aria-label={cardOpen ? 'Collapse' : 'Expand'}
          className="lg-toggle-lead lg-text-muted"
        >
          <ChevronDown className="lg-chevron" data-collapsed={!cardOpen} />
        </ButtonBase>
        {/* Type lives on the tab; repeating the badge here was chrome. */}
        <input
          aria-label="Job name"
          value={stream.name}
          disabled={stream.locked}
          onChange={(e) => updateStream(stream.id, { name: e.target.value })}
          className="lg-name-input lg-name-input-visible lg-band-head__title min-w-0 flex-1 disabled:cursor-not-allowed disabled:opacity-60 lg-text-fg"
        />
        <div className="flex shrink-0 items-baseline gap-1.5">
          <span className="lg-label">{periodLabel(year, isYearToDate)}</span>
          <span className="lg-band-head__title">{money2(ytdGross)}</span>
        </div>
      </div>

      {cardOpen ? (
      <>
      <div className="lg-job-status">
        {/* Same three states as calc20 settings. Tabs only show Ongoing;
            Paused / Ended land under Not ongoing with Return to ongoing. */}
        <div className="lg-seg" role="group" aria-label="Job status">
          <ButtonBase
            type="button"
            disabled={stream.locked}
            data-on={stream.lifecycle === 'active'}
            className="lg-seg-item disabled:cursor-not-allowed disabled:opacity-45"
            onClick={() => updateStream(stream.id, { lifecycle: 'active', activeTo: null })}
          >
            Ongoing
          </ButtonBase>
          <ButtonBase
            type="button"
            disabled={stream.locked}
            data-on={stream.lifecycle === 'inactive'}
            className="lg-seg-item disabled:cursor-not-allowed disabled:opacity-45"
            onClick={() => updateStream(stream.id, { lifecycle: 'inactive' })}
          >
            Paused
          </ButtonBase>
          <ButtonBase
            type="button"
            disabled={stream.locked}
            data-on={stream.lifecycle === 'completed'}
            className="lg-seg-item disabled:cursor-not-allowed disabled:opacity-45"
            onClick={() => updateStream(stream.id, {
              lifecycle: 'completed',
              activeTo: stream.activeTo ?? todayMonth()
            })}
          >
            Ended
          </ButtonBase>
        </div>
        <label className="flex items-center gap-1.5 lg-type-body lg-text-muted">
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
          <label className="flex items-center gap-1.5 lg-type-body lg-text-muted">
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
          <span className="ml-auto flex items-center gap-1 lg-type-body lg-text-warn">
            <TriangleAlert className="size-4" /> History stays — Return to ongoing under Not ongoing
          </span>
        ) : null}
        <ButtonBase
          type="button"
          onClick={() => updateStream(stream.id, { locked: !stream.locked })}
          aria-label={stream.locked ? 'Unlock' : 'Lock'}
          data-locked={stream.locked || undefined}
          className="lg-lock-btn lg-job-status-lock"
          title={stream.locked ? 'Unlock this job' : 'Lock this job'}
        >
          {stream.locked ? <LockOpen className="size-4" /> : <Lock className="size-4" />}
        </ButtonBase>
      </div>

      {stream.type === 'w2' ? (
        <>
          <SectionToggle label="Pay cycle" meta={scheduleSummary} open={settingsOpen} onToggle={() => onToggleSection('settings')} />
          {settingsOpen ? (
            <div className="flex flex-wrap lg-settings-grid">
              <SettingTile label="Frequency">
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
                label="Payday"
                help={stream.anchorDate ? 'Other paydays follow from this.' : 'Any real payday — finds months with an extra check.'}
              >
                <input
                  type="date"
                  value={stream.anchorDate ?? ''}
                  disabled={stream.locked}
                  onChange={(e) => updateStream(stream.id, { anchorDate: e.target.value })}
                  className="lg-field"
                />
              </SettingTile>
              <SettingTile label="Rate" help="Optional. Finds extra-check months.">
                <div className="grid grid-cols-2 gap-1.5">
                  <label className="lg-field flex min-w-0 cursor-text items-center gap-1.5">
                    <span className="lg-field-prefix">$</span>
                    <LedgerNumberInput
                      ariaLabel="Hourly rate"
                      value={stream.hourlyRate}
                      placeholder="0.00"
                      disabled={stream.locked}
                      onCommit={(hourlyRate) => updateStream(stream.id, { hourlyRate })}
                      className="text-right"
                    />
                    <span className="lg-field-suffix lg-type-micro">an hour</span>
                  </label>
                  <label className="lg-field flex min-w-0 cursor-text items-center gap-1.5">
                    <LedgerNumberInput
                      ariaLabel="Planned hours per week"
                      value={stream.plannedHoursPerWeek}
                      placeholder="0"
                      disabled={stream.locked}
                      onCommit={(plannedHoursPerWeek) => updateStream(stream.id, { plannedHoursPerWeek })}
                      className="text-right"
                    />
                    <span className="lg-field-suffix lg-type-micro">hours a week</span>
                  </label>
                </div>
              </SettingTile>
              <SettingTile
                label="Checks"
                help={plan ? (plan.heavyMonths.length ? `${year}: ${plan.heavyMonths.length} ${plan.heavyMonths.length === 1 ? 'month has' : 'months have'} an extra check.` : `${year}: same number every month.`) : `Set a payday to forecast ${year}.`}
              >
                <span className="lg-type-title">{plan ? plan.total : '—'}</span>
              </SettingTile>
            </div>
          ) : null}
          {settingsOpen && plan && plan.heavyMonths.length ? (
            <div className="flex items-center gap-2 lg-pad-cell-y lg-type-caption font-medium lg-card-inset lg-warn-banner">
              <Zap className="size-3.5 shrink-0" />
              {plan.typicalCount + 1} paychecks in {plan.heavyMonths.length} month{plan.heavyMonths.length === 1 ? '' : 's'} this year
            </div>
          ) : null}

          {historySection}

          <W2MonthLedger
            stream={stream}
            months={months}
            locked={stream.locked}
            onExtend={(m) => {
              if (monthIndex(m) < monthIndex(stream.activeFrom)) updateStream(stream.id, { activeFrom: m });
            }}
            onUpdate={(m, patch) => updateMonthEntry(stream.id, m, patch)}
            onClear={(m) => updateMonthEntry(stream.id, m, {
              gross: undefined, hours: undefined, net: undefined, basis: undefined
            })}
          />

        </>
      ) : (
        <>
          <div className="lg-se-form flex flex-wrap gap-3">
              <label className="flex min-w-40 flex-1 flex-col gap-1.5">
                <span className="lg-label">Paid</span>
                <span className="lg-field flex cursor-text items-center gap-1.5">
                  <span className="lg-field-prefix">$</span>
                  <LedgerNumberInput
                    ariaLabel={`Money they paid you, ${periodLabel(year, isYearToDate).toLowerCase()}`}
                    placeholder="0.00"
                    disabled={stream.locked || !eligibleMonths.length}
                    value={ytdGross || undefined}
                    onCommit={(next) => {
                      if (!eligibleMonths.length) return;
                      updateMonthEntries(stream.id, evenSplit(next ?? 0, eligibleMonths.length)
                        .map((gross, i) => ({ month: eligibleMonths[i], patch: { gross } })));
                    }}
                    className="text-right"
                  />
                </span>
              </label>
              <label className="flex min-w-40 flex-1 flex-col gap-1.5">
                <span className="lg-label">Miles</span>
                <span className="lg-field flex cursor-text items-center gap-1.5">
                  <LedgerNumberInput
                    ariaLabel={`Miles you drove for work, ${periodLabel(year, isYearToDate).toLowerCase()}`}
                    placeholder="0"
                    disabled={stream.locked || !eligibleMonths.length}
                    value={ytdMiles || undefined}
                    onCommit={(next) => {
                      if (!eligibleMonths.length) return;
                      updateMonthEntries(stream.id, evenSplit(next ?? 0, eligibleMonths.length)
                        .map((miles, i) => ({ month: eligibleMonths[i], patch: { miles } })));
                    }}
                    className="text-right"
                  />
                  <span className="lg-field-suffix lg-type-micro">miles</span>
                </span>
              </label>
              <label className="flex min-w-40 flex-1 flex-col gap-1.5">
                <span className="lg-label">Hours</span>
                <span className="lg-field flex cursor-text items-center gap-1.5">
                  <LedgerNumberInput
                    ariaLabel={`Hours you worked, ${periodLabel(year, isYearToDate).toLowerCase()}`}
                    placeholder="0"
                    disabled={stream.locked || !eligibleMonths.length}
                    value={ytdHours || undefined}
                    onCommit={(next) => {
                      if (!eligibleMonths.length) return;
                      updateMonthEntries(stream.id, evenSplit(next ?? 0, eligibleMonths.length)
                        .map((hours, i) => ({ month: eligibleMonths[i], patch: { hours } })));
                    }}
                    className="text-right"
                  />
                  <span className="lg-field-suffix lg-type-micro">hours</span>
                </span>
              </label>
              <div className="flex w-full items-center justify-between lg-pad-micro-t">
                <ButtonBase
                  type="button"
                  onClick={() => setHelpOpen(true)}
                  className="lg-type-caption font-semibold hover:underline lg-text-w2"
                >
                  How your miles change what counts →
                </ButtonBase>
              </div>
              <p className="w-full lg-type-body leading-relaxed lg-text-muted">
                {eligibleMonths.length
                  ? (ytdMileageOff > 0
                    ? `Split across ${eligibleMonths.length} month${eligibleMonths.length === 1 ? '' : 's'} · ${miles0(ytdMiles)} take ${money2(ytdMileageOff)} off · ${money2(ytdCountable)} counts toward your limit.`
                    : `Split evenly across ${eligibleMonths.length} month${eligibleMonths.length === 1 ? '' : 's'} you have worked in ${year}. Over ${TWP_SELF_EMPLOYMENT_HOURS} hours in a month uses a trial work month.`)
                  : `No active months in ${year} yet to split this across.`}
              </p>
          </div>

          {historySection}

        </>
      )}

      </>
      ) : null}

      {helpOpen ? <HelpSpread onClose={() => setHelpOpen(false)} /> : null}
    </div>
    </PayBasisProvider>
  );
}
