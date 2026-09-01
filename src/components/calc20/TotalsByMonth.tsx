// Countable by month, across every stream.
//
// This is what "combined by month" was reaching for. It does not need to be
// a separate section: hovering a month here lights the same month in every
// stream grid above, because the grid already knows.
//
// Fills say what happened. Proximity is a small figure, never a fill — a
// month that nearly crossed must not look like one that did.

import type { MonthKey } from '../../domain/types';
import { useTracker } from './state';
import { layoutFor } from './state';
import { money } from '../../domain/format';
import { formatMonth, listedMonths, shortMonthName, todayMonth } from '../../domain/months';
import { monthStatus, nearLimit, yearTotal } from '../../domain/earnings';
import { extraPaycheckLabel, extraPaycheckMonths } from '../../domain/paySchedule';
import { rulesFor } from '../../domain/rules';
import { benefitPhase } from '../../domain/trialWork';
import { gridColumns } from './gridColumns';
import { useViewportBand } from './useIsWide';

export function TotalsByMonth({
  hovered,
  onHover,
  onOpenMonth
}: {
  hovered: MonthKey | null;
  onHover: (month: MonthKey | null) => void;
  onOpenMonth: (month: MonthKey) => void;
}) {
  const { data, ui } = useTracker();
  const prefs = layoutFor(ui, useViewportBand());
  const now = todayMonth();
  const rules = rulesFor(ui.year);
  const phase = benefitPhase(data, `${ui.year}-12`);

  const months = listedMonths(ui.year, ui.hideFuture, ui.focusMode);
  const extraPay = extraPaycheckMonths(data.streams, ui.year);

  return (
    <div className="totals-card">
      <div className="totals-card__head">
        <span className="totals-card__title">Countable by month</span>
        <span className="stream-card__meta">
          {/* One limit, never named as a rule — the same wording every other
              layout uses for this row. */}
          {phase === 'trialWork'
            ? `Your limit ${money(rules.trialWork)}`
            : phase === 'sga'
              ? `Your limit ${money(rules.sga)}`
              : 'No limit yet — tell us where you stand'}
        </span>
      </div>

      <div
        className="month-grid"
        style={{ gridTemplateColumns: gridColumns(
          { ...ui, density: prefs.density, monthColumnsAuto: prefs.monthColumnsAuto },
          false
        ) }}
      >
        {months.map((month) => {
          const status = monthStatus(data, month);
          const empty = status.countable === 0;

          let cls = 'total-cell';
          if (empty) cls += ' total-cell--empty';
          else if (phase === 'sga' && status.overSga) cls += ' total-cell--over';
          else if (phase === 'trialWork' && status.isServiceMonth) cls += ' total-cell--spent';
          else if (phase === 'unknown' || phase === 'verifyComplete') cls += ' total-cell--unknown';
          else cls += ' total-cell--keep';
          if (month === now) cls += ' total-cell--now';
          if (hovered === month) cls += ' total-cell--hover';

          // The gap to the next line you would cross, when it is close.
          const nearHit = nearLimit(status, phase);
          const near = nearHit
            ? { text: `${money(nearHit.room)} to your limit`, kind: nearHit.kind }
            : null;

          const extra = extraPay.get(month);
          const extraText = extra ? extraPaycheckLabel(extra.counts) : null;

          return (
            <button
              className={cls}
              key={month}
              type="button"
              aria-label={
                extraText
                  ? 'Enter ' + formatMonth(month) + ', ' + extraText
                  : 'Enter ' + formatMonth(month)
              }
              onMouseEnter={() => onHover(month)}
              onMouseLeave={() => onHover(null)}
              onClick={() => onOpenMonth(month)}
            >
              <span className="total-cell__label">{shortMonthName(month)}</span>
              <span className="total-cell__value">{empty ? '—' : money(status.countable)}</span>
              {extraText ? <span className="total-cell__pay">{extraText}</span> : null}
              {near ? (
                <span className={'total-cell__near near--' + near.kind}>{near.text}</span>
              ) : null}
            </button>
          );
        })}
      </div>

      <div className="legend">
        {phase === 'trialWork' ? (
          <>
            <span className="legend__item"><span className="legend__swatch legend__swatch--keep" />trial work month kept</span>
            <span className="legend__item"><span className="legend__swatch legend__swatch--spent" />one trial work month used</span>
          </>
        ) : phase === 'sga' ? (
          <>
            <span className="legend__item"><span className="legend__swatch legend__swatch--keep" />under your limit</span>
            <span className="legend__item"><span className="legend__swatch legend__swatch--over" />over your limit</span>
          </>
        ) : (
          <span className="legend__item">No limit is shown until you tell us where you stand</span>
        )}
        <span className="grow" />
        <span className="legend__item">
          <span className="stream-card__meta">{ui.year} total</span>
          <span className="stream-card__total">{money(yearTotal(data, ui.year))}</span>
        </span>
      </div>
    </div>
  );
}
