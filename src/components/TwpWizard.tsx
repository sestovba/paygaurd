import { useState } from 'react';
import type { ReactNode } from 'react';
import { useTracker } from '../state/TrackerProvider';
import { money } from '../domain/format';
import { monthsBetween, todayMonth } from '../domain/months';
import { recentMonths } from '../domain/trialWork';
import { rulesFor } from '../domain/rules';
import { NumericInput } from './NumericInput';
import { Segmented } from './ui';
import { Sheet } from './Sheet';

type Step = 'start' | 'worked' | 'estimate' | 'knowsTwp' | 'count' | 'conclusion';

interface Conclusion {
  headline: string;
  detail: string;
  showCountEscape?: boolean;
}

interface PendingAssessment {
  state: 'remaining' | 'complete' | 'unknown';
  basis: 'personal-records' | 'unconfirmed';
  priorUsed: number | null;
}

const LONG_AGO_MONTHS = 60;
const RECENT_MONTHS = 11;

/* Every title is a question the reader can answer, except the last, which is
   the answer. "Typical monthly pay" was a noun phrase on a form; "Do you know
   your Trial Work status?" asked about a proper noun rather than about their
   own life. */
const STEP_COPY: Record<Step, { eyebrow: string; title: string }> = {
  start: { eyebrow: 'Question 1 of 3', title: 'When did your benefits start?' },
  worked: { eyebrow: 'Question 2 of 3', title: 'Have you done any paid work since then?' },
  estimate: { eyebrow: 'Question 3 of 3', title: 'How much do you usually make in a month?' },
  knowsTwp: { eyebrow: 'Question 3 of 3', title: 'How many of your 9 trial work months have you used?' },
  count: { eyebrow: 'Almost done', title: 'How many months?' },
  conclusion: { eyebrow: 'Your answer', title: 'Here is where you stand' }
};

/**
 * The TWP quiz — short, branching, and confident wherever the answer is
 * actually knowable. First-time setup only; TwpStatusForm is the quiet
 * way to revisit this later.
 */
