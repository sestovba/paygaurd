import { useMemo, useState } from 'react';
import { countableFor } from '../../domain/earnings';
import { money } from '../../domain/format';
import { longMonthName, monthKey, shortMonthName } from '../../domain/months';
import { rulesFor } from '../../domain/rules';
import { extraPaycheckMonths } from '../../domain/paySchedule';
import type { Stream } from '../../domain/types';

/**
 * Review note: "it is currently a picture of income. It earns its height when
 * the SGA and TWP lines are what you read first, the bars over them are
 * marked, and the 3- and 5-paycheck months are called out on the axis. Right
 * now the threshold lines are decoration on a chart rather than the point of
 * it."
 *
 * Three changes, one per clause. The limits are solid rules with the ground
 * above SGA tinted, so the eye lands on them before any bar; the dashed grid
 * they used to compete with is now the quieter of the two. A bar that crosses
 * a limit is capped in that limit's colour, so a breach is a mark rather than
 * something you measure by eye. And the months a weekly or fortnightly
 * schedule pays an extra check are stamped on the axis — before they arrive,
 * because that is the whole use of knowing.
 */
export function PayGuardChart({ streams, year, limit }: {
  streams: Stream[];
  year: number;
  /* The limit in force, or null while the app has not been told — the same
     prop LedgerChart already takes. This chart drew both lines, labelled
     "SGA $1,690" and "TWP $1,210": two abbreviations and two limits, one of
     which never applies to the reader. The ledger's chart was fixed for that
     and this one was not, so the two layouts contradicted each other. */
  limit: { kind: 'trialWork' | 'sga'; amount: number } | null;
}) {
  const [selectedMonth, setSelectedMonth] = useState<string | null>(null);
  const rules = rulesFor(year);
  const months = useMemo(() => Array.from({ length: 12 }, (_, i) => monthKey(year, i + 1)), [year]);
  const extraPay = useMemo(() => extraPaycheckMonths(streams, year), [streams, year]);

  const byMonth = useMemo(() => months.map((month) => {
    const w2 = streams
      .filter((s) => s.type === 'w2')
      .reduce((sum, s) => sum + countableFor(s, month), 0);
    const se = streams
      .filter((s) => s.type === 'ten99')
      .reduce((sum, s) => sum + countableFor(s, month), 0);
    const total = w2 + se;
    return { month, w2, se, total };
  }), [months, streams]);

  const maxIncome = Math.max(...byMonth.map((m) => m.total), 0);
  const ceiling = Math.max((limit?.amount ?? rules.sga) * 1.25, maxIncome * 1.15, 2000);

  // Compute 4-5 nice Y-axis grid markers
  const ySteps = useMemo(() => {
    const stepSize = ceiling > 3500 ? 1000 : ceiling > 2000 ? 500 : 400;
    const steps: number[] = [];
    for (let v = 0; v <= ceiling; v += stepSize) {
      steps.push(v);
    }
    return steps.reverse();
  }, [ceiling]);

  const activeMonthData = byMonth.find((m) => m.month === selectedMonth);
  const activeIdx = months.indexOf(selectedMonth ?? '');

  // The crosshair tracks the pointer across the whole plot — gaps between the
  // bars included — and snaps to the month section it is over. Hover selection
  // rides on the same handler so the line, the tooltip and the bar highlight
  // can never disagree; touch keeps the tap-to-pin behaviour instead.
  function trackPointer(event: React.PointerEvent<HTMLDivElement>) {
    if (event.pointerType === 'touch') return;
    const rect = event.currentTarget.getBoundingClientRect();
    if (rect.width <= 0) return;
    const ratio = (event.clientX - rect.left) / rect.width;
    const idx = Math.min(months.length - 1, Math.max(0, Math.floor(ratio * months.length)));
    setSelectedMonth(months[idx]);
  }

  function clearPointer(event: React.PointerEvent<HTMLDivElement>) {
    if (event.pointerType === 'touch') return;
    setSelectedMonth(null);
  }

  return (
    <div id="pg-income-chart" className="pg-card flex scroll-mt-20 flex-col overflow-hidden">
      {/* Chart Header */}
      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2 pg-rule-b px-3.5 py-3 sm:px-5 sm:py-3.5">
        <h2 className="pg-section-title pg-fg sm:text-[0.8125rem]">
          What counted toward your limit, month by month
        </h2>
        <p id="pg-chart-thresholds" className="sr-only">
          {limit ? `Your monthly limit is ${money(limit.amount)}.` : 'No limit is set yet.'}
        </p>
        <div className="flex flex-wrap items-center gap-2.5 text-[0.6875rem] font-semibold sm:gap-4 sm:text-xs">
          <span className="flex items-center gap-1.5 pg-muted">
            <span className="size-2 sm:size-2.5 rounded-full pg-fill-w2" /> Employer
          </span>
          <span className="flex items-center gap-1.5 pg-muted">
            <span className="size-2 sm:size-2.5 rounded-full pg-fill-se" /> Gig work
          </span>
          <span className="pg-dim font-mono">
            Peak: {money(maxIncome)}
          </span>
        </div>
      </div>

      {/* Selected Month Mobile Banner (Shown when tapped on mobile) */}
      {activeMonthData ? (
        <div className="pg-chart-selection mx-3.5 mt-3 flex items-center justify-between rounded-[var(--pg-radius-md)] pg-border-all pg-surface-2 p-2.5 text-xs sm:hidden" aria-live="polite">
          <div className="flex items-center gap-2">
            <span className="font-bold pg-fg">{longMonthName(activeMonthData.month)}:</span>
            <span className="pg-mono font-bold pg-fg">{money(activeMonthData.total)}</span>
          </div>
          <div className="flex items-center gap-2 text-[0.6875rem]">
            {activeMonthData.w2 > 0 ? <span className="pg-text-w2 font-semibold">W2: {money(activeMonthData.w2)}</span> : null}
            {activeMonthData.se > 0 ? <span className="pg-text-se font-semibold">1099: {money(activeMonthData.se)}</span> : null}
            <button
              type="button"
              onClick={() => setSelectedMonth(null)}
              aria-label="Clear selected month"
              className="pg-icon-btn pg-touch-target ml-1"
            >
              <span aria-hidden="true">✕</span>
            </button>
          </div>
        </div>
      ) : null}

      {/* Main Chart Graphic */}
      <div
        className="pg-chart-scroll relative p-3.5 sm:p-5"
        role="region"
        aria-label={`${year} monthly income chart. Scroll horizontally to see all months.`}
        tabIndex={0}
      >
        <div className="relative h-48 sm:h-64 min-w-[20rem] sm:min-w-0 w-full">
          {/* Y Axis Grid & Labels */}
          <div className="pointer-events-none absolute inset-0 flex flex-col justify-between text-[0.625rem] sm:text-[0.6875rem] font-semibold pg-dim">
            {ySteps.map((step) => {
              const topPct = (1 - step / ceiling) * 100;
              if (topPct < 0 || topPct > 100) return null;
              return (
                <div
                  key={step}
                  className="absolute left-0 right-0 flex items-center"
                  style={{ top: `${topPct}%` }}
                >
                  <span className="pg-mono w-9 pr-1.5 text-right text-[0.625rem] pg-dim sm:w-14 sm:pr-2 sm:text-xs">
                    {money(step)}
                  </span>
                  <div className="flex-1 border-b border-dashed pg-gridline" />
                </div>
              );
            })}
          </div>

          {/* The limits, drawn as the subject of the chart rather than as
              annotation on it: a solid rule each, and the ground above SGA
              tinted so "over" is a place on the chart, not a comparison the
              reader has to make. */}
          {limit && limit.amount <= ceiling ? (
            <div
              className="pg-chart-over-band pointer-events-none absolute left-9 right-0 sm:left-14"
              style={{ top: 0, height: `${(1 - limit.amount / ceiling) * 100}%` }}
              aria-hidden="true"
            />
          ) : null}

          {/* One line, named in words. */}
          {limit && limit.amount <= ceiling ? (
            <div
              className="pointer-events-none absolute left-9 sm:left-14 right-0 flex items-center z-10"
              style={{ top: `${(1 - limit.amount / ceiling) * 100}%` }}
            >
              <div className="pg-chart-limit flex-1" data-limit={limit.kind === 'trialWork' ? 'twp' : 'over'} />
              <span className={`pg-badge ml-1.5 shrink-0 sm:ml-2 ${limit.kind === 'trialWork' ? 'pg-badge-twp' : 'pg-badge-over'}`}>
                Your limit {money(limit.amount)}
              </span>
            </div>
          ) : null}

          {/* Cursor crosshair — one hairline centred on the hovered month */}
          <div
            className="pointer-events-none absolute inset-y-0 left-11 sm:left-16 right-16 sm:right-24 flex justify-between gap-1 sm:gap-3"
            aria-hidden="true"
          >
            {months.map((m, idx) => (
              <div key={m} className="relative min-w-[1.25rem] flex-1">
                {idx === activeIdx ? <span className="pg-crosshair" /> : null}
              </div>
            ))}
          </div>

          {/* Bars */}
          <div
            className="absolute inset-y-0 left-11 sm:left-16 right-16 sm:right-24 flex items-end justify-between gap-1 sm:gap-3"
            onPointerMove={trackPointer}
            onPointerLeave={clearPointer}
          >
            {byMonth.map((item, idx) => {
              const w2Pct = (item.w2 / ceiling) * 100;
              const sePct = (item.se / ceiling) * 100;
              const totalPct = Math.min(100, w2Pct + sePct);
              const isSelected = selectedMonth === item.month;
              const isOverLimit = limit != null && item.total > limit.amount;
              const usesTrialMonth = limit?.kind === 'trialWork' && isOverLimit;
              // Keep the tooltip inside the plot box: it used to be anchored
              // above the full-height column, which put it outside the card
              // entirely and got it clipped. Pin it to whichever end of the
              // column the bar is not occupying, and pull edge months inward.
              const tipVertical = totalPct > 55 ? 'bottom-2' : 'top-0';
              const tipHorizontal = idx <= 1 ? 'left-0'
                : idx >= byMonth.length - 2 ? 'right-0'
                  : 'left-1/2 -translate-x-1/2';

              return (
                <button
                  type="button"
                  key={item.month}
                  onClick={() => setSelectedMonth((cur) => cur === item.month ? null : item.month)}
                  onFocus={() => setSelectedMonth(item.month)}
                  onBlur={() => setSelectedMonth(null)}
                  aria-pressed={isSelected}
                  aria-describedby="pg-chart-thresholds"
                  /* A screen reader gets the same words as a screen: this
                     said "countable income", "W-2", "1099", "the SGA limit"
                     and "the TWP limit" in one label. */
                  aria-label={
                    `${longMonthName(item.month)}: ${money(item.total)} counted toward your limit.`
                    + ` ${money(item.w2)} from an employer. ${money(item.se)} from gig work.`
                    + (isOverLimit ? ' Over your monthly limit.' : '')
                    + (extraPay.get(item.month) ? ` ${extraPay.get(item.month)!.counts.join(' or ')} paychecks this month.` : '')
                  }
                  className="pg-chart-bar-trigger group relative flex h-full flex-1 flex-col items-center justify-end"
                >
                  {/* Floating Desktop Tooltip */}
                  {isSelected ? (
                    <div
                      className={`pg-tooltip pointer-events-none absolute z-40 hidden flex-col sm:flex ${tipVertical} ${tipHorizontal}`}
                      data-caret={totalPct > 55 ? 'top' : 'bottom'}
                    >
                      <div className="pg-tip-head">
                        <span className="pg-tip-month">{longMonthName(item.month)}</span>
                        <span className="pg-tip-total">{money(item.total)}</span>
                      </div>

                      {item.w2 > 0 || item.se > 0 ? (
                        <div className="pg-tip-body">
                          {item.w2 > 0 ? (
                            <div className="pg-tip-row">
                              <span className="pg-tip-key">
                                <span className="pg-tip-swatch pg-fill-w2" /> W-2 wages
                              </span>
                              <span className="pg-tip-val">{money(item.w2)}</span>
                            </div>
                          ) : null}
                          {item.se > 0 ? (
                            <div className="pg-tip-row">
                              <span className="pg-tip-key">
                                <span className="pg-tip-swatch pg-fill-se" /> Gig work
                              </span>
                              <span className="pg-tip-val">{money(item.se)}</span>
                            </div>
                          ) : null}
                        </div>
                      ) : null}

                      {/* One row, not two. The tooltip stated the reader's
                          distance to both limits at once, each of them named
                          by its initials. */}
                      {limit ? (
                        <div className="pg-tip-foot">
                          <div className="pg-tip-row">
                            <span className="pg-tip-key">Your limit {money(limit.amount)}</span>
                            <span
                              className={`pg-tip-val ${isOverLimit && !usesTrialMonth ? 'pg-text-over' : 'pg-text-safe'}`}
                              style={usesTrialMonth ? { color: 'var(--pg-twp)' } : undefined}
                            >
                              {usesTrialMonth
                                ? `${money(item.total - limit.amount)} over · uses a trial work month`
                                : isOverLimit
                                  ? `${money(item.total - limit.amount)} over`
                                  : `${money(limit.amount - item.total)} left`}
                            </span>
                          </div>
                        </div>
                      ) : null}
                    </div>
                  ) : null}

                  {/* Stacked bar. A bar that crosses a limit wears that
                      limit's colour as a cap, so a breach is something you
                      see rather than something you measure. */}
                  <div
                    className={`pg-chart-bar relative w-full max-w-[28px] sm:max-w-[32px] rounded-t-md flex flex-col justify-end overflow-hidden transition-all duration-150 ${
                      isSelected ? 'scale-105 shadow-md brightness-110 pg-ring-selected' : 'group-hover:brightness-105'
                    }`}
                    style={{ height: `${Math.max(totalPct, 0)}%` }}
                  >
                    {item.se > 0 ? (
                      <div
                        style={{ height: `${(item.se / (item.total || 1)) * 100}%` }}
                        className="w-full pg-fill-se transition-all"
                      />
                    ) : null}
                    {item.w2 > 0 ? (
                      <div
                        style={{ height: `${(item.w2 / (item.total || 1)) * 100}%` }}
                        className="w-full pg-fill-w2 transition-all"
                      />
                    ) : null}
                    {isOverLimit ? (
                      <span className="pg-chart-cap" data-breach={usesTrialMonth ? 'twp' : 'over'} aria-hidden="true" />
                    ) : null}
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* X Axis Month Labels. The months a weekly or fortnightly schedule
            drops an extra check into are stamped here — the one fact about a
            future month that is knowable before it happens. */}
        <div className="mr-16 ml-11 mt-2 flex min-w-[20rem] justify-between text-[0.625rem] font-bold uppercase tracking-wider pg-muted sm:mr-24 sm:ml-16 sm:min-w-0 sm:text-[0.6875rem]" aria-hidden="true">
          {months.map((m) => {
            const extra = extraPay.get(m);
            return (
              <span key={m} className="flex flex-1 flex-col items-center gap-0.5">
                <span data-extra-pay={extra ? true : undefined} className={extra ? 'pg-text-info' : undefined}>
                  {shortMonthName(m)}
                </span>
                {extra ? (
                  <span className="pg-axis-pay" title={`${extra.counts.join(' or ')} paychecks`}>
                    {extra.counts.join('/')}&times;
                  </span>
                ) : null}
              </span>
            );
          })}
        </div>
        {extraPay.size > 0 ? (
          <p className="mr-16 ml-11 mt-1.5 text-[0.625rem] font-semibold pg-muted sm:mr-24 sm:ml-16">
            <span className="pg-axis-pay align-middle">3&times;</span>
            <span className="ml-1.5 align-middle">marks a month your pay schedule lands an extra paycheck in.</span>
          </p>
        ) : null}
      </div>
    </div>
  );
}
