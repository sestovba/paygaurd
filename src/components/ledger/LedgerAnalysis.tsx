import { useMemo, useState } from 'react';
import { ShieldCheck } from 'lucide-react';
import { countableFor, monthStatus, nearLimit } from '../../domain/earnings';
import { longMonthName, listedMonths, todayMonth } from '../../domain/months';
import { rulesFor } from '../../domain/rules';
import { paycheckContextForMonth } from '../../domain/paySchedule';
import { benefitPhase } from '../../domain/trialWork';
import type { BenefitPhase } from '../../domain/trialWork';
import type { MonthStatus, TrackerData } from '../../domain/types';
import { SafeWorkSimulator } from '../SafeWorkSimulator';
import { money0, money2 } from './ledgerFormat';
import { ReviewTarget } from '../../review/ReviewTarget';

type StatusKind = 'none' | 'review' | 'safe' | 'warn' | 'twp' | 'over';

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

/* One limit at a time, and named without its abbreviation: the reader is
   only ever under one regime and does not need the other one's initials. */
function remainingLabel(status: MonthStatus, phase: BenefitPhase): string {
  if (status.countable <= 0 && !status.isServiceMonth) return '';
  if (phase === 'unknown' || phase === 'verifyComplete') return 'Status not set';
  if (phase === 'sga') {
    return status.overSga ? 'Over your limit'
      : status.roomToSga != null ? `${money0(status.roomToSga)} left` : '';
  }
  if (status.isServiceMonth) return 'Trial work month used';
  return status.roomToTrialWork != null ? `${money0(status.roomToTrialWork)} left` : '';
}

const KIND_LABEL: Record<StatusKind, string> = {
  none: 'No income', review: 'Status not set', safe: 'Under', warn: 'Close', twp: 'Trial work month', over: 'Over limit'
};

function statusColor(kind: StatusKind): string {
  return kind === 'none' ? 'var(--lg-border)'
    : kind === 'review' ? 'var(--lg-muted)'
      : `var(--lg-${kind})`;
}

function deltaToLimit(value: number, limit: number): string {
  if (value <= 0) return '—';
  const delta = value - limit;
  if (Math.abs(delta) < 0.005) return 'At limit';
  return delta > 0 ? `${money0(delta)} over` : `${money0(Math.abs(delta))} below`;
}

type Mode = 'table' | 'cards' | 'activeOnly';

