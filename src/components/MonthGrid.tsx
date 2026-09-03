import { Zap } from 'lucide-react';
import { Chip } from './ui';
import { useMonthScope, useTracker } from '../state/TrackerProvider';
import { money } from '../domain/format';
import { formatMonth, longMonthName, shortMonthName, todayMonth, yearOf } from '../domain/months';
import { MonthScopePicker } from './MonthScopePicker';
import type { MonthScope } from '../domain/months';
import { monthStatus, nearLimit } from '../domain/earnings';
import { extraPaycheckLabel, extraPaycheckMonths, payPlan } from '../domain/paySchedule';
import { benefitPhase } from '../domain/trialWork';
import type { BenefitPhase } from '../domain/trialWork';
import type { MonthKey, MonthStatus } from '../domain/types';

/**
 * Which of the three states a month is in, in words.
 *
 * Review note: "It would be the strongest surface in the product if each cell
 * said which of the three states it is in — under TWP, TWP month used, at or
 * over SGA."
 *
 * It was saying it in colour only: a red tile, an amber tile, a plain tile.
 * Colour alone is a legend the reader has to have been taught, and it is the
 * one channel that fails for a colour-blind reader and in a screenshot. The
 * tint stays — it is a fast second reading — but the words are what the cell
 * actually says now.
 *
 * The three states are the ones asked for; the initials are not. A later note
 * — "I cant follow that title, its jargon and abbreviations" — applies here
 * too, and under the one-limit rule the reader is only ever inside one of the
 * two regimes, so "your limit" is unambiguous and TWP/SGA buy nothing.
 */
function stateLabel(status: MonthStatus, phase: BenefitPhase): string | null {
  if (phase === 'unknown' || phase === 'verifyComplete') {
    return status.countable > 0 || status.isServiceMonth ? 'Status not set' : null;
  }
  if (phase === 'trialWork') {
    if (status.isServiceMonth) return 'Trial work month used';
    return status.countable > 0 ? 'Under your limit' : null;
  }
  if (status.overSga) return 'Over your limit';
  return status.countable > 0 ? 'Under your limit' : null;
}

