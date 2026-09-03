import { useTracker } from '../state/TrackerProvider';
import { money } from '../domain/format';
import { mileageRateFor, mileageRatesForYear } from '../domain/rules';
import { Sheet } from './Sheet';

export function HelpSpread({ onClose }: { onClose: () => void }) {
  const { ui } = useTracker();
  const mileage = mileageRatesForYear(ui.year);
  const exampleRate = mileageRateFor(`${ui.year}-07`);

  const gross = 6200;
  const miles = 593;
  const deduction = miles * exampleRate;
  const net = gross - deduction;

  return (
    <Sheet
      title="How gig work is counted"
      eyebrow="Why your miles matter"
      onClose={onClose}
    >
      <p className="type-muted">
        Gig work is counted differently from a job with an employer. What counts is
        what you were paid, minus what it cost you to drive. That is usually a lot
        less than the amount that landed in your account.
      </p>

      <div className="flex flex-col gap-2 rounded-xl border border-border bg-surface-2 p-4">
        <span className="label-caps">An example</span>
        <p className="type-muted text-sm">
          Take off your work miles first. What is left is split evenly across the
          months you worked.
        </p>
        <div className="mt-2 flex flex-col gap-1 rounded-lg bg-surface p-3 font-mono text-xs">
          <div>{money(gross)} paid to you</div>
          <div>− {miles} miles × ${exampleRate.toFixed(3).replace(/0$/, '')} a mile</div>
          <div>= {money(net)}, split across 12 months</div>
          <div className="font-bold text-good">= {money(net / 12)} counted each month</div>
        </div>
      </div>

      <div className="flex flex-col gap-2 rounded-xl border border-border bg-surface-2 p-4">
        <span className="label-caps">Which miles count</span>
        <p className="type-muted text-sm">
          Miles you drive for work — deliveries, rides, driving to a job you are paid
          for. Not miles you drive for yourself. In {ui.year} they are worth:{' '}
          {mileage.map((period) =>
            `${period.fromMonth === 1 ? 'January to June' : 'July to December'}: $${period.rate.toFixed(3).replace(/0$/, '')} a mile`
          ).join(' · ')}. Write your miles down, or let your driving app record them.
        </p>
      </div>

      <div className="rounded-xl border border-warn/40 bg-warn-soft/60 p-4 text-sm text-warn-foreground">
        <div className="font-semibold">Hours can count even when the money does not</div>
        <div className="mt-1">
          Work more than 80 hours of gig work in one month and it uses 1 of your 9
          trial work months. This happens even if you earned very little.
        </div>
      </div>
    </Sheet>
  );
}