export function LedgerAnalysis({ data, year, focusMode = false }: {
  data: TrackerData; year: number; focusMode?: boolean;
}) {
  const [mode, setMode] = useState<Mode>('table');
  const [simulatorOpen, setSimulatorOpen] = useState(false);
  /* Review note: "now that we have only september, I am not sure what should
     be here."
     Table, Cards and Active Only are three ways of reading twelve months.
     Focus mode leaves one, and all three collapse onto the same single row —
     a switch with three positions and one outcome. So in focus mode the
     switch is not offered and the month is drawn as the card, which is the
     rendering that reads well on its own; a one-row table is a header with a
     row under it. */
  const view = focusMode ? 'cards' : mode === 'cards' ? 'cards' : 'table';
  const onlyIncome = !focusMode && mode === 'activeOnly';
  const rules = rulesFor(year);
  const now = todayMonth();
  const asOf = year < Number(now.slice(0, 4)) ? `${year}-12` : now;
  const analysisPhase = benefitPhase(data, asOf);

  const cards = useMemo(() => listedMonths(year, false, focusMode).map((month) => {
    const status = monthStatus(data, month);
    const phase = benefitPhase(data, month);
    const w2 = data.streams.filter((s) => s.type === 'w2').reduce((sum, s) => sum + countableFor(s, month), 0);
    const se = data.streams.filter((s) => s.type === 'ten99').reduce((sum, s) => sum + countableFor(s, month), 0);
    const kind = statusKind(status, phase);
    const context = paycheckContextForMonth(data.streams, month);
    const threshold = phase === 'trialWork' ? rules.trialWork : rules.sga;
    const pct = threshold ? Math.min(100, (status.countable / threshold) * 100) : 0;
    return { month, status, kind, w2, se, context, pct, label: remainingLabel(status, phase) };
  }), [data, year, rules, focusMode]);

  const visible = onlyIncome ? cards.filter((c) => c.status.countable > 0 || c.status.isServiceMonth) : cards;

  return (
    <div className="lg-analysis">
      <div className="lg-analysis-pad flex flex-wrap items-center gap-2.5 pb-3 pt-5">
        <span className="lg-sans text-lg font-semibold">
          {focusMode && visible.length === 1 ? longMonthName(visible[0].month) : 'Month by month'}
        </span>
        <span className="lg-label">All streams combined</span>
        {focusMode ? null : (
          <ReviewTarget
            id="ledger-analysis-view-modes"
            label="Three views of one table"
            reason="Cards, Table and Active Only show the same twelve months three ways — pick the one that answers the SGA question."
            certainty="sure"
            layout="ledger"
            className="ml-auto w-full sm:w-auto"
          >
            <div className="lg-seg w-full sm:w-auto">
              <button type="button" data-on={mode === 'table'} className="lg-seg-item" onClick={() => setMode('table')}>Table</button>
              <button type="button" data-on={mode === 'cards'} className="lg-seg-item" onClick={() => setMode('cards')}>Cards</button>
              <button type="button" data-on={mode === 'activeOnly'} className="lg-seg-item" onClick={() => setMode('activeOnly')}>Active Only</button>
            </div>
          </ReviewTarget>
        )}
      </div>

      <div className="lg-analysis-pad flex flex-wrap gap-x-5 gap-y-1.5 pb-1">
        {analysisPhase === 'unknown' || analysisPhase === 'verifyComplete' ? (
          <span className="lg-legend-item">
            <span className="lg-swatch lg-swatch-muted" /> Confirm TWP status to turn limit warnings on
          </span>
        ) : (
          /* One limit at a time — the same rule the overview layouts follow.
             This legend named both regimes at once, so half of it was always
             about a rule that does not apply to the reader. */
          <>
            <span className="lg-legend-item">
              <span className="lg-swatch lg-swatch-safe" /> Under{' '}
              {money2(analysisPhase === 'trialWork' ? rules.trialWork : rules.sga)}
            </span>
            <span className="lg-legend-item">
              <span className="lg-swatch lg-swatch-warn" /> Close to it
            </span>
            {analysisPhase === 'trialWork' ? (
              <span className="lg-legend-item">
                <span className="lg-swatch lg-swatch-twp" /> Uses a trial work month
              </span>
            ) : (
              <span className="lg-legend-item">
                <span className="lg-swatch lg-swatch-over" /> Over your limit
              </span>
            )}
          </>
        )}
      </div>

      {view === 'cards' ? (
        <div className="lg-analysis-grid">
          {visible.map((c) => (
            <div key={c.month} className="lg-status-card" data-status={c.kind}>
              <div className="flex items-center gap-2 px-3 py-3 sm:px-4 lg-border-b-soft">
                <span className="text-[0.75rem] font-semibold uppercase tracking-wider">{longMonthName(c.month)}</span>
                <span
                  className="ml-auto lg-status-dot"
                  style={{ background: statusColor(c.kind) }}
                />
              </div>
              {c.kind === 'none' ? (
                <div className="flex flex-col gap-1 p-3">
                  <span className="text-2xl font-semibold lg-text-muted">–</span>
                  <span className="text-[0.8125rem] lg-text-muted">No income</span>
                </div>
              ) : (
                <div className="flex flex-col gap-2 p-3">
                  <div className="flex items-baseline gap-1.5">
                    <span className="text-2xl font-semibold">{money2(c.status.countable)}</span>
                    <span className="text-[0.6875rem] uppercase tracking-wider lg-text-muted">countable</span>
                  </div>
                  <div className="relative h-1.5 lg-bg-border-soft">
                    <div className="absolute inset-y-0 left-0" style={{ width: c.pct + '%', background: statusColor(c.kind) }} />
                  </div>
                  {c.context.length ? (
                    <div className="text-[0.625rem] font-medium uppercase tracking-wider lg-text-warn">
                      {c.context.map((ctx) => `${ctx.count} paychecks · ${ctx.streamName}`).join(' · ')}
                    </div>
                  ) : null}
                  <div className="flex items-center justify-between gap-2 text-[0.75rem] lg-text-muted">
                    <span>
                      <span className="lg-text-w2">W2 {money0(c.w2)}</span>
                      {' · '}
                      <span className="lg-text-se">SE {money0(c.se)}</span>
                    </span>
                    <span>{c.label}</span>
                  </div>
                </div>
              )}
            </div>
          ))}
          {!visible.length ? (
            <p className="w-full px-4 py-10 text-center text-sm lg-text-muted">
              No months with income yet — enter figures in the ledger above.
            </p>
          ) : null}
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full lg-analysis-table">
            <thead>
              <tr>
                {['Month', 'Combined', 'Status', 'vs SGA', 'vs TWP'].map((h, i) => (
                  <th key={h} className={`lg-label border-b px-3 py-3 sm:px-4 lg-label-border ${i === 0 ? 'text-left' : 'text-right'}`}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {visible.map((c) => (
                <tr key={c.month} className="lg-border-b-soft">
                  <td className="px-3 py-3.5 sm:px-4 text-base font-medium">{longMonthName(c.month)}</td>
                  <td className={`px-3 py-3.5 sm:px-4 text-right text-base font-semibold${c.kind === 'none' ? ' lg-text-muted' : ''}`}>
                    {c.kind === 'none' ? '–' : money2(c.status.countable)}
                  </td>
                  <td className="px-3 py-3.5 sm:px-4 text-right">
                    {c.kind === 'none' ? (
                      <span className="lg-text-muted">–</span>
                    ) : (
                      <span className="lg-status-badge" style={{ color: statusColor(c.kind) }}>{KIND_LABEL[c.kind]}</span>
                    )}
                  </td>
                  <td className={`px-3 py-3.5 sm:px-4 text-right text-base ${c.status.overSga ? 'lg-text-over' : 'lg-text-muted'}`}>
                    {deltaToLimit(c.status.countable, rules.sga)}
                  </td>
                  <td className={`px-3 py-3.5 sm:px-4 text-right text-base ${c.status.isServiceMonth ? 'lg-text-twp' : 'lg-text-muted'}`}>
                    {c.status.isServiceMonth && c.status.countable <= rules.trialWork
                      ? 'Used by hours'
                      : deltaToLimit(c.status.countable, rules.trialWork)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="lg-analysis-pad py-3 lg-border-t">
        <button
          type="button"
          onClick={() => setSimulatorOpen((v) => !v)}
          className="lg-btn flex items-center gap-2"
        >
          <ShieldCheck className="size-4 lg-text-safe" />
          {simulatorOpen ? 'Hide Safe Work Simulator' : 'Open Safe Work Simulator'}
        </button>
      </div>

      {simulatorOpen ? (
        <div className="lg-analysis-pad pb-4">
          <SafeWorkSimulator />
        </div>
      ) : null}

      <p className="lg-analysis-pad py-3.5 text-[0.8125rem] leading-relaxed lg-disclaimer">
        Thresholds are planning estimates. Confirm figures with SSA before acting on them. Data is stored in this browser only — use Export for a backup.
      </p>
    </div>
  );
}
