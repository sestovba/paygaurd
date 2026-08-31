import { useMemo, useState } from 'react';
import { countableFor } from '../../domain/earnings';
import { money } from '../../domain/format';
import { longMonthName, monthKey, shortMonthName } from '../../domain/months';
import { rulesFor } from '../../domain/rules';
import type { Stream } from '../../domain/types';

export function PayGuardChart({ streams, year }: { streams: Stream[]; year: number }) {
  const [selectedMonth, setSelectedMonth] = useState<string | null>(null);
  const rules = rulesFor(year);
  const months = useMemo(() => Array.from({ length: 12 }, (_, i) => monthKey(year, i + 1)), [year]);

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
  const ceiling = Math.max(rules.sga * 1.25, maxIncome * 1.15, 2000);

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
          {year} countable income by month
        </h2>
        <p id="pg-chart-thresholds" className="sr-only">
          SGA threshold {money(rules.sga)} per month. Trial Work Period threshold {money(rules.trialWork)} per month.
        </p>
        <div className="flex flex-wrap items-center gap-2.5 text-[0.6875rem] font-semibold sm:gap-4 sm:text-xs">
          <span className="flex items-center gap-1.5 pg-muted">
            <span className="size-2 sm:size-2.5 rounded-full pg-fill-w2" /> W-2
          </span>
          <span className="flex items-center gap-1.5 pg-muted">
            <span className="size-2 sm:size-2.5 rounded-full pg-fill-se" /> 1099
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

          {/* Threshold Lines */}
          {/* SGA Line */}
          {rules.sga <= ceiling ? (
            <div
              className="pointer-events-none absolute left-9 sm:left-14 right-0 flex items-center z-10"
              style={{ top: `${(1 - rules.sga / ceiling) * 100}%` }}
            >
              <div className="flex-1 border-t-2 border-dashed pg-border-over" />
              <span className="pg-badge pg-badge-over ml-1.5 shrink-0 sm:ml-2">
                SGA {money(rules.sga)}
              </span>
            </div>
          ) : null}

          {/* TWP Line */}
          {rules.trialWork <= ceiling ? (
            <div
              className="pointer-events-none absolute left-9 sm:left-14 right-0 flex items-center z-10"
              style={{ top: `${(1 - rules.trialWork / ceiling) * 100}%` }}
            >
              <div className="flex-1 border-t-2 border-dashed pg-border-twp" />
              <span className="pg-badge pg-badge-twp ml-1.5 shrink-0 sm:ml-2">
                TWP {money(rules.trialWork)}
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
              const isOverSga = item.total > rules.sga;
              const isOverTwp = item.total > rules.trialWork;
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
                  aria-label={`${longMonthName(item.month)}: ${money(item.total)} countable income. W-2 ${money(item.w2)}. 1099 ${money(item.se)}.`}
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
                                <span className="pg-tip-swatch pg-fill-se" /> 1099 self-emp.
                              </span>
                              <span className="pg-tip-val">{money(item.se)}</span>
                            </div>
                          ) : null}
                        </div>
                      ) : null}

                      <div className="pg-tip-foot">
                        <div className="pg-tip-row">
                          <span className="pg-tip-key">SGA {money(rules.sga)}</span>
                          <span className={`pg-tip-val ${isOverSga ? 'pg-text-over' : 'pg-text-safe'}`}>
                            {isOverSga
                              ? `+${money(item.total - rules.sga)} over`
                              : `${money(rules.sga - item.total)} left`}
                          </span>
                        </div>
                        <div className="pg-tip-row">
                          <span className="pg-tip-key">TWP {money(rules.trialWork)}</span>
                          <span className="pg-tip-val" style={isOverTwp ? { color: 'var(--pg-twp)' } : undefined}>
                            {isOverTwp
                              ? `+${money(item.total - rules.trialWork)} · uses a month`
                              : `${money(rules.trialWork - item.total)} left`}
                          </span>
                        </div>
                      </div>
                    </div>
                  ) : null}

                  {/* Stacked bar */}
                  <div
                    className={`w-full max-w-[28px] sm:max-w-[32px] rounded-t-md flex flex-col justify-end overflow-hidden transition-all duration-150 ${
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
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* X Axis Month Labels */}
        <div className="mr-16 ml-11 mt-2 flex min-w-[20rem] justify-between text-[0.625rem] font-bold uppercase tracking-wider pg-muted sm:mr-24 sm:ml-16 sm:min-w-0 sm:text-[0.6875rem]" aria-hidden="true">
          {months.map((m) => (
            <span key={m} className="flex-1 text-center">
              {shortMonthName(m)}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
