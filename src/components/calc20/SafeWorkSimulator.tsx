import { useEffect, useMemo, useState } from 'react';
import { useTracker } from './state';
import { copyFor } from '../../domain/copy';
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
  const words = copyFor('calc20');
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
        <div className="simulator__eyebrow">{words.hoursPanel}</div>
        <div className="simulator__title">We need your limit first</div>
        <p className="help-note">
          Hours only mean something against a limit, and yours is not set yet.
          Answer a few questions and this fills itself in.
        </p>
      </div>
    );
  }

  return (
    <div className="simulator">
      {/* el-8lyfa5 — same rename as the shared simulator, and from the same
          key: this layout has its own copy of the panel, which is exactly how
          one name became four. */}
      <div className="simulator__eyebrow">{words.hoursPanel}</div>
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
          <span className="entry-field__label">Hours a week</span>
          <NumericExprInput className="num-input" value={hoursPerWeek} onCommit={setHoursPerWeek} />
        </label>
        <label className="entry-field">
          <span className="entry-field__label">Other pay counted this month</span>
          <NumericExprInput
            className="num-input"
            value={otherIncome}
            onCommit={(next) => { setOtherIncomeTouched(true); setOtherIncome(next); }}
          />
          <span className="entry-field__hint">
            {otherIncomeTouched
              ? 'You changed this, so it no longer follows what you entered.'
              : `From your gig work in ${formatMonth(currentMonth)} so far.`}
          </span>
        </label>
        <label className="entry-field">
          <span className="entry-field__label">Stay this far under (%)</span>
          <NumericExprInput className="num-input" value={buffer} onCommit={setBuffer} />
        </label>
        <label className="entry-field">
          <span className="entry-field__label">Allow for a bigger check (%)</span>
          <NumericExprInput className="num-input" value={variance} onCommit={setVariance} />
        </label>
      </div>

      <div className="simulator__results">
        <div>
          {/* Was "Safest · 5-week month" and "Average · 4.35 weeks" — one
               naming a calendar arithmetic the reader has never met, the
               other a decimal. And "h/week" twice, on a screen with no
               abbreviations anywhere else. */}
          <span className="simulator__result-label">Recommended</span>
          <strong>{Math.floor(safeFiveWeekHours)} hours a week</strong>
        </div>
        <div>
          <span className="simulator__result-label">Still under, closer to your limit</span>
          <strong>{Math.floor(safeAverageHours)} hours a week</strong>
        </div>
        <div className={fiveWeekProjection > safeTarget ? 'simulator__projection simulator__projection--over' : 'simulator__projection'}>
          In a month that pays you an extra time, that comes to <strong>{money(fiveWeekProjection)}</strong>
          {' '}against the {money(safeTarget)} we aim for.
        </div>
      </div>

      {paydayRisks.length ? (
        <div className="simulator__paydays">
          <strong>Watch out</strong>
          <span>
            {groupPaydayRisks(paydayRisks).join(' · ')}. These months pay you more
            times than usual, on the same hours.
          </span>
        </div>
      ) : null}

      <p className="help-note">
        This is a careful guess. Other money you get, and things you pay for so you
        can work, can move the real total.{phase === 'trialWork'
          ? ' Working for yourself can use a trial work month on hours alone, even if you earned very little.'
          : ''}
      </p>
    </div>
  );
}
