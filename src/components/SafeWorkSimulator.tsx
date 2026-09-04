import { useEffect, useMemo, useState } from 'react';
import { ShieldCheck, TriangleAlert } from 'lucide-react';
import { useTracker } from '../state/TrackerProvider';
import { copyFor } from '../domain/copy';
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
    /* Was "Cafe shift: May and October have 3" — three of what. The noun
       was left to the reader on the one line warning them about the thing
       that catches people out. */
    const verb = months.length > 1 ? 'pay' : 'pays';
    const checksText = streamRisks.every((r) => r.checks === streamRisks[0].checks)
      ? String(streamRisks[0].checks)
      : streamRisks.map((r) => r.checks).join(' or ');
    return `${stream}: ${monthsText} ${verb} you ${checksText} times`;
  });
}

export function SafeWorkSimulator({ onOpenStatus }: { onOpenStatus?: () => void } = {}) {
  const { data, ui } = useTracker();
  const words = copyFor(ui.layout);
  const asOf = monthsOfYear(ui.year)[11];
  const phase = benefitPhase(data, asOf);
  const threshold = activeThreshold(data, asOf);

  const observedRate = useMemo(() => {
    for (const stream of data.streams) {
      if (stream.type !== 'w2' || stream.lifecycle !== 'active') continue;
      const hours = streamYearHours(stream, ui.year);
      const gross = streamYearGross(stream, ui.year);
      /* To the cent. This is a division — $667 over 30 hours — and it went
         straight into a field labelled with a dollar sign, so the screen that
         tells somebody what to aim for opened on "$ 22.233333333333332",
         overflowing its own input. Nobody is paid a repeating decimal, and a
         figure printed to fourteen places reads as a machine's number rather
         than theirs. It is an estimate either way; the extra digits add no
         accuracy, only noise. */
      if (hours > 0 && gross > 0) return Math.round((gross / hours) * 100) / 100;
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

  /* el-o3yk3y: "Another explanation, this is bad UI." The paragraph is gone
     and the question is the heading. And where there is no onOpenStatus the
     whole panel goes: without a button this is a heading in an empty box, and
     the only screen that mounts it that way is the status page, where the
     questions it would send you to are already the next thing down. */
  if (phase === 'unknown' || phase === 'verifyComplete' || !threshold) {
    if (!onOpenStatus) return null;
    return (
      <section className="panel p-4 sm:p-5">
        <h2 className="display-figure">{words.hoursAsk}</h2>
        <button type="button" className="btn-primary mt-3" onClick={onOpenStatus}>
          Answer a few questions
        </button>
      </section>
    );
  }

  return (
    <section className="panel p-4 sm:p-5">
      <div className="flex items-center gap-2">
        <ShieldCheck className="size-4 shrink-0 text-good" />
        {/* el-8lyfa5: "safe" never says safe from what. The eyebrow says
            which number this is; the sentence below says what it keeps you
            under. The words come from the vocabulary, not from here — five
            screens open this panel and they were calling it four things. */}
        <p className="label-caps">{words.hoursPanel}</p>
      </div>
      <h2 className="display-figure mt-1.5">
        Aim for {Math.floor(safeFiveWeekHours)} hours a week
      </h2>
      <p className="type-muted mt-1 max-w-prose">
        Holds even with an extra paycheck.
        {otherValue > 0 ? ` ${money(otherValue)} self-employment this month already counted.` : ''}
      </p>

      {/* A label sits over its own field and is as wide as it — so when it
          needs two lines the field under it drops with it, and the pair
          beside it no longer lines up. Two columns only where the label fits
          on one line at that width; below that each field takes the row and
          gets the whole width to say its name in. Same rule the Calc20
          simulator has had at 520px. */}
      <div className="mt-4 grid grid-cols-2 gap-2.5 sm:max-w-sm">
        <label className="flex flex-col justify-end gap-1.5">
          <span className="field-label">Hourly rate</span>
          <NumericInput prefix="$" className="num field-input w-full" value={rate} onCommit={setRate} />
        </label>
        <label className="flex flex-col justify-end gap-1.5">
          <span className="field-label">Weekly hours</span>
          <NumericInput className="num field-input w-full" placeholder="0" value={hoursPerWeek} onCommit={setHoursPerWeek} />
        </label>
      </div>

      <details className="mt-3">
        <summary className="type-muted cursor-pointer list-none text-base">
          {bufferValue + varianceValue}% under — recommended.
        </summary>
        <div className="mt-3 grid grid-cols-1 gap-2.5 sm:grid-cols-2 sm:max-w-xl">
          <label className="flex flex-col justify-end gap-1.5">
            <span className="field-label">Stay this far under (%)</span>
            <NumericInput className="num field-input w-full" placeholder="10" value={buffer} onCommit={setBuffer} />
          </label>
          <label className="flex flex-col justify-end gap-1.5">
            <span className="field-label">Allow for a bigger check (%)</span>
            <NumericInput className="num field-input w-full" placeholder="5" value={variance} onCommit={setVariance} />
          </label>
          <label className="flex flex-col justify-end gap-1.5 sm:col-span-2">
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

      <div className="mt-4 grid gap-2.5 sm:grid-cols-2 sm:max-w-xl">
        <div className="flex flex-col gap-1 rounded-lg border border-border bg-surface-2 p-3">
          <span className="label-caps">Recommended</span>
          <span className="display-figure text-good">{Math.floor(safeFiveWeekHours)} hours a week</span>
        </div>
        <div className="flex flex-col gap-1 rounded-lg border border-border bg-surface-2 p-3">
          {/* "closer to the line" is a figure of speech for a limit the
               reader has never been shown a line for. */}
          <span className="label-caps">Still under, close to your limit</span>
          <span className="display-figure">{Math.floor(safeAverageHours)} hours a week</span>
        </div>
      </div>

      <p className={
        'mt-3 rounded-lg border p-3 text-base '
        + (over ? 'border-destructive/40 bg-destructive/10 text-destructive' : 'border-border bg-surface-2')
      }>
        <strong>{hoursValue} hrs/week</strong> with an extra check → <strong>{money(fiveWeekProjection)}</strong>
        {' '}({over ? 'over' : 'under'} {money(safeTarget)}).
      </p>

      {paydayRisks.length ? (
        <div className="mt-3 flex items-start gap-2 rounded-lg border border-warn/40 bg-warn-soft/60 p-3 text-warn-foreground">
          <TriangleAlert className="mt-0.5 size-4 shrink-0" />
          <span>
            <strong>Watch out:</strong> {groupPaydayRisks(paydayRisks).join(' · ')}.
          </span>
        </div>
      ) : null}
    </section>
  );
}
