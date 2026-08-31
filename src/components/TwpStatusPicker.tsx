import { Check, X } from 'lucide-react';

export type TwpState = 'unknown' | 'remaining' | 'complete';

const OPTIONS: Array<{ state: TwpState; label: string }> = [
  { state: 'unknown', label: 'Not sure' },
  { state: 'remaining', label: 'TWP remains' },
  { state: 'complete', label: 'TWP used up' }
];

export function TwpStatusPicker({
  state, onChange
}: {
  state: TwpState;
  onChange: (state: TwpState) => void;
}) {
  return (
    <div
      className="flex flex-wrap items-center gap-2"
      role="group"
      aria-label="Trial work status"
    >
      {OPTIONS.map(({ state: optionState, label }) => {
        const on = state === optionState;
        return (
          <button
            key={optionState}
            type="button"
            aria-pressed={on}
            onClick={() => onChange(optionState)}
            className={
              'chip flex items-center gap-1.5 border px-3.5 py-2 text-base '
              + (on
                ? 'border-primary bg-surface font-semibold text-foreground'
                : 'border-border bg-surface-2 font-medium text-muted-foreground hover:text-foreground')
            }
          >
            {optionState === 'remaining' ? (
              <Check className="size-4 text-good" />
            ) : optionState === 'complete' ? (
              <X className="size-4 text-destructive" />
            ) : null}
            {label}
          </button>
        );
      })}
    </div>
  );
}
