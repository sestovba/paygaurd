import { CircleAlert, CircleCheck, CircleDashed, TriangleAlert } from 'lucide-react';
import { useTracker } from '../state/TrackerProvider';
import { money } from '../domain/format';
import { roomToTargetLine, trialPermissionLine } from '../domain/copy';
import { LimitRuler } from './LimitRuler';
import { longMonthName, todayMonth, yearOf } from '../domain/months';
import { monthStatus } from '../domain/earnings';
import { capacityFor } from '../domain/capacity';
import { benefitPhase, trialWorkStatus, TRIAL_MONTH_LIMIT } from '../domain/trialWork';
import { TrialMeter } from './TrialMeter';
import { PrecisionLine } from './PrecisionLine';
import { precisionFor } from '../domain/precision';
import type { PrecisionGap } from '../domain/precision';

/** The one thing this app exists to answer: are you safe right now. */
export function SafetyHero({
  onTakeQuiz, onReviewStatus, onFixStream
}: {
  onTakeQuiz: () => void;
  onReviewStatus: () => void;
  /** Opens the source that is holding the reading back, at the field it is
   *  missing. Optional: a layout without a source editor to open still shows
   *  the reading, it just cannot offer the fix. */
  onFixStream?: (gap: PrecisionGap) => void;
}) {
  const { data, ui } = useTracker();
  const now = todayMonth();
  const asOf = yearOf(now) === ui.year ? now : `${ui.year}-12`;
  const phase = benefitPhase(data, asOf);
  const status = monthStatus(data, asOf);
  const twp = trialWorkStatus(data, asOf);
  const precision = precisionFor(data, asOf);

  /* Review note: "we should spend massive effort and time thinking about the
     best way to communicate this... not make it seem like a computer warning
     or almost error. This is an emotional thing, we are trying to help you
     have the most accurate picture of your finances, without this we are
     guessing and we are not as accurate. This in fact is the precision
     gauge."

     It was written as a fault report: a warning triangle, an imperative, and
     "We need this to show you...". Nothing is wrong here and the person has
     done nothing. What is true is that the app is guessing, which is the
     precision line's own idea — so it wears the precision line's own mark
     (the dashed circle that means Estimated) and says what the trade is:
     answer this, and the numbers stop being averages and start being yours.
     The reason is one clause, not a paragraph about Social Security. */
  if (phase === 'unknown' || phase === 'verifyComplete') {
    return (
      <section className="panel overflow-hidden p-5 sm:p-6 xl:col-span-6">
        <div className="flex items-start gap-3">
          <CircleDashed className="mt-0.5 size-6 shrink-0 text-muted-foreground" />
          <div className="min-w-0">
            <div className="text-lg font-semibold">
              {/* "Nine months left to check" reads first as "you have nine
                   months left" — which is a claim about the reader's
                   benefits, made by accident, on the largest line of the
                   screen. It is a list of months waiting to be checked. */}
              {phase === 'unknown'
                ? 'These numbers are still a guess'
                : 'Nine months need a quick check'}
            </div>
            <p className="type-muted mt-1.5">
              {phase === 'unknown'
                ? 'A few questions set your real monthly limit.'
                : 'Match them to your records. Then the limit here is yours.'}
            </p>
            <button
              type="button"
              onClick={phase === 'unknown' ? onTakeQuiz : onReviewStatus}
              className="btn-primary mt-4"
            >
              {phase === 'unknown' ? 'Answer a few questions' : 'Check months'}
            </button>
          </div>
        </div>
      </section>
    );
  }

  /* Read through capacityFor so this hero answers to the same safety line as
     the rest of the app: a thousand dollars a month, with the real limit
     beyond it. Aiming at the limit itself leaves no room for the extra
     paycheck a fortnightly schedule drops into some months, which is the most
     common way somebody goes over without meaning to. */
  const capacity = capacityFor(data, asOf);
  const tone = capacity
    ? (capacity.stage === 'over' ? 'over' : capacity.stage === 'careful' ? 'caution' : 'safe')
    : 'safe';

  const toneClasses = {
    safe: { value: 'text-good', badgeBg: 'bg-good-soft', badgeFg: 'text-good-text', bar: 'bg-good' },
    caution: { value: 'text-warn', badgeBg: 'bg-warn-soft', badgeFg: 'text-warn-foreground', bar: 'bg-warn' },
    over: { value: 'text-destructive', badgeBg: 'bg-destructive/15', badgeFg: 'text-destructive', bar: 'bg-destructive' }
  }[tone];

  return (
    <section className="panel overflow-hidden p-5 sm:p-6 xl:col-span-6">
      <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-4">
        <div className="min-w-0">
          {/* Review note: "I dont need to know about social securities
              opinions, I just need to be able to generate my own opinion."
              The figure is this month's countable pay. Naming whose opinion
              it is puts an institution between the reader and their own
              number, on the one line where that is least welcome. */}
          <p className="label-caps">{longMonthName(asOf)} so far</p>
          <p className={'display-figure mt-1 text-5xl sm:text-6xl ' + toneClasses.value}>
            {money(status.countable)}
          </p>
        </div>
        <span className={'flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-semibold ' + toneClasses.badgeBg + ' ' + toneClasses.badgeFg}>
          {tone === 'safe' ? <CircleCheck className="size-4" />
            : tone === 'caution' ? <TriangleAlert className="size-4" />
            : <CircleAlert className="size-4" />}
          {tone === 'safe' ? 'Safe'
            : tone === 'over' ? 'Over your limit'
            : 'Close to your limit'}
        </span>
      </div>

      {/* money() already carries the dollar sign; this line used to wrap it
          in another one and print "($$1,210)" on three layouts. */}
      {capacity ? (
        <>
          <p className="mt-6 text-lg font-semibold">
            {capacity.over > 0
              ? `${money(capacity.over)} over your ${money(capacity.threshold)} limit`
              : capacity.stage === 'careful'
                ? `Past the ${money(capacity.safeTarget)} aim. ${money(capacity.roomToLimit)} left to ${money(capacity.threshold)}.`
                : roomToTargetLine(capacity.room, capacity.safeTarget, capacity.threshold)}
          </p>
          {/* Hours, when we know what an hour is worth here. Dollars are the
              unit the rule is written in; hours are the unit the decision is
              made in. */}
          <LimitRuler capacity={capacity} />
          {capacity.hours !== null && capacity.over === 0 ? (
            <p className="type-muted mt-1">
              About {capacity.hours} more {capacity.hours === 1 ? 'hour' : 'hours'}
              {capacity.rate ? ` at ${money(capacity.rate.rate)} an hour` : ''}.
            </p>
          ) : null}
        </>
      ) : null}

      {/* One limit at a time. Review note: "I dont need to even hear about TWP
          anywhere... we must cut ruthlessly any stranded lines that serve no
          purpose."

          The old foot printed "Substantial Gainful Activity (SGA) limit
          applies · 9 Trial Work months complete" to somebody whose trial work
          months finished — a line naming two rules, one of which is over, and
          telling them nothing they can do anything about. It is gone. The
          limit that applies is already stated in the sentence above it.

          While the trial work months are still running they are the opposite
          of stranded: they are a countable resource being spent, and how many
          are left changes what this month is worth risking. That stays — with
          the name spelled out once and the abbreviation nowhere. */}
      {/* el-1vysf4s: "Why is there a divider line here". Because the card
          was being cut into three panels by rules, on the one screen that is
          supposed to read as a single answer. Space separates them; a line
          says they are different things. Both rules go, not just the one
          that was pointed at. */}
      <div className="mt-6">
        <PrecisionLine reading={precision} onFix={onFixStream} variant="gauge" />
      </div>

      {phase === 'trialWork' ? (
        <div className="mt-6">
          {/* Was "Trial Work Period · 3 of 9 months used, 6 left" — a proper
               noun the reader has not been taught, then the same fact stated
               twice in two directions. Then "0 of your 9 trial work months
               used", which fixed the noun and kept the wrong end of the
               sentence: it counts what has been spent, on a screen read by
               someone whose defining fear is losing their payments, and at the
               start it opens on a zero. What the rule actually grants is nine
               months in which earnings cannot cost them anything, so the
               permission is said first and the arithmetic second. This is the
               stated exception in DESIGN-SYSTEM.md § 1.5 — still a remainder,
               just a remainder of something good. */}
          <p className="type-muted min-w-0">
            {trialPermissionLine(twp.remaining, TRIAL_MONTH_LIMIT)}
          </p>
          <TrialMeter used={twp.used} prior={data.priorTrialMonths.length} />
        </div>
      ) : null}
    </section>
  );
}
