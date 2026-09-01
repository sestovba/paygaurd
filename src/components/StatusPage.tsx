import { useTracker } from '../state/TrackerProvider';
import { money } from '../domain/format';
import { formatMonth, todayMonth } from '../domain/months';
import { rulesFor } from '../domain/rules';
import { benefitPhase, trialWorkStatus, TRIAL_MONTH_LIMIT } from '../domain/trialWork';
import { TrialMeter } from './TrialMeter';
import { TwpStatusForm } from './TwpStatusForm';
import { SafeWorkSimulator } from './SafeWorkSimulator';

/**
 * Four review notes landed on this page and they are the same note.
 *
 *   "Where you stand" — an eyebrow that describes the act of reading a page.
 *   "Update" — "is the word a call to action or is it a type of information?"
 *   "This is what drives every limit warning on Overview" — "nice, a long
 *   explanation is a symptom of bad design."
 *   And, on the substantial-work branch: "when TWP is exhausted I don't need
 *   any explanation or mention of it — this section is reminding me about
 *   something that's no longer there."
 *
 * So: no eyebrows that name a genre instead of a thing, headings that are
 * nouns you could point at, and the trial work period spoken of only while
 * you are in it. Past it, the page states the limit that does apply and says
 * nothing at all about the one that does not.
 */
export function StatusPage() {
  const { data, ui } = useTracker();
  const now = todayMonth();
  const phase = benefitPhase(data, now);
  const twp = trialWorkStatus(data, now);
  const rules = rulesFor(ui.year);

  return (
    <div className="flex flex-col gap-5">
      {phase === 'trialWork' || phase === 'verifyComplete' ? (
        <section className="panel p-5 sm:p-6">
          <h2 className="display-figure text-2xl">
            {twp.used} of {TRIAL_MONTH_LIMIT} trial work months used
          </h2>
          <p className="type-muted mt-2">
            {twp.remaining} left in the current 60-month window
            {twp.nextExpiry ? `. The oldest one ages out ${formatMonth(twp.nextExpiry)}.` : '.'}
          </p>
          <TrialMeter used={twp.used} prior={data.priorTrialMonths.length} />
        </section>
      ) : phase === 'sga' ? (
        <section className="panel p-5 sm:p-6">
          <h2 className="display-figure text-2xl">{money(rules.sga)} a month</h2>
          <p className="type-muted mt-2">
            That is your limit. Earn more than it in a calendar month and your benefits are at
            risk.
          </p>
        </section>
      ) : null}

      <SafeWorkSimulator />

      <section className="panel p-5 sm:p-6">
        <h2 className="display-figure text-2xl">Your status</h2>
        <p className="type-muted mt-2">Sets the limit used everywhere else. Change it anytime.</p>
        <div className="mt-4">
          <TwpStatusForm />
        </div>
      </section>
    </div>
  );
}
