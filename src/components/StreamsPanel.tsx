import { useState } from 'react';
import { ArrowRight, ChevronDown, Pause } from 'lucide-react';
import { useTracker } from '../state/TrackerProvider';
import { copyFor, periodLabel, SOURCE_SHORT } from '../domain/copy';
import { money } from '../domain/format';
import { streamYearTotal } from '../domain/earnings';
import { frequencyLabel, payPlan } from '../domain/paySchedule';
import { todayMonth, yearOf } from '../domain/months';
import { AddJobButton, ButtonRow, Chip } from './ui';
import type { Stream } from '../domain/types';

import { ButtonBase } from '../design-system';
export function StreamsPanel({
  onOpenStream, selectedId, compact, fill = false
}: {
  onOpenStream: (id: string) => void;
  selectedId?: string;
  compact?: boolean;
  /** Stretch to the parent height — only for a side rail next to an editor. */
  fill?: boolean;
}) {
  const { data, ui, addStream } = useTracker();
  const words = copyFor(ui.layout);
  const streams = data.streams.filter((s) => s.lifecycle === 'active');
  const archived = data.streams.filter((s) => s.lifecycle !== 'active');

  return (
    <section className={compact ? (fill ? 'flex h-full flex-col' : 'flex flex-col') : 'panel p-5 sm:p-6 xl:col-span-6'}>
      {/* Review note: "Income sources, my mind goes blank, just call it
          Income." A source of income is an income; the extra word named the
          category the list belongs to rather than the list.
          The word itself comes from src/domain/copy.ts now, so the next time
          it changes it changes in the six places it is written. */}
      {compact ? null : <h2 className="text-lg font-semibold">{words.income}</h2>}

      <div className={compact ? (fill ? 'min-h-0 flex-1 overflow-y-auto p-4' : 'p-4') : ''}>
        {streams.length === 0 ? (
          <p className={compact ? 'p-1 type-muted' : 'mt-4 type-muted'}>
            No income sources yet. Add where your money comes from below.
          </p>
        ) : compact ? (
          <ul className="flex flex-col gap-1.5">
            {streams.map((stream) => (
              <li key={stream.id}>
                <ButtonBase
                  type="button"
                  onClick={() => onOpenStream(stream.id)}
                  className={
                    'flex w-full items-center gap-3 rounded-lg border px-3 py-3 text-left transition-colors '
                    + (stream.id === selectedId
                      ? 'border-primary bg-surface-2 font-semibold text-foreground'
                      : 'border-transparent font-medium text-muted-foreground hover:bg-muted hover:text-foreground')
                  }
                >
                  <span className={'h-6 w-1 shrink-0 rounded-full ' + (stream.type === 'w2' ? 'bg-good' : 'bg-info')} />
                  <span className="min-w-0 flex-1 truncate text-base">{stream.name}</span>
                  <Chip tone={stream.type === 'w2' ? 'good' : 'info'}>
                    {SOURCE_SHORT[stream.type]}
                  </Chip>
                  {/* What this source has actually paid this year. The row
                      named the job and its kind and then stopped, so the list
                      answered "which jobs do I have" and not "which one is
                      most of my income" — which is the question somebody
                      deciding where to cut back is actually asking. */}
                  <span className="num shrink-0 text-sm font-semibold text-foreground">
                    {money(streamYearTotal(stream, ui.year))}
                  </span>
                </ButtonBase>
              </li>
            ))}
          </ul>
        ) : (
          <ul className="mt-4 space-y-3">
            {streams.map((stream) => (
              <StreamRow key={stream.id} stream={stream} year={ui.year} onOpen={() => onOpenStream(stream.id)} />
            ))}
          </ul>
        )}
      </div>

      <ButtonRow className={compact ? 'shrink-0 border-t border-border p-4' : 'mt-4'}>
        <AddJobButton type="w2" onClick={() => onOpenStream(addStream('w2'))} />
        <AddJobButton type="ten99" onClick={() => onOpenStream(addStream('ten99'))} />
      </ButtonRow>

      {!compact && archived.length ? (
        <div className="mt-5 border-t border-border pt-4">
          <p className="label-caps flex items-center gap-1.5">
            <Pause className="size-4" /> Not ongoing
          </p>
          <div className="mt-2.5 flex flex-wrap gap-2">
            {archived.map((stream) => (
              <ButtonBase
                key={stream.id}
                type="button"
                onClick={() => onOpenStream(stream.id)}
                className="flex items-center gap-2 rounded-full border border-border bg-surface-2 px-3 py-2 text-base text-muted-foreground transition-colors hover:bg-muted"
              >
                {stream.name}
                <Chip tone="muted">{stream.lifecycle === 'inactive' ? 'Paused' : 'Ended'}</Chip>
              </ButtonBase>
            ))}
          </div>
          <p className="type-muted mt-2 text-[0.9375rem]">
            Not counted toward this month or any future one — history stays as entered.
          </p>
        </div>
      ) : null}
    </section>
  );
}

