// A single number for the whole year, for 1099 work that doesn't break down
// by month cleanly. The figure is divided evenly across the stream's active
// months as it is entered, rather than asking for the same average twelve
// times. Splitting on entry — not on read — is what keeps this dataset
// readable by every other layout: a month holds the amount it counts for.

import { useEffect, useState } from 'react';
import type { Stream } from '../../domain/types';
import { useTracker } from './state';
import { activeMonthsInYear, evenSplit } from '../../domain/earnings';
import { NumericExprInput } from './NumericExprInput';

export function AnnualTotalEntry({ stream }: { stream: Stream }) {
  const { ui, setMonthEntries } = useTracker();
  const active = activeMonthsInYear(stream, ui.year);
  const currentTotal = active.reduce((sum, m) => sum + (stream.months[m]?.gross ?? 0), 0);

  const [value, setValue] = useState<number | undefined>(currentTotal || undefined);

  // Follow real changes (undo, a month edited directly in the grid below)
  // as long as the field isn't mid-edit.
  useEffect(() => { setValue(currentTotal || undefined); }, [currentTotal]);

  if (!active.length) return null;

  const apply = (next: number | undefined) => {
    setMonthEntries(stream.id, evenSplit(next ?? 0, active.length)
      .map((gross, i) => ({ month: active[i], patch: { gross } })));
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
        the same average twelve times. That is what SSA does when income
        can't be tied to a month. Edit any month below for an exact figure.
      </p>
    </div>
  );
}