export function MonthGrid({ onOpenMonth }: { onOpenMonth: (month: MonthKey) => void }) {
  const { data, ui } = useTracker();
  const { scope, months: listed, setScope } = useMonthScope('many');
  const now = todayMonth();
  const extraPay = extraPaycheckMonths(data.streams, ui.year);

  /* Review note: "maybe hide the calendar and have something else made
     instead of converting it to what its not meant to do."
     Focus mode was rendering this calendar with eleven twelfths of it
     filtered away — a grid of one cell, under a heading about a year, beside
     a switch for hiding months there are none of. A calendar with one date on
     it is not a smaller calendar, it is the wrong drawing.
     So focus mode gets its own component instead of a filtered version of
     this one. What it shows is the half of the month the hero does not: the
     hero answers "am I safe", and this answers "what actually lands in this
     month" — the paydays, on the days they fall. */
  if (scope === 'month') {
    return (
      <MonthUpClose
        month={listed[0]}
        onOpenMonth={onOpenMonth}
        scope={scope}
        onScopeChange={setScope}
      />
    );
  }

  /* Hide future is on by default, which meant a 3- or 5-paycheck month was
     only ever badged once it had already arrived — the review note's "before
     they happen rather than after". The months an extra check lands in are
     the one thing about the future this app can state as fact, so they stay
     in the grid whatever Hide future says, and they lead it: what is coming,
     then what has happened. */
  const upcoming = [...extraPay.keys()].filter((m) => m > now && !listed.includes(m)).sort();
  const months = [...upcoming, ...listed];

  return (
    <section className="panel p-5 sm:p-6 xl:col-span-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        {/* "Every month this year" was true when the only alternative was
            all twelve or one. With four positions beside it, the heading is
            the noun and the dropdown is the qualifier — one idea each. */}
        <h2 className="text-lg font-semibold">Months</h2>
        {/* "Hide future" was a two-position switch on a four-position
            question. Same axis, all of it: one month, the months behind you,
            the months ahead, or the whole year. */}
        <MonthScopePicker
          scope={scope}
          onChange={setScope}
          className="flex items-center justify-between gap-3 text-base text-muted-foreground sm:justify-end"
          selectClassName="field-input w-48"
        />
      </div>

      {upcoming.length ? (
        <p className="type-muted mt-2 text-base">
          Months ahead that pay you an extra time stay listed either way — they are the ones
          worth planning around.
        </p>
      ) : null}

      <div className="mt-4 grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-4">
        {months.map((month) => {
          const status = monthStatus(data, month);
          const empty = status.countable === 0;
          const extra = extraPay.get(month);
          // The phase is resolved per month, not once for December. A Trial
          // Work Period that runs out in June means July is judged against
          // SGA, and one phase for the whole year gets every month before the
          // changeover wrong. Same rule as src/domain/attention.ts.
          const phase = benefitPhase(data, month);
          const near = nearLimit(status, phase);
          const isNow = month === now;
          const isAhead = month > now;
          const state = stateLabel(status, phase);

          const over = phase === 'sga' && status.overSga;
          const spent = phase === 'trialWork' && status.isServiceMonth;

          const valueColor = over ? 'text-destructive' : spent ? 'text-warn' : empty ? 'text-muted-foreground/50' : 'text-foreground';
          // isNow only adds a ring, never overrides the semantic tint below —
          // otherwise today's tile could clash with its own extra-paycheck badge.
          const tileClass = (
            over
              ? 'border-destructive/30 bg-destructive/10'
              : spent
                ? 'border-warn/30 bg-warn-soft/60'
                : extra
                  ? 'border-info/40 bg-info-soft/40'
                  : isNow
                    ? 'border-primary/30 bg-accent/60'
                    : 'border-border bg-surface-2'
          ) + (isNow ? ' ring-1 ring-primary/15' : '');

          return (
            <button
              key={month}
              type="button"
              onClick={() => onOpenMonth(month)}
              aria-label={
                `Enter ${formatMonth(month)}`
                + (state ? `, ${state}` : '')
                + (extra ? `, ${extra.counts.join(' or ')} paychecks` : '')
              }
              className={'relative rounded-lg border p-3 text-left transition-colors ' + tileClass}
            >
              {extra ? (
                <span className="absolute -top-2 -right-2 flex items-center gap-0.5 rounded-full bg-info px-2 py-0.5 text-[0.7rem] font-bold text-info-foreground">
                  <Zap className="size-3.5" />{extra.counts.join('/')}
                </span>
              ) : null}
              <p className="label-caps">{shortMonthName(month)}</p>
              <p className={'display-figure mt-1 text-xl sm:text-2xl ' + valueColor}>
                {empty ? '—' : money(status.countable)}
              </p>
              {/* One line of words per cell, in this order of usefulness:
                  what the month is ahead of you for, then which of the three
                  states it landed in. A future month has no state yet — the
                  paycheck count is the whole point of it being here. */}
              {isAhead && extra ? (
                <p className="mt-1 text-base font-semibold text-info">
                  {extraPaycheckLabel(extra.counts)} due
                </p>
              ) : state ? (
                <p className={'mt-1 text-base font-semibold ' + (over ? 'text-destructive' : spent ? 'text-warn' : 'text-muted-foreground')}>
                  {state}
                </p>
              ) : null}
              {near ? (
                <p className="mt-2">
                  <Chip tone={near.kind === 'sga' ? 'danger' : 'warn'}>
                    {/* Was "$162 below TWP" / "$162 below SGA": an
                        abbreviation, and a distance to a thing the reader
                        has never been shown. */}
                    {money(near.room)} left before your limit
                  </Chip>
                </p>
              ) : null}
            </button>
          );
        })}
      </div>
    </section>
  );
}

/**
 * One month, up close.
 *
 * The overview in focus mode already answers "am I safe this month" in the
 * hero above. Repeating the same figure in a smaller box under a different
 * heading is what the filtered calendar was doing. So this answers the other
 * half — the half nothing else on the screen says — which is what the month
 * is made of: the days you get paid on, how many of them there are, and
 * whether that count is the unusual one.
 *
 * That is the calendar fact this whole product exists for, and at one-month
 * range it can be shown as actual dates rather than as a badge on a tile.
 */
