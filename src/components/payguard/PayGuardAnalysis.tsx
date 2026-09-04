import { ButtonBase } from '../../design-system';
import { useMemo, useState } from 'react';
import { CalendarOff, ShieldCheck } from 'lucide-react';
import { countableFor, monthStatus, nearLimit } from '../../domain/earnings';
import { money } from '../../domain/format';
import { longMonthName, scopedMonths, shortMonthName, todayMonth } from '../../domain/months';
import type { MonthScope } from '../../domain/months';
import { rulesFor } from '../../domain/rules';
import type { YearRules } from '../../domain/rules';
import { paycheckContextForMonth } from '../../domain/paySchedule';
import { benefitPhase } from '../../domain/trialWork';
import type { BenefitPhase } from '../../domain/trialWork';
import type { MonthStatus, TrackerData } from '../../domain/types';
import { SafeWorkSimulator } from '../SafeWorkSimulator';
import { copyFor } from '../../domain/copy';

type StatusKind = 'none' | 'review' | 'safe' | 'warn' | 'twp' | 'over';

/** Every status colour resolves to a token so the four sub-themes stay in step. */
const KIND_COLOR: Record<StatusKind, string> = {
  none: 'var(--pg-fg-dim)',
  review: 'var(--pg-info)',
  safe: 'var(--pg-safe)',
  warn: 'var(--pg-warn)',
  twp: 'var(--pg-twp)',
  over: 'var(--pg-over)'
};

const KIND_TEXT_CLASS: Record<StatusKind, string> = {
  none: 'pg-dim',
  review: 'pg-text-info',
  safe: 'pg-text-safe',
  warn: 'pg-text-warn',
  twp: 'pg-text-twp',
  over: 'pg-text-over'
};

/* One limit at a time, named without initials. Under the review rule the app
   never mentions the regime the reader is not in, so these say "your limit"
   rather than naming which of the two rules produced it. */
const KIND_LABEL: Record<StatusKind, string> = {
  none: 'No income',
  review: 'Status not set',
  safe: 'Under your limit',
  warn: 'Close to your limit',
  twp: 'Trial work month used',
  over: 'Over your limit'
};

function statusKind(status: MonthStatus, phase: BenefitPhase): StatusKind {
  if (phase === 'unknown' || phase === 'verifyComplete') {
    return status.countable > 0 || status.isServiceMonth ? 'review' : 'none';
  }
  if (phase === 'sga') {
    if (status.countable <= 0) return 'none';
    if (status.overSga) return 'over';
    if (nearLimit(status, phase)) return 'warn';
    return 'safe';
  }
  if (status.isServiceMonth) return 'twp';
  if (status.countable <= 0) return 'none';
  if (nearLimit(status, phase)) return 'warn';
  return 'safe';
}

function remainingLabel(status: MonthStatus, phase: BenefitPhase, rules: YearRules): string {
  if (status.countable <= 0 && !status.isServiceMonth) return 'No income';
  if (phase === 'unknown' || phase === 'verifyComplete') return 'Status not set';
  if (phase === 'sga') {
    return status.overSga
      ? `${money(status.countable - rules.sga)} over`
      : status.roomToSga != null
        ? status.roomToSga === 0 ? 'At your limit' : `${money(status.roomToSga)} left`
        : 'Under your limit';
  }
  if (status.isServiceMonth) return 'Trial work month used';
  return status.roomToTrialWork != null
    ? status.roomToTrialWork === 0
      ? 'At your limit'
      : `${money(status.roomToTrialWork)} left`
    : 'Under your limit';
}

function thresholdGapLabel(value: number, threshold: number): string {
  const gap = value - threshold;
  if (Math.abs(gap) < 0.005) return 'At threshold';
  return `${money(Math.abs(gap))} ${gap > 0 ? 'over' : 'below'}`;
}

type Mode = 'cards' | 'table';

const MODES: { id: Mode; label: string }[] = [
  { id: 'cards', label: 'Cards' },
  { id: 'table', label: 'Table' }
];

function StatusDot({ kind, size = 'sm' }: { kind: StatusKind; size?: 'sm' | 'md' }) {
  return (
    <span
      className={`shrink-0 rounded-full ${size === 'md' ? 'size-2' : 'size-1.5'}`}
      style={{ background: KIND_COLOR[kind] }}
    />
  );
}

