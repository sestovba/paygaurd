import { TRIAL_MONTH_LIMIT } from '../domain/trialWork';

/** Nine-bar TWP meter. Bold on purpose — these are irreversible months. */
export function TrialMeter({ used, prior }: { used: number; prior: number }) {
  const priorInWindow = Math.min(prior, used);

  return (
    <div
      className="mt-3 grid grid-cols-9 gap-1.5"
      role="img"
      aria-label={`${used} of ${TRIAL_MONTH_LIMIT} trial work months used`}
    >
      {Array.from({ length: TRIAL_MONTH_LIMIT }, (_, i) => (
        <span
          key={i}
          className={
            'h-1.5 rounded-full '
            + (i < priorInWindow ? 'bg-muted-foreground/60' : i < used ? 'bg-warn' : 'bg-muted')
          }
        />
      ))}
    </div>
  );
}
