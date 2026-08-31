import { useTracker } from '../state/TrackerProvider';
import { money } from '../domain/format';
import { mileageRateFor, mileageRatesForYear, rulesFor } from '../domain/rules';
import { benefitPhase } from '../domain/trialWork';
import { Sheet } from './Sheet';

export function HelpSpread({ onClose }: { onClose: () => void }) {
  const { data, ui } = useTracker();
  const rules = rulesFor(ui.year);
  const phase = benefitPhase(data, `${ui.year}-12`);
  const mileage = mileageRatesForYear(ui.year);
  const exampleRate = mileageRateFor(`${ui.year}-07`);

  const gross = 6200;
  const miles = 593;
  const deduction = miles * exampleRate;
  const net = gross - deduction;

  return (
    <Sheet
      title="How income spreads"
      eyebrow="Guidelines"
      onClose={onClose}
    >
      <p className="type-muted">
        SSA looks at what you earned in each calendar month, not what you were
        paid. For W-2 work those are usually the same. For 1099 work they often
        are not.
      </p>

      <div className="flex flex-col gap-2 rounded-xl border border-border bg-surface-2 p-4">
        <span className="label-caps">Average (Default)</span>
        <p className="type-muted text-sm">
          Your yearly net is divided evenly across the months the stream was
          active. This is the default, and it is what SSA does when income
          cannot be tied to a particular month.
        </p>
        <div className="mt-2 flex flex-col gap-1 rounded-lg bg-surface p-3 font-mono text-xs">
          <div>{money(gross)} gross − {miles} mi × ${exampleRate.toFixed(3).replace(/0$/, '')}</div>
          <div>= {money(net)} net ÷ 12 months</div>
          <div className="font-bold text-good">= {money(net / 12)} per month</div>
        </div>
      </div>

      <div className="flex flex-col gap-2 rounded-xl border border-border bg-surface-2 p-4">
        <span className="label-caps">Per month</span>
        <p className="type-muted text-sm">
          You enter each month yourself. Use this when the work was genuinely
          uneven and you can show which month it belongs to.
        </p>
      </div>

      <div className="rounded-xl border border-warn/40 bg-warn-soft/60 p-4 text-sm text-warn-foreground">
        <div className="font-semibold">Switching changes the past</div>
        <div className="mt-1">
          {phase === 'trialWork'
            ? `Spread decides which months cross ${money(rules.trialWork)}. Moving from Average to Per month can change whether a month uses TWP.`
            : phase === 'sga'
              ? `Spread decides which months cross the ${money(rules.sga)} SGA line.`
              : 'Spread can change which months cross the applicable line once benefit phase is confirmed.'}
        </div>
      </div>

      <div className="flex flex-col gap-2 rounded-xl border border-border bg-surface-2 p-4">
        <span className="label-caps">Mileage Deductions</span>
        <p className="type-muted text-sm">
          Business miles come off 1099 gross before anything is counted, at the
          IRS standard rate effective in the month. In {ui.year}:{' '}
          {mileage.map((period) =>
            `${period.fromMonth === 1 ? 'Jan–Jun' : 'Jul–Dec'} $${period.rate.toFixed(3).replace(/0$/, '')}/mi`
          ).join(' · ')}. Keep your own log; SSA can ask for it.
        </p>
      </div>
    </Sheet>
  );
}
