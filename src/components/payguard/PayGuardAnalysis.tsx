import { useMemo, useState } from 'react';
import { CalendarOff, ShieldCheck } from 'lucide-react';
import { countableFor, monthStatus, nearLimit } from '../../domain/earnings';
import { money } from '../../domain/format';
import { longMonthName, monthsOfYear, shortMonthName, todayMonth } from '../../domain/months';
import { rulesFor } from '../../domain/rules';
import type { YearRules } from '../../domain/rules';
import { paycheckContextForMonth } from '../../domain/paySchedule';
import { benefitPhase, trialWorkStatus } from '../../domain/trialWork';
import type { BenefitPhase } from '../../domain/trialWork';
import type { MonthStatus, TrackerData } from '../../domain/types';
import { SafeWorkSimulator } from '../SafeWorkSimulator';
import { Tile } from './PayGuardPrimitives';

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

const KIND_LABEL: Record<StatusKind, string> = {
  none: 'No income',
  review: 'TWP status needed',
  safe: 'Below threshold',
  warn: 'Near threshold',
  twp: 'TWP month',
  over: 'Over SGA'
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
  if (phase === 'unknown' || phase === 'verifyComplete') return 'Confirm TWP status';
  if (phase === 'sga') {
    return status.overSga
      ? `${money(status.countable - rules.sga)} over SGA`
      : status.roomToSga != null
        ? status.roomToSga === 0 ? 'At SGA threshold' : `${money(status.roomToSga)} below SGA`
        : 'Below SGA threshold';
  }
  if (status.isServiceMonth) return 'TWP month';
  return status.roomToTrialWork != null
    ? status.roomToTrialWork === 0
      ? 'At TWP threshold'
      : `${money(status.roomToTrialWork)} below TWP`
    : 'Below TWP threshold';
}

function thresholdGapLabel(value: number, threshold: number): string {
  const gap = value - threshold;
  if (Math.abs(gap) < 0.005) return 'At threshold';
  return `${money(Math.abs(gap))} ${gap > 0 ? 'over' : 'below'}`;
}

type Mode = 'cards' | 'table' | 'activeOnly';

const MODES: { id: Mode; label: string }[] = [
  { id: 'cards', label: 'Cards' },
  { id: 'table', label: 'Table' },
  { id: 'activeOnly', label: 'Activity' }
];

function StatusDot({ kind, size = 'sm' }: { kind: StatusKind; size?: 'sm' | 'md' }) {
  return (
    <span
      className={`shrink-0 rounded-full ${size === 'md' ? 'size-2' : 'size-1.5'}`}
      style={{ background: KIND_COLOR[kind] }}
    />
  );
}

