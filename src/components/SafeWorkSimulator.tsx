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

export function SafeWorkSimulator() {
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
        <div className="flex items-center gap-2">
          <ShieldCheck className="size-4 shrink-0 text-good" />
          <p className="label-caps">Safe work simulator</p>
        </div>
        <h2 className="display-figure mt-1.5">Confirm TWP status first</h2>
        <p className="type-muted mt-1.5 max-w-prose">
          A safe-hours calculation needs to know whether your goal is preserving trial work months
          or staying below SGA.
        </p>
      </section>
    );
  }

  return (
    <section className="panel p-4 sm:p-5">
      <div className="flex items-center gap-2">
        <ShieldCheck className="size-4 shrink-0 text-good" />
        <p className="label-caps">Safe work simulator</p>
      </div>
      <h2 className="display-figure mt-1.5">
        {phase === 'trialWork' ? 'Preserve a TWP month' : 'Stay below SGA'}
      </h2>
      <p className="type-muted mt-1 max-w-prose">
        Safe weekly hours for a five-week stress month. Other countable income comes off first.
      </p>

      <div className="mt-4 grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-5">
        <label className="flex flex-col gap-1.5">
          <span className="field-label">Hourly rate</span>
          <NumericInput prefix="$" className="num field-input w-full" value={rate} onCommit={setRate} />
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="field-label">Planned h/wk</span>
          <NumericInput className="num field-input w-full" placeholder="0" value={hoursPerWeek} onCommit={setHoursPerWeek} />
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="field-label">Other income</span>
          <NumericInput
            prefix="$"
            className="num field-input w-full"
            value={otherIncome}
            onCommit={(next) => { setOtherIncomeTouched(true); setOtherIncome(next); }}
          />
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="field-label">Safety buffer %</span>
          <NumericInput className="num field-input w-full" placeholder="10" value={buffer} onCommit={setBuffer} />
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="field-label">Variance %</span>
          <NumericInput className="num field-input w-full" placeholder="5" value={variance} onCommit={setVariance} />
        </label>
      </div>

      <div className="mt-4 grid gap-2.5 sm:grid-cols-3">
        <div className="flex flex-col gap-1 rounded-lg border border-border bg-surface-2 p-3">
          <span className="label-caps">Safest · 5-week month</span>
          <span className="display-figure text-good">{safeFiveWeekHours.toFixed(1)} h/wk</span>
        </div>
        <div className="flex flex-col gap-1 rounded-lg border border-border bg-surface-2 p-3">
          <span className="label-caps">Average · 4.35 weeks</span>
          <span className="display-figure">{safeAverageHours.toFixed(1)} h/wk</span>
        </div>
        <div className={`flex flex-col gap-1 rounded-lg border p-3 ${over ? 'border-destructive/40 bg-destructive/10' : 'border-border bg-surface-2'}`}>
          <span className="label-caps">5-week stress total</span>
          <span className={`display-figure ${over ? 'text-destructive' : ''}`}>{money(fiveWeekProjection)}</span>
          <span className="type-muted text-xs">of {money(safeTarget)} target</span>
        </div>
      </div>

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
