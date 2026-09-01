// Where the explaining moved. Nothing on a collapsed row has to teach
// anything, because this page exists.

import { useTracker } from './state';
import { money } from '../../domain/format';
import { mileageRateFor, mileageRatesForYear, rulesFor } from '../../domain/rules';
import { benefitPhase } from '../../domain/trialWork';
import { SheetSurface } from './SheetSurface';

export function HelpSpread({ onBack, onClose }: { onBack: () => void; onClose: () => void }) {
  return (
    <SheetSurface
      label="How income spreads"
      eyebrow="App settings"
      title="How income spreads"
      onBack={onBack}
      onClose={onClose}
    >
      <HelpSpreadContent />
    </SheetSurface>
  );
}

export function HelpSpreadContent() {
  const { data, ui } = useTracker();
  const rules = rulesFor(ui.year);
  const phase = benefitPhase(data, `${ui.year}-12`);
  const mileage = mileageRatesForYear(ui.year);
  const exampleRate = mileageRateFor(`${ui.year}-07`);

  // A worked example, using this year's real mileage rate.
  const gross = 6200;
  const miles = 593;
  const deduction = miles * exampleRate;
  const net = gross - deduction;

  return (
    <>
          <p className="help-copy">
            SSA looks at what you earned in each calendar month, not what you were
            paid. For W-2 work those are usually the same. For 1099 work they often
            are not.
          </p>

          <div className="field">
            <span className="eyebrow">Average</span>
            <p className="help-copy">
              Your yearly net is divided evenly across the months the stream was
              active. This is the default, and it is what SSA does when income
              cannot be tied to a particular month.
            </p>
            <div className="rows help-example">
              <div className="num help-note">
                {money(gross)} gross − {miles} mi × ${exampleRate.toFixed(3).replace(/0$/, '')}
              </div>
              <div className="num help-note">
                = {money(net)} net ÷ 12 months
              </div>
              <div className="num help-example__total">
                = {money(net / 12)} per month
              </div>
            </div>
          </div>

          <div className="field">
            <span className="eyebrow">Per month</span>
            <p className="help-copy">
              You enter each month yourself. Use this when the work was genuinely
              uneven and you can show which month it belongs to.
            </p>
          </div>

          <div className="warning">
            <div className="warning__bar" />
            <div className="warning__body">
              <div className="warning__title">Switching changes the past</div>
              <div className="warning__text">
                {phase === 'trialWork'
                  ? `Spread decides which months cross ${money(rules.trialWork)}. Moving from Average to Per month can change whether a month uses a trial work month.`
                  : phase === 'sga'
                    ? `Spread decides which months cross your ${money(rules.sga)} limit.`
                    : 'Spread can change which months cross the applicable line once benefit phase is confirmed.'}
              </div>
            </div>
          </div>

          <div className="field">
            <span className="eyebrow">Mileage</span>
            <p className="help-copy">
              Business miles come off 1099 gross before anything is counted, at the
              IRS standard rate effective in the month. In {ui.year}:{' '}
              {mileage.map((period) =>
                `${period.fromMonth === 1 ? 'Jan–Jun' : 'Jul–Dec'} $${period.rate.toFixed(3).replace(/0$/, '')}/mi`
              ).join(' · ')}. Keep your own log; SSA can ask for it.
            </p>
          </div>

          <p className="help-note">
            This app helps you keep a record. It is not advice, and SSA makes the
            final determination.
          </p>
    </>
  );
}
