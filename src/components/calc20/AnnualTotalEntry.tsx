// A single number for the whole year, for 1099 work that doesn't break down
// by month cleanly. Average spread already divides gross across every active
// month — this just writes the full total into one month and clears the
// rest, instead of asking for the same average entered twelve times.

import { useEffect, useState } from 'react';
import type { Stream } from '../../domain/types';
import { useTracker } from './state';
import { activeMonthsInYear } from '../../domain/earnings';
import { NumericExprInput } from './NumericExprInput';

export function AnnualTotalEntry({ stream }: { stream: Stream }) {
  const { ui, setMonthEntry } = useTracker();
  const active = activeMonthsInYear(stream, ui.year);
  const currentTotal = active.reduce((sum, m) => sum + (stream.months[m]?.gross ?? 0), 0);

  const [value, setValue] = useState<number | undefined>(currentTotal || undefined);

  // Follow real changes (undo, a month edited directly in the grid below)
  // as long as the field isn't mid-edit.
  useEffect(() => { setValue(currentTotal || undefined); }, [currentTotal]);

  if (!active.length) return null;

  const apply = (next: number | undefined) => {
    const target = active[0];
    active.forEach((month) => {
      if (month === target) setMonthEntry(stream.id, month, { gross: next });
      else if (stream.months[month]?.gross) setMonthEntry(stream.id, month, { gross: undefined });
    });
  };

  return (
    <div className="field field--spaced">
      <span className="eyebrow">Annual total for {ui.year}</span>
      <NumericExprInput
        className="num-input"
        placeholder="0 or 2+2"
        aria-label={`${stream.name} annual total for ${ui.year}`}
        value={value}
        onCommit={(next) => { setValue(next); apply(next); }}
      />
      <p className="help-note">
        One figure for the whole year, spread evenly across the {active.length}
        {' '}active month{active.length === 1 ? '' : 's'} — instead of entering
        the same average twelve times. Still averaged the way SSA does when
        income can't be tied to a month; switch to Per month below for exact
        figures instead.
      </p>
    </div>
  );
}
