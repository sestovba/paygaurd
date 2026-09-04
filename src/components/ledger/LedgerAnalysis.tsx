import { useMemo, useState } from 'react';
import { ChevronDown, ShieldCheck } from 'lucide-react';
import { countableFor, hoursFor, monthStatus, nearLimit } from '../../domain/earnings';
import { longMonthName, scopedMonths, todayMonth } from '../../domain/months';
import type { MonthScope } from '../../domain/months';
import { rulesFor } from '../../domain/rules';
import { paycheckContextForMonth } from '../../domain/paySchedule';
import { benefitPhase } from '../../domain/trialWork';
import type { BenefitPhase } from '../../domain/trialWork';
import type { MonthStatus, TrackerData } from '../../domain/types';
import { SafeWorkSimulator } from '../SafeWorkSimulator';
import { copyFor } from '../../domain/copy';
import { money0, money2 } from './ledgerFormat';
import { ButtonBase } from '../../design-system';
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
  if (phase === 'unknown' || phase === 'verifyComplete') return 'Limit not known yet';
  if (phase === 'sga') {
    return status.overSga ? 'Over your limit'
      : status.roomToSga != null ? `${money0(status.roomToSga)} left before your limit` : '';
  }
  if (status.isServiceMonth) return 'Trial month';
  return status.roomToTrialWork != null ? `${money0(status.roomToTrialWork)} left before your limit` : '';
}

/* Legend stays short ("Under $X", "Near") because the amount sits next to
   the swatch. Badges in the table have to finish the sentence on their own —
   "Under" / "Near" alone are comparatives with nothing to compare to. */
const KIND_LABEL: Record<StatusKind, string> = {
  none: 'No income',
  review: 'Limit not known yet',
  safe: 'Under your limit',
  warn: 'Near your limit',
  twp: 'Trial month',
  over: 'Over your limit'
};

function statusColor(kind: StatusKind): string {
  return kind === 'none' ? 'var(--lg-border)'
    : kind === 'review' ? 'var(--lg-muted)'
      : `var(--lg-${kind})`;
}

/* Inside a column headed "Against your limit", so "over" and "below" have
   their subject supplied by the header rather than repeating it twelve
   times. "At limit" was the exception and read as a label rather than a
   reading. */
function deltaToLimit(value: number, limit: number): string {
  if (value <= 0) return '—';
  const delta = value - limit;
  if (Math.abs(delta) < 0.005) return 'Exactly at it';
  return delta > 0 ? `${money0(delta)} over` : `${money0(Math.abs(delta))} under`;
}

type Mode = 'cards' | 'table';

