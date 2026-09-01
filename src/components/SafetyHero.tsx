import { CircleAlert, CircleCheck, TriangleAlert } from 'lucide-react';
import { useTracker } from '../state/TrackerProvider';
import { money } from '../domain/format';
import { longMonthName, todayMonth, yearOf } from '../domain/months';
import { monthStatus } from '../domain/earnings';
import { activeThreshold, benefitPhase, trialWorkStatus, TRIAL_MONTH_LIMIT } from '../domain/trialWork';
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
  const threshold = activeThreshold(data, asOf);
  const status = monthStatus(data, asOf);
  const twp = trialWorkStatus(data, asOf);
  const precision = precisionFor(data, asOf);

  if (phase === 'unknown' || phase === 'verifyComplete') {
    return (
      <section className="panel overflow-hidden p-5 sm:p-6 xl:col-span-6">
        <div className="flex items-start gap-3">
          <TriangleAlert className="size-6 shrink-0 text-warn" />
          <div className="min-w-0">
            <div className="text-lg font-semibold">
              {phase === 'unknown' ? 'Confirm TWP status' : 'Review 9 possible TWP months'}
            </div>
            <p className="type-muted mt-1.5">
              {phase === 'unknown'
                ? 'We need this to choose the correct TWP or SGA limit.'
                : 'Confirm these months before switching to the SGA limit.'}
            </p>
            <button
              type="button"
              onClick={phase === 'unknown' ? onTakeQuiz : onReviewStatus}
              className="btn-primary mt-4"
            >
              {phase === 'unknown' ? 'Confirm status' : 'Review months'}
            </button>
          </div>
        </div>
      </section>
    );
  }

  const over = threshold ? status.countable > threshold.amount : false;
  const room = threshold ? Math.max(0, threshold.amount - status.countable) : 0;
  // Crossing SGA is the month that can actually stop payments — red.
  // Using a TWP month is real but not that; same amber as "close but not
  // over yet", matching the same keep/spent/over split the calendar uses.
  const tone = phase === 'sga' && over ? 'over' : (over || room <= 200) ? 'caution' : 'safe';

  const toneClasses = {
    safe: { value: 'text-good', badgeBg: 'bg-good-soft', badgeFg: 'text-good', bar: 'bg-good' },
    caution: { value: 'text-warn', badgeBg: 'bg-warn-soft', badgeFg: 'text-warn-foreground', bar: 'bg-warn' },
    over: { value: 'text-destructive', badgeBg: 'bg-destructive/15', badgeFg: 'text-destructive', bar: 'bg-destructive' }
  }[tone];

  return (
    <section className="panel overflow-hidden p-5 sm:p-6 xl:col-span-6">
      <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-4">
        <div className="min-w-0">
          <p className="label-caps">{longMonthName(asOf)} countable earnings</p>
          <p className={'display-figure mt-1 text-5xl sm:text-6xl ' + toneClasses.value}>
            {money(status.countable)}
          </p>
        </div>
        <span className={'flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-semibold ' + toneClasses.badgeBg + ' ' + toneClasses.badgeFg}>
          {tone === 'safe' ? <CircleCheck className="size-4" />
            : tone === 'caution' ? <TriangleAlert className="size-4" />
            : <CircleAlert className="size-4" />}
          {tone === 'safe' ? `Below ${phase === 'trialWork' ? 'TWP' : 'SGA'}`
            : tone === 'over' ? 'Over SGA'
            : over ? 'TWP month used' : `Near ${phase === 'trialWork' ? 'TWP' : 'SGA'}`}
        </span>
      </div>

      {/* What the figure above is worth. Under the number, not in a panel of
          its own: precision is a property of this answer, and a card about
          data quality would be one more section competing with the month. */}
      <PrecisionLine reading={precision} onFix={onFixStream} />

      {threshold ? (
        <p className="mt-6 text-lg font-semibold">
          {over
            ? `${money(status.countable - threshold.amount)} over the ${phase === 'trialWork' ? 'TWP' : 'SGA'} limit this month`
            : `${money(room)} left before the ${phase === 'trialWork' ? 'TWP' : 'SGA'} limit this month`}
        </p>
      ) : null}

      <div className="mt-6 border-t border-border pt-5">
        <p className="type-muted min-w-0">
          {phase === 'trialWork'
            ? `TWP: ${twp.used} of ${TRIAL_MONTH_LIMIT} months used · ${twp.remaining} left`
            : 'SGA applies · TWP complete'}
        </p>
      </div>

      {phase === 'trialWork' ? <TrialMeter used={twp.used} prior={data.priorTrialMonths.length} /> : null}
    </section>
  );
}