export function PayGuardAnalysis({ data, year, scope = 'year', onOpenStatus }: {
  data: TrackerData;
  year: number;
  scope?: MonthScope;
  onOpenStatus?: () => void;
}) {
  const [mode, setMode] = useState<Mode>('cards');
  /* Active filters either view; default on. Not a third layout. */
  const [activeOnly, setActiveOnly] = useState(true);
  const [simulatorOpen, setSimulatorOpen] = useState(false);
  const words = copyFor('payguard');
  const rules = rulesFor(year);
  const now = todayMonth();
  const asOf = year < Number(now.slice(0, 4)) ? `${year}-12` : now;
  const analysisPhase = benefitPhase(data, asOf);
  const needsTwpConfirmation = analysisPhase === 'unknown' || analysisPhase === 'verifyComplete';
  const months = useMemo(() => scopedMonths(year, scope), [year, scope]);

  const cards = useMemo(() => months.map((month) => {
    const status = monthStatus(data, month);
    const phase = benefitPhase(data, month);
    const w2 = data.streams.filter((s) => s.type === 'w2').reduce((sum, s) => sum + countableFor(s, month), 0);
    const se = data.streams.filter((s) => s.type === 'ten99').reduce((sum, s) => sum + countableFor(s, month), 0);
    const threshold = phase === 'trialWork' ? rules.trialWork : rules.sga;
    return {
      month,
      status,
      w2,
      se,
      kind: statusKind(status, phase),
      context: paycheckContextForMonth(data.streams, month),
      pct: threshold ? Math.min(100, (status.countable / threshold) * 100) : 0,
      label: remainingLabel(status, phase, rules)
    };
  }), [data, months, rules]);

  const visible = activeOnly
    ? cards.filter((c) => c.status.countable > 0 || c.status.isServiceMonth)
    : cards;
  /* One month listed is drawn as the month itself rather than as a
     one-row table — the test is the number of months on screen, not which
     setting produced it. */
  const focused = cards.length === 1 ? cards[0] : undefined;
  /* Whether the focused month has anything in it at all. The room figure and
     the body block are the same fact told twice when it does not: the body
     already says "No income added for September". */
  const focusedFilled = Boolean(focused && (focused.status.countable > 0 || focused.status.isServiceMonth));

  return (
    <div className="flex flex-col gap-3 sm:gap-4">
      {/* ---------------- Monthly analysis ---------------- */}
      <section className="pg-card flex flex-col overflow-hidden">
        {/*
          Title, mode switch and legend share one band. The legend used to sit
          in its own padded, ruled row, which read as a separate section rather
          than as a key for the panel it belongs to.
        */}
        {/*
          el-1lie5wt: "no background or line and less padding bottom". One
          month is not a table, so it does not get a table's title bar — the
          band and the rule under it are what made a single month read as a
          header over an empty grid. Several months still get both, because
          there the header is a key for the rows beneath it.

          el-446101: the room left goes to the top right of this header, on
          the "Under your limit" line — hence items-end on the focused month
          and items-center where the right cell is the view switch.
        */}
        <header className={focused
          ? 'px-3.5 pt-3 pb-1.5 sm:px-4'
          : 'pg-rule-b pg-surface-quiet px-3.5 py-3 sm:px-4'}>
          <div className={'grid gap-2.5 sm:grid-cols-[minmax(0,1fr)_auto] '
            + (focused ? 'sm:items-end' : 'sm:items-center')}>
            <div className="flex min-w-0 flex-col gap-1.5">
              <h2 className="pg-section-title pg-fg sm:text-[0.8125rem]">
                {focused ? longMonthName(focused.month) : 'By month'}
              </h2>

              {focused ? (
                <span className={`flex items-center gap-1.5 text-[0.6875rem] font-bold leading-snug ${KIND_TEXT_CLASS[focused.kind]}`}>
                  <StatusDot kind={focused.kind} /> {KIND_LABEL[focused.kind]}
                </span>
              ) : needsTwpConfirmation ? (
                <span className="pg-muted flex items-center gap-1.5 text-[0.6875rem] font-bold leading-snug">
                  <StatusDot kind="review" /> Set your status and these months get a limit to be measured against.
                </span>
              ) : (
                <div className="flex flex-wrap gap-x-4 gap-y-1 text-[0.6875rem] font-bold leading-snug">
                  <span className="flex items-center gap-1.5 pg-text-safe">
                    <StatusDot kind="safe" /> Under{' '}
                    {money(analysisPhase === 'trialWork' ? rules.trialWork : rules.sga)}
                  </span>
                  <span className="flex items-center gap-1.5 pg-text-warn">
                    <StatusDot kind="warn" /> Near
                  </span>
                  {/* The regime you are not in is not drawn. */}
                  {analysisPhase === 'trialWork' ? (
                    <span className="flex items-center gap-1.5 pg-text-twp">
                      <StatusDot kind="twp" /> Trial month
                    </span>
                  ) : (
                    <span className="flex items-center gap-1.5 pg-text-over">
                      <StatusDot kind="over" /> Over
                    </span>
                  )}
                </div>
              )}
            </div>

            {focused ? (focusedFilled ? (
              <span className={`justify-self-start text-xs font-bold sm:justify-self-end ${KIND_TEXT_CLASS[focused.kind]}`}>
                {focused.label}
              </span>
            ) : null) : (
              <div className="pg-view-tools justify-self-start sm:justify-self-end" role="toolbar" aria-label="By month view">
                <div className="pg-seg w-fit" role="group" aria-label="Layout">
                  {MODES.map((m) => (
                    <ButtonBase
                      key={m.id}
                      type="button"
                      data-on={mode === m.id}
                      aria-pressed={mode === m.id}
                      onClick={() => setMode(m.id)}
                      className="pg-seg-item"
                    >
                      {m.label}
                    </ButtonBase>
                  ))}
                </div>
                <ButtonBase
                  type="button"
                  className="pg-filter-chip"
                  data-on={activeOnly || undefined}
                  aria-pressed={activeOnly}
                  onClick={() => setActiveOnly((v) => !v)}
                >
                  <span className="pg-filter-chip-mark" aria-hidden="true" />
                  Active only
                </ButtonBase>
              </div>
            )}
          </div>
        </header>

        {focused ? (
          <div className="pg-surface p-3.5 sm:p-5">
            {focusedFilled ? (
              <div className="flex flex-col gap-3">
                {/* The room left moved up to the header — el-446101. */}
                <span className="flex items-baseline gap-2">
                  <span className="pg-figure">{money(focused.status.countable)}</span>
                  <span className="pg-label">Counted</span>
                </span>

                <div className="pg-meter" aria-label={`${Math.round(focused.pct)} percent of your monthly limit`}>
                  <span
                    className="pg-meter-seg"
                    style={{ width: `${focused.pct}%`, background: KIND_COLOR[focused.kind] }}
                  />
                </div>

                {focused.context.length ? (
                  <p className="text-[0.6875rem] font-bold pg-text-warn">
                    {focused.context.map((ctx) => `${ctx.count} paychecks from ${ctx.streamName}`).join(' · ')}
                  </p>
                ) : null}

                <dl className="grid grid-cols-2 gap-px overflow-hidden rounded-[var(--pg-radius-md)] pg-rule">
                  <div className="pg-surface-2 p-2.5 sm:p-3">
                    <dt className="pg-label">From an employer</dt>
                    <dd className="pg-mono mt-1 text-sm font-bold pg-fg">{money(focused.w2)}</dd>
                  </div>
                  <div className="pg-surface-2 p-2.5 sm:p-3">
                    <dt className="pg-label">From gig work</dt>
                    <dd className="pg-mono mt-1 text-sm font-bold pg-fg">{money(focused.se)}</dd>
                  </div>
                </dl>
              </div>
            ) : (
              <div className="flex items-center gap-2 py-2 text-sm pg-muted">
                <CalendarOff className="size-4" /> No income added for {longMonthName(focused.month)}.
              </div>
            )}
          </div>
        ) : visible.length === 0 ? (
          /* el-16owyjf, carried over from the ledger: a label beside a month
             list has to describe the rows under it, not the calendar. All
             three strings here counted the calendar — the year in the title
             and "all 12 months" twice below — while the list itself is
             scopedMonths(year, scope), which in focus mode is one row. The
             months on screen are named once, by the picker above this panel,
             so nothing here has to name them a second time and get it
             wrong. */
          <div className="pg-empty">
            <CalendarOff className="size-5 pg-dim" />
            <span className="pg-empty-title">Nothing recorded yet</span>
            <span className="pg-empty-body">
              This shows months with earnings or a trial work month. Add earnings above, or
              turn off Active only to see every month on this list.
            </span>
            <ButtonBase type="button" className="pg-btn mt-1" onClick={() => setActiveOnly(false)}>
              Show every month
            </ButtonBase>
          </div>
        ) : mode === 'table' ? (
          /* Full bleed: the card's own border is the table's border. */
          <div
            className="pg-scroll-x pg-surface"
            role="region"
            aria-label="Monthly analysis table"
            tabIndex={0}
            onScroll={(e) => e.currentTarget.classList.toggle('pg-scrolled', e.currentTarget.scrollLeft > 0)}
          >
            <table className="pg-analysis-table w-full border-collapse text-left text-xs">
                <caption className="sr-only">
                  Monthly countable income, threshold status, and income sources for {year}
                </caption>
                {/* One room column, not two. It carried "SGA room" and "TWP
                    room" side by side, so every reader was reading one column
                    about their own limit and one about a rule that either has
                    not started or is already over. */}
                <colgroup>
                  <col className="pg-analysis-col-month" />
                  <col className="pg-analysis-col-countable" />
                  <col className="pg-analysis-col-status" />
                  <col className="pg-analysis-col-gap" />
                  <col className="pg-analysis-col-source" />
                  <col className="pg-analysis-col-source" />
                </colgroup>
                <thead>
                  <tr className="pg-table-head">
                    <th scope="col" className="pg-frozen pg-rule-r px-3.5 py-2.5 text-left sm:px-4">Month</th>
                    <th scope="col" className="pg-rule-r px-3.5 py-2.5 text-right sm:px-4">Counted</th>
                    <th scope="col" className="pg-rule-r px-3.5 py-2.5 text-left sm:px-4">Status</th>
                    <th
                      scope="col"
                      title="Room left below your limit, or the amount over it"
                      className="pg-rule-r px-3.5 py-2.5 text-right sm:px-4"
                    >
                      Left before your limit
                    </th>
                    {/* "W-2 gross" and "1099 net" name two tax forms and two
                        accounting words in four syllables, on the two columns
                        that say where the money came from. */}
                    <th scope="col" className="pg-rule-r px-3.5 py-2.5 text-right sm:px-4">From an employer</th>
                    <th scope="col" className="px-3.5 py-2.5 text-right sm:px-4">From gig work</th>
                  </tr>
                </thead>
                <tbody>
                  {visible.map((c, idx) => (
                    <tr key={c.month} className="pg-table-row" data-stripe={idx % 2 === 1}
  aria-current={c.month === todayMonth() ? 'date' : undefined}
  data-current-month={c.month === todayMonth() || undefined}>
                      <th
                        scope="row"
                        className="pg-frozen pg-rule-r px-3.5 py-2 text-left font-semibold pg-fg sm:px-4"
                        data-stripe={idx % 2 === 1}
                      >
                        {shortMonthName(c.month)}
                      </th>
                      <td className="pg-mono pg-rule-r px-3.5 py-2 text-right font-bold pg-fg sm:px-4">
                        {c.status.countable > 0 ? money(c.status.countable) : '—'}
                      </td>
                      <td className="pg-rule-r px-3.5 py-2 text-left sm:px-4">
                        <span className={`inline-flex items-center gap-1.5 whitespace-nowrap text-[0.6875rem] font-bold ${KIND_TEXT_CLASS[c.kind]}`}>
                          <StatusDot kind={c.kind} /> {KIND_LABEL[c.kind]}
                        </span>
                      </td>
                      <td className="pg-mono pg-rule-r px-3.5 py-2 text-right pg-muted sm:px-4">
                        {c.status.isServiceMonth && c.status.countable <= rules.trialWork ? (
                          /* The 80-hour rule: a month can be spent on time
                             alone, and no dollar figure explains that. */
                          <span className="font-bold pg-text-twp">Used by hours</span>
                        ) : c.status.countable > 0 ? (
                          <span className={
                            c.kind === 'over' ? 'font-bold pg-text-over'
                              : c.kind === 'twp' ? 'font-bold pg-text-twp'
                                : 'pg-text-safe'
                          }>
                            {thresholdGapLabel(
                              c.status.countable,
                              analysisPhase === 'trialWork' ? rules.trialWork : rules.sga
                            )}
                          </span>
                        ) : '—'}
                      </td>
                      <td className="pg-mono pg-rule-r px-3.5 py-2 text-right pg-muted sm:px-4">
                        {c.w2 > 0 ? money(c.w2) : '—'}
                      </td>
                      <td className="pg-mono px-3.5 py-2 text-right pg-muted sm:px-4">
                        {c.se > 0 ? money(c.se) : '—'}
                      </td>
                    </tr>
                  ))}
            </tbody>
          </table>
        </div>
        ) : (
          <div className="pg-month-grid pg-surface">
            {visible.map((c) => (
              <div
                key={c.month}
                className="pg-month-cell"
                data-filled={c.status.countable > 0 || c.status.isServiceMonth}
                aria-current={c.month === todayMonth() ? 'date' : undefined}
                data-current-month={c.month === todayMonth() || undefined}
              >
                <div className="flex items-center justify-between gap-1">
                  <span className="pg-label pg-fg">{shortMonthName(c.month)}</span>
                  <StatusDot kind={c.kind} size="md" />
                </div>

                <span className="pg-figure pg-figure-sm">
                  {c.status.countable > 0 ? money(c.status.countable) : '—'}
                </span>

                <div className="pg-meter" aria-hidden={c.status.countable <= 0}>
                  {c.status.countable > 0 ? (
                    <span
                      className="pg-meter-seg transition-all duration-300"
                      style={{ width: `${c.pct}%`, background: KIND_COLOR[c.kind] }}
                    />
                  ) : null}
                </div>

                <span className="truncate text-[0.625rem] font-medium pg-muted" title={c.label}>
                  {c.label}
                </span>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* ---------------- Work planning ---------------- */}
      <section className="pg-card overflow-hidden">
        <div className="grid gap-3 px-3.5 py-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center sm:px-5 sm:py-4">
          <div className="min-w-0">
            <h2 className="text-sm font-bold pg-fg">
              {needsTwpConfirmation ? 'Set your limit before planning hours' : words.hoursAsk}
            </h2>
            <p className="mt-0.5 text-xs leading-relaxed pg-muted">
              {needsTwpConfirmation
                ? 'The calculator needs to know which monthly limit applies to you.'
                : 'Use your hourly rate to find a weekly target, including an extra-paycheck month.'}
            </p>
          </div>
          <ButtonBase
            type="button"
            onClick={() => {
              if (needsTwpConfirmation && onOpenStatus) onOpenStatus();
              else setSimulatorOpen((v) => !v);
            }}
            aria-expanded={simulatorOpen}
            className="pg-btn"
          >
            <ShieldCheck className="size-3.5 pg-accent" />
            {needsTwpConfirmation && onOpenStatus
              ? 'Set my limit'
              : simulatorOpen ? 'Close' : 'Plan my hours'}
          </ButtonBase>
        </div>

        {simulatorOpen ? (
          <div className="pg-rule-t">
            <SafeWorkSimulator onOpenStatus={onOpenStatus} />
          </div>
        ) : null}

        {/* Review note: "I dont even want to read this its so wordy". Three
            sentences, two subjects, and nobody reads any of it — which makes
            it worse than useless, because the one line that actually matters
            was buried in the middle of the other two. Kept: check with Social
            Security before you act on a number. The privacy sentence is a
            different subject and lives in Settings with the rest of it. */}
        <p className="pg-rule-t pg-surface-2 px-3.5 py-2.5 text-[0.6875rem] leading-relaxed pg-muted sm:px-5 sm:py-3">
          These figures are for planning. Check with Social Security before you act on one.
        </p>
      </section>
    </div>
  );
}
