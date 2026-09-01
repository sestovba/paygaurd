import { useEffect, useMemo, useState } from 'react';
import { ShieldCheck, TriangleAlert } from 'lucide-react';
import { useTracker } from '../state/TrackerProvider';
import { money } from '../domain/format';
import { formatMonth, monthsOfYear, todayMonth, yearOf } from '../domain/months';
import { countableFor, streamYearHours, streamYearGross } from '../domain/earnings';
import { activeThreshold, benefitPhase } from '../domain/trialWork';
import { payPlan } from '../domain/paySchedule';
import { NumericInput } from './NumericInput';

function clamp(value: number | undefined, max?: number): number {
  const n = Math.max(0, value ?? 0);
  return max !== undefined ? Math.min(max, n) : n;
}

interface PaydayRisk {
  stream: string;
  month: string;
  checks: number;
}

/** One line per stream, months grouped so the name is not repeated. */
function groupPaydayRisks(risks: PaydayRisk[]): string[] {
  const byStream = new Map<string, PaydayRisk[]>();
  risks.forEach((risk) => {
    const list = byStream.get(risk.stream) ?? [];
    list.push(risk);
    byStream.set(risk.stream, list);
  });

  return Array.from(byStream.entries()).map(([stream, streamRisks]) => {
    const months = streamRisks.map((r) => formatMonth(r.month).split(' ')[0]);
    const monthsText = months.length > 1
      ? months.slice(0, -1).join(', ') + ' and ' + months[months.length - 1]
      : months[0];
    const verb = months.length > 1 ? 'have' : 'has';
    const checksText = streamRisks.every((r) => r.checks === streamRisks[0].checks)
      ? String(streamRisks[0].checks)
      : streamRisks.map((r) => r.checks).join('/');
    return `${stream}: ${monthsText} ${verb} ${checksText}`;
  });
}