/* The month picker travels with this panel, not just with the grid it
   replaces. Without it, choosing "This month" is a door that locks behind
   you: the control that made the choice is in the grid, and the grid is what
   just went away. */
function MonthUpClose({ month, onOpenMonth, scope, onScopeChange }: {
  month: MonthKey;
  onOpenMonth: (month: MonthKey) => void;
  scope: MonthScope;
  onScopeChange: (scope: MonthScope) => void;
}) {
  const { data } = useTracker();
  const status = monthStatus(data, month);
  const phase = benefitPhase(data, month);
  const state = stateLabel(status, phase);
  const extra = extraPaycheckMonths(data.streams, yearOf(month)).get(month);

  /* Every W-2 payday landing in this month, per job. A job with no schedule
     on file contributes nothing here rather than a zero — "we do not know" and
     "no paydays" are different answers and only one of them is true. */
  const jobs = data.streams
    .filter((s) => s.type === 'w2' && s.lifecycle === 'active' && s.payFrequency && s.anchorDate)
    .map((s) => {
      const plan = payPlan(yearOf(month), s.payFrequency!, s.anchorDate!);
      const days = plan.checks
        .filter((c) => c.month === month)
        .map((c) => Number(c.date.slice(8, 10)));
      return { id: s.id, name: s.name, days, typical: plan.typicalCount };
    })
    .filter((j) => j.days.length > 0);

  const unscheduled = data.streams.filter(
    (s) => s.type === 'w2' && s.lifecycle === 'active' && (!s.payFrequency || !s.anchorDate)
  );

  return (
    <section className="panel p-5 sm:p-6 xl:col-span-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        {/* The month is the heading, not a label above one. */}
        <h2 className="display-figure text-3xl sm:text-4xl">{longMonthName(month)}</h2>
        <MonthScopePicker
          scope={scope}
          onChange={onScopeChange}
          className="sm:shrink-0"
          selectClassName="field-input w-48"
        />
      </div>
      <p className="type-muted mt-1">
        {status.countable > 0 ? money(status.countable) : 'Nothing'} counted so far
        {state ? ` · ${state}` : ''}
      </p>

      {jobs.length ? (
        <div className="mt-5 flex flex-col gap-4">
          {jobs.map((job) => (
            <div key={job.id}>
              <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                <p className="text-base font-semibold">{job.name}</p>
                <p className={'text-base font-semibold ' + (job.days.length > job.typical ? 'text-info' : 'type-muted')}>
                  {job.days.length} {job.days.length === 1 ? 'payday' : 'paydays'}
                  {job.days.length > job.typical ? ' — one more than usual' : ''}
                </p>
              </div>
              {/* The dates themselves. At one-month range there is room to
                  show them, and a date you can point at is worth more than a
                  count you have to trust. */}
              <ul className="mt-2 flex flex-wrap gap-1.5">
                {job.days.map((day, i) => (
                  <li
                    key={day}
                    className={
                      'num grid size-10 place-items-center rounded-lg border text-base font-semibold '
                      + (job.days.length > job.typical && i === job.days.length - 1
                        ? 'border-info bg-info text-info-foreground'
                        : 'border-border bg-surface-2')
                    }
                  >
                    {day}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      ) : null}

      {extra ? (
        <p className="mt-4 flex items-start gap-2 rounded-lg border border-info/30 bg-info-soft/50 p-3 text-base font-semibold text-info-text">
          <Zap className="mt-0.5 size-5 shrink-0" />
          <span>
            {extraPaycheckLabel(extra.counts)} land in {longMonthName(month)} instead of the usual
            number. An extra payday is the most common way a month goes over without anyone deciding
            to work more.
          </span>
        </p>
      ) : null}

      {unscheduled.length ? (
        <p className="type-muted mt-4">
          {unscheduled.map((s) => s.name).join(', ')} {unscheduled.length === 1 ? 'has' : 'have'} no
          payday on file, so its paydays are not shown here.
        </p>
      ) : null}

      <button
        type="button"
        onClick={() => onOpenMonth(month)}
        className="btn-primary mt-5"
      >
        Open {longMonthName(month)}
      </button>
    </section>
  );
}