function StreamRow({ stream, year, onOpen }: { stream: Stream; year: number; onOpen: () => void }) {
  const [expanded, setExpanded] = useState(false);
  const total = streamYearTotal(stream, year);
  const w2 = stream.type === 'w2';
  const isCurrentYear = year === yearOf(todayMonth());

  return (
    <li className="overflow-hidden rounded-lg border border-border bg-surface-2">
      <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 p-4">
        <ButtonBase
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="flex min-w-0 items-center gap-3 text-left"
        >
          <span className={'h-6 w-1 shrink-0 rounded-full ' + (w2 ? 'bg-good' : 'bg-info')} />
          <span className="truncate text-base font-medium">{stream.name}</span>
        </ButtonBase>
        <span className="flex shrink-0 items-center gap-2.5">
          <Chip tone={w2 ? 'good' : 'info'}>{SOURCE_SHORT[w2 ? 'w2' : 'ten99']}</Chip>
          <span className="num text-base font-semibold">{money(total)}</span>
          <ButtonBase
            type="button"
            aria-label={expanded ? 'Collapse details' : 'Expand details'}
            onClick={() => setExpanded((v) => !v)}
            className="icon-btn grid text-muted-foreground hover:bg-muted"
          >
            <ChevronDown className={'size-5 transition-transform ' + (expanded ? 'rotate-180' : '')} />
          </ButtonBase>
        </span>
      </div>

      {expanded ? (
        <div className="border-t border-border p-4">
          <StreamStats stream={stream} year={year} isCurrentYear={isCurrentYear} total={total} />
          <ButtonBase
            type="button"
            onClick={onOpen}
            className="mt-3 flex w-full items-center justify-center gap-1.5 rounded-lg border border-border bg-surface px-3 py-3 text-base font-medium transition-colors hover:bg-muted"
          >
            Edit details <ArrowRight className="size-4" />
          </ButtonBase>
        </div>
      ) : null}
    </li>
  );
}

function StreamStats({
  stream, year, isCurrentYear, total
}: {
  stream: Stream;
  year: number;
  isCurrentYear: boolean;
  total: number;
}) {
  const w2 = stream.type === 'w2';
  const todayKey = new Date().toISOString().slice(0, 10);
  const plan = w2 && stream.payFrequency && stream.anchorDate ? payPlan(year, stream.payFrequency, stream.anchorDate) : null;

  const payPeriod = w2
    ? (stream.payFrequency ? frequencyLabel(stream.payFrequency) : 'Not set')
    : 'Averaged across the year';

  const referenceKey = isCurrentYear ? todayKey : (year < yearOf(todayMonth()) ? `${year}-12-31` : `${year}-01-01`);
  const priorChecks = plan?.checks.filter((c) => c.date <= referenceKey) ?? [];
  const lastPaycheck = priorChecks.length
    ? new Date(priorChecks[priorChecks.length - 1].date + 'T00:00:00')
      .toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
    : '—';

  const thisMonthCount = isCurrentYear && plan
    ? plan.countByMonth[Number(todayMonth().slice(5, 7)) - 1]
    : null;

  return (
    <div className="grid grid-cols-2 gap-2">
      <Stat label="Pay period" value={payPeriod} />
      <Stat label="Last paycheck" value={lastPaycheck} />
      <Stat label={periodLabel(year, isCurrentYear)} value={money(total)} />
      <Stat label="This month" value={thisMonthCount === null ? '—' : `${thisMonthCount} checks`} />
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-surface p-3">
      <p className="label-caps truncate">{label}</p>
      <p className="num mt-1 truncate text-base font-semibold">{value}</p>
    </div>
  );
}