export function PayGuardAnalysis({ data, year }: { data: TrackerData; year: number }) {
  const [mode, setMode] = useState<Mode>('cards');
  const [simulatorOpen, setSimulatorOpen] = useState(false);
  const rules = rulesFor(year);
  const now = todayMonth();
  const asOf = year < Number(now.slice(0, 4)) ? `${year}-12` : now;
  const analysisPhase = benefitPhase(data, asOf);
  const needsTwpConfirmation = analysisPhase === 'unknown' || analysisPhase === 'verifyComplete';

  const cards = useMemo(() => monthsOfYear(year).map((month) => {
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
  }), [data, year, rules]);

  const visible = mode === 'activeOnly'
    ? cards.filter((c) => c.status.countable > 0 || c.status.isServiceMonth)
    : cards;

  const elapsed = cards.filter((card) => card.month <= asOf);
  const yearTotalCountable = elapsed.reduce((sum, card) => sum + card.status.countable, 0);
  const w2Year = elapsed.reduce((sum, c) => sum + c.w2, 0);
  const seYear = elapsed.reduce((sum, c) => sum + c.se, 0);
  const totalYearIncome = w2Year + seYear;
  const w2Pct = totalYearIncome > 0 ? Math.round((w2Year / totalYearIncome) * 100) : 0;
  const sePct = totalYearIncome > 0 ? 100 - w2Pct : 0;
  const twp = trialWorkStatus(data, asOf);
  const overSgaMonths = elapsed.filter((c) => c.status.overSga).length;

  return (
    <div className="flex flex-col gap-3 sm:gap-4">
      {/* ---------------- Monthly analysis ---------------- */}
      <section className="pg-card flex flex-col overflow-hidden">
        {/*
          Title, mode switch and legend share one band. The legend used to sit
          in its own padded, ruled row, which read as a separate section rather
          than as a key for the panel it belongs to.
        */}
        <header className="pg-rule-b pg-surface-quiet px-3.5 py-3 sm:px-4">
          <div className="grid gap-2.5 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
            <div className="flex min-w-0 flex-col gap-1.5">
              <h2 className="pg-section-title pg-fg sm:text-[0.8125rem]">
                Monthly work-limit status
              </h2>

              {needsTwpConfirmation ? (
                <span className="pg-muted flex items-center gap-1.5 text-[0.6875rem] font-bold leading-snug">
                  <StatusDot kind="review" /> Confirm your TWP status to enable threshold warnings.
                </span>
              ) : (
                <div className="flex flex-wrap gap-x-4 gap-y-1 text-[0.6875rem] font-bold leading-snug">
                  <span className="flex items-center gap-1.5 pg-text-safe">
                    <StatusDot kind="safe" /> Below threshold
                  </span>
                  <span className="flex items-center gap-1.5 pg-text-warn">
                    <StatusDot kind="warn" /> Near threshold
                  </span>
                  <span className="flex items-center gap-1.5 pg-text-twp">
                    <StatusDot kind="twp" /> TWP month
                  </span>
                  <span className="flex items-center gap-1.5 pg-text-over">
                    <StatusDot kind="over" /> Over SGA (&gt;{money(rules.sga)})
                  </span>
                </div>
              )}
            </div>

            <div
              className="pg-seg w-fit justify-self-start sm:justify-self-end"
              role="group"
              aria-label="Monthly analysis view"
            >
              {MODES.map((m) => (
                <button
                  key={m.id}
                  type="button"
                  data-on={mode === m.id}
                  aria-pressed={mode === m.id}
                  onClick={() => setMode(m.id)}
                  className="pg-seg-item"
                >
                  {m.label}
                </button>
              ))}
            </div>
          </div>
        </header>

        {visible.length === 0 ? (
          <div className="pg-empty">
            <CalendarOff className="size-5 pg-dim" />
            <span className="pg-empty-title">No activity recorded for {year}</span>
            <span className="pg-empty-body">
              Activity shows months with countable income or a TWP month. Add earnings above, or
              choose Cards to see all 12 months.
            </span>
            <button type="button" className="pg-btn mt-1" onClick={() => setMode('cards')}>
              Show all months
            </button>
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
                <colgroup>
                  <col className="pg-analysis-col-month" />
                  <col className="pg-analysis-col-countable" />
                  <col className="pg-analysis-col-status" />
                  <col className="pg-analysis-col-gap" />
                  <col className="pg-analysis-col-gap" />
                  <col className="pg-analysis-col-source" />
                  <col className="pg-analysis-col-source" />
                </colgroup>
                <thead>
                  <tr className="pg-table-head">
                    <th scope="col" className="pg-frozen pg-rule-r px-3.5 py-2.5 text-left sm:px-4">Month</th>
                    <th scope="col" className="pg-rule-r px-3.5 py-2.5 text-right sm:px-4">Countable</th>
                    <th scope="col" className="pg-rule-r px-3.5 py-2.5 text-left sm:px-4">Status</th>
                    <th
                      scope="col"
                      title="Room below or amount over the SGA threshold"
                      className="pg-rule-r px-3.5 py-2.5 text-right sm:px-4"
                    >
                      SGA room
                    </th>
                    <th
                      scope="col"
                      title="Room below or amount over the TWP earnings threshold"
                      className="pg-rule-r px-3.5 py-2.5 text-right sm:px-4"
                    >
                      TWP room
                    </th>
                    <th scope="col" className="pg-rule-r px-3.5 py-2.5 text-right sm:px-4">W-2 gross</th>
                    <th scope="col" className="px-3.5 py-2.5 text-right sm:px-4">1099 net</th>
                  </tr>
                </thead>
                <tbody>
                  {visible.map((c, idx) => (
                    <tr key={c.month} className="pg-table-row" data-stripe={idx % 2 === 1}>
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
                        {c.status.countable > 0 ? (
                          c.status.overSga ? (
                            <span className="font-bold pg-text-over">
                              {thresholdGapLabel(c.status.countable, rules.sga)}
                            </span>
                          ) : (
                            <span className="pg-text-safe">
                              {thresholdGapLabel(c.status.countable, rules.sga)}
                            </span>
                          )
                        ) : '—'}
                      </td>
                      <td className="pg-mono pg-rule-r px-3.5 py-2 text-right pg-muted sm:px-4">
                        {c.status.isServiceMonth && c.status.countable <= rules.trialWork ? (
                          <span className="font-bold pg-text-twp">Used by hours</span>
                        ) : c.status.countable > 0 ? (
                          c.status.countable > rules.trialWork ? (
                            <span className="font-bold pg-text-twp">
                              {thresholdGapLabel(c.status.countable, rules.trialWork)}
                            </span>
                          ) : (
                            <span>{thresholdGapLabel(c.status.countable, rules.trialWork)}</span>
                          )
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

      {/* ---------------- Summary deck ---------------- */}
      <section className="pg-card overflow-hidden">
        <div className="pg-tile-grid">
          <Tile
            label="YTD countable income"
            value={money(yearTotalCountable)}
            valueColor="var(--pg-safe-text)"
            note={`Through ${longMonthName(asOf)}`}
          />

          <Tile
            label="Income by source"
            value={
              <>
                <span className="pg-text-w2">{money(w2Year)}</span>
                <span className="mx-1.5 font-normal pg-dim">·</span>
                <span className="pg-text-se">{money(seYear)}</span>
              </>
            }
          >
            <div className="pg-meter mt-0.5">
              <span className="pg-meter-seg pg-fill-w2" style={{ width: `${w2Pct}%` }} />
              <span className="pg-meter-seg pg-fill-se" style={{ width: `${sePct}%` }} />
            </div>
            <span className="pg-tile-note">W-2 {w2Pct}% · 1099 {sePct}%</span>
          </Tile>

          <Tile
            label="TWP months used"
            value={<>{twp.used}<span className="ml-1 text-sm font-semibold pg-dim">of 9</span></>}
            valueColor="var(--pg-twp-text)"
            note={9 - twp.used > 0 ? `${9 - twp.used} remaining` : 'All 9 used'}
          />

          <Tile
            label="Months over SGA"
            value={<>{overSgaMonths}<span className="ml-1 text-sm font-semibold pg-dim">{overSgaMonths === 1 ? 'month' : 'months'}</span></>}
            valueColor={overSgaMonths > 0 ? 'var(--pg-over-text)' : 'var(--pg-safe-text)'}
            note={`SGA threshold: ${money(rules.sga)}/month`}
          />
        </div>

        {/* Simulator */}
        <div className="flex items-center justify-between gap-3 pg-rule-t px-3.5 py-3 sm:px-5">
          <span className="hidden text-xs pg-muted sm:block">
            Test a hypothetical month against the {year} thresholds.
          </span>
          <button
            type="button"
            onClick={() => setSimulatorOpen((v) => !v)}
            aria-expanded={simulatorOpen}
            className="pg-btn"
          >
            <ShieldCheck className="size-3.5 pg-accent" />
            {simulatorOpen ? 'Hide simulator' : 'Open simulator'}
          </button>
        </div>

        {simulatorOpen ? (
          <div className="pg-rule-t">
            <SafeWorkSimulator />
          </div>
        ) : null}

        <p className="pg-rule-t pg-surface-2 px-3.5 py-2.5 text-[0.6875rem] leading-relaxed pg-muted sm:px-5 sm:py-3">
          These Social Security thresholds are for planning only. Report wages and verify current
          figures with SSA before making work decisions. Your data stays on this device unless you
          enable cloud sync.
        </p>
      </section>
    </div>
  );
}
