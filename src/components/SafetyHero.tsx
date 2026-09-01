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
              {phase === 'unknown' ? 'Confirm your Trial Work Period status' : 'Review 9 possible Trial Work months'}
            </div>
            <p className="type-muted mt-1.5">
              {phase === 'unknown'
                ? 'We need this to show you the correct monthly earnings limit.'
                : 'Check these 9 months against your records before switching to the SGA limit.'}
            </p>
            <button
              type="button"
              onClick={phase === 'unknown' ? onTakeQuiz : onReviewStatus}
              className="btn-primary mt-4"
            >
              {phase === 'unknown' ? 'Answer questions' : 'Review months'}
            </button>
          </div>
        </div>
      </section>
    );
  }

  const over = threshold ? status.countable > threshold.amount : false;
  const room = threshold ? Math.max(0, threshold.amount - status.countable) : 0;
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
          <p className="label-caps">What Social Security counts for {longMonthName(asOf)}</p>
          <p className={'display-figure mt-1 text-5xl sm:text-6xl ' + toneClasses.value}>
            {money(status.countable)}
          </p>
        </div>
        <span className={'flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-semibold ' + toneClasses.badgeBg + ' ' + toneClasses.badgeFg}>
          {tone === 'safe' ? <CircleCheck className="size-4" />
            : tone === 'caution' ? <TriangleAlert className="size-4" />
            : <CircleAlert className="size-4" />}
          {tone === 'safe' ? `Below ${phase === 'trialWork' ? 'TWP' : 'SGA'} limit`
            : tone === 'over' ? 'Over monthly limit'
            : over ? '1 TWP month used' : 'Close to limit'}
        </span>
      </div>

      <PrecisionLine reading={precision} onFix={onFixStream} />

      {threshold ? (
        <p className="mt-6 text-lg font-semibold">
          {over
            ? `${money(status.countable - threshold.amount)} over your ${phase === 'trialWork' ? 'Trial Work Period' : 'SGA'} limit ($${money(threshold.amount)}) this month`
            : `${money(room)} left before reaching your ${phase === 'trialWork' ? 'Trial Work Period' : 'SGA'} limit ($${money(threshold.amount)}) this month`}
        </p>
      ) : null}

      <div className="mt-6 border-t border-border pt-5">
        <p className="type-muted min-w-0">
          {phase === 'trialWork'
            ? `Trial Work Period: ${twp.used} of ${TRIAL_MONTH_LIMIT} months used · ${twp.remaining} remaining`
            : 'Substantial Gainful Activity (SGA) limit applies · 9 Trial Work months complete'}
        </p>
      </div>

      {phase === 'trialWork' ? <TrialMeter used={twp.used} prior={data.priorTrialMonths.length} /> : null}
    </section>
  );
}
