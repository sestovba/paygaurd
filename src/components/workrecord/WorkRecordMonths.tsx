// Countable by month, across every stream — the Months slab's whole content.
//
// Ported from sga_calc20's TotalsByMonth. The rule it exists to enforce is
// kept: a fill says what happened, and proximity to a limit is a small figure
// underneath, never a fill of its own. A month that nearly crossed a line must
// not look like one that did.

import type { MonthKey } from '../../domain/types';
import { useTracker } from '../../state/TrackerProvider';
import { money } from '../../domain/format';
import { displayMonths, formatMonth, shortMonthName, todayMonth } from '../../domain/months';
import { monthStatus, nearLimit, yearTotal } from '../../domain/earnings';
import { extraPaycheckLabel, extraPaycheckMonths } from '../../domain/paySchedule';
import { rulesFor } from '../../domain/rules';
import { benefitPhase } from '../../domain/trialWork';
import { ReviewTarget } from '../../review/ReviewTarget';

type Fill = 'empty' | 'keep' | 'spent' | 'over' | 'unknown';

export function WorkRecordMonths({
  hovered, onHover, onOpenMonth
}: {
  hovered: MonthKey | null;
  onHover: (month: MonthKey | null) => void;
  onOpenMonth: (month: MonthKey) => void;
}) {
  const { data, ui } = useTracker();
  const now = todayMonth();
  const rules = rulesFor(ui.year);
  const phase = benefitPhase(data, `${ui.year}-12`);
  const months = displayMonths(ui.year, ui.hideFuture);
  const extraPay = extraPaycheckMonths(data.streams, ui.year);

  const limitLabel = phase === 'trialWork'
    ? `TWP month ${money(rules.trialWork)}`
    : phase === 'sga'
      ? `SGA ${money(rules.sga)}`
      : 'Confirm TWP status before relying on a limit';

  return (
    <div className="pg-card overflow-hidden">
      <header className="pg-section-head">
        <span className="flex min-w-0 flex-1 items-center gap-2">
          <span className="pg-section-title">Countable by month</span>
          <span className="pg-section-meta hidden truncate xs:block">{limitLabel}</span>
        </span>
      </header>

      {months.length ? (
        <div className="pg-month-grid">
          {months.map((month) => {
            const status = monthStatus(data, month);
            const monthPhase = benefitPhase(data, month);
            const empty = status.countable === 0;

            let fill: Fill = 'keep';
            if (empty) fill = 'empty';
            else if (monthPhase === 'sga' && status.overSga) fill = 'over';
            else if (monthPhase === 'trialWork' && status.isServiceMonth) fill = 'spent';
            else if (monthPhase === 'unknown' || monthPhase === 'verifyComplete') fill = 'unknown';

            // The gap to the next line you would cross, when it is close.
            const near = nearLimit(status, monthPhase);
            const extra = extraPay.get(month);
            const extraText = extra ? extraPaycheckLabel(extra.counts) : null;

            const note = near
              ? { kind: near.kind, text: money(near.room) + (near.kind === 'trial' ? ' to TWP' : ' to SGA') }
              : extraText
                ? { kind: 'pay' as const, text: extraText }
                : null;

            return (
              <button
                key={month}
                type="button"
                className="wr-month-cell"
                data-fill={fill}
                data-now={month === now}
                data-hover={hovered === month}
                aria-label={note
                  ? `Enter ${formatMonth(month)}, ${note.text}`
                  : `Enter ${formatMonth(month)}`}
                onMouseEnter={() => onHover(month)}
                onMouseLeave={() => onHover(null)}
                onFocus={() => onHover(month)}
                onBlur={() => onHover(null)}
                onClick={() => onOpenMonth(month)}
              >
                <span className="wr-month-label">{shortMonthName(month)}</span>
                <span className="wr-month-value">{empty ? '—' : money(status.countable)}</span>
                {note ? <span className="wr-month-note" data-kind={note.kind}>{note.text}</span> : null}
              </button>
            );
          })}
        </div>
      ) : (
        <div className="pg-empty">
          <span className="pg-empty-title">Nothing to show for {ui.year} yet</span>
          <span className="pg-empty-body">Turn off “Hide future” to enter months ahead of time.</span>
        </div>
      )}

      <div className="wr-legend">
        {phase === 'trialWork' ? (
          <>
            <span className="wr-legend-item">
              <span className="wr-legend-swatch" data-fill="keep" />TWP month preserved
            </span>
            <span className="wr-legend-item">
              <span className="wr-legend-swatch" data-fill="spent" />one TWP month used
            </span>
          </>
        ) : phase === 'sga' ? (
          <>
            <span className="wr-legend-item">
              <span className="wr-legend-swatch" data-fill="keep" />under SGA
            </span>
            <span className="wr-legend-item">
              <span className="wr-legend-swatch" data-fill="over" />over SGA
            </span>
          </>
        ) : (
          <span className="wr-legend-item">Limits paused until TWP status is confirmed</span>
        )}

        <span className="flex-1" />

        <ReviewTarget
          id="workrecord-months-year-total"
          label="Monthly-history year total"
          reason="The total repeats the headline and can hide a single risky TWP or SGA month."
          layout="workrecord"
        >
          <span className="wr-legend-item">
            {ui.year} total
            <span className="pg-figure pg-figure-sm">{money(yearTotal(data, ui.year))}</span>
          </span>
        </ReviewTarget>
      </div>
    </div>
  );
}
