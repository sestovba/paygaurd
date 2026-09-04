import { useState } from 'react';
import { useTracker } from '../state/TrackerProvider';
import { formatMonth } from '../domain/months';
import { recentMonths } from '../domain/trialWork';
import { InfoNote } from './InfoNote';
import { TwpStatusPicker } from './TwpStatusPicker';
import type { TwpState } from './TwpStatusPicker';

import { ButtonBase } from '../design-system';
/** The TWP self-assessment — shared by the Settings sheet's Status modal
 *  and the standalone Status page, so the two never drift apart. This is
 *  the quiet, revisit-anytime version; first-time setup uses TwpWizard. */
export function TwpStatusForm() {
  const { data, setTwpAssessment, setPriorTrialMonths } = useTracker();
  const [priorText, setPriorText] = useState('');
  const state = data.twpAssessment.state as TwpState;

  return (
    <div className="flex flex-col gap-4">
      {/* Review note: "this is making me tired to read... they dont want to
          think hard and want an easy explanation, we are failing in
          communication." Two clauses: where to look it up, and why it is
          worth looking up rather than guessing. */}
      <InfoNote>
        Check a benefit letter if you have one. Guess here and every number we
        show you is a guess too.
      </InfoNote>

      <TwpStatusPicker
        state={state}
        onChange={(next) => setTwpAssessment({
          state: next,
          basis: next === 'unknown' ? 'unconfirmed' : 'personal-records',
          checkedOn: next === 'unknown' ? undefined : new Date().toISOString().slice(0, 10)
        })}
      />

      {state === 'remaining' ? (
        <div className="flex flex-col gap-2">
          <span className="field-label">Trial work months already used (before this app)</span>
          <p className="type-muted">
            {data.priorTrialMonths.length ? data.priorTrialMonths.map(formatMonth).join(', ') : 'None recorded yet.'}
          </p>
          <div className="flex gap-2">
            <input
              className="field-input w-24"
              type="text"
              inputMode="numeric"
              placeholder="0–9"
              value={priorText}
              onChange={(e) => setPriorText(e.target.value.replace(/[^0-9]/g, ''))}
            />
            <ButtonBase
              type="button"
              className="btn-primary shrink-0"
              onClick={() => {
                const n = Math.max(0, Math.min(9, Number(priorText) || 0));
                if (!n) return;
                setPriorTrialMonths(recentMonths(n));
                setPriorText('');
              }}
            >
              Fill in
            </ButtonBase>
          </div>
          <InfoNote>
            Fills the most recent months before now. You can change any of them
            after.
          </InfoNote>
        </div>
      ) : null}
    </div>
  );
}
