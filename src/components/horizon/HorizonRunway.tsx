import { ButtonBase } from '../../design-system';
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
// to right, and the pace warning — "at this pace you cross the limit in
// November" — is a mark on that track rather than a sentence in a sheet
// nobody opens.
//
// Only the months ahead are drawn. What already happened is in the table
// below; a runway that starts in January is a history, and the product's
// question is not what happened.

import { AlertTriangle, Zap } from 'lucide-react';
import { useMonthScope, useTracker } from '../../state/TrackerProvider';
import { money } from '../../domain/format';
import { formatMonth, scopedMonths, shortMonthName, todayMonth } from '../../domain/months';
import { MONTH_SCOPE_LABEL } from '../MonthScopePicker';
import { monthStatus, nearLimit } from '../../domain/earnings';
import { extraPaycheckMonths } from '../../domain/paySchedule';
import { activeThreshold, benefitPhase } from '../../domain/trialWork';
import type { MonthKey } from '../../domain/types';

type Fill = 'over' | 'used' | 'near' | 'clear' | 'empty';

const FILL_MEANING: Record<Fill, string> = {
  over: 'over your limit',
  used: 'uses a trial work month',
  near: 'close to your limit',
  clear: 'under your limit',
  empty: 'nothing recorded yet'
};

/* The legend, in reading order. `over` and `used` are the two regimes and
 * they are mutually exclusive — a month is judged against one limit or the
 * other, never both — so listing them together taught the reader a rule the
 * app has decided never to explain. It is built from the fills actually on
 * the track instead, which makes that impossible by construction. */
const KEY_ORDER: ReadonlyArray<{ fill: Fill; label: string }> = [
  /* Each entry finishes its own sentence. "Close" and "Under" were
     comparatives with the thing compared to left out, on the key whose whole
     job is explaining the colours. */
  { fill: 'over', label: 'Over' },
  { fill: 'used', label: 'Trial month' },
  { fill: 'near', label: 'Near' },
  { fill: 'clear', label: 'Under' }
];

export function HorizonRunway({ onOpenMonth }: { onOpenMonth?: (month: MonthKey) => void }) {
  const { data, ui } = useTracker();
  const { scope } = useMonthScope('many');
  const now = todayMonth();

  /* The runway is the months you have left, so it looks forward whatever
     else is on screen — "up to this month" and "all year" both mean the
     runway ahead here, because a runway behind you is not one. The one
     scope it does obey is "This month": the reader asked for one month. */
  const months = scopedMonths(ui.year, scope === 'month' ? 'month' : 'ahead');
  const extraPay = extraPaycheckMonths(data.streams, ui.year);

  // Where the year is heading, said as a month rather than a rate. The first
  // month ahead that crosses the line is the whole content of a pace warning
  // — "you cross the limit in November" is actionable; "trending 8% over"
  // is not.
  const crossing = months.find((month) => {
    const phase = benefitPhase(data, month);
    const status = monthStatus(data, month);
    return (phase === 'sga' && status.overSga) || (phase === 'trialWork' && status.isServiceMonth);
  });

  if (!months.length) return null;

  /* Worked out before anything is drawn, because the legend below is built
     from what actually ended up on the track. */
  const stops = months.map((month) => {
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

    return { month, fill, extra, room };
  });

  const onTrack = new Set(stops.map((stop) => stop.fill));
  const key = KEY_ORDER.filter((entry) => onTrack.has(entry.fill));

  const runwayTitle = scope === 'month'
    ? MONTH_SCOPE_LABEL.month
    : `The rest of ${ui.year}`;

  return (
    <section className="hz-runway" aria-label={runwayTitle}>
      <header className="hz-runway-head">
        <h2 className="hz-label">{runwayTitle}</h2>
        {crossing ? (
          <p className="hz-runway-lede" data-tone="warn">
            <AlertTriangle className="size-3.5 shrink-0" aria-hidden="true" />
            If you keep earning this much, you go over your limit in {formatMonth(crossing).split(' ')[0]}.
          </p>
        ) : (
          <p className="hz-runway-lede">Nothing you have entered takes you over your limit this year.</p>
        )}
      </header>

      <ol className="hz-track">
        {stops.map(({ month, fill, extra, room }) => (
          <li key={month} className="hz-stop" data-fill={fill} data-now={month === now || undefined}>
            <ButtonBase
              type="button"
              className="hz-stop-btn"
              onClick={onOpenMonth ? () => onOpenMonth(month) : undefined}
              aria-label={
                `${formatMonth(month)}: ${FILL_MEANING[fill]}`
                + (month === now ? ', current month' : '')
                + (extra ? `, ${extra.counts.join(' or ')} paychecks` : '')
                + (room != null && room > 0 ? `, ${money(room)} left before your limit` : '')
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
                {/* Inside a track of months, under a heading that names the
                     limit — so "left" and "over" have their subject from the
                     surface rather than repeating it twelve times. */}
                {room == null ? '—'
                  : room > 0 ? `${money(room)} left`
                    : `${money(Math.abs(room))} over`}
              </span>
            </ButtonBase>
          </li>
        ))}
      </ol>

      {/* The key is spelled out rather than left to colour alone: four fills
          on a strip is exactly the point where a legend stops being clutter
          and starts being the only way to read it. Only the fills that are
          actually on the track get a line — a key entry for a state nothing
          is in is a rule being taught for no reason. */}
      {key.length ? (
        <ul className="hz-key" aria-hidden="true">
          {key.map(({ fill, label }) => <li key={fill} data-fill={fill}>{label}</li>)}
        </ul>
      ) : null}
    </section>
  );
}
