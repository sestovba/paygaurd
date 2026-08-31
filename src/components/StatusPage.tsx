import { useTracker } from '../state/TrackerProvider';
import { formatMonth, todayMonth } from '../domain/months';
import { benefitPhase, trialWorkStatus, TRIAL_MONTH_LIMIT } from '../domain/trialWork';
import { TrialMeter } from './TrialMeter';
import { TwpStatusForm } from './TwpStatusForm';
import { SafeWorkSimulator } from './SafeWorkSimulator';

export function StatusPage() {
  const { data } = useTracker();
  const now = todayMonth();
  const phase = benefitPhase(data, now);
  const twp = trialWorkStatus(data, now);

  return (
    <div className="flex flex-col gap-5">
      {phase === 'trialWork' || phase === 'verifyComplete' ? (
        <section className="panel p-5 sm:p-6">
          <p className="label-caps text-accent-foreground">Where you stand</p>
          <h2 className="display-figure mt-1 text-2xl">Trial Work Period</h2>
          <p className="type-muted mt-2">
            {twp.used} of {TRIAL_MONTH_LIMIT} months used in the current 60-month window
            {twp.nextExpiry ? `; the oldest one ages out ${formatMonth(twp.nextExpiry)}.` : '.'}
          </p>
          <TrialMeter used={twp.used} prior={data.priorTrialMonths.length} />
        </section>
      ) : phase === 'sga' ? (
        <section className="panel p-5 sm:p-6">
          <p className="label-caps text-accent-foreground">Where you stand</p>
          <h2 className="display-figure mt-1 text-2xl">Substantial Gainful Activity</h2>
          <p className="type-muted mt-2">
            Trial Work is used up. SGA is the working limit now — crossing it
            puts benefits at risk, not just a used month.
          </p>
        </section>
      ) : null}

      <SafeWorkSimulator />

      <section className="panel p-5 sm:p-6">
        <p className="label-caps text-accent-foreground">Update</p>
        <h2 className="display-figure mt-1 text-2xl">Your assessment</h2>
        <p className="type-muted mt-2">
          This is what drives every limit warning on Overview. Change it anytime.
        </p>
        <div className="mt-4">
          <TwpStatusForm />
        </div>
      </section>
    </div>
  );
}
