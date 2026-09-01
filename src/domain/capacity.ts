/*
 * What you can still do this month — and what is about to change that.
 *
 * Every other module in this folder reports money. Money is the rule SSA
 * applies, so that is correct, but it is not the decision anybody actually
 * makes. Nobody chooses to earn $238. They choose whether to take Saturday's
 * shift. The gap between those two sentences is the whole reason this file
 * exists: it does the one translation the product has never done, from
 * dollars of room into hours of work, and it does it in the direction that is
 * safe to be wrong in.
 *
 * Two rules hold throughout.
 *
 *   Round down, always. Ten and a half hours of room is reported as ten. A
 *   tracker that rounds up hands someone an overpayment they have to repay;
 *   a tracker that rounds down costs them half an hour of pay they can take
 *   next month. Those are not symmetrical mistakes.
 *
 *   Two ceilings, not one. For self-employment the money is not the only
 *   limit — more than 80 hours in a month uses up a trial work month by
 *   itself, whatever was earned. Anything that answers "how many more hours"
 *   has to check both and report whichever runs out first, or it is telling
 *   a 1099 worker they have thirty hours of room when they have four.
 */

import type { MonthKey, Stream, TrackerData } from './types';
import { safeTargetFor, TWP_SELF_EMPLOYMENT_HOURS } from './rules';
import {
  hoursFor, isActive, isEstimatedMonth, monthTotal,
  streamYearGross, streamYearHours
} from './earnings';
import { yearOf } from './months';
import { activeThreshold } from './trialWork';

function floor(n: number): number {
  return Math.max(0, Math.floor(n));
}

/**
 * An hourly rate, and where it came from.
 *
 * `stated` is the rate on the job. `observed` is gross ÷ hours across the
 * year, used only when no rate was given — it is a real figure rather than a
 * guess, but it silently includes overtime and any raise, so it is labelled
 * differently and never presented as "your rate".
 */
export interface RateSource {
  streamId: string;
  streamName: string;
  type: Stream['type'];
  rate: number;
  basis: 'stated' | 'observed';
}

export function rateForStream(stream: Stream, year: number): RateSource | null {
  if (stream.hourlyRate && stream.hourlyRate > 0) {
    return {
      streamId: stream.id, streamName: stream.name, type: stream.type,
      rate: stream.hourlyRate, basis: 'stated'
    };
  }
  const worked = streamYearHours(stream, year);
  const paid = streamYearGross(stream, year);
  if (worked > 0 && paid > 0) {
    return {
      streamId: stream.id, streamName: stream.name, type: stream.type,
      rate: Math.round((paid / worked) * 100) / 100, basis: 'observed'
    };
  }
  return null;
}

/**
 * The rate to answer "how many more hours" with.
 *
 * The next hour someone works is at one specific job, so this picks one
 * rather than averaging — an average rate belongs to no job and would buy
 * hours at neither. A stated rate wins over an inferred one; after that, the
 * lowest rate wins, because the lowest rate is the one that buys the fewest
 * safe hours, and being told a smaller number is the harmless mistake here.
 */
export function workingRate(data: TrackerData, month: MonthKey): RateSource | null {
  const year = yearOf(month);
  const rates = data.streams
    .filter((stream) => stream.lifecycle === 'active' && isActive(stream, month))
    .map((stream) => rateForStream(stream, year))
    .filter((r): r is RateSource => r !== null);
  if (!rates.length) return null;

  const stated = rates.filter((r) => r.basis === 'stated');
  const pool = stated.length ? stated : rates;
  return pool.reduce((lowest, r) => (r.rate < lowest.rate ? r : lowest));
}

/** Self-employment hours across every 1099 source in one month — the figure
 *  the 80-hour rule is tested against. */
export function selfEmployedHours(data: TrackerData, month: MonthKey): number {
  return data.streams
    .filter((stream) => stream.type === 'ten99')
    .reduce((sum, stream) => sum + hoursFor(stream, month), 0);
}

/* The safety line lives in rules.ts, so every layout answers to the same
 * number — see SAFE_MONTHLY there for why it is a thousand. Re-exported here
 * because this module is where it is reasoned about. */
export { SAFE_MONTHLY, safeTargetFor } from './rules';

/*
 * How far a worked-out figure could still be out, and why it is this small.
 *
 * Converting a bank balance to gross already leans high on purpose:
 * grossFromNet divides by 0.88, while the only deduction every W-2 worker
 * certainly has is FICA at 7.65%. On this income band federal withholding is
 * often nothing at all, so the true figure is usually *below* what we record,
 * not above it. What is left to be wrong about is a few points of state tax
 * or insurance, and eight per cent covers it.
 *
 * The wider band this replaced — a fifth on top — made sense when it was the
 * only thing standing between a guess and an overpayment. It is not any more.
 * The safety line is explicit protection, it is drawn on the gauge, and it is
 * a great deal larger. Stacking a third margin behind it protects nobody
 * twice; it just quietly deletes hours somebody was allowed to work, which is
 * the one cost of caution that never shows up on the screen.
 */
export const NET_ESTIMATE_BAND = 0.08;

/** Which of the two ceilings runs out first. */
export type Binding = 'money' | 'hours';

