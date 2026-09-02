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
              <div className="eyebrow">Trial work months left</div>
              <div className="hero-figure">
                {twp.remaining}
                <span className="hero-figure__of"> of {TRIAL_MONTH_LIMIT}</span>
              </div>
            </div>
            <TrialMeter used={twp.used} prior={data.priorTrialMonths.length} showLabel={false} />
          </div>
          {/* The same paragraph as workrecord's, fixed the same way: one
               idea a sentence, and "leaves the window" says what happens to
               the reader rather than what happens to our record. */}
          <p className="help-note">
            Earning more than {money(rules.trialWork)} in a month uses one trial work month.
            So does working more than {TWP_SELF_EMPLOYMENT_HOURS} hours for yourself, even if you earned very little.
            {' '}You get {TRIAL_MONTH_LIMIT} of them across any {ROLLING_WINDOW} months.
            {twp.nextExpiry
              ? ` Your oldest one stops counting in ${formatMonth(twp.nextExpiry)}.`
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
              ? `These months counted more than your ${money(rules.sga)} limit.`
              : `No month has gone over your ${money(rules.sga)} limit this year.`}
          </p>
        </>
      ) : (
        <div className="phase-warning">
          {phase === 'verifyComplete'
            ? 'We have nine trial work months on record. Check them in App settings against your own paperwork. After that, your limit changes.'
            : 'We cannot warn you about a limit until you tell us where you stand. The hours planner stays off until then, too.'}
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
            <div className="rows__label">Counted toward your limit in {ui.year}</div>
            <div className="help-note">every job, after your miles come off</div>
          </div>
          <span className="rows__value">{money(yearTotal(data, ui.year))}</span>
        </div>
      </div>

      <SafeWorkSimulator />
    </div>
  );
}
