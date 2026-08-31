import { useState } from 'react';
import { Trash2 } from 'lucide-react';
import { useTracker } from '../state/TrackerProvider';
import { money } from '../domain/format';
import { formatMonth, monthsOfYear, shortMonthName, yearOf } from '../domain/months';
import { countableFor, isActive, monthStatus } from '../domain/earnings';
import { benefitPhase } from '../domain/trialWork';
import { InfoNote } from './InfoNote';
import { NumericInput } from './NumericInput';
import { Sheet } from './Sheet';
import { AddJobButton, Chip, Switch } from './ui';
import type { MonthKey } from '../domain/types';

export function MonthSheet({
  month, onClose, onOpenStream, variant = 'sheet', backLabel
}: {
  month: MonthKey;
  onClose: () => void;
  onOpenStream: (id: string) => void;
  variant?: 'sheet' | 'inline';
  backLabel?: string;
}) {
  const { data, updateMonthEntry, addStream, removeStream } = useTracker();
  const phase = benefitPhase(data, month);
  const status = monthStatus(data, month);
  const streams = data.streams.filter((s) => s.lifecycle === 'active' && isActive(s, month));
  const [wholeYear, setWholeYear] = useState<Record<string, boolean>>({});

  return (
    <Sheet
      title={formatMonth(month)}
      eyebrow="Monthly entry"
      onClose={onClose}
      variant={variant === 'inline' ? 'inline' : 'modal'}
      backLabel={variant === 'inline' ? backLabel : undefined}
    >
      <div className={
        'flex gap-2 rounded-lg bg-surface-2 px-4 py-3 '
        + (streams.length === 0 ? 'flex-col items-center text-center' : 'items-baseline')
      }>
        <span className="display-figure text-3xl">{money(status.countable)}</span>
        <span className="label-caps">
          countable{phase === 'trialWork' ? ' · TWP month' : phase === 'sga' ? ' · SGA' : ''}
        </span>
      </div>

      {streams.length === 0 ? (
        <p className="type-muted text-center">No active jobs cover this month yet.</p>
      ) : (
        <div className="flex flex-col gap-4">
          {streams.map((stream) => {
            const checked = Boolean(wholeYear[stream.id]);
            return (
              <div className="flex flex-col gap-3 rounded-lg border border-border p-4" key={stream.id}>
                <div className="flex items-center justify-between gap-3">
                  <div className="flex min-w-0 items-center gap-2.5">
                    <Chip tone={stream.type === 'w2' ? 'good' : 'info'}>
                      {stream.type === 'w2' ? 'W-2' : '1099'}
                    </Chip>
                    <span className="truncate text-base font-semibold">{stream.name}</span>
                  </div>
                  <button
                    type="button"
                    aria-label={`Remove ${stream.name}`}
                    title={stream.locked ? 'Unlock this job to remove it' : `Remove ${stream.name}`}
                    disabled={stream.locked}
                    onClick={() => removeStream(stream.id)}
                    className="icon-btn grid text-muted-foreground hover:bg-destructive/10 hover:text-destructive disabled:pointer-events-none disabled:opacity-30"
                  >
                    <Trash2 className="size-5" />
                  </button>
                </div>
                {stream.type === 'ten99' ? (
                  <div className="flex items-center justify-between gap-3 rounded-lg bg-surface-2 px-3 py-2.5">
                    <div>
                      <p className="num text-base font-semibold">{money(countableFor(stream, month))}</p>
                      <p className="type-muted text-sm">This month's share of the YTD total</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => onOpenStream(stream.id)}
                      className="shrink-0 text-sm font-medium text-primary hover:underline"
                    >
                      Edit total
                    </button>
                  </div>
                ) : (
                  <>
                    <label className="flex items-center justify-between gap-3 rounded-lg bg-surface-2 px-3 py-2.5">
                      <span className="text-base font-medium">Whole year</span>
                      <Switch
                        checked={checked}
                        label={`Show every month for ${stream.name}`}
                        onChange={() => setWholeYear((prev) => ({ ...prev, [stream.id]: !checked }))}
                      />
                    </label>

                    {checked ? (
                      <div className="month-year-grid grid grid-cols-2 gap-x-3 gap-y-3">
                        {monthsOfYear(yearOf(month)).map((m) => (
                          <div key={m} className="flex items-center gap-2">
                            <span className="field-label w-8 shrink-0 text-right">{shortMonthName(m)}</span>
                            <NumericInput
                              className="num field-input min-w-0 flex-1"
                              prefix="$"
                              value={stream.months[m]?.gross}
                              placeholder="0"
                              onCommit={(next) => updateMonthEntry(stream.id, m, { gross: next })}
                            />
                          </div>
                        ))}
                      </div>
                    ) : (
                      <label className="flex items-center gap-2">
                        <span className="field-label">Gross</span>
                        <NumericInput
                          className="num field-input min-w-0 flex-1"
                          prefix="$"
                          value={stream.months[month]?.gross}
                          placeholder="0"
                          onCommit={(next) => updateMonthEntry(stream.id, month, { gross: next })}
                        />
                      </label>
                    )}
                  </>
                )}
              </div>
            );
          })}
        </div>
      )}

      <div className="grid grid-cols-2 gap-3">
        <AddJobButton type="w2" onClick={() => onOpenStream(addStream('w2'))} />
        <AddJobButton type="ten99" onClick={() => onOpenStream(addStream('ten99'))} />
      </div>

      {streams.length > 0 ? (
        <InfoNote>
          Only Gross counts toward these thresholds. 1099 work is entered as
          a YTD total on the job's own page, then split evenly across its
          active months here.
        </InfoNote>
      ) : null}
    </Sheet>
  );
}
