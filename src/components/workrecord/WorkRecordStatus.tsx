// The Status slab: what phase you are in, which months are spent, and the
// planner. Ported from sga_calc20's StatusSection — same progression (trial
// work → after it → unconfirmed), rebuilt on the PayGuard tokens so it retheme
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

  /* One limit is named and the other never is, on every branch here. Which
     regime you are in decides the figure and the words; it is not something
     the reader is told about. */
  const title = phase === 'trialWork' ? 'Trial work'
    : phase === 'sga' ? 'Your limit this year' : 'Where you stand';
  const meta = phase === 'trialWork' ? `Your limit ${money(rules.trialWork)}`
    : phase === 'sga' ? `Your limit ${money(rules.sga)}`
      : 'No limit yet — tell us where you stand';

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
                  <span className="pg-label">Trial work months left</span>
                  <div className="pg-figure pg-figure-lg mt-1">
                    {twp.remaining}
                    <span className="ml-1 text-sm font-semibold pg-dim">of {TRIAL_MONTH_LIMIT}</span>
                  </div>
                </div>
                <div className="min-w-[9rem] flex-1">
                  <TrialMeter used={twp.used} prior={data.priorTrialMonths.length} />
                </div>
              </div>
              {/* Four facts in one paragraph, joined by full stops that were
                   doing the work of paragraph breaks. One idea a sentence, and
                   the two that are rules come before the two that are counts. */}
              <p className="wr-note">
                Earning more than {money(rules.trialWork)} in a month uses one trial work month.
                So does working more than {TWP_SELF_EMPLOYMENT_HOURS} hours for yourself, even if you earned very little.
                {' '}You get {TRIAL_MONTH_LIMIT} of them across any {ROLLING_WINDOW} months.
                {twp.nextExpiry
                  ? ` Your oldest one stops counting in ${formatMonth(twp.nextExpiry)}.`
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
                <span className="pg-label">Months over your limit</span>
                <div
                  className="pg-figure pg-figure-lg mt-1"
                  style={overMonths.length ? { color: 'var(--pg-over-text)' } : undefined}
                >
                  {overMonths.length}
                </div>
              </div>
              <p className="wr-note">
                {overMonths.length
                  ? `These months counted more than your ${money(rules.sga)} limit.`
                  : `No month has gone over your ${money(rules.sga)} limit this year.`}
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
                  ? 'We have nine trial work months on record. Check them against your own paperwork. After that, your limit changes.'
                  : 'We cannot warn you about a limit until you tell us where you stand. The hours planner stays off until then, too.'}
              </p>
              <button type="button" className="pg-btn" onClick={onReviewStatus}>
                Review status
              </button>
            </div>
          )}

          <div className="wr-rows">
            {phase === 'trialWork' ? (
              <div className="wr-row">
                <span className="wr-row-label flex-1">Trial work months we have on record</span>
                <span className="pg-figure pg-figure-sm">{twp.used}</span>
              </div>
            ) : null}
            <ReviewTarget
              id="workrecord-status-year-total"
              label="Status year total"
              reason="This panel should show the limit in force this month, not a repeated annual total."
              layout="workrecord"
            >
              <div className="wr-row">
                <span className="flex-1">
                  {/* "2026 countable total / all sources, after tracked
                       deductions" — three pieces of accounting language in
                       nine words, on the row the reviewer said they were lost
                       in. */}
                  <span className="wr-row-label block">Counted toward your limit in {ui.year}</span>
                  <span className="wr-row-note">every job, after your miles come off</span>
                </span>
                <span className="pg-figure pg-figure-sm">{money(yearTotal(data, ui.year))}</span>
              </div>
            </ReviewTarget>
          </div>
        </div>
      </div>

      <ReviewTarget
        id="workrecord-safe-work-simulator"
        label="Hours you can work"
        reason="The multi-input planner overwhelms the core status view and belongs in an optional advanced tool."
        layout="workrecord"
      >
        <SafeWorkSimulator onOpenStatus={onReviewStatus} />
      </ReviewTarget>
    </div>
  );
}
