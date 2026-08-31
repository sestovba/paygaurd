import { useMemo, useRef, useState } from 'react';
import type { MouseEvent } from 'react';
import { countableFor } from '../../domain/earnings';
import { monthsOfYear, shortMonthName } from '../../domain/months';
import { rulesFor } from '../../domain/rules';
import type { Stream } from '../../domain/types';
import { money0, money2 } from './ledgerFormat';

/**
 * Self-employment as the base layer, W-2 stacked on top of it — so the
 * steady, evenly-spread 1099 income reads as a floor, and the real,
 * lumpy paycheck timing shows as what rides on top of it each month.
 */
export function LedgerChart({ streams, year }: { streams: Stream[]; year: number }) {
  const rules = rulesFor(year);
  const months = monthsOfYear(year);

  const rows = useMemo(() => months.map((month) => {
    const w2 = streams.filter((s) => s.type === 'w2')
      .reduce((sum, s) => sum + countableFor(s, month), 0);
    const se = streams.filter((s) => s.type === 'ten99')
      .reduce((sum, s) => sum + countableFor(s, month), 0);
    return { month, w2, se, total: w2 + se };
  }), [streams, months]);

  const ceiling = Math.max(rules.sga, ...rows.map((r) => r.total)) * 1.25;
  const sgaPct = Math.min(100, (rules.sga / ceiling) * 100);
  const twpPct = Math.min(100, (rules.trialWork / ceiling) * 100);

  const railRef = useRef<HTMLDivElement>(null);
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);

  function onMove(e: MouseEvent<HTMLDivElement>) {
    const rect = railRef.current?.getBoundingClientRect();
    if (!rect || rect.width === 0) return;
    const fraction = (e.clientX - rect.left) / rect.width;
    const index = Math.min(rows.length - 1, Math.max(0, Math.floor(fraction * rows.length)));
    setHoverIndex(index);
  }

  const hovered = hoverIndex !== null ? rows[hoverIndex] : null;
  const hoverLeftPct = hoverIndex !== null ? ((hoverIndex + 0.5) / rows.length) * 100 : 0;
  const tooltipRight = hoverIndex !== null && hoverIndex >= rows.length - 3;

  return (
    <div className="border-t px-3 pt-4 pb-2 sm:px-5 lg-label-border">
      <div className="mb-3 flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <span className="lg-label">{year} Countable Income by Month</span>
        <span className="ml-auto flex flex-wrap items-center gap-x-3 gap-y-1 text-[0.8125rem] lg-text-muted">
          <span className="inline-flex items-center gap-1.5">
            <span className="lg-swatch lg-swatch-w2" /> W2
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="lg-swatch lg-swatch-se" /> Self-Emp
          </span>
          <span>ceiling {money0(ceiling)}</span>
        </span>
      </div>

      <div
        ref={railRef}
        className="lg-chart-rail h-40 sm:h-52 lg-label-border"
        onMouseMove={onMove}
        onMouseLeave={() => setHoverIndex(null)}
      >
        {hovered ? (
          <>
            <div
              className="pointer-events-none absolute inset-y-0"
              style={{ left: hoverLeftPct + '%', width: '1px', background: 'var(--lg-border)' }}
            />
            <div
              className="pointer-events-none absolute top-1 z-10 flex flex-col gap-0.5 p-2 lg-tooltip-panel"
              style={{
                left: hoverLeftPct + '%',
                transform: tooltipRight ? 'translateX(calc(-100% - 8px))' : 'translateX(8px)',
              }}
            >
              <span className="text-[0.625rem] font-semibold uppercase tracking-wider lg-text-muted">
                {shortMonthName(hovered.month)} {year}
              </span>
              <span className="text-base font-semibold">{money2(hovered.total)}</span>
              <span className="text-[0.625rem] lg-text-muted">
                {hovered.total > 0 ? `W2 ${money0(hovered.w2)} · SE ${money0(hovered.se)}` : 'No income'}
              </span>
            </div>
          </>
        ) : null}
        <div className="lg-chart-threshold" style={{ bottom: sgaPct + '%', color: 'var(--lg-over)' }} />
        <span
          className="absolute right-0.5 px-1 text-[0.5625rem] font-medium uppercase leading-tight tracking-wider lg-text-over lg-bg-surface"
          style={{ bottom: sgaPct + '%' }}
        >
          SGA {money0(rules.sga)}
        </span>
        <div className="lg-chart-threshold" style={{ bottom: twpPct + '%', color: 'var(--lg-warn)' }} />
        <span
          className="absolute right-0.5 px-1 text-[0.5625rem] font-medium uppercase leading-tight tracking-wider lg-text-warn lg-bg-surface"
          style={{ bottom: twpPct + '%' }}
        >
          TWP {money0(rules.trialWork)}
        </span>

        <div className="lg-chart-bars">
          {rows.map((row) => {
            const w2Pct = Math.min(100, (row.w2 / ceiling) * 100);
            const sePct = Math.min(100, (row.se / ceiling) * 100);
            return (
              <div
                key={row.month}
                className="lg-chart-col"
                title={`${shortMonthName(row.month)} ${year} — ${money0(row.total)} countable`}
              >
                <div
                  className="lg-chart-bar-w2"
                  style={{ height: w2Pct + '%', minHeight: row.w2 > 0 ? '2px' : 0 }}
                />
                <div
                  className="lg-chart-bar-se"
                  style={{ height: sePct + '%', minHeight: row.se > 0 ? '2px' : 0 }}
                />
              </div>
            );
          })}
        </div>
      </div>

      <div className="mt-2 flex gap-[3px] sm:gap-[7px]">
        {months.map((month) => (
          <div key={month} className="flex-1 text-center text-[0.8125rem] font-semibold uppercase tracking-wide lg-text-muted">
            {shortMonthName(month)}
          </div>
        ))}
      </div>
    </div>
  );
}
