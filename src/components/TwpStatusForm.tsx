import { useState } from 'react';
import { useTracker } from '../state/TrackerProvider';
import { formatMonth } from '../domain/months';
import { recentMonths } from '../domain/trialWork';
import { InfoNote } from './InfoNote';
import { TwpStatusPicker } from './TwpStatusPicker';
import type { TwpState } from './TwpStatusPicker';

/** The TWP self-assessment — shared by the Settings sheet's Status modal
 *  and the standalone Status page, so the two never drift apart. This is
 *  the quiet, revisit-anytime version; first-time setup uses TwpWizard. */
export function TwpStatusForm() {
  const { data, setTwpAssessment, setPriorTrialMonths } = useTracker();
  const [priorText, setPriorText] = useState('');
  const state = data.twpAssessment.state as TwpState;

  return (
    <div className="flex flex-col gap-4">
      <InfoNote>
        Base this on your benefit letters, SSA record, or personal history
        rather than memory alone — it drives every limit warning from here.
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
            <button
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
            </button>
          </div>
          <InfoNote>
            Fills the most recent months before now. These count toward the
            rolling 60-month window like any other recorded month, so they
            age out correctly over time — a stored number alone cannot do that.
          </InfoNote>
        </div>
      ) : null}
    </div>
  );
}
