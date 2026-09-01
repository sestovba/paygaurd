import { TRIAL_MONTH_LIMIT } from '../../domain/trialWork';

/** Nine-slot TWP meter. Same dots in the header and Status. */
export function TrialMeter({
  used,
  prior,
  showLabel = true
}: {
  used: number;
  prior: number;
  showLabel?: boolean;
}) {
  const priorInWindow = Math.min(prior, used);

  return (
    <div className="twp-meter">
      <div className="twp-meter__dots" role="img" aria-label={`${used} of ${TRIAL_MONTH_LIMIT} trial work months used`}>
        {Array.from({ length: TRIAL_MONTH_LIMIT }, (_, i) => {
          let cls = 'twp-dot';
          if (i < priorInWindow) cls += ' twp-dot--prior';
          else if (i < used) cls += ' twp-dot--spent';
          return <span className={cls} key={i} />;
        })}
      </div>
      {showLabel ? (
        <div className="twp-meter__label">
          {prior ? `${prior} recorded before this tracker` : 'Trial work period'}
        </div>
      ) : null}
    </div>
  );
}
