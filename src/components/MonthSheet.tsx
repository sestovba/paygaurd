import { useState } from 'react';
import { Trash2 } from 'lucide-react';
import { useTracker } from '../state/TrackerProvider';
import { money } from '../domain/format';
import { formatMonth, monthsOfYear, shortMonthName, yearOf } from '../domain/months';
import {
  countableFor, grossFor, grossFromNet, hoursFor, isActive, mileageDeduction, monthStatus
} from '../domain/earnings';
import { benefitPhase } from '../domain/trialWork';
import { mileageRateFor, TWP_SELF_EMPLOYMENT_HOURS } from '../domain/rules';
import { InfoNote } from './InfoNote';
import { NumericInput } from './NumericInput';
import { Sheet } from './Sheet';
import { AddJobButton, ButtonRow, Chip, Switch } from './ui';
import type { MonthKey, Stream } from '../domain/types';

/**
 * Self-employment, editable for the month you are looking at.
 *
 * This block used to be read-only: it printed the profit and sent you to the
 * job editor, which only takes a year-to-date total and splits it evenly
 * across months. That is the wrong shape for the work it describes — a
 * delivery week is not one twelfth of a year — and it meant the two fields
 * that decide everything here, miles and hours, could not be entered against
 * the month they happened in.
 *
 * Miles matter more than they look. SSA counts net earnings for
 * self-employment, so every business mile comes off the top at the IRS rate:
 * somebody paid $1,000 by a delivery app may have under $300 that actually
 * counts. Almost nobody knows this, so the deduction is shown live as the
 * number is typed rather than explained in a paragraph nobody reads.
 */
function SelfEmployedMonth({ stream, month, onOpenStream }: {
  stream: Stream;
  month: MonthKey;
  onOpenStream: (id: string) => void;
}) {
  const { data, updateMonthEntry } = useTracker();
  const entry = stream.months[month];
  const miles = entry?.miles ?? 0;
  const hrs = hoursFor(stream, month);
  const off = mileageDeduction(stream, month);

  return (
    <div className="flex flex-col gap-3 rounded-lg bg-surface-2 p-3">
      <div className="flex items-baseline justify-between gap-3">
        <div>
          <p className="num text-base font-semibold">{money(countableFor(stream, month))}</p>
          <p className="type-muted text-sm">Counted this month, after mileage</p>
        </div>
        <button
          type="button"
          onClick={() => onOpenStream(stream.id)}
          className="shrink-0 text-sm font-medium text-primary hover:underline"
        >
          Whole year
        </button>
      </div>

      <label className="flex items-center gap-2">
        <span className="field-label w-16 shrink-0">Earned</span>
        <NumericInput
          className="num field-input min-w-0 flex-1"
          prefix="$"
          value={grossFor(stream, month) || undefined}
          placeholder="Numbers only"
          onCommit={(next) => updateMonthEntry(stream.id, month, { gross: next })}
        />
      </label>

      <label className="flex items-center gap-2">
        <span className="field-label w-16 shrink-0">Miles</span>
        <NumericInput
          className="num field-input min-w-0 flex-1"
          prefix="mi"
          value={miles || undefined}
          placeholder="0"
          onCommit={(next) => updateMonthEntry(stream.id, month, { miles: next })}
        />
      </label>
      <p className="type-muted -mt-1 text-sm">
        {off > 0
          ? `Your ${miles.toLocaleString('en-US')} miles take ${money(off)} off what counts.`
          : `Miles you drive for work come off what counts, at about ${(mileageRateFor(month) * 100).toFixed(0)} cents each.`}
      </p>

      <label className="flex items-center gap-2">
        <span className="field-label w-16 shrink-0">Hours</span>
        <NumericInput
          className="num field-input min-w-0 flex-1"
          value={hrs || undefined}
          placeholder="0"
          onCommit={(next) => updateMonthEntry(stream.id, month, { hours: next })}
        />
      </label>

      {benefitPhase(data, month) === 'trialWork' && hrs > TWP_SELF_EMPLOYMENT_HOURS ? (
        <div className="rounded border border-warn/40 bg-warn-soft/60 p-2 text-sm text-warn-foreground">
          Over {TWP_SELF_EMPLOYMENT_HOURS} hours this month, so it uses 1 of your 9 trial work
          months — even though you did not earn much.
        </div>
      ) : null}
    </div>
  );
}

/**
 * The way in for somebody who does not have the before-tax figure.
 *
 * Gross is what SSA counts and it lives on a document plenty of people cannot
 * find. What they do have is the amount that reached the bank, because it is
 * in their banking app. Recorded as an estimate, never as an entered figure,
 * so nothing downstream reports a confidence it did not earn.
 */
