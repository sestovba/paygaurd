import { forwardRef, useId } from 'react';
import type { InputHTMLAttributes, ReactNode } from 'react';
import { cn } from './cn';

/**
 * A labelled input.
 *
 * The label is required, and there is deliberately no placeholder-only form.
 * A placeholder vanishes the moment somebody types, and every input in this
 * app is a number that decides whether a benefits payment is at risk — the
 * one screen where "what was this box again?" is expensive. It is also the
 * single most common accessibility failure in the layouts this replaces:
 * measured on 2026-09-04 the app had 50 `<input>` elements and 11 `htmlFor`
 * attributes, so most inputs had a styled `<span>` beside them and nothing
 * linking the two. Going through this component makes the link automatic —
 * the id is generated with useId() and wired to the label, the hint and the
 * error without a call site having to remember.
 *
 * `hint` is where a rule gets explained, and is the reason the component
 * takes one at all: CLAUDE.md's standing instruction is that the conversion
 * happens out loud, so the box that asks for take-home pay can say what it
 * will do with it without the layout inventing somewhere to put that.
 */
export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  invalid?: boolean;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { invalid, className, ...rest },
  ref
) {
  return (
    <input
      ref={ref}
      aria-invalid={invalid || undefined}
      className={cn('ui-field-input', className)}
      {...rest}
    />
  );
});

export interface FieldProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'id'> {
  label: ReactNode;
  hint?: ReactNode;
  error?: ReactNode;
  id?: string;
  className?: string;
}

export const Field = forwardRef<HTMLInputElement, FieldProps>(function Field(
  { label, hint, error, id, className, ...rest },
  ref
) {
  const auto = useId();
  const inputId = id ?? auto;
  const hintId = hint ? `${inputId}-hint` : undefined;
  const errorId = error ? `${inputId}-error` : undefined;

  return (
    <div className={cn('ui-field', className)}>
      <label className="ui-field-label" htmlFor={inputId}>{label}</label>
      <Input
        ref={ref}
        id={inputId}
        invalid={Boolean(error)}
        aria-describedby={cn(hintId, errorId) || undefined}
        {...rest}
      />
      {hint && !error && <span className="ui-field-hint" id={hintId}>{hint}</span>}
      {error && <span className="ui-field-error" id={errorId}>{error}</span>}
    </div>
  );
});
