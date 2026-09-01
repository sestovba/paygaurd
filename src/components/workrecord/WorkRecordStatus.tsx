// The Status slab: what phase you are in, which months are spent, and the
// planner. Ported from sga_calc20's StatusSection — same progression (trial
// work → SGA → unconfirmed), rebuilt on the PayGuard tokens so it retheme
// with the rest of the layout.

import type { MonthKey } from '../../domain/types';
import { useTracker } from '../../state/TrackerProvider';
import { money } from '../../domain/format';
import { formatMonth, monthsOfYear, shortMonthName, todayMonth, yearOf } from '../../domain/months';
import { monthStatus, yearTotal } from '../../domain/earnings';
import {
  benefitPhase, trialWorkStatus, ROLLING_WINDOW, TRIAL_MONTH_LIMIT
} from '../../domain/trialWork';
import { rulesFor, TWP_SELF_EMPLOYMENT_HOURS } from '../../domain/rules';
import { SafeWorkSimulator } from '../SafeWorkSimulator';
import { TrialMeter } from '../TrialMeter';
import { ReviewTarget } from '../../review/ReviewTarget';

/** A month from a prior year has to say which year it came from. */
function chipLabel(month: MonthKey, year: number): string {
  const name = shortMonthName(month);
  return yearOf(month) === year ? name : `${name} ${yearOf(month)}`;
}

export function WorkRecordStatus({ onReviewStatus }: { onReviewStatus: () => void }) {
  const { data, ui } = useTracker();
  const now = todayMonth();
  const asOf = yearOf(now) === ui.year ? now : monthsOfYear(ui.year)[11];
  const phase = benefitPhase(data, asOf);
  const twp = trialWorkStatus(data, asOf);
  const rules = rulesFor(ui.year);
  const overMonths = monthsOfYear(ui.year).filter((m) => monthStatus(data, m).overSga);

  const title = phase === 'trialWork' ? 'Trial work'
    : phase === 'sga' ? 'SGA this year' : 'Benefit phase';
  const meta = phase === 'trialWork' ? `TWP month ${money(rules.trialWork)}`
    : phase === 'sga' ? `SGA ${money(rules.sga)}`
      : 'Confirm TWP status before relying on a limit';

  return (
    <div className="flex flex-col gap-3">
      <div className="pg-card overflow-hidden">
        <header className="pg-section-head">
          <span className="flex min-w-0 flex-1 items-center gap-2">
            <span className="pg-section-title">{title}</span>
            <span className="pg-section-meta hidden truncate xs:block">{meta}</span>
          </span>
        </header>

        <div className="flex flex-col gap-3 p-3.5 sm:p-4">
          {phase === 'trialWork' ? (
            <>
              <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-3">
                <div className="min-w-0">
                  <span className="pg-label">Trial months left</span>
                  <div className="pg-figure pg-figure-lg mt-1">
                    {twp.remaining}
                    <span className="ml-1 text-sm font-semibold pg-dim">of {TRIAL_MONTH_LIMIT}</span>
                  </div>
                </div>
                <div className="min-w-[9rem] flex-1">
                  <TrialMeter used={twp.used} prior={data.priorTrialMonths.length} />
                </div>
              </div>
              <p className="wr-note">
                Countable earnings over {money(rules.trialWork)} use one TWP month.
                Self-employment over {TWP_SELF_EMPLOYMENT_HOURS} hours can also count.
                {' '}{TRIAL_MONTH_LIMIT} service months in {ROLLING_WINDOW} complete the TWP.
                {twp.nextExpiry
                  ? ` The oldest recorded month leaves the window in ${formatMonth(twp.nextExpiry)}.`
                  : ''}
              </p>
              {twp.inWindow.length ? (
                <div className="wr-chip-row">
                  {twp.inWindow.map((month) => (
                    <span key={month} className="pg-badge pg-badge-twp">{chipLabel(month, ui.year)}</span>
                  ))}
                </div>
              ) : null}
            </>
          ) : phase === 'sga' ? (
            <>
              <div>
                <span className="pg-label">Months over SGA</span>
                <div
                  className="pg-figure pg-figure-lg mt-1"
                  style={overMonths.length ? { color: 'var(--pg-over-text)' } : undefined}
                >
                  {overMonths.length}
                </div>
              </div>
              <p className="wr-note">
                {overMonths.length
                  ? `Countable earnings over ${money(rules.sga)} in the months below.`
                  : `Nothing above the ${money(rules.sga)} working limit this year.`}
              </p>
              {overMonths.length ? (
                <div className="wr-chip-row">
                  {overMonths.map((month) => (
                    <span key={month} className="pg-badge pg-badge-over">{chipLabel(month, ui.year)}</span>
                  ))}
                </div>
              ) : null}
            </>
          ) : (
            <div className="flex flex-wrap items-center gap-3">
              <p className="wr-note min-w-[16rem] flex-1">
                {phase === 'verifyComplete'
                  ? 'Nine possible TWP months are recorded. Verify them before the tracker switches to SGA mode.'
                  : 'TWP status is not confirmed, so limit warnings and the hours planner stay paused.'}
              </p>
              <button type="button" className="pg-btn" onClick={onReviewStatus}>
                Review status
              </button>
            </div>
          )}

          <div className="wr-rows">
            {phase === 'trialWork' ? (
              <div className="wr-row">
                <span className="wr-row-label flex-1">TWP months recorded</span>
                <span className="pg-figure pg-figure-sm">{twp.used}</span>
              </div>
            ) : null}
            <ReviewTarget
              id="workrecord-status-year-total"
              label="Status year total"
              reason="The TWP / SGA panel should show the active monthly rule, not a repeated annual total."
              certainty="sure"
              layout="workrecord"
            >
              <div className="wr-row">
                <span className="flex-1">
                  <span className="wr-row-label block">{ui.year} countable total</span>
                  <span className="wr-row-note">all sources, after tracked deductions</span>
                </span>
                <span className="pg-figure pg-figure-sm">{money(yearTotal(data, ui.year))}</span>
              </div>
            </ReviewTarget>
          </div>
        </div>
      </div>

      <ReviewTarget
        id="workrecord-safe-work-simulator"
        label="Safe-work simulator"
        reason="The multi-input planner overwhelms the core status view and belongs in an optional advanced tool."
        certainty="hunch"
        layout="workrecord"
      >
        <SafeWorkSimulator />
      </ReviewTarget>
    </div>
  );
}