export interface Capacity {
  month: MonthKey;
  /** The line SSA actually applies. */
  threshold: number;
  /** The line this app answers to. See SAFE_MONTHLY. */
  safeTarget: number;
  thresholdKind: 'trialWork' | 'sga';
  /** Recorded countable pay — what to report. */
  counted: number;
  /** Counted, raised to the top of its uncertainty band when anything this
   *  month was a guess. What to make decisions from. */
  safeCounted: number;
  /** True when safeCounted is padded, i.e. some figure was worked out
   *  rather than entered. */
  guessed: boolean;
  /** Where this month stands. `safe` is under the thousand. `careful` is past
   *  it and still under the real limit — allowed, and the place this tool
   *  earns its keep, because working there safely takes arithmetic nobody
   *  should have to do in their head. `over` is past the limit. */
  stage: 'safe' | 'careful' | 'over';
  /** Dollars before the safety line, from safeCounted. Zero once past it. */
  room: number;
  /** Dollars before the real limit, from safeCounted. Zero once past it. */
  roomToLimit: number;
  /** Dollars past the real limit on the recorded figure. Zero while under. */
  over: number;
  /** Past the real limit only once the guess is taken at its highest. */
  maybeOver: boolean;
  /** Past the safe target but still under the limit. Nothing has gone wrong
   *  here — it is the band where one extra paycheck would go wrong. */
  pastSafe: boolean;
  rate: RateSource | null;
  /** Hours of work the room buys, after both ceilings. Null without a rate. */
  hours: number | null;
  /** Which ceiling produced `hours`. */
  binding: Binding;
  /** Present when the working rate is self-employment, where the 80-hour
   *  rule applies alongside the money. */
  hoursRule: { worked: number; left: number } | null;
}

/**
 * Everything the month's answer needs, in one reading.
 *
 * Returns null when the benefit phase is unknown, because there is no limit
 * to have room against — and inventing one would be the single most harmful
 * thing this file could do.
 */
export function capacityFor(data: TrackerData, month: MonthKey): Capacity | null {
  const threshold = activeThreshold(data, month);
  if (!threshold) return null;

  const counted = monthTotal(data, month);
  const guessed = isEstimatedMonth(data, month);
  const safeCounted = guessed
    ? Math.round(counted * (1 + NET_ESTIMATE_BAND) * 100) / 100
    : counted;
  const safeTarget = safeTargetFor(threshold.amount);
  const room = Math.max(0, safeTarget - safeCounted);
  const roomToLimit = Math.max(0, threshold.amount - safeCounted);
  const over = Math.max(0, counted - threshold.amount);
  const pastSafe = safeCounted > safeTarget;
  const stage: Capacity['stage'] = over > 0 ? 'over' : pastSafe ? 'careful' : 'safe';
  /* Past the safety line the question changes from "how much can I earn" to
     "how much more can I take without going over", so the room that answers
     it changes too. This is the squeeze, and it is the whole reason someone
     in the careful band opens the app rather than just stopping. */
  const operativeRoom = stage === 'safe' ? room : roomToLimit;

  const rate = workingRate(data, month);
  /* The 80-hour rule is a trial-work test, not a substantial-work one. Once
     the 9 months are used up, hours stop mattering on their own and only the
     money does — so capping a 1099 worker at 80 hours in that phase would
     take real work away from them for a rule that no longer applies. */
  const hoursRule = rate && rate.type === 'ten99' && threshold.kind === 'trialWork'
    ? {
      worked: selfEmployedHours(data, month),
      left: Math.max(0, TWP_SELF_EMPLOYMENT_HOURS - selfEmployedHours(data, month))
    }
    : null;

  let hours: number | null = null;
  let binding: Binding = 'money';
  if (rate && rate.rate > 0) {
    const byMoney = floor(operativeRoom / rate.rate);
    if (hoursRule && hoursRule.left < byMoney) {
      hours = hoursRule.left;
      binding = 'hours';
    } else {
      hours = byMoney;
    }
  }

  return {
    month,
    threshold: threshold.amount,
    safeTarget,
    thresholdKind: threshold.kind,
    counted,
    safeCounted,
    guessed,
    stage,
    room,
    roomToLimit,
    over,
    maybeOver: over === 0 && safeCounted > threshold.amount,
    pastSafe,
    rate,
    hours,
    binding,
    hoursRule
  };
}

export type Tone = 'clear' | 'near' | 'over' | 'unknown';

/**
 * Three states, and the middle one is not a warning.
 *
 * `near` means past the thousand we aim at and still under the real limit.
 * Nothing has gone wrong there and the copy that goes with it should not
 * suggest it has — it is the band where one more paycheck would be a problem,
 * which is a different thing from a problem.
 */
export function toneOf(capacity: Capacity | null): Tone {
  if (!capacity) return 'unknown';
  if (capacity.stage === 'over' || capacity.maybeOver) return 'over';
  return capacity.stage === 'careful' ? 'near' : 'clear';
}

export interface Outcome {
  /** Countable pay after the extra work, from the cautious figure. */
  total: number;
  /** Dollars still short of the safe target afterwards. */
  room: number;
  /** Dollars past the real limit afterwards. */
  over: number;
  /** Past the safe target afterwards, limit or no limit. */
  pastSafe: boolean;
  tone: Tone;
  /** True when the extra hours break the 80-hour rule even while the money
   *  stays under — the failure nobody expects. */
  breaksHoursRule: boolean;
}

/** What happens if you work `extraHours` more at the working rate. */
export function outcomeOf(capacity: Capacity, extraHours: number): Outcome {
  const rate = capacity.rate?.rate ?? 0;
  const total = Math.round(capacity.safeCounted + extraHours * rate);
  const room = Math.max(0, capacity.safeTarget - total);
  const over = Math.max(0, total - capacity.threshold);
  const pastSafe = total > capacity.safeTarget;
  const breaksHoursRule = Boolean(
    capacity.hoursRule
    && capacity.hoursRule.worked + extraHours > TWP_SELF_EMPLOYMENT_HOURS
  );
  const tone: Tone = over > 0 || breaksHoursRule
    ? 'over'
    : pastSafe ? 'near' : 'clear';
  return { total, room, over, pastSafe, tone, breaksHoursRule };
}
