import type { MonthScope } from '../domain/months';
import { MONTH_SCOPES } from '../domain/months';

/**
 * How much of the year to show, in the reader's words.
 *
 * A layout built to hold twelve months does not become a smaller version of
 * itself when it is showing one — it reads as broken, a page that failed to
 * load. So the layouts that were drawn around a year get to say how much of
 * it they want, instead of being collapsed to a single row by a switch in
 * Settings they cannot see from here.
 *
 * Four positions, each a phrase about the months and none about the app: no
 * "focus", no "filter", no "range". "So far" and "the rest" are a pair and
 * read as opposites, and both include the month you are in — it is not over
 * yet, so it belongs to both halves. "Rest of the year" is the default on
 * these layouts. It used to be "So far this year", on the grounds that the
 * months with anything in them are the ones behind you — true, and beside
 * the point, because nothing behind you can be acted on. An explicit choice
 * still wins and is remembered, so a reader who picked "So far this year"
 * keeps it until they change it.
 */
export const MONTH_SCOPE_LABEL: Readonly<Record<MonthScope, string>> = {
  month: 'This month',
  sofar: 'So far this year',
  ahead: 'Rest of the year',
  year: 'All year'
};

/**
 * The dropdown itself. A native `<select>` on purpose: it is one tap, it
 * cannot be styled into something unreadable, and it is the one menu that
 * works the same on a five-year-old Android WebView as it does here.
 *
 * Every layout skins it — pass the wrapper and select classes it uses for its
 * own fields, the same way the year pickers are skinned.
 */
export function MonthScopePicker({
  scope,
  onChange,
  className,
  selectClassName,
  label
}: {
  scope: MonthScope;
  onChange: (scope: MonthScope) => void;
  /** Wrapper class — the layout's own field or button shell. */
  className?: string;
  /** Class for the `<select>` itself, where the layout styles those. */
  selectClassName?: string;
  /** Shown before the dropdown when there is room for it. */
  label?: string;
}) {
  return (
    <label className={className}>
      {label ? <span>{label}</span> : null}
      <select
        className={selectClassName}
        value={scope}
        aria-label="Which months to show"
        onChange={(event) => onChange(event.target.value as MonthScope)}
      >
        {MONTH_SCOPES.map((option) => (
          <option key={option} value={option}>{MONTH_SCOPE_LABEL[option]}</option>
        ))}
      </select>
    </label>
  );
}
