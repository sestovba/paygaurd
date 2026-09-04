import { forwardRef, useState, useRef } from 'react';
import type { InputHTMLAttributes } from 'react';
import { evalAmount } from '../../domain/expr';

type Props = Omit<InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange' | 'type'> & {
  value: number | undefined;
  onCommit: (next: number | undefined) => void;
};

export const NumericExprInput = forwardRef<HTMLInputElement, Props>(function NumericExprInput(
  { value, onCommit, onBlur, onFocus, onKeyDown, ...rest },
  ref
) {
  const [draft, setDraft] = useState<string | null>(null);
  const editStartRef = useRef(value);
  const skipBlurCommitRef = useRef(false);
  const shown = draft ?? (value == null ? '' : String(value));

  return (
    <input
      {...rest}
      ref={ref}
      type="text"
      inputMode="decimal"
      value={shown}
      onFocus={(event) => {
        editStartRef.current = value;
        skipBlurCommitRef.current = false;
        setDraft(value == null ? '' : String(value));
        // Select-all on focus so typing a new figure replaces the old one
        // instead of appending to it — the common case beats editing in place.
        event.target.select();
        onFocus?.(event);
      }}
      onChange={(event) => {
        const raw = event.target.value;
        setDraft(raw);
        if (!raw.trim()) {
          onCommit(undefined);
          return;
        }
        const next = evalAmount(raw);
        if (next !== undefined) onCommit(next);
      }}
      onBlur={(event) => {
        if (skipBlurCommitRef.current) {
          skipBlurCommitRef.current = false;
          setDraft(null);
          onBlur?.(event);
          return;
        }
        if (draft !== null) {
          if (!draft.trim()) onCommit(undefined);
          else {
            const next = evalAmount(draft);
            if (next !== undefined) onCommit(next);
          }
          setDraft(null);
        }
        onBlur?.(event);
      }}
      onKeyDown={(event) => {
        if (event.key === 'Escape') {
          event.preventDefault();

          const original = editStartRef.current;

          skipBlurCommitRef.current = true;
          setDraft(original == null ? '' : String(original));

          onCommit(original == null ? undefined : original);
          event.currentTarget.blur();

          onKeyDown?.(event);
          return;
        }

        if (event.key === 'Enter') {
          event.currentTarget.blur();
        }

        onKeyDown?.(event);
      }}
    />
  );
});
