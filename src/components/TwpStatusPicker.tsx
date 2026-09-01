import { Check, X } from 'lucide-react';

export type TwpState = 'unknown' | 'remaining' | 'complete';

/* Not "TWP remains" / "TWP used up". The abbreviation is the thing the app
   has decided never to print, and these three are the words in the one place
   where the reader is asked about it directly. */
const OPTIONS: Array<{ state: TwpState; label: string }> = [
  { state: 'unknown', label: 'Not sure' },
  { state: 'remaining', label: 'Trial months left' },
  { state: 'complete', label: 'All used up' }
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