export function LedgerAnalysis({ data, year, scope = 'year' }: {
  data: TrackerData; year: number; scope?: MonthScope;
}) {
  const [mode, setMode] = useState<Mode>('cards');
  /* Active is a filter on either view, not a third view — default on so
     empty months stay out of the way until someone asks for them. */
  const [activeOnly, setActiveOnly] = useState(true);
  const [simulatorOpen, setSimulatorOpen] = useState(false);
  /* Open by default — primary read; collapses like Year shape. */
  const [open, setOpen] = useState(true);
  const words = copyFor('ledger');
  /* Review note: "now that we have only september, I am not sure what should
     be here."
     Cards and Table are two ways of reading the months; Active filters which
     months appear. With one month listed the switch collapses onto one card
     and is not offered. The test is how many months are listed, not which
     setting produced them. */
  const months = useMemo(() => scopedMonths(year, scope), [year, scope]);
  const single = months.length === 1;
  const view = single || mode === 'cards' ? 'cards' : 'table';
  const onlyIncome = !single && activeOnly;
  const rules = rulesFor(year);
  const now = todayMonth();
  const asOf = year < Number(now.slice(0, 4)) ? `${year}-12` : now;
  const analysisPhase = benefitPhase(data, asOf);

  const cards = useMemo(() => months.map((month) => {
    const status = monthStatus(data, month);
    const phase = benefitPhase(data, month);
    const w2 = data.streams.filter((s) => s.type === 'w2').reduce((sum, s) => sum + countableFor(s, month), 0);
    const se = data.streams.filter((s) => s.type === 'ten99').reduce((sum, s) => sum + countableFor(s, month), 0);
    const hours = data.streams.reduce((sum, s) => sum + hoursFor(s, month), 0);
    const kind = statusKind(status, phase);
    const context = paycheckContextForMonth(data.streams, month);
    const threshold = phase === 'trialWork' ? rules.trialWork : rules.sga;
    const pct = threshold ? Math.min(100, (status.countable / threshold) * 100) : 0;
    return { month, status, kind, w2, se, hours, context, pct, label: remainingLabel(status, phase) };
  }), [data, months, rules]);

  const visible = onlyIncome ? cards.filter((c) => c.status.countable > 0 || c.status.isServiceMonth) : cards;
  /* Worked is hours — omit the column when every visible row would be a dash. */
  const showWorked = visible.some((c) => c.hours > 0);

  const title = single && visible.length === 1 ? longMonthName(visible[0].month) : 'By month';
  const closedMeta = single
    ? (visible[0] ? money2(visible[0].status.countable) : '')
    : `${visible.length} month${visible.length === 1 ? '' : 's'}`;

  return (
    <div className="lg-analysis" data-open={open || undefined}>
      <ButtonBase
        type="button"
        className="lg-band-head"
        data-open={open}
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        <span className="lg-toggle-lead" aria-hidden="true">
          <ChevronDown className="lg-chevron" data-collapsed={!open} />
        </span>
        <span className="lg-band-head__title">{title}</span>
        {!open ? (
          <span className="lg-band-head__meta lg-section-toggle-meta" style={{ marginLeft: 0 }}>
            {closedMeta}
          </span>
        ) : null}
      </ButtonBase>

      {open ? (
      <>
      {/* Legend + view tools sit under the accordion head — not inside the
          toggle button, so Cards / Active don't collapse the section. */}
      {single ? null : (
        <div className="lg-analysis-toolbar">
          <div className="lg-analysis-titleblock">
            <div className="lg-legend">
              {analysisPhase === 'unknown' || analysisPhase === 'verifyComplete' ? (
                <span className="lg-legend-item">
                  <span className="lg-swatch lg-swatch-muted" /> Tell us where you stand to turn limit warnings on
                </span>
              ) : (
                <>
                  <span className="lg-legend-item">
                    <span className="lg-swatch lg-swatch-safe" /> Under{' '}
                    {money2(analysisPhase === 'trialWork' ? rules.trialWork : rules.sga)}
                  </span>
                  <span className="lg-legend-item">
                    <span className="lg-swatch lg-swatch-warn" /> Near
                  </span>
                  {analysisPhase === 'trialWork' ? (
                    <span className="lg-legend-item">
                      <span className="lg-swatch lg-swatch-twp" /> Trial month
                    </span>
                  ) : (
                    <span className="lg-legend-item">
                      <span className="lg-swatch lg-swatch-over" /> Over
                    </span>
                  )}
                </>
              )}
            </div>
          </div>
          <ReviewTarget
            id="ledger-analysis-view-modes"
            label="How to read the months"
            reason="Cards or Table for the layout; Active hides empty months."
            layout="ledger"
            className="lg-analysis-tools-wrap"
          >
            <div className="lg-analysis-controls" role="toolbar" aria-label="By month view">
              <div className="lg-seg" role="group" aria-label="Layout">
                <ButtonBase type="button" data-on={mode === 'cards'} aria-pressed={mode === 'cards'} className="lg-seg-item" onClick={() => setMode('cards')}>Cards</ButtonBase>
                <ButtonBase type="button" data-on={mode === 'table'} aria-pressed={mode === 'table'} className="lg-seg-item" onClick={() => setMode('table')}>Table</ButtonBase>
              </div>
              <label className="lg-active-filter">
                <input
                  type="checkbox"
                  checked={activeOnly}
                  onChange={() => setActiveOnly((v) => !v)}
                />
                <span>Active</span>
              </label>
            </div>
          </ReviewTarget>
        </div>
      )}

      {!visible.length ? (
        <div className="lg-empty-months">
          <p>
            {activeOnly
              ? 'No months with income yet — enter figures above, or uncheck Active to see every month.'
              : 'No months with income yet — enter figures in the ledger above.'}
          </p>
          {activeOnly ? (
            <ButtonBase type="button" className="lg-btn" onClick={() => setActiveOnly(false)}>
              Show every month
            </ButtonBase>
          ) : null}
        </div>
      ) : view === 'cards' ? (
        <div className="lg-analysis-grid">
          {visible.map((c) => (
            <div key={c.month} className="lg-status-card" data-status={c.kind}
  aria-current={c.month === todayMonth() ? 'date' : undefined}
  data-current-month={c.month === todayMonth() || undefined}>
              <div className="lg-status-card-head">
                <span className="lg-label">{longMonthName(c.month)}</span>
                <span className="ml-auto lg-status-dot" />
              </div>
              {c.kind === 'none' ? (
                <div className="lg-status-card-body">
                  <span className="lg-type-figure lg-text-muted">–</span>
                  <span className="lg-type-body lg-text-muted">No income</span>
                </div>
              ) : (
                <div className="lg-status-card-body lg-status-card-body-filled">
                  <div className="flex items-baseline gap-1.5">
                    <span className="lg-type-figure">{money2(c.status.countable)}</span>
                    <span className="lg-type-caption uppercase tracking-wider lg-text-muted">countable</span>
                  </div>
                  {c.context.length ? (
                    <div className="lg-type-caption lg-text-muted">
                      {c.context.map((ctx) => `${ctx.count} paychecks · ${ctx.streamName}`).join(' · ')}
                    </div>
                  ) : null}
                  <div className="mt-auto flex items-center justify-between gap-2 lg-type-caption lg-text-muted">
                    <span>
                      <span className="lg-text-w2">W2 {money0(c.w2)}</span>
                      {' · '}
                      <span className="lg-text-se">SE {money0(c.se)}</span>
                    </span>
                    <span>{c.label}</span>
                  </div>
                </div>
              )}
              <div
                className="lg-card-meter"
                role="img"
                aria-label={c.kind === 'none' ? undefined : `${Math.round(c.pct)} percent of your monthly limit`}
              >
                {c.kind !== 'none' && c.pct > 0 ? (
                  <span style={{ width: `${Math.min(100, c.pct)}%` }} />
                ) : null}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full lg-analysis-table" data-worked={showWorked || undefined}>
            <thead>
              <tr>
                {/* Four abbreviations and a preposition became two columns.
                    "vs SGA" and "vs TWP" sat side by side, so half of every
                    row was a distance to a limit that does not apply to this
                    reader — the one-limit rule, unfinished on this layout.
                    One column now, against the limit in force.
                    Worked (hours) only appears when at least one visible
                    row has hours — otherwise it is a column of dashes. */}
                <th className="lg-label border-b text-left lg-label-border">Month</th>
                <th className="lg-label border-b text-right lg-label-border">Counted</th>
                {showWorked ? (
                  <th className="lg-label border-b text-right lg-label-border">Hours</th>
                ) : null}
                <th className="lg-label border-b text-right lg-label-border">Status</th>
                <th className="lg-label border-b text-right lg-label-border">Vs limit</th>
              </tr>
            </thead>
            <tbody>
              {visible.map((c) => (
                <tr key={c.month} className="lg-border-b-soft"
  aria-current={c.month === todayMonth() ? 'date' : undefined}
  data-current-month={c.month === todayMonth() || undefined}>
                  <td className="lg-type-body">{longMonthName(c.month)}</td>
                  <td className={`text-right lg-type-body font-semibold${c.kind === 'none' ? ' lg-text-muted' : ''}`}>
                    {c.kind === 'none' ? '–' : money2(c.status.countable)}
                  </td>
                  {showWorked ? (
                    <td className={`text-right lg-type-body${c.hours > 0 ? '' : ' lg-text-muted'}`}>
                      {c.hours > 0 ? `${Math.round(c.hours * 10) / 10}` : '—'}
                    </td>
                  ) : null}
                  <td className="text-right">
                    {c.kind === 'none' ? (
                      <span className="lg-text-muted">–</span>
                    ) : (
                      <span className="lg-status-badge" style={{ color: statusColor(c.kind) }}>{KIND_LABEL[c.kind]}</span>
                    )}
                  </td>
                  <td className={`text-right lg-type-body ${
                    analysisPhase === 'sga'
                      ? (c.status.overSga ? 'lg-text-over' : 'lg-text-muted')
                      : (c.status.isServiceMonth ? 'lg-text-twp' : 'lg-text-muted')
                  }`}>
                    {analysisPhase === 'sga'
                      ? deltaToLimit(c.status.countable, rules.sga)
                      : c.status.isServiceMonth && c.status.countable <= rules.trialWork
                        ? 'Used by your hours'
                        : deltaToLimit(c.status.countable, rules.trialWork)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="lg-analysis-band">
        <ButtonBase
          type="button"
          onClick={() => setSimulatorOpen((v) => !v)}
          className="lg-btn lg-btn-bleed flex w-full items-center justify-center gap-2"
        >
          <ShieldCheck className="size-4 lg-text-safe" />
          {/* el-8lyfa5: "what does safe mean? what does that have to do with
              anything". Nothing — it was the tool naming itself after its own
              maths. The tool is named by the question it answers, the way
              PayGuard already names it. */}
          {simulatorOpen ? 'Close' : words.hoursAsk}
        </ButtonBase>
      </div>

      {simulatorOpen ? (
        <div className="lg-analysis-band lg-analysis-band--panel">
          <SafeWorkSimulator />
        </div>
      ) : null}

      <p className="lg-analysis-band lg-analysis-band--copy lg-type-body leading-relaxed lg-disclaimer">
        These figures are for planning. Check with Social Security before you act on one.
      </p>
      </>
      ) : null}
    </div>
  );
}
