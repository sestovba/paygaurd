// The three-way TWP status choice, shared by onboarding and Settings so
// the icons and wording can't drift between the two places someone picks
// it. A checkmark and a red X carry the "good news / bad news" meaning
// faster than the label text alone.

import { CheckIcon, CloseIcon } from './Icons';

export type TwpState = 'unknown' | 'remaining' | 'complete';

const OPTIONS: Array<{ state: TwpState; label: string }> = [
  { state: 'unknown', label: 'Not sure' },
  { state: 'remaining', label: 'TWP remains' },
  { state: 'complete', label: 'TWP used up' }
];

export function TwpStatusControl({
  state,
  onChange,
  variant,
  wrapperClassName
}: {
  state: TwpState;
  onChange: (state: TwpState) => void;
  /** `seg` needs the `.seg__btn`/`.seg__btn--on` classes explicitly — unlike
   *  `.segmented`, its selected look is not derived from aria-pressed alone. */
  variant: 'seg' | 'segmented';
  /** Extra class(es) on the group wrapper, alongside the base `seg`/`segmented`. */
  wrapperClassName?: string;
}) {
  const groupClass = variant + (wrapperClassName ? ' ' + wrapperClassName : '');

  return (
    <div className={groupClass} role="group" aria-label="Trial work status">
      {OPTIONS.map(({ state: optionState, label }) => {
        const on = state === optionState;
        return (
          <button
            className={variant === 'seg' ? 'seg__btn' + (on ? ' seg__btn--on' : '') : undefined}
            key={optionState}
            type="button"
            aria-pressed={on}
            onClick={() => onChange(optionState)}
          >
            {optionState === 'remaining' ? (
              <CheckIcon className="twp-status-icon twp-status-icon--good" size={14} />
            ) : optionState === 'complete' ? (
              <CloseIcon className="twp-status-icon twp-status-icon--bad" size={14} />
            ) : null}
            {label}
          </button>
        );
      })}
    </div>
  );
}
