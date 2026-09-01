// The runway: the months you have left, and what is waiting in them.
//
// This is the one surface in the layout that does not exist anywhere else.
// Today the same forward-looking facts are scattered across four separate
// components, and one of them is not shown at all:
//
//   MonthGrid        the twelve months, coloured by state
//   PaycheckRadar    which months carry a third or fifth paycheck
//   the hotbar       the months that need you, as chips
//   paceWarning()    computed, and surfaced only inside a source editor
//
// A reviewer reading four surfaces has to hold four things in their head to
// answer one question: what is coming. So they are one track here, read left
// to right, and the pace warning — "at this pace you cross SGA in November" —
// is a mark on that track rather than a sentence in a sheet nobody opens.
//
// Only the months ahead are drawn. What already happened is in the table
// below; a runway that starts in January is a history, and the product's
// question is not what happened.

import { AlertTriangle, Zap } from 'lucide-react';
import { useTracker } from '../../state/TrackerProvider';
import { money } from '../../domain/format';
import { formatMonth, monthsOfYear, shortMonthName, todayMonth, yearOf } from '../../domain/months';
import { monthStatus, nearLimit } from '../../domain/earnings';
import { extraPaycheckMonths } from '../../domain/paySchedule';
import { activeThreshold, benefitPhase } from '../../domain/trialWork';
import type { MonthKey } from '../../domain/types';

type Fill = 'over' | 'used' | 'near' | 'clear' | 'empty';

const FILL_MEANING: Record<Fill, string> = {
  over: 'at or over SGA',
  used: 'uses a trial work month',
  near: 'close to the limit',
  clear: 'under the limit',
  empty: 'nothing recorded yet'
};

export function HorizonRunway({ onOpenMonth }: { onOpenMonth?: (month: MonthKey) => void }) {
  const { data, ui } = useTracker();
  const now = todayMonth();
  const thisYear = yearOf(now) === ui.year;

  const months = monthsOfYear(ui.year).filter((m) => !thisYear || m >= now);
  const extraPay = extraPaycheckMonths(data.streams, ui.year);

  // Where the year is heading, said as a month rather than a rate. The first
  // month ahead that crosses the line is the whole content of a pace warning
  // — "you cross SGA in November" is actionable; "trending 8% over" is not.
  const crossing = months.find((month) => {
    const phase = benefitPhase(data, month);
    const status = monthStatus(data, month);
    return (phase === 'sga' && status.overSga) || (phase === 'trialWork' && status.isServiceMonth);
  });

  if (!months.length) return null;

  return (
    <section className="hz-runway" aria-label={`The rest of ${ui.year}`}>
      <header className="hz-runway-head">
        <h2 className="hz-label">The rest of {ui.year}</h2>
        {crossing ? (
          <p className="hz-runway-lede" data-tone="warn">
            <AlertTriangle className="size-3.5 shrink-0" aria-hidden="true" />
            At this pace you cross the limit in {formatMonth(crossing).split(' ')[0]}.
          </p>
        ) : (
          <p className="hz-runway-lede">Nothing ahead crosses a limit on what you have entered.</p>
        )}
      </header>

      <ol className="hz-track">
        {months.map((month) => {
          const status = monthStatus(data, month);
          const phase = benefitPhase(data, month);
          const near = nearLimit(status, phase);
          const extra = extraPay.get(month);
          const limit = activeThreshold(data, month);

          /* No confirmed phase means no limit, and no limit means there is
             nothing to be under. Reading 'clear' here would paint the whole
             runway green for someone whose status the app has never been
             told — safe-looking by construction, which is the exact failure
             the review caught in the averages elsewhere. */
          const fill: Fill = !limit ? 'empty'
            : phase === 'sga' && status.overSga ? 'over'
              : phase === 'trialWork' && status.isServiceMonth ? 'used'
                : near ? 'near'
                  : status.countable === 0 ? 'empty' : 'clear';

          // The number that answers "how much room is left", not "how much
          // have I earned" — the second is a total, and no limit is annual.
          const room = limit?.amount != null ? limit.amount - status.countable : null;

          return (
            <li key={month} className="hz-stop" data-fill={fill} data-now={month === now || undefined}>
              <button
                type="button"
                className="hz-stop-btn"
                onClick={onOpenMonth ? () => onOpenMonth(month) : undefined}
                aria-label={
                  `${formatMonth(month)}: ${FILL_MEANING[fill]}`
                  + (extra ? `, ${extra.counts.join(' or ')} paychecks` : '')
                  + (room != null && room > 0 ? `, ${money(room)} of room left` : '')
                }
              >
                <span className="hz-stop-month">{shortMonthName(month).toUpperCase()}</span>

                {/* The paycheck count is the fact that catches people out, so
                    it is the loudest thing on a stop that has one. */}
                {extra ? (
                  <span className="hz-stop-checks">
                    <Zap className="size-3" aria-hidden="true" />{extra.counts.join('/')}
                  </span>
                ) : null}

                <span className="hz-stop-room">
                  {room == null ? '—'
                    : room > 0 ? `${money(room)} left`
                      : `${money(Math.abs(room))} over`}
                </span>
              </button>
            </li>
          );
        })}
      </ol>

      {/* The key is spelled out rather than left to colour alone: four fills
          on a strip is exactly the point where a legend stops being clutter
          and starts being the only way to read it. */}
      <ul className="hz-key" aria-hidden="true">
        <li data-fill="over">At or over SGA</li>
        <li data-fill="used">Trial work month</li>
        <li data-fill="near">Close</li>
        <li data-fill="clear">Under</li>
      </ul>
    </section>
  );
}
