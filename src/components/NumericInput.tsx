import { forwardRef, useState } from 'react';
import type { InputHTMLAttributes } from 'react';
import { evalAmount } from '../domain/expr';

type Props = Omit<InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange' | 'type'> & {
  value: number | undefined;
  onCommit: (next: number | undefined) => void;
  /** A fixed character shown inside the field, e.g. "$" for dollar amounts. */
  prefix?: string;
  /** Reserve padding as if the prefix were this many characters wide, so a
   *  shorter prefix (e.g. "$") can line up its value with a longer one
   *  (e.g. "mi") stacked above or below it. Defaults to prefix.length. */
  prefixWidth?: number;
};

/** A number field that also accepts expressions (8×5, 1200+80). */
export const NumericInput = forwardRef<HTMLInputElement, Props>(function NumericInput(
  { value, onCommit, onBlur, onFocus, onKeyDown, prefix, prefixWidth, className, style, ...rest },
  ref
) {
  const [draft, setDraft] = useState<string | null>(null);
  const shown = draft ?? (value == null ? '' : String(value));

  const input = (
    <input
      {...rest}
      ref={ref}
      type="text"
      inputMode="decimal"
      value={shown}
      className={className}
      style={prefix ? { paddingLeft: `calc(0.75rem + ${prefixWidth ?? prefix.length}ch + 0.3rem)`, ...style } : style}
      onFocus={(event) => {
        setDraft(value == null ? '' : String(value));
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
        if (event.key === 'Enter' || event.key === 'Escape') event.currentTarget.blur();
        onKeyDown?.(event);
      }}
    />
  );

  const grow = /\b(w-full|flex-1|min-w-0)\b/.test(className ?? '');

  if (!prefix) return input;

  return (
    <div className={grow ? 'relative block min-w-0 w-full' : 'relative inline-block'}>
      <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-base text-muted-foreground">
        {prefix}
      </span>
      {input}
    </div>
  );
});
