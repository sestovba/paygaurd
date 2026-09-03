import { useTracker } from '../state/TrackerProvider';
import { money } from '../domain/format';
import { formatMonth, todayMonth } from '../domain/months';
import { rulesFor } from '../domain/rules';
import { benefitPhase, trialWorkStatus, TRIAL_MONTH_LIMIT } from '../domain/trialWork';
import { TrialMeter } from './TrialMeter';
import { TwpStatusForm } from './TwpStatusForm';
import { SafeWorkSimulator } from './SafeWorkSimulator';

export function StatusPage() {
  const { data, ui } = useTracker();
  const now = todayMonth();
  const phase = benefitPhase(data, now);
  const twp = trialWorkStatus(data, now);
  const rules = rulesFor(ui.year);

  return (
    <div className="flex flex-col gap-5">
      {phase === 'trialWork' || phase === 'verifyComplete' ? (
        <section className="panel p-5 sm:p-6">
          <h2 className="display-figure text-2xl">
            {twp.used} of {TRIAL_MONTH_LIMIT} trial work months used
          </h2>
          <p className="type-muted mt-2">
            {/* Was "left in the current 60-month window" and "ages out" —
                a unit of time nobody counts in, and a piece of caseworker
                idiom for a month no longer being held against you. */}
            {twp.remaining} left, across any 5 years
            {twp.nextExpiry ? `. Your oldest one stops counting in ${formatMonth(twp.nextExpiry)}.` : '.'}
          </p>
          <TrialMeter used={twp.used} prior={data.priorTrialMonths.length} />
        </section>
      ) : phase === 'sga' ? (
        <section className="panel p-5 sm:p-6">
          <h2 className="display-figure text-2xl">{money(rules.sga)} a month</h2>
          <p className="type-muted mt-2">
            Earn more than that in one calendar month and your benefits are at risk.
          </p>
        </section>
      ) : null}

      <SafeWorkSimulator />

      <section className="panel p-5 sm:p-6">
        <h2 className="display-figure text-2xl">
          {phase === 'sga' ? 'Where you are now' : 'Your trial work months'}
        </h2>
        <div className="mt-4">
          <TwpStatusForm />
        </div>
      </section>
    </div>
  );
}
