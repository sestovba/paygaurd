// Stream settings. The anchor date lives here, and it is the only input the
// three-paycheck warning needs — every check date derives from it.

import type { PayFrequency, Stream } from '../../domain/types';
import { useTracker } from './state';
import { money } from '../../domain/format';
import { longMonthName, monthKey, parseMonth } from '../../domain/months';
import { frequencyLabel, payPlan, weeksPerCheck } from '../../domain/paySchedule';
import { knownYears, mileageRatesForYear, rulesFor } from '../../domain/rules';
import { benefitPhase } from '../../domain/trialWork';
import { SheetSurface } from './SheetSurface';
import { NumericExprInput } from './NumericExprInput';
import { LockIcon, UnlockIcon } from './Icons';

import { ButtonBase } from '../../design-system';
const FREQUENCIES: PayFrequency[] = ['weekly', 'biweekly', 'semimonthly', 'monthly'];

export function StreamSettingsSheet({
  stream,
  onClose
}: {
  stream: Stream;
  onClose: () => void;
}) {
  return (
    <SheetSurface
      label={`${stream.name} settings`}
      eyebrow={stream.type === 'w2' ? 'W-2 job settings' : '1099 work settings'}
      title={stream.name}
      onClose={onClose}
    >
      <StreamSettingsContent stream={stream} />
    </SheetSurface>
  );
}

