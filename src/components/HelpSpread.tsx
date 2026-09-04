import { useTracker } from '../state/TrackerProvider';
import { money } from '../domain/format';
import { mileageRateFor, mileageRatesForYear } from '../domain/rules';
import { Sheet } from './Sheet';

/** The content on its own, so it can be a page inside another sheet as well
 *  as a sheet of its own. Settings drills into it rather than stacking a
 *  second sheet on top of itself; StreamSheet still opens it as a sheet. */
export function HelpSpreadBody() {
  const { ui } = useTracker();
  const mileage = mileageRatesForYear(ui.year);
  const exampleRate = mileageRateFor(`${ui.year}-07`);

  const gross = 6200;
  const miles = 593;
  const deduction = miles * exampleRate;
  const net = gross - deduction;

  return (
    <>
      <p className="type-muted">
        For gig work, what counts is what you were paid minus your driving costs —
        usually much less than what hit your account.
      </p>

      <div className="flex flex-col gap-2 rounded-xl border border-border bg-surface-2 p-4">
        <span className="label-caps">An example</span>
        <p className="type-muted text-sm">
          Subtract work miles first. What’s left is split across the months you worked.
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
          Only miles for work — deliveries, rides, paid jobs. Not personal miles.
          In {ui.year}:{' '}
          {mileage.map((period) =>
            `${period.fromMonth === 1 ? 'Jan–Jun' : 'Jul–Dec'}: $${period.rate.toFixed(3).replace(/0$/, '')}/mile`
          ).join(' · ')}. Track them yourself or in your driving app.
        </p>
      </div>

      <div className="rounded-xl border border-warn/40 bg-warn-soft/60 p-4 text-sm text-warn-foreground">
        <div className="font-semibold">Hours can count even when pay is low</div>
        <div className="mt-1">
          More than 80 hours of gig work in a month uses 1 of your 9 trial months —
          even if you earned very little.
        </div>
      </div>
    </>
  );
}

export function HelpSpread({ onClose }: { onClose: () => void }) {
  return (
    <Sheet
      title="How gig work counts"
      eyebrow="Why miles matter"
      onClose={onClose}
    >
      <HelpSpreadBody />
    </Sheet>
  );
}
