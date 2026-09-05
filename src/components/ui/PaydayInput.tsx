import { forwardRef, useRef, useState } from 'react';
import type { InputHTMLAttributes } from 'react';
import { PAYDAY_MAX, PAYDAY_MIN } from '../../domain/paySchedule';

type Props = Omit<InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange' | 'type'> & {
  /** Day of the month, 1–31. */
  value: number | undefined;
  /** Fires with a day in range, or undefined when the field is cleared. */
  onCommit: (next: number | undefined) => void;
};

/**
 * Payday, asked as a number.
 *
 * A payday is "the 15th" or "every other Friday" — never a particular square
 * on a 2026 calendar, and every layout used to ask for one with `type="date"`.
 * That is three taps and a scroll on an old Android to say something the
 * person already holds as a two-digit number, and it puts a year and a month
 * into a question that has neither.
 *
 * So: digits only, 1–31, and nothing else gets in. 0 and 32 are not typos to
 * be reported back at the reader — the field simply refuses them, the same
 * way it refuses a letter. `anchorForPayday` in domain/paySchedule.ts turns
 * the number into the date the schedule maths still needs.
 */
export const PaydayInput = forwardRef<HTMLInputElement, Props>(function PaydayInput(
  { value, onCommit, onBlur, onFocus, onKeyDown, className, ...rest },
  ref
) {
  const [draft, setDraft] = useState<string | null>(null);
  const editStartRef = useRef(value);
  const skipBlurCommitRef = useRef(false);
  const shown = draft ?? (value == null ? '' : String(value));

  const inRange = (n: number) => n >= PAYDAY_MIN && n <= PAYDAY_MAX;

  return (
    <input
      {...rest}
      ref={ref}
      type="text"
      inputMode="numeric"
      autoComplete="off"
      maxLength={2}
      value={shown}
      className={className}
      onFocus={(event) => {
        editStartRef.current = value;
        skipBlurCommitRef.current = false;
        setDraft(value == null ? '' : String(value));
        event.target.select();
        onFocus?.(event);
      }}
      onChange={(event) => {
        // Two digits, nothing else. A leading 0 is dropped rather than
        // rejected so "05" typed off a paystub lands on the 5th.
        const digits = event.target.value.replace(/\D/g, '').slice(0, 2);
        setDraft(digits);
        if (!digits) {
          onCommit(undefined);
          return;
        }
        const next = Number(digits);
        if (inRange(next)) onCommit(next);
      }}
      onBlur={(event) => {
        if (skipBlurCommitRef.current) {
          skipBlurCommitRef.current = false;
          setDraft(null);
          onBlur?.(event);
          return;
        }
        if (draft !== null) {
          const next = Number(draft);
          // "0" and "32" leave as nothing rather than as a guess: a wrong
          // payday quietly moves which months carry an extra check.
          if (!draft || !inRange(next)) onCommit(undefined);
          else onCommit(next);
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
        }
        onKeyDown?.(event);
      }}
    />
  );
});
