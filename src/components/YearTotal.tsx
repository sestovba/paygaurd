import { Check } from 'lucide-react';
import { useTracker } from '../state/TrackerProvider';
import { money } from '../domain/format';
import { yearTotal } from '../domain/earnings';
import { activeThreshold } from '../domain/trialWork';

export function YearTotal() {
  const { data, ui } = useTracker();
  // A year total is the definition of what focus mode removes: no SSA limit
  // is annual, so the figure cannot be over or under anything.
  if (ui.focusMode) return null;
  const threshold = activeThreshold(data, `${ui.year}-12`);
  const total = yearTotal(data, ui.year);
  const active = data.streams.filter((s) => s.lifecycle === 'active').length;

  return (
    <section className="panel flex flex-col gap-3 bg-surface-2 p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6 xl:col-span-12">
      <div className="min-w-0">
        <p className="text-base font-medium">{ui.year} total, all sources</p>
        <p className="type-muted">{active} active source{active === 1 ? '' : 's'}</p>
      </div>
      <div className="shrink-0 sm:text-right">
        <p className="display-figure text-3xl">{money(total)}</p>
        {threshold ? (
          <p className="num mt-0.5 flex items-center gap-1 text-sm text-muted-foreground sm:justify-end">
            <Check className="size-4 shrink-0 text-good" />
            {/* One limit at a time: which rule produced the number is the
                app's business, not the reader's. Naming the regime here was
                the last place on the overview that made somebody hold two of
                them in their head to read one line. */}
            {Math.round((total / (threshold.amount * 12)) * 100)}% of your limit for a whole year
          </p>
        ) : null}
      </div>
    </section>
  );
}