function FromBank({ stream, month }: { stream: Stream; month: MonthKey }) {
  const { updateMonthEntry } = useTracker();
  const [open, setOpen] = useState(false);
  const [net, setNet] = useState<number | undefined>(undefined);
  const estimate = grossFromNet(net ?? 0);

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="self-start text-sm font-medium text-primary hover:underline"
      >
        I only know what went into my bank
      </button>
    );
  }

  return (
    <div className="flex flex-col gap-2 rounded-lg bg-surface-2 p-3">
      <label className="flex items-center gap-2">
        <span className="field-label">Into my bank</span>
        <NumericInput
          className="num field-input min-w-0 flex-1"
          prefix="$"
          value={net}
          placeholder="Numbers only"
          onCommit={setNet}
        />
      </label>
      <p className="type-muted text-sm">
        {estimate
          ? `Before taxes that is about ${money(estimate)}. A guess, so we leave room to be safe.`
          : 'The amount you actually received.'}
      </p>
      <div className="flex gap-2">
        <button
          type="button"
          disabled={!estimate}
          onClick={() => {
            if (!estimate) return;
            updateMonthEntry(stream.id, month, { gross: estimate, basis: 'fromNet' });
            setOpen(false);
            setNet(undefined);
          }}
          className="btn-primary disabled:opacity-40"
        >
          Use about {estimate ? money(estimate) : '—'}
        </button>
        <button
          type="button"
          onClick={() => { setOpen(false); setNet(undefined); }}
          className="text-sm font-medium text-muted-foreground hover:underline"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}

export function MonthSheet({
  month, onClose, onOpenStream, variant = 'sheet', backLabel
}: {
  month: MonthKey;
  onClose: () => void;
  onOpenStream: (id: string) => void;
  variant?: 'sheet' | 'inline';
  backLabel?: string;
}) {
  const { data, ui, updateMonthEntry, addStream, removeStream } = useTracker();
  const phase = benefitPhase(data, month);
  const status = monthStatus(data, month);
  const streams = data.streams.filter((s) => s.lifecycle === 'active' && isActive(s, month));
  const [wholeYear, setWholeYear] = useState<Record<string, boolean>>({});

  return (
    <Sheet
      title={formatMonth(month)}
      eyebrow="Monthly earnings"
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
          What Social Security counts{phase === 'trialWork' ? ' · TWP month' : phase === 'sga' ? ' · SGA limit' : ''}
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
                      {stream.type === 'w2' ? 'Job' : 'Self-employed'}
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
                  <SelfEmployedMonth stream={stream} month={month} onOpenStream={onOpenStream} />
                ) : null}
                {stream.type === 'ten99' ? null : (
                  <>
                    {/* The whole-year grid is twelve fields for a sheet you
                        opened about one month. Focus mode takes it away and
                        leaves the single field. */}
                    <label
                      className="flex items-center justify-between gap-3 rounded-lg bg-surface-2 px-3 py-2.5"
                      hidden={ui.focusMode}
                    >
                      <span className="text-base font-medium">Show all months for this job</span>
                      <Switch
                        checked={checked}
                        label={`Show every month for ${stream.name}`}
                        onChange={() => setWholeYear((prev) => ({ ...prev, [stream.id]: !checked }))}
                      />
                    </label>

                    {checked && !ui.focusMode ? (
                      <div className="month-year-grid grid grid-cols-2 gap-x-3 gap-y-3">
                        {monthsOfYear(yearOf(month)).map((m) => (
                          <div key={m} className="flex items-center gap-2">
                            <span className="field-label w-8 shrink-0 text-right">{shortMonthName(m)}</span>
                            <NumericInput
                              className="num field-input min-w-0 flex-1"
                              prefix="$"
                              value={stream.months[m]?.gross}
                              placeholder="Numbers only"
                              onCommit={(next) => updateMonthEntry(stream.id, m, { gross: next })}
                            />
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="flex flex-col gap-2">
                        <label className="flex items-center gap-2">
                          <span className="field-label">Pay before taxes</span>
                          <NumericInput
                            className="num field-input min-w-0 flex-1"
                            prefix="$"
                            value={stream.months[month]?.gross}
                            placeholder="Numbers only"
                            onCommit={(next) => updateMonthEntry(stream.id, month, { gross: next })}
                          />
                        </label>
                        <FromBank stream={stream} month={month} />
                      </div>
                    )}
                  </>
                )}
              </div>
            );
          })}
        </div>
      )}

      <ButtonRow>
        <AddJobButton type="w2" onClick={() => onOpenStream(addStream('w2'))} />
        <AddJobButton type="ten99" onClick={() => onOpenStream(addStream('ten99'))} />
      </ButtonRow>

      {/* One sentence, and only the half the fields above do not already
          say. The gross/net point is made where it applies — on the field
          itself — and for self-employment it was wrong anyway, since what
          counts there is earnings minus mileage. */}
      {streams.length > 0 ? (
        <InfoNote>Earnings count in the month you were paid.</InfoNote>
      ) : null}
    </Sheet>
  );
}
