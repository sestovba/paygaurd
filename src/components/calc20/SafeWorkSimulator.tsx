import { useEffect, useMemo, useState } from 'react';
import { useTracker } from './state';
import { money } from '../../domain/format';
import { formatMonth, monthsOfYear, todayMonth, yearOf } from '../../domain/months';
import { countableFor, streamYearHours, streamYearGross } from '../../domain/earnings';
import { activeThreshold, benefitPhase } from '../../domain/trialWork';
import { payPlan } from '../../domain/paySchedule';
import { NumericExprInput } from './NumericExprInput';

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

  // What every other active stream has already countable this month — the
  // W-2 hours question is "how much more," not "how much," and guessing at
  // this number is exactly the gap that let a real month get away.
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

  // Keep the pre-fill live as real entries come in, unless the user has
  // deliberately overridden it.
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
      <div className="simulator simulator--paused">
        <div className="simulator__eyebrow">Work pay simulator</div>
        <div className="simulator__title">We need your limit first</div>
        <p className="help-note">
          Hours only mean something against a limit, and yours is not set yet.
          Answer the status questions and this fills itself in.
        </p>
      </div>
    );
  }

  return (
    <div className="simulator">
      <div className="simulator__eyebrow">Work pay simulator</div>
      {/* The heading is the answer, not the panel's job description — the
          same change the shared simulator got for "Stay below SGA — Duh".
          It also stops this layout naming a regime the reader is not in. */}
      <div className="simulator__title">
        Aim for {safeFiveWeekHours.toFixed(1)} hours a week
      </div>
      <p className="help-note">
        That holds even in a month that pays you an extra time. Other counted
        pay comes off first.
      </p>

      <div className="simulator__inputs">
        <label className="entry-field">
          <span className="entry-field__label">Hourly rate</span>
          <NumericExprInput className="num-input" value={rate} onCommit={setRate} />
        </label>
        <label className="entry-field">
          <span className="entry-field__label">Planned hours/week</span>
          <NumericExprInput className="num-input" value={hoursPerWeek} onCommit={setHoursPerWeek} />
        </label>
        <label className="entry-field">
          <span className="entry-field__label">Other monthly income</span>
          <NumericExprInput
            className="num-input"
            value={otherIncome}
            onCommit={(next) => { setOtherIncomeTouched(true); setOtherIncome(next); }}
          />
          <span className="entry-field__hint">
            {otherIncomeTouched
              ? 'Edited — no longer following this month’s entries.'
              : `From non-W-2 sources entered for ${formatMonth(currentMonth)} so far.`}
          </span>
        </label>
        <label className="entry-field">
          <span className="entry-field__label">Safety buffer %</span>
          <NumericExprInput className="num-input" value={buffer} onCommit={setBuffer} />
        </label>
        <label className="entry-field">
          <span className="entry-field__label">Pay variance %</span>
          <NumericExprInput className="num-input" value={variance} onCommit={setVariance} />
        </label>
      </div>

      <div className="simulator__results">
        <div>
          <span className="simulator__result-label">Safest · 5-week month</span>
          <strong>{safeFiveWeekHours.toFixed(1)} h/week</strong>
        </div>
        <div>
          <span className="simulator__result-label">Average · 4.35 weeks</span>
          <strong>{safeAverageHours.toFixed(1)} h/week</strong>
        </div>
        <div className={fiveWeekProjection > safeTarget ? 'simulator__projection simulator__projection--over' : 'simulator__projection'}>
          Your five-week stress estimate: <strong>{money(fiveWeekProjection)}</strong>
          {' '}of a {money(safeTarget)} buffered target.
        </div>
      </div>

      {paydayRisks.length ? (
        <div className="simulator__paydays">
          <strong>Extra-paycheck cash-flow warning</strong>
          <span>
            {groupPaydayRisks(paydayRisks).join(' · ')}. Payday count is a
            planning signal; pay-period dates determine the earned month used
            for tracking.
          </span>
        </div>
      ) : null}

      <p className="help-note">
        Estimate only — unearned income, subsidies, IRWE, and SSA averaging can
        shift the real total.{phase === 'trialWork'
          ? ' Working for yourself can use a trial work month on hours alone, even under the dollar line.'
          : ''}
      </p>
    </div>
  );
}