export function TwpWizard({
  onClose, variant = 'sheet', backLabel
}: {
  onClose: () => void;
  variant?: 'sheet' | 'inline';
  backLabel?: string;
}) {
  const { setTwpAssessment, setPriorTrialMonths } = useTracker();
  const [step, setStep] = useState<Step>('start');
  const [history, setHistory] = useState<Step[]>([]);
  const [startMonth, setStartMonth] = useState('');
  const [monthlyEarnings, setMonthlyEarnings] = useState<number | undefined>(undefined);
  const [countMode, setCountMode] = useState<'used' | 'remaining'>('used');
  const [countValue, setCountValue] = useState<number | undefined>(undefined);
  const [conclusion, setConclusion] = useState<Conclusion | null>(null);
  const [pending, setPending] = useState<PendingAssessment | null>(null);

  const monthsSince = startMonth ? monthsBetween(startMonth, todayMonth()) : 0;

  function goTo(next: Step) {
    setHistory((current) => [...current, step]);
    setStep(next);
  }

  function goBack() {
    const previous = history[history.length - 1];
    if (!previous) return;
    setHistory((current) => current.slice(0, -1));
    setStep(previous);
    if (previous !== 'conclusion') {
      setConclusion(null);
    }
  }

  function land(
    state: 'remaining' | 'complete' | 'unknown',
    basis: 'personal-records' | 'unconfirmed',
    priorUsed: number | null,
    result: Conclusion
  ) {
    setPending({ state, basis, priorUsed });
    setConclusion(result);
    goTo('conclusion');
  }

  function finish() {
    if (pending) {
      setTwpAssessment({
        state: pending.state,
        basis: pending.basis,
        checkedOn: pending.basis === 'personal-records' ? new Date().toISOString().slice(0, 10) : undefined
      });
      if (pending.priorUsed !== null) setPriorTrialMonths(recentMonths(pending.priorUsed));
    }
    onClose();
  }

  function submitStart() {
    if (!startMonth) return;
    goTo('worked');
  }

  function notWorkedYet() {
    land('remaining', 'personal-records', 0, {
      /* "a clean slate" is an idiom, and the ones in this file are the
         worst-placed ones in the app: this is the screen where somebody is
         being told what their benefits situation is. */
      headline: 'All 9 of your trial work months are still yours',
      detail: 'You have not worked yet, so none of them are used. Add a job when you are ready and we will watch your limit from there.'
    });
  }

  function hasWorked() {
    if (monthsSince >= LONG_AGO_MONTHS) {
      land('complete', 'unconfirmed', null, {
        headline: 'Your 9 trial work months have most likely been used',
        detail: 'Benefits that started this long ago almost always have. We will watch the other limit instead — that is the one that matters for you now. Check with Social Security when you can.',
        showCountEscape: true
      });
    } else if (monthsSince <= RECENT_MONTHS) {
      goTo('estimate');
    } else {
      goTo('knowsTwp');
    }
  }

  function submitEstimate() {
    const earnings = monthlyEarnings ?? 0;
    const threshold = rulesFor(Number(todayMonth().slice(0, 4))).trialWork;
    const guessedUsed = earnings > threshold ? Math.min(monthsSince, 9) : 0;
    const remaining = 9 - guessedUsed;
    land(remaining <= 0 ? 'complete' : 'remaining', 'unconfirmed', guessedUsed, guessedUsed === 0 ? {
      headline: 'You have most likely used none of your 9 months yet',
      detail: `At ${money(earnings)} a month, you probably have not used any trial work months. Social Security can confirm that for you.`
    } : remaining <= 0 ? {
      headline: 'Our best guess: all 9 of your trial work months are used',
      detail: 'This is a guess from what you told us. The real count comes from your paystubs. Check with Social Security before you rely on it.'
    } : {
      headline: `Our best guess: about ${remaining} of your 9 trial work months are left`,
      detail: 'This is a guess, not a fact. Social Security can tell you the exact count.'
    });
  }

  function dontKnowStatus() {
    land('unknown', 'unconfirmed', null, {
      headline: 'We will not guess at this one',
      detail: 'Getting this wrong could point you the wrong way at the worst moment. Check your benefits letter or call Social Security, then come back and we will take it from there.'
    });
  }

  function submitCount() {
    const n = Math.max(0, Math.min(9, countValue ?? 0));
    const used = countMode === 'used' ? n : 9 - n;
    const remaining = 9 - used;
    land(remaining <= 0 ? 'complete' : 'remaining', 'personal-records', used, {
      headline: remaining <= 0 ? 'All 9 of your trial work months are used' : `${remaining} of your 9 trial work months are left`,
      detail: 'Got it. We will watch your limit from here, using what you told us.'
    });
  }

  const chrome = STEP_COPY[step];
  let body: ReactNode;
  let primary: ReactNode = null;

  if (step === 'start') {
    body = (
      <>
        <p className="type-muted">
          A few short questions. We only ask what we need to put the right limit in front of you.
        </p>
        <label className="flex flex-col gap-1.5">
          <span className="field-label">Month your disability benefits started</span>
          <input
            className="field-input"
            type="month"
            autoFocus
            value={startMonth}
            onChange={(e) => setStartMonth(e.target.value)}
            max={todayMonth()}
          />
        </label>
      </>
    );
    primary = (
      <button type="button" disabled={!startMonth} onClick={submitStart} className="btn-primary ml-auto">
        Continue
      </button>
    );
  } else if (step === 'worked') {
    body = (
      <>
        <p className="type-muted">Any paid hours count — even a short gig.</p>
        <div className="grid grid-cols-2 gap-3">
          <button type="button" onClick={hasWorked} className="seg-item rounded-lg border border-border bg-surface-2 py-3.5 text-base font-semibold">
            Yes
          </button>
          <button type="button" onClick={notWorkedYet} className="seg-item rounded-lg border border-border bg-surface-2 py-3.5 text-base font-semibold">
            Not yet
          </button>
        </div>
      </>
    );
  } else if (step === 'estimate') {
    body = (
      <label className="flex flex-col gap-1.5">
        <span className="field-label">About how much do you make in a typical month?</span>
        <NumericInput
          className="num field-input w-full"
          prefix="$"
          value={monthlyEarnings}
          placeholder="0"
          autoFocus
          onCommit={setMonthlyEarnings}
        />
        <span className="type-muted">A round number is fine. We only use it for an early estimate.</span>
      </label>
    );
    primary = (
      <button type="button" onClick={submitEstimate} className="btn-primary ml-auto">
        See my estimate
      </button>
    );
  } else if (step === 'knowsTwp') {
    body = (
      <>
        <p className="type-muted">
          You get 9 months when you can try working without it counting against your benefits. They do not have to be one after another.
        </p>
        <p className="type-muted">
          Do you know how many you have used?
        </p>
        <div className="grid grid-cols-2 gap-3">
          <button type="button" onClick={() => goTo('count')} className="seg-item rounded-lg border border-border bg-surface-2 py-3.5 text-base font-semibold">
            Yes, I know
          </button>
          <button type="button" onClick={dontKnowStatus} className="seg-item rounded-lg border border-border bg-surface-2 py-3.5 text-base font-semibold">
            Not sure
          </button>
        </div>
      </>
    );
  } else if (step === 'count') {
    body = (
      <>
        <p className="type-muted">Use whichever number is easier to remember.</p>
        <Segmented
          value={countMode}
          onChange={setCountMode}
          options={[
            { id: 'used', label: 'Months used' },
            { id: 'remaining', label: 'Months left' }
          ]}
        />
        <NumericInput
          className="num field-input w-full"
          value={countValue}
          placeholder="0–9"
          autoFocus
          onCommit={setCountValue}
        />
        <button type="button" onClick={dontKnowStatus} className="text-left text-base font-medium text-muted-foreground hover:text-foreground">
          Actually, I do not know
        </button>
      </>
    );
    primary = (
      <button type="button" disabled={countValue === undefined} onClick={submitCount} className="btn-primary">
        Continue
      </button>
    );
  } else if (conclusion) {
    body = (
      <>
        <div className="rounded-lg border border-border bg-surface-2 p-4">
          <p className="text-lg font-semibold leading-snug">{conclusion.headline}</p>
          <p className="type-muted mt-2">{conclusion.detail}</p>
        </div>
        {conclusion.showCountEscape ? (
          <button
            type="button"
            onClick={() => goTo('count')}
            className="text-left text-base font-medium text-muted-foreground hover:text-foreground"
          >
            I know how many months I have left
          </button>
        ) : null}
      </>
    );
    primary = (
      <button type="button" onClick={finish} className="btn-primary ml-auto">
        Save and continue
      </button>
    );
  }

  return (
    <Sheet
      title={chrome.title}
      eyebrow={chrome.eyebrow}
      onClose={onClose}
      footer={
        <div className="flex w-full items-center justify-between gap-3">
          {history.length ? (
            <button type="button" onClick={goBack} className="text-base font-medium text-muted-foreground hover:text-foreground">
              Back
            </button>
          ) : <span />}
          {primary}
        </div>
      }
      variant={variant === 'inline' ? 'inline' : 'modal'}
      backLabel={variant === 'inline' ? backLabel : undefined}
    >
      {body}
    </Sheet>
  );
}