export function SafeWorkSimulator({ onOpenStatus }: { onOpenStatus?: () => void } = {}) {
  const { data, ui } = useTracker();
  const asOf = monthsOfYear(ui.year)[11];
  const phase = benefitPhase(data, asOf);
  const threshold = activeThreshold(data, asOf);

  const observedRate = useMemo(() => {
    for (const stream of data.streams) {
      if (stream.type !== 'w2' || stream.lifecycle !== 'active') continue;
      const hours = streamYearHours(stream, ui.year);
      const gross = streamYearGross(stream, ui.year);
      if (hours > 0 && gross > 0) return gross / hours;
    }
    return 20;
  }, [data.streams, ui.year]);

  const currentMonth = todayMonth();
  const otherIncomeSoFar = useMemo(() => {
    if (yearOf(currentMonth) !== ui.year) return 0;
    return data.streams
      .filter((stream) => stream.type !== 'w2' && stream.lifecycle === 'active')
      .reduce((sum, stream) => sum + countableFor(stream, currentMonth), 0);
  }, [data.streams, ui.year, currentMonth]);

  const [rate, setRate] = useState<number | undefined>(() => observedRate);
  const [hoursPerWeek, setHoursPerWeek] = useState<number | undefined>(12);
  const [otherIncome, setOtherIncome] = useState<number | undefined>(() => otherIncomeSoFar);
  const [otherIncomeTouched, setOtherIncomeTouched] = useState(false);
  const [buffer, setBuffer] = useState<number | undefined>(10);
  const [variance, setVariance] = useState<number | undefined>(5);

  useEffect(() => {
    if (!otherIncomeTouched) setOtherIncome(otherIncomeSoFar);
  }, [otherIncomeSoFar, otherIncomeTouched]);

  const rateValue = clamp(rate);
  const hoursValue = clamp(hoursPerWeek);
  const otherValue = clamp(otherIncome);
  const bufferValue = clamp(buffer, 50);
  const varianceValue = clamp(variance, 50);
  const effectiveRate = rateValue * (1 + varianceValue / 100);
  const usable = threshold
    ? Math.max(0, threshold.amount * (1 - bufferValue / 100) - otherValue)
    : 0;
  const safeFiveWeekHours = effectiveRate > 0 ? usable / effectiveRate / 5 : 0;
  const safeAverageHours = effectiveRate > 0 ? usable / effectiveRate / 4.348 : 0;
  const fiveWeekProjection = otherValue + hoursValue * effectiveRate * 5;
  const safeTarget = threshold ? threshold.amount * (1 - bufferValue / 100) : 0;
  const over = fiveWeekProjection > safeTarget;

  const paydayRisks = data.streams.flatMap((stream) => {
    if (stream.type !== 'w2' || stream.lifecycle !== 'active'
      || !stream.payFrequency || !stream.anchorDate) return [];
    const plan = payPlan(ui.year, stream.payFrequency, stream.anchorDate);
    return plan.heavyMonths.map((month1) => ({
      id: `${stream.id}-${month1}`,
      stream: stream.name,
      month: monthsOfYear(ui.year)[month1 - 1],
      checks: plan.countByMonth[month1 - 1]
    }));
  });

  if (phase === 'unknown' || phase === 'verifyComplete' || !threshold) {
    return (
      <section className="panel p-4 sm:p-5">
        <h2 className="display-figure">Select your benefit phase to calculate safe hours</h2>
        <p className="type-muted mt-1.5 max-w-prose">
          Safe hours are calculated based on your active Trial Work or SGA monthly earnings limit.
        </p>
        {onOpenStatus ? (
          <button type="button" className="btn-primary mt-3" onClick={onOpenStatus}>
            Confirm benefit phase
          </button>
        ) : null}
      </section>
    );
  }

  return (
    <section className="panel p-4 sm:p-5">
      <div className="flex items-center gap-2">
        <ShieldCheck className="size-4 shrink-0 text-good" />
        <p className="label-caps">Safe Hours &amp; Pay Calculator</p>
      </div>
      <h2 className="display-figure mt-1.5">
        Aim for {safeFiveWeekHours.toFixed(1)} hours a week
      </h2>
      <p className="type-muted mt-1 max-w-prose">
        That keeps you safe even in months with 3 paychecks.
        {otherValue > 0 ? ` Your ${money(otherValue)} of self-employment pay this month is already deducted.` : ''}
      </p>

      <div className="mt-4 grid grid-cols-2 gap-2.5 sm:max-w-sm">
        <label className="flex flex-col gap-1.5">
          <span className="field-label">Hourly rate</span>
          <NumericInput prefix="$" className="num field-input w-full" value={rate} onCommit={setRate} />
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="field-label">Weekly hours</span>
          <NumericInput className="num field-input w-full" placeholder="0" value={hoursPerWeek} onCommit={setHoursPerWeek} />
        </label>
      </div>

      <details className="mt-3">
        <summary className="type-muted cursor-pointer list-none text-base">
          Safety margin: 15% buffer under monthly limit (preset).
        </summary>
        <div className="mt-3 grid grid-cols-2 gap-2.5 sm:max-w-sm">
          <label className="flex flex-col gap-1.5">
            <span className="field-label">Stay this far under</span>
            <NumericInput className="num field-input w-full" placeholder="10" value={buffer} onCommit={setBuffer} />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="field-label">Allow for a bigger check</span>
            <NumericInput className="num field-input w-full" placeholder="5" value={variance} onCommit={setVariance} />
          </label>
          <label className="col-span-2 flex flex-col gap-1.5">
            <span className="field-label">Self-employment pay counted this month</span>
            <NumericInput
              prefix="$"
              className="num field-input w-full"
              value={otherIncome}
              onCommit={(next) => { setOtherIncomeTouched(true); setOtherIncome(next); }}
            />
          </label>
        </div>
      </details>

      <div className="mt-4 grid gap-2.5 sm:grid-cols-2 sm:max-w-md">
        <div className="flex flex-col gap-1 rounded-lg border border-border bg-surface-2 p-3">
          <span className="label-caps">Recommended (3-paycheck months)</span>
          <span className="display-figure text-good">{safeFiveWeekHours.toFixed(1)} h/wk</span>
        </div>
        <div className="flex flex-col gap-1 rounded-lg border border-border bg-surface-2 p-3">
          <span className="label-caps">Standard (2-paycheck months)</span>
          <span className="display-figure">{safeAverageHours.toFixed(1)} h/wk</span>
        </div>
      </div>

      <p className={
        'mt-3 rounded-lg border p-3 text-base '
        + (over ? 'border-destructive/40 bg-destructive/10 text-destructive' : 'border-border bg-surface-2')
      }>
        At <strong>{hoursValue} hours a week</strong>, a month that pays you an extra time comes
        to <strong>{money(fiveWeekProjection)}</strong> — {over ? 'over' : 'under'} the
        {' '}{money(safeTarget)} we aim for.
      </p>

      {paydayRisks.length ? (
        <div className="mt-3 flex items-start gap-2 rounded-lg border border-warn/40 bg-warn-soft/60 p-3 text-warn-foreground">
          <TriangleAlert className="mt-0.5 size-4 shrink-0" />
          <span>
            <strong>Extra-paycheck warning:</strong> {groupPaydayRisks(paydayRisks).join(' · ')}.
          </span>
        </div>
      ) : null}
    </section>
  );
}
