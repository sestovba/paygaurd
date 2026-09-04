import { useState } from 'react';
import { Trash2 } from 'lucide-react';
import { useTracker } from '../state/TrackerProvider';
import { copyFor, SOURCE_SHORT } from '../domain/copy';
import { money } from '../domain/format';
import { formatMonth, monthsOfYear, shortMonthName, yearOf } from '../domain/months';
import {
  countableFor, grossFor, hoursFor, isActive, mileageDeduction, monthStatus
} from '../domain/earnings';
import { benefitPhase } from '../domain/trialWork';
import { mileageRateFor, TWP_SELF_EMPLOYMENT_HOURS } from '../domain/rules';
import { InfoNote } from './InfoNote';
import { NumericInput } from './NumericInput';
import { PayAmountField, PayBasisProvider, PayBasisSwitch } from './PayAmount';
import { Sheet } from './Sheet';
import { AddJobButton, ButtonRow, Chip, IconButton, Switch } from './ui';
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
  const { data, ui, updateMonthEntry } = useTracker();
  const words = copyFor(ui.layout);
  const entry = stream.months[month];
  const miles = entry?.miles ?? 0;
  const hrs = hoursFor(stream, month);
  const off = mileageDeduction(stream, month);

  return (
    <div className="flex flex-col gap-3 rounded-lg bg-surface-2 p-3">
      <div className="flex items-baseline justify-between gap-3">
        <div>
          <p className="num text-base font-semibold">{money(countableFor(stream, month))}</p>
          <p className="type-muted text-sm">Counts toward your limit, after your miles come off</p>
        </div>
        <button
          type="button"
          onClick={() => onOpenStream(stream.id)}
          className="shrink-0 text-sm font-medium text-primary hover:underline"
        >
          See every month
        </button>
      </div>

      {/* Three labels one word long — Earned, Miles, Hours — where each word
          was doing the work of a question. "Miles" is the expensive one:
          personal miles are not deductible, so a reader who reads it as "how
          far did you drive" claims a deduction they are not owed. The labels
          stack above their fields now, because a complete label does not fit
          in a four-rem gutter. */}
      <label className="flex flex-col gap-1">
        <span className="field-label">{words.paidToYouAsk}</span>
        <NumericInput
          className="num field-input w-full"
          prefix="$"
          value={grossFor(stream, month) || undefined}
          placeholder="Numbers only"
          onCommit={(next) => updateMonthEntry(stream.id, month, { gross: next })}
        />
      </label>

      <label className="flex flex-col gap-1">
        <span className="field-label">{words.workMiles}</span>
        <NumericInput
          className="num field-input w-full"
          value={miles || undefined}
          placeholder="Numbers only"
          onCommit={(next) => updateMonthEntry(stream.id, month, { miles: next })}
        />
        <span className="type-muted text-sm">
          {off > 0
            ? `Your ${miles.toLocaleString('en-US')} miles take ${money(off)} off what counts.`
            : `Miles you drive for work come off what counts, at about ${(mileageRateFor(month) * 100).toFixed(0)} cents each. Miles you drive for yourself do not.`}
        </span>
      </label>

      <label className="flex flex-col gap-1">
        <span className="field-label">{words.hoursWorked}</span>
        <NumericInput
          className="num field-input w-full"
          value={hrs || undefined}
          placeholder="Numbers only"
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
    <PayBasisProvider>
    <Sheet
      title={formatMonth(month)}
      /* "Monthly earnings" named the genre of the screen. The month is
         already the title; the eyebrow says what the figure under it is. */
      eyebrow="What counts toward your limit"
      onClose={onClose}
      variant={variant === 'inline' ? 'inline' : 'modal'}
      backLabel={variant === 'inline' ? backLabel : undefined}
    >
      <div className={
        'flex gap-2 rounded-lg bg-surface-2 px-4 py-3 '
        + (streams.length === 0 ? 'flex-col items-center text-center' : 'items-baseline')
      }>
        <span className="display-figure text-3xl">{money(status.countable)}</span>
        {/* el-wmahw2. The reviewer said "needs styling", and it does — but the
            words were the worse half. "What Social Security counts" is the
            phrasing an earlier note in this pass took out of the hero for
            explaining Social Security's opinions back at the reader, and
            "TWP"/"SGA" are both on the no-jargon list. It says what the number
            is, and names only the rule that applies to this month. */}
        <span className="label-caps">
          Counted so far in {formatMonth(month)}{phase === 'trialWork' ? ' · uses a trial work month' : ''}
        </span>
      </div>

      {/* One switch for every wage job in the month, above the list rather
          than inside each card: the question "which number do you have" is
          answered once by a person, not once per job. */}
      {streams.some((s) => s.type === 'w2') ? <PayBasisSwitch /> : null}

      {streams.length === 0 ? (
        <p className="type-muted text-center">None of your jobs were running in {formatMonth(month)}.</p>
      ) : (
        <div className="flex flex-col gap-4">
          {streams.map((stream) => {
            const checked = Boolean(wholeYear[stream.id]);
            return (
              <div className="flex flex-col gap-3 rounded-lg border border-border p-4" key={stream.id}>
                <div className="flex items-center justify-between gap-3">
                  <div className="flex min-w-0 items-center gap-2.5">
                    {/* "Job" and "Self-employed" were two different kinds of
                        word — one about who pays you, one about a tax status.
                        SOURCE_SHORT says both of them the same way. */}
                    <Chip tone={stream.type === 'w2' ? 'good' : 'info'}>
                      {SOURCE_SHORT[stream.type]}
                    </Chip>
                    <span className="truncate text-base font-semibold">{stream.name}</span>
                  </div>
                  <IconButton
                    label={stream.locked ? `Unlock ${stream.name} to remove it` : `Remove ${stream.name}`}
                    tone="danger"
                    disabled={stream.locked}
                    onClick={() => removeStream(stream.id)}
                  >
                    <Trash2 className="size-5" />
                  </IconButton>
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
                      <span className="text-base font-medium">Show every month of {yearOf(month)}</span>
                      <Switch
                        checked={checked}
                        label={`Show every month for ${stream.name}`}
                        onChange={() => setWholeYear((prev) => ({ ...prev, [stream.id]: !checked }))}
                      />
                    </label>

                    {checked && !ui.focusMode ? (
                      <div className="month-year-grid grid grid-cols-2 gap-x-3 gap-y-3">
                        {monthsOfYear(yearOf(month)).map((m) => (
                          <PayAmountField
                            key={m}
                            label={shortMonthName(m)}
                            entry={stream.months[m]}
                            className="num field-input min-w-0 w-full"
                            onCommit={(patch) => updateMonthEntry(stream.id, m, patch)}
                          />
                        ))}
                      </div>
                    ) : (
                      /* One field, and the switch above the list says which
                         number goes in it. This used to be a "Pay before
                         taxes" box with a link under it reading "I only know
                         what went into my bank" — a second door, opening on
                         a different question, for anyone who did not have
                         the figure the first door asked for. */
                      <PayAmountField
                        entry={stream.months[month]}
                        className="num field-input min-w-0 w-full"
                        onCommit={(patch) => updateMonthEntry(stream.id, month, patch)}
                      />
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
        <InfoNote>Pay counts in the month it reached you, not the month you worked for it.</InfoNote>
      ) : null}
    </Sheet>
    </PayBasisProvider>
  );
}
