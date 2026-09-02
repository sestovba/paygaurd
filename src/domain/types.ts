// Domain types. Multi-year by design: the trial work period is nine months
// within any rolling 60, which crosses calendar years, so nothing here is
// scoped to a single year. The year picker is a filter over one dataset.

export type StreamType = 'w2' | 'ten99';

export type PayFrequency = 'weekly' | 'biweekly' | 'semimonthly' | 'monthly';

/** 'YYYY-MM', 1-indexed month. Sorts lexically and chronologically. */
export type MonthKey = string;

/** 'YYYY-MM-DD'. */
export type DateKey = string;

export interface Paycheck {
  id: string;
  /** Legacy/manual assignment of the month in which wages were earned. */
  month: MonthKey;
  /** Pay date. */
  date: DateKey;
  gross: number;
  hours?: number;
  /** True when generated from the pay schedule rather than entered by hand. */
  projected?: boolean;
}

export interface MonthEntry {
  gross?: number;
  /** What the person said reached their bank, when that is how they entered
   *  it. `gross` is still the figure everything downstream reads; this is
   *  kept so the field they typed into can show them back what they typed.
   *
   *  Deriving it by running the conversion backwards would very nearly work
   *  and would be wrong in the one case that matters: a month entered from a
   *  paystub has no bank figure at all, and inventing one would put a number
   *  the person never gave into a field labelled with their own bank. */
  net?: number;
  /** Where `gross` came from. Absent means it was typed in as-is.
   *
   *  This exists so the precision gauge can tell the truth about a figure the
   *  app worked out rather than was told. Offering easier ways in — "what
   *  went into your bank", "your hourly rate" — is only honest if the result
   *  is then reported as the estimate it is. */
  basis?: 'entered' | 'fromNet' | 'fromHours';
  hours?: number;
  /** Business miles driven, deducted at that year's IRS rate. */
  miles?: number;
}

export interface Stream {
  id: string;
  name: string;
  type: StreamType;

  activeFrom: MonthKey;
  /** Null means ongoing. */
  activeTo: MonthKey | null;

  /** Organisation only. Historical income remains in totals. */
  lifecycle: 'active' | 'inactive' | 'completed';
  /** Prevents accidental edits until explicitly unlocked. */
  locked: boolean;

  /** W-2 only. Together these generate every check date for a year — and
   *  with it, which months land 3 or 5 paychecks instead of 2. */
  payFrequency?: PayFrequency;
  anchorDate?: DateKey;
  /** W-2 only. Paired with plannedHoursPerWeek to estimate a per-check
   *  gross for the paycheck forecast, and to suggest a starting Gross
   *  whenever Hours is entered for a month. */
  hourlyRate?: number;
  plannedHoursPerWeek?: number;

  /** Keyed by MonthKey. 1099 entries are pre-split evenly across active
   *  months at entry time; W-2 entries are per-month overrides. */
  months: Record<MonthKey, MonthEntry>;

  /** W-2 only. Individual checks, when they differ from the schedule. */
  checks: Paycheck[];
}

export interface TwpAssessment {
  /** Never infer this from an empty/default prior-month list. */
  state: 'unknown' | 'remaining' | 'complete';
  basis: 'unconfirmed' | 'personal-records' | 'ssa-record';
  checkedOn?: DateKey;
  completedOn?: MonthKey;
}

/** A logged event for the notifications panel — what happened, not what's
 *  currently true (that's actionItems, computed fresh from live state). */
export interface ActivityEntry {
  id: string;
  message: string;
  /** ISO timestamp. */
  at: string;
}

/**
 * Trial work months used before this tracker was started. Stored as months,
 * not a count, because the 60-month window means old months age out and the
 * capacity comes back.
 */
export interface TrackerData {
  version: 1;
  streams: Stream[];
  priorTrialMonths: MonthKey[];
  twpAssessment: TwpAssessment;
  /** Impairment-related work expenses, by month. Deducted from the combined
   *  countable total before SGA/TWP comparisons. */
  irwe: Record<MonthKey, number>;
  /** Newest last. Capped where it's appended to keep storage bounded. */
  activity: ActivityEntry[];
}

export interface MonthStatus {
  month: MonthKey;
  countable: number;
  isServiceMonth: boolean;
  overSga: boolean;
  roomToTrialWork: number | null;
  roomToSga: number | null;
}

export const EMPTY_DATA: TrackerData = {
  version: 1,
  streams: [],
  priorTrialMonths: [],
  twpAssessment: {
    state: 'unknown',
    basis: 'unconfirmed'
  },
  irwe: {},
  activity: []
};
