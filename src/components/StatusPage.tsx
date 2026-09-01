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
            {twp.remaining} left in the current 60-month window
            {twp.nextExpiry ? `. The oldest one ages out ${formatMonth(twp.nextExpiry)}.` : '.'}
          </p>
          <TrialMeter used={twp.used} prior={data.priorTrialMonths.length} />
        </section>
      ) : phase === 'sga' ? (
        <section className="panel p-5 sm:p-6">
          <h2 className="display-figure text-2xl">{money(rules.sga)} a month</h2>
          <p className="type-muted mt-2">
            That is your SGA earnings limit. Earning more than this in any calendar month can affect your benefits.
          </p>
        </section>
      ) : null}

      <SafeWorkSimulator />

      <section className="panel p-5 sm:p-6">
        <h2 className="display-figure text-2xl">Trial Work Period &amp; Rules</h2>
        <p className="type-muted mt-2">Choose whether you are in your 9 Trial Work months or subject to the SGA limit.</p>
        <div className="mt-4">
          <TwpStatusForm />
        </div>
      </section>
    </div>
  );
}
