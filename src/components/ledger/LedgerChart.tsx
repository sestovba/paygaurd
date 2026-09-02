import { useMemo, useRef, useState } from 'react';
import type { MouseEvent } from 'react';
import { countableFor } from '../../domain/earnings';
import { monthsOfYear, shortMonthName } from '../../domain/months';
import { rulesFor } from '../../domain/rules';
import { extraPaycheckMonths } from '../../domain/paySchedule';
import type { Stream } from '../../domain/types';
import { money0, money2 } from './ledgerFormat';

/**
 * Self-employment as the base layer, W-2 stacked on top of it — so the
 * steady, evenly-spread 1099 income reads as a floor, and the real,
 * lumpy paycheck timing shows as what rides on top of it each month.
 *
 * This chart was proposed for cutting — "twelve bars against two threshold
 * lines; the monthly analysis below states the same thing in words" — and the
 * answer was to use my judgement. The criticism was fair about what the chart
 * was, not about whether a chart belongs here: a picture of income really does
 * lose to a table of income. So it earns its place the same way payguard's
 * does, and for the same stated reasons: the limit is the subject rather
 * than annotation, a bar that crosses it is capped in that limit's colour,
 * and the months an extra paycheck lands in are stamped on the axis.
 *
 * One rule is drawn, not two. Which one depends on where you stand — see the
 * `limit` prop, and the one-limit rule in domain/copy.ts.
 * Those last two are things the table below genuinely cannot show — a shape
 * you take in at a glance, and a warning about months that have not happened.
 */
export function LedgerChart({
  streams, year, limit
}: {
  streams: Stream[];
  year: number;
  /** The limit in force, or null while the app has not been told. */
  limit: { kind: 'trialWork' | 'sga'; amount: number } | null;
}) {
  const rules = rulesFor(year);
  const months = monthsOfYear(year);
  const extraPay = useMemo(() => extraPaycheckMonths(streams, year), [streams, year]);

  const rows = useMemo(() => months.map((month) => {
    const w2 = streams.filter((s) => s.type === 'w2')
      .reduce((sum, s) => sum + countableFor(s, month), 0);
    const se = streams.filter((s) => s.type === 'ten99')
      .reduce((sum, s) => sum + countableFor(s, month), 0);
    return { month, w2, se, total: w2 + se };
  }), [streams, months]);

  const ceiling = Math.max(limit?.amount ?? rules.sga, ...rows.map((r) => r.total)) * 1.25;
  const limitPct = limit ? Math.min(100, (limit.amount / ceiling) * 100) : null;

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
        <span className="lg-label">What counted toward your limit, month by month</span>
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
                {/* "W2 $900 · SE $300" — two abbreviations, one of which
                    ("SE") appears nowhere else in the product. */}
                {hovered.total > 0 ? `Employer ${money0(hovered.w2)} · Gig work ${money0(hovered.se)}` : 'No income'}
              </span>
            </div>
          </>
        ) : null}
        {/* One line, labelled in words rather than an abbreviation. It used
            to draw both — "SGA $1,690" above "TWP $1,210" — which is the app
            teaching a rule it has decided not to explain, in the two loudest
            annotations on the chart. */}
        {limitPct != null ? (
          <>
            <div className="lg-chart-over-band" style={{ bottom: limitPct + '%' }} aria-hidden="true" />
            <div className="lg-chart-threshold" style={{ bottom: limitPct + '%', color: 'var(--lg-over)' }} />
            <span
              className="absolute right-0.5 px-1 text-[0.5625rem] font-medium uppercase leading-tight tracking-wider lg-text-over lg-bg-surface"
              style={{ bottom: limitPct + '%' }}
            >
              Your limit {money0(limit!.amount)}
            </span>
          </>
        ) : null}

        <div className="lg-chart-bars">
          {rows.map((row) => {
            const w2Pct = Math.min(100, (row.w2 / ceiling) * 100);
            const sePct = Math.min(100, (row.se / ceiling) * 100);
            const breach = limit && row.total > limit.amount ? 'over' : undefined;
            const extra = extraPay.get(row.month);
            return (
              <div
                key={row.month}
                className="lg-chart-col"
                data-breach={breach}
                title={
                  `${shortMonthName(row.month)} ${year} — ${money0(row.total)} countable`
                  + (breach ? ' · over your limit' : '')
                  + (extra ? ` · ${extra.counts.join(' or ')} paychecks` : '')
                }
              >
                <div
                  className="lg-chart-bar-w2"
                  style={{ height: w2Pct + '%', minHeight: row.w2 > 0 ? '2px' : 0 }}
                />
                <div
                  className="lg-chart-bar-se"
                  style={{ height: sePct + '%', minHeight: row.se > 0 ? '2px' : 0 }}
                />
                {breach ? (
                  <span
                    className="lg-chart-cap"
                    style={{ bottom: `calc(${Math.min(100, w2Pct + sePct)}% - 3px)` }}
                    aria-hidden="true"
                  />
                ) : null}
              </div>
            );
          })}
        </div>
      </div>

      <div className="mt-2 flex gap-[3px] sm:gap-[7px]">
        {months.map((month) => {
          const extra = extraPay.get(month);
          return (
            <div key={month} className="flex flex-1 flex-col items-center text-[0.8125rem] font-semibold uppercase tracking-wide lg-text-muted">
              <span className={extra ? 'lg-text-warn' : undefined}>{shortMonthName(month)}</span>
              {extra ? (
                <span className="lg-axis-pay" title={`${extra.counts.join(' or ')} paychecks`}>
                  {extra.counts.join('/')}&times;
                </span>
              ) : null}
            </div>
          );
        })}
      </div>
      {extraPay.size > 0 ? (
        <p className="mt-1.5 text-[0.6875rem] lg-text-muted">
          <span className="lg-axis-pay align-middle">3&times;</span>
          <span className="ml-1.5 align-middle">months your pay schedule lands an extra paycheck in.</span>
        </p>
      ) : null}
    </div>
  );
}
