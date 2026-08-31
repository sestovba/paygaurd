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

const STEP_COPY: Record<Step, { eyebrow: string; title: string }> = {
  start: { eyebrow: 'Check-in · 1 of 3', title: 'When did benefits start?' },
  worked: { eyebrow: 'Check-in · 2 of 3', title: 'Any paid work since then?' },
  estimate: { eyebrow: 'Check-in · 3 of 3', title: 'Typical monthly pay' },
  knowsTwp: { eyebrow: 'Check-in · 3 of 3', title: 'Do you know your Trial Work status?' },
  count: { eyebrow: 'Check-in · almost done', title: 'How many months?' },
  conclusion: { eyebrow: 'Your result', title: 'Here is where you stand' }
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
      headline: 'You are starting with a clean slate',
      detail: 'No work yet means all 9 Trial Work months are still available. Add a job when you are ready and we will watch the limits from here.'
    });
  }

  function hasWorked() {
    if (monthsSince >= LONG_AGO_MONTHS) {
      land('complete', 'unconfirmed', null, {
        headline: 'Your Trial Work Period has most likely already passed',
        detail: 'Benefits that started this long ago almost always have. We will track the Substantial Gainful Activity (SGA) limit instead — that is the number that matters now. Confirm with Social Security when you can.',
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
      headline: 'You are likely still early in your Trial Work Period',
      detail: `At ${money(earnings)} a month, you probably have not used any Trial Work months yet. A quick check with Social Security can confirm you are starting clean.`
    } : remaining <= 0 ? {
      headline: 'Best guess: all 9 Trial Work months are used',
      detail: 'That is only an estimate from what you told us. The real count depends on your pay stubs — worth confirming with Social Security before you rely on it.'
    } : {
      headline: `Best guess: about ${remaining} of 9 Trial Work months left`,
      detail: 'That is an estimate, not a certainty. Social Security can confirm the exact count.'
    });
  }

  function dontKnowStatus() {
    land('unknown', 'unconfirmed', null, {
      headline: 'We will not guess on this one',
      detail: 'A wrong count here could point you the wrong way at the wrong moment. Check your benefits letter or call Social Security, then come back and we will take it from there.'
    });
  }

  function submitCount() {
    const n = Math.max(0, Math.min(9, countValue ?? 0));
    const used = countMode === 'used' ? n : 9 - n;
    const remaining = 9 - used;
    land(remaining <= 0 ? 'complete' : 'remaining', 'personal-records', used, {
      headline: remaining <= 0 ? 'All 9 Trial Work months are used' : `${remaining} of 9 Trial Work months left`,
      detail: 'Got it — we will track your limits from here based on what you told us.'
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
          The Trial Work Period is 9 months — they do not have to be in a row — when you can test working without it counting against benefits.
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
