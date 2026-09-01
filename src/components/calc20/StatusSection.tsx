import type { MonthKey } from '../../domain/types';
import { useTracker } from './state';
import { money } from '../../domain/format';
import { formatMonth, monthsOfYear, shortMonthName, todayMonth, yearOf } from '../../domain/months';
import { monthStatus, yearTotal } from '../../domain/earnings';
import {
  benefitPhase, trialWorkStatus, TRIAL_MONTH_LIMIT, ROLLING_WINDOW
} from '../../domain/trialWork';
import { rulesFor, TWP_SELF_EMPLOYMENT_HOURS } from '../../domain/rules';
import { SafeWorkSimulator } from './SafeWorkSimulator';
import { TrialMeter } from './TrialMeter';

function chipLabel(month: MonthKey, year: number): string {
  const name = shortMonthName(month);
  return yearOf(month) === year ? name : name + ' ' + yearOf(month);
}

export function StatusSection() {
  const { data, ui } = useTracker();
  const now = todayMonth();
  const asOf = yearOf(now) === ui.year ? now : monthsOfYear(ui.year)[11];
  const phase = benefitPhase(data, asOf);
  const twp = trialWorkStatus(data, asOf);
  const rules = rulesFor(ui.year);
  const overMonths = monthsOfYear(ui.year).filter((m) => monthStatus(data, m).overSga);

  /* One limit is named on every branch, and never the other one. */
  const title = phase === 'trialWork'
    ? 'Trial work'
    : phase === 'sga'
      ? 'Your limit this year'
      : 'Where you stand';
  const meta = phase === 'trialWork'
    ? `Your limit ${money(rules.trialWork)}`
    : phase === 'sga'
      ? `Your limit ${money(rules.sga)}`
      : 'No limit yet — tell us where you stand';

  return (
    <div className="totals-card">
      <div className="totals-card__head">
        <span className="totals-card__title">{title}</span>
        <span className="stream-card__meta">{meta}</span>
      </div>

      {phase === 'trialWork' ? (
        <>
          <div className="sheet-hero">
            <div className="grow">
              <div className="eyebrow">Trial months left</div>
              <div className="hero-figure">
                {twp.remaining}
                <span className="hero-figure__of"> of {TRIAL_MONTH_LIMIT}</span>
              </div>
            </div>
            <TrialMeter used={twp.used} prior={data.priorTrialMonths.length} showLabel={false} />
          </div>
          <p className="help-note">
            Counted pay over {money(rules.trialWork)} uses one trial work month.
            Working for yourself more than {TWP_SELF_EMPLOYMENT_HOURS} hours in a month
            can use one too, even on small pay.
            {' '}You have {TRIAL_MONTH_LIMIT} of them, over any {ROLLING_WINDOW} months.
            {twp.nextExpiry
              ? ` Oldest recorded month leaves the window in ${formatMonth(twp.nextExpiry)}.`
              : ''}
          </p>
        </>
      ) : phase === 'sga' ? (
        <>
          <div className="sheet-hero">
            <div className="grow">
              <div className="eyebrow">Months over your limit</div>
              <div className={'hero-figure' + (overMonths.length ? ' hero-figure--over' : '')}>
                {overMonths.length}
              </div>
            </div>
          </div>
          <p className="help-note">
            {overMonths.length
              ? `Counted pay over ${money(rules.sga)} in the months below.`
              : `Nothing over your ${money(rules.sga)} limit this year.`}
          </p>
        </>
      ) : (
        <div className="phase-warning">
          {phase === 'verifyComplete'
            ? 'Nine trial work months are on record. Check them in App settings against your own paperwork — after that your limit changes.'
            : 'Until you tell us where you stand there is no limit to warn you about, and the hours planner stays off.'}
        </div>
      )}

      {phase === 'trialWork' && twp.inWindow.length ? (
        <div className="chip-row">
          {twp.inWindow.map((month) => (
            <span className="chip chip--spent" key={month}>{chipLabel(month, ui.year)}</span>
          ))}
        </div>
      ) : null}
      {phase === 'sga' && overMonths.length ? (
        <div className="chip-row">
          {overMonths.map((month) => (
            <span className="chip chip--over" key={month}>{chipLabel(month, ui.year)}</span>
          ))}
        </div>
      ) : null}

      <div className="rows">
        {phase === 'trialWork' ? (
          <div className="rows__row">
            <span className="rows__label grow">Trial work months recorded</span>
            <span className="rows__value">{twp.used}</span>
          </div>
        ) : null}
        <div className="rows__row">
          <div className="grow">
            <div className="rows__label">{ui.year} countable total</div>
            <div className="help-note">all sources, after tracked deductions</div>
          </div>
          <span className="rows__value">{money(yearTotal(data, ui.year))}</span>
        </div>
      </div>

      <SafeWorkSimulator />
    </div>
  );
}
