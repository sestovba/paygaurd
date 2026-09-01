// SSA and IRS figures, per year. These change annually and are the single
// place to update when new numbers are published.
//
// Sources: SSA substantial gainful activity and trial work period amounts;
// IRS standard business mileage rate. Verify each year before filing.

export interface YearRules {
  /** Monthly countable earnings that count as substantial gainful activity. */
  sga: number;
  /** Monthly earnings that make a month count against the trial work period. */
  trialWork: number;
}

/** A self-employment month can use TWP based on time even below the dollar line. */
export const TWP_SELF_EMPLOYMENT_HOURS = 80;

/*
 * The number to aim at, which is not the limit.
 *
 * This one is ours, not SSA's, and it lives here because every part of the
 * app has to agree on it. Both SSA limits are cliffs, and two things push
 * people over one without their noticing: a weekly or fortnightly schedule
 * quietly hands some months a third or fifth paycheck, and any figure worked
 * out from a bank balance carries a margin of error.
 *
 * Aiming at the limit means the first of those tips you over. So a thousand
 * dollars a month is what the app answers to, and the real limit is shown
 * beyond it. A thousand sits far enough below both the 2026 trial work line
 * ($1,210) and the substantial work line ($1,690) to absorb an extra
 * paycheck, and it is a round number somebody can hold in their head while a
 * manager waits for an answer, which "$1,210 minus what I have earned" is not.
 *
 * Being wrong in this direction costs a few hours of pay that can be taken
 * next month. Being wrong in the other direction costs a debt to Social
 * Security, or the payments themselves.
 */
export const SAFE_MONTHLY = 1000;

/** The figure to aim at for a given limit. Never above the limit itself — a
 *  handful of earlier years had a trial work line below a thousand. */
export function safeTargetFor(threshold: number): number {
  return Math.min(SAFE_MONTHLY, threshold);
}

const RULES: Record<number, YearRules> = {
  2021: { sga: 1310, trialWork: 940 },
  2022: { sga: 1350, trialWork: 970 },
  2023: { sga: 1470, trialWork: 1050 },
  2024: { sga: 1550, trialWork: 1110 },
  2025: { sga: 1620, trialWork: 1160 },
  2026: { sga: 1690, trialWork: 1210 }
};

export interface MileagePeriod {
  fromMonth: number;
  toMonth: number;
  rate: number;
}

// IRS standard business mileage rates. Mid-year changes stay separate.
const MILEAGE: Record<number, MileagePeriod[]> = {
  2021: [{ fromMonth: 1, toMonth: 12, rate: 0.56 }],
  2022: [
    { fromMonth: 1, toMonth: 6, rate: 0.585 },
    { fromMonth: 7, toMonth: 12, rate: 0.625 }
  ],
  2023: [{ fromMonth: 1, toMonth: 12, rate: 0.655 }],
  2024: [{ fromMonth: 1, toMonth: 12, rate: 0.67 }],
  2025: [{ fromMonth: 1, toMonth: 12, rate: 0.70 }],
  2026: [
    { fromMonth: 1, toMonth: 6, rate: 0.725 },
    { fromMonth: 7, toMonth: 12, rate: 0.76 }
  ]
};

const YEARS = Object.keys(RULES).map(Number).sort((a, b) => a - b);

export const FIRST_YEAR = YEARS[0];
export const LAST_YEAR = YEARS[YEARS.length - 1];

/**
 * Rules for a year. Years outside the table fall back to the nearest known
 * year rather than throwing.
 */
export function rulesFor(year: number): YearRules {
  if (RULES[year]) return RULES[year];
  const nearest = year < FIRST_YEAR ? FIRST_YEAR : LAST_YEAR;
  return RULES[nearest];
}

export function isExactYear(year: number): boolean {
  return Boolean(RULES[year]);
}

export function mileageRatesForYear(year: number): MileagePeriod[] {
  if (MILEAGE[year]) return MILEAGE[year].map((period) => ({ ...period }));
  const nearest = year < FIRST_YEAR ? FIRST_YEAR : LAST_YEAR;
  return MILEAGE[nearest].map((period) => ({ ...period }));
}

/** IRS mileage rate effective for a specific YYYY-MM. */
export function mileageRateFor(month: string): number {
  const year = Number(month.slice(0, 4));
  const month1 = Number(month.slice(5, 7));
  const periods = mileageRatesForYear(year);
  return periods.find((period) => month1 >= period.fromMonth && month1 <= period.toMonth)?.rate
    ?? periods[periods.length - 1].rate;
}

export function knownYears(): number[] {
  return YEARS.slice();
}
