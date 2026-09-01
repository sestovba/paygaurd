// Months, as squares. Mobile's version of the totals grid.

import type { MonthKey } from '../../domain/types';
import { useTracker } from './state';
import { money } from '../../domain/format';
import { displayMonths, formatMonth, shortMonthName, todayMonth } from '../../domain/months';
import { monthStatus, nearLimit } from '../../domain/earnings';
import { extraPaycheckLabel, extraPaycheckMonths } from '../../domain/paySchedule';
import { benefitPhase } from '../../domain/trialWork';

export function MonthSquares({ onOpenMonth }: { onOpenMonth: (month: MonthKey) => void }) {
  const { data, ui } = useTracker();
  const now = todayMonth();
  const phase = benefitPhase(data, `${ui.year}-12`);
  const extraPay = extraPaycheckMonths(data.streams, ui.year);

  return (
    <div className="month-squares">
      {displayMonths(ui.year, ui.hideFuture).map((month) => {
        const status = monthStatus(data, month);
        const empty = status.countable === 0;
        const extra = extraPay.get(month);
        const extraText = extra ? extraPaycheckLabel(extra.counts) : null;

        const nearHit = nearLimit(status, phase);
        const near = nearHit
          ? { text: money(nearHit.room) + (nearHit.kind === 'trial' ? ' to TWP' : ' to SGA'), kind: nearHit.kind }
          : null;

        let cls = 'month-square';
        if (empty) cls += ' month-square--empty';
        else if (phase === 'sga' && status.overSga) cls += ' month-square--over';
        else if (phase === 'trialWork' && status.isServiceMonth) cls += ' month-square--spent';
        else if (phase === 'unknown' || phase === 'verifyComplete') cls += ' month-square--unknown';
        else cls += ' month-square--keep';
        if (month === now) cls += ' month-square--now';

        return (
          <button
            className={cls}
            key={month}
            type="button"
            aria-label={
              near
                ? 'Enter ' + formatMonth(month) + ', ' + near.text
                : extraText
                  ? 'Enter ' + formatMonth(month) + ', ' + extraText
                  : 'Enter ' + formatMonth(month)
            }
            onClick={() => onOpenMonth(month)}
          >
            <span className="month-square__label">{shortMonthName(month).toUpperCase()}</span>
            <span className="month-square__value">{empty ? '—' : money(status.countable)}</span>
            {/* One badge line only — a square tile has no room for both,
              * and a near-limit warning is the more urgent of the two. */}
            {near ? (
              <span className={'month-square__near near--' + near.kind}>{near.text}</span>
            ) : extraText ? (
              <span className="month-square__pay">{extraText}</span>
            ) : null}
          </button>
        );
      })}
    </div>
  );
}