/** Shared by the full setup sheet and the inline stream actions surface. */
export function StreamSettingsContent({ stream }: { stream: Stream }) {
  const { data, ui, updateStream } = useTracker();
  const rules = rulesFor(ui.year);
  const mileage = mileageRatesForYear(ui.year);
  const phase = benefitPhase(data, monthKey(ui.year, 12));

  const plan = stream.payFrequency && stream.anchorDate
    ? payPlan(ui.year, stream.payFrequency, stream.anchorDate)
    : null;

  // Hourly rate × planned hours/week × the weeks one check covers — an
  // estimate that fits hours varying week to week, unlike a flat guessed
  // gross-per-check.
  const per = stream.payFrequency
    ? (stream.hourlyRate ?? 0) * (stream.plannedHoursPerWeek ?? 0) * weeksPerCheck(stream.payFrequency)
    : 0;
  const heavyNames = plan ? plan.heavyMonths.map((m) => longMonthName(monthKey(ui.year, m))) : [];
  const heavyTotal = plan ? (plan.typicalCount + 1) * per : 0;

  return (
    <>
          <div className="field">
            <span className="eyebrow">Type</span>
            <div className="segmented">
              <ButtonBase
                type="button"
                aria-pressed={stream.type === 'w2'}
                onClick={() => updateStream(stream.id, { type: 'w2' })}
              >
                W-2
              </ButtonBase>
              <ButtonBase
                type="button"
                aria-pressed={stream.type === 'ten99'}
                onClick={() => updateStream(stream.id, { type: 'ten99' })}
              >
                1099
              </ButtonBase>
            </div>
            <p className="help-note">
              Switches which fields apply below — pay schedule and hourly
              rate for W-2, mileage and spread for 1099. Recorded months and
              past totals stay as entered either way.
            </p>
          </div>

          <div className="field">
            <span className="eyebrow">Source status</span>
            <div className="segmented">
              <ButtonBase
                type="button"
                aria-pressed={stream.lifecycle === 'active'}
                onClick={() => updateStream(stream.id, { lifecycle: 'active' })}
              >
                Ongoing
              </ButtonBase>
              <ButtonBase
                type="button"
                aria-pressed={stream.lifecycle === 'inactive'}
                onClick={() => updateStream(stream.id, { lifecycle: 'inactive' })}
              >
                Paused
              </ButtonBase>
              <ButtonBase
                type="button"
                aria-pressed={stream.lifecycle === 'completed'}
                onClick={() => updateStream(stream.id, { lifecycle: 'completed' })}
              >
                Ended
              </ButtonBase>
            </div>
            <p className="help-note">
              {stream.lifecycle === 'inactive'
                ? 'Paused is for work you are not currently doing but could pick back up — gig apps you have stepped away from, for example. No end date needed.'
                : stream.lifecycle === 'completed'
                  ? 'Ended is for work you have left for good. History stays either way — this only moves it out of ongoing.'
                  : 'Move a stream to Paused or Ended without deleting its history.'}
            </p>
            <ButtonBase
              className="lock-toggle"
              type="button"
              aria-pressed={stream.locked}
              onClick={() => updateStream(stream.id, { locked: !stream.locked })}
            >
              {stream.locked ? <UnlockIcon size={15} /> : <LockIcon size={15} />}
              {stream.locked ? 'Locked — unlock to edit' : 'Lock to prevent accidental edits'}
            </ButtonBase>
          </div>

          <fieldset className="settings-fieldset">
          <label className="field">
            <span className="eyebrow">{stream.type === 'w2' ? 'Job' : 'Gig'}</span>
            <input
              type="text"
              value={stream.name}
              onChange={(e) => updateStream(stream.id, { name: e.target.value })}
            />
          </label>

          {stream.type === 'w2' ? (
            <>
              <div className="field">
                <span className="eyebrow">How often are you paid</span>
                <div className="segmented">
                  {FREQUENCIES.map((f) => (
                    <ButtonBase
                      key={f}
                      type="button"
                      aria-pressed={stream.payFrequency === f}
                      onClick={() => updateStream(stream.id, { payFrequency: f })}
                    >
                      {f === 'semimonthly' ? 'Twice a month' : f.charAt(0).toUpperCase() + f.slice(1)}
                    </ButtonBase>
                  ))}
                </div>
              </div>

              <label className="field">
                <span className="eyebrow">Last known pay date for this job</span>
                <input
                  type="date"
                  value={stream.anchorDate ?? ''}
                  onChange={(e) => updateStream(stream.id, { anchorDate: e.target.value })}
                />
                <p className="help-note">
                  One real date you were (or will be) paid for {stream.name || 'this job'}.
                  The app counts every {stream.payFrequency === 'weekly' ? 'week' : 'two weeks'}
                  {' '}forward and backward from it to find which calendar
                  months land 3 paychecks instead of 2 — the months a
                  cash-flow warning below depends on.
                </p>
              </label>

              <div className="field__row">
                <label className="field">
                  <span className="eyebrow">Hourly rate</span>
                  <NumericExprInput
                    className="num-input"
                    value={stream.hourlyRate}
                    placeholder="0"
                    onCommit={(next) => updateStream(stream.id, { hourlyRate: next })}
                  />
                </label>
                <label className="field">
                  <span className="eyebrow">Planned hours/week</span>
                  <NumericExprInput
                    className="num-input"
                    value={stream.plannedHoursPerWeek}
                    placeholder="0"
                    onCommit={(next) => updateStream(stream.id, { plannedHoursPerWeek: next })}
                  />
                </label>
              </div>
              <p className="help-note">
                We use this to work out what each paycheck is worth, and to fill in
                your pay when you type hours for a month. Change it if your paystub
                says something different.
              </p>

              {plan ? (
                <div className="derived">
                  <div className="derived__label">Which means</div>
                  <div className="derived__main">
                    {plan.total} paycheck{plan.total === 1 ? '' : 's'} in {ui.year}
                  </div>
                  <div className="derived__accent">
                    {heavyNames.length
                      ? `${plan.typicalCount + 1} checks in ${heavyNames.join(' and ')}`
                      : 'Same number every month'}
                  </div>
                </div>
              ) : stream.payFrequency === 'weekly' || stream.payFrequency === 'biweekly' ? (
                <div className="warning">
                  <div className="warning__bar" />
                  <div className="warning__body">
                    <div className="warning__title">No payday set yet</div>
                    <div className="warning__text">
                      {frequencyLabel(stream.payFrequency).toLowerCase()} pay gives some
                      months an extra paycheck — that is usually the month closest to a
                      limit. One real payday is the only way the app can tell you which
                      month that is; without it, the risk is just invisible.
                    </div>
                  </div>
                </div>
              ) : (
                <p className="help-note">
                  One real payday lets the app project every 3- or 5-paycheck
                  cash-flow month. It is a risk forecast; SSA earned-month totals
                  still come from the work period.
                </p>
              )}

              {plan && heavyNames.length > 0 && per > 0 ? (
                <div className="warning">
                  <div className="warning__bar" />
                  <div className="warning__body">
                    <div className="warning__title">
                      {heavyNames.join(' and ')} {heavyNames.length > 1 ? 'have' : 'has'}
                      {' '}{plan.typicalCount + 1} paychecks
                    </div>
                    <div className="warning__text">
                      Payday forecast only. SSA generally assigns W-2 wages to
                      the month earned using the pay period, not just the pay date.
                      {' '}{phase === 'trialWork' && heavyTotal > rules.trialWork
                        ? 'If that work was earned in one month, it could use a trial work month.'
                        : phase === 'sga' && heavyTotal > rules.sga
                          ? 'If that work was earned in one month, it could go over your limit.'
                          : 'Use this as an extra-paycheck warning, then enter earned monthly gross.'}
                    </div>
                    <div className="warning__figures">
                      <span className="warning__big">{money(heavyTotal)}</span>
                      <span className="warning__small">
                        vs {money(plan.typicalCount * per)} usual
                      </span>
                    </div>
                  </div>
                </div>
              ) : null}
            </>
          ) : (
            <>
              {/* Where a spread toggle used to sit. This app has one rule for
                * 1099 income and every layout follows it: a year figure is
                * divided across the active months as it is entered, so the
                * stored months are the months that count. Nothing to choose,
                * and no way for two layouts to disagree about a total. */}
              <div className="field">
                <span className="eyebrow">How this income spreads</span>
                <p className="help-note">
                  The annual total on the card divides evenly across the months
                  this job was running — what Social Security does when pay cannot
                  be tied to one month. Enter a month directly for an exact figure.
                </p>
              </div>

              <div className="rows">
                {mileage.map((period) => (
                  <div className="rows__row" key={period.fromMonth}>
                    <span className="rows__label">
                      Mileage, {ui.year}{mileage.length > 1
                        ? ` · ${period.fromMonth === 1 ? 'Jan–Jun' : 'Jul–Dec'}`
                        : ''}
                    </span>
                    <span className="rows__value">
                      ${period.rate.toFixed(3).replace(/0$/, '')}
                      <span className="rows__unit"> a mile</span>
                    </span>
                  </div>
                ))}
              </div>
            </>
          )}

          <div className="field__row">
            <label className="field">
              <span className="eyebrow">Active from</span>
              <select
                value={parseMonth(stream.activeFrom).month1}
                onChange={(e) => updateStream(stream.id, {
                  activeFrom: monthKey(parseMonth(stream.activeFrom).year, Number(e.target.value))
                })}
              >
                {Array.from({ length: 12 }, (_, i) => (
                  <option key={i} value={i + 1}>{longMonthName(monthKey(ui.year, i + 1))}</option>
                ))}
              </select>
            </label>
            <label className="field">
              <span className="eyebrow">Active from year</span>
              <select
                value={parseMonth(stream.activeFrom).year}
                onChange={(e) => updateStream(stream.id, {
                  activeFrom: monthKey(Number(e.target.value), parseMonth(stream.activeFrom).month1)
                })}
              >
                {knownYears().map((y) => <option key={y} value={y}>{y}</option>)}
              </select>
            </label>
          </div>

          <label className="field">
            <span className="eyebrow">Ended</span>
            <select
              value={stream.activeTo ?? ''}
              onChange={(e) => updateStream(stream.id, { activeTo: e.target.value || null })}
            >
              <option value="">Still going</option>
              {knownYears().flatMap((y) =>
                Array.from({ length: 12 }, (_, i) => {
                  const key = monthKey(y, i + 1);
                  return <option key={key} value={key}>{longMonthName(key)} {y}</option>;
                })
              )}
            </select>
            <p className="help-note">
              A stream that ended contributes nothing after that month to
              {' '}{phase === 'trialWork' ? 'your trial work months' : 'your limit'}.
            </p>
          </label>
          </fieldset>
    </>
  );
}
