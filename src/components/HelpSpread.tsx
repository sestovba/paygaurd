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
      title="How self-employment income is counted"
      eyebrow="Social Security rules"
      onClose={onClose}
    >
      <p className="type-muted">
        Social Security counts 1099 and gig work differently than a regular job.
        They look at your total net profit for the year, and divide it across the months you worked.
      </p>

      <div className="flex flex-col gap-2 rounded-xl border border-border bg-surface-2 p-4">
        <span className="label-caps">How the math works</span>
        <p className="type-muted text-sm">
          Your total money earned minus your business mileage expenses gives your net profit.
          This net profit is split evenly across your active work months.
        </p>
        <div className="mt-2 flex flex-col gap-1 rounded-lg bg-surface p-3 font-mono text-xs">
          <div>{money(gross)} earned − ({miles} miles × ${exampleRate.toFixed(3).replace(/0$/, '')}/mi)</div>
          <div>= {money(net)} profit ÷ 12 active months</div>
          <div className="font-bold text-good">= {money(net / 12)} counted per month</div>
        </div>
      </div>

      <div className="flex flex-col gap-2 rounded-xl border border-border bg-surface-2 p-4">
        <span className="label-caps">Business Mileage</span>
        <p className="type-muted text-sm">
          Miles you drive for gig work or self-employment (like delivery or rideshare) are subtracted from your earnings at the official IRS rate.
          In {ui.year}:{' '}
          {mileage.map((period) =>
            `${period.fromMonth === 1 ? 'Jan–Jun' : 'Jul–Dec'} $${period.rate.toFixed(3).replace(/0$/, '')}/mile`
          ).join(' · ')}. Keep a written log or app record of your miles.
        </p>
      </div>

      <div className="rounded-xl border border-warn/40 bg-warn-soft/60 p-4 text-sm text-warn-foreground">
        <div className="font-semibold">Important 80-Hour Rule</div>
        <div className="mt-1">
          If you work more than 80 hours in any month doing 1099 or self-employed work, Social Security counts that month as 1 of your 9 Trial Work Period months, even if your earnings were low.
        </div>
      </div>
    </Sheet>
  );
}
