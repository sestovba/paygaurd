// Month keys as absolute integers, so rolling-window arithmetic is just
// subtraction. 'YYYY-MM' strings are the storage format; these helpers are
// the only place that parses them.

import type { MonthKey, DateKey } from './types';

export function monthKey(year: number, month1: number): MonthKey {
  return String(year) + '-' + String(month1).padStart(2, '0');
}

export function parseMonth(key: MonthKey): { year: number; month1: number } {
  const year = Number(key.slice(0, 4));
  const month1 = Number(key.slice(5, 7));
  return { year, month1 };
}

export function yearOf(key: MonthKey): number {
  return Number(key.slice(0, 4));
}

/** Absolute month index. Lets you subtract two months to get a distance. */
export function monthIndex(key: MonthKey): number {
  const { year, month1 } = parseMonth(key);
  return year * 12 + (month1 - 1);
}

export function fromIndex(index: number): MonthKey {
  const year = Math.floor(index / 12);
  return monthKey(year, (index % 12) + 1);
}

export function addMonths(key: MonthKey, delta: number): MonthKey {
  return fromIndex(monthIndex(key) + delta);
}

export function monthsBetween(from: MonthKey, to: MonthKey): number {
  return monthIndex(to) - monthIndex(from);
}

/** Inclusive range. Returns [] when to precedes from. */
export function monthRange(from: MonthKey, to: MonthKey): MonthKey[] {
  const start = monthIndex(from);
  const end = monthIndex(to);
  if (end < start) return [];
  const out: MonthKey[] = [];
  for (let i = start; i <= end; i += 1) out.push(fromIndex(i));
  return out;
}

export function monthsOfYear(year: number): MonthKey[] {
  return Array.from({ length: 12 }, (_, i) => monthKey(year, i + 1));
}

/**
 * How much of the year a screen is listing.
 *
 * One switch, four positions, and it replaces two: `focusMode` used to
 * collapse every month list to a single row and `hideFuture` used to chop
 * the far end off, which is the same axis decided twice in two places with
 * no way to say "this month and what is left of the year".
 *
 * The names are the reader's, not the calendar's:
 *
 * | Scope    | Shows                          | Order |
 * |----------|--------------------------------|-------|
 * | `month`  | the month you are in           | one row |
 * | `sofar`  | this month and everything before | newest first |
 * | `ahead`  | this month and everything after  | oldest first |
 * | `year`   | all twelve                      | this month, back, then ahead |
 *
 * `ahead` is the default for a layout built to hold a year. The argument for
 * `sofar` was that the months with anything in them are the ones behind you,
 * so the screen is never empty — true, and beside the point. Nothing behind
 * you can be acted on. The decision this product exists to support is "can I
 * take that shift", "which months pay me extra", and every month that answers
 * either of those is in front of you. A screen that opens on the past is a
 * record; this one is supposed to be a plan.
 *
 * (Owner's call, and it overrides the earlier reasoning above it: "Rest of
 * the year is the better default.")
 */
export type MonthScope = 'month' | 'sofar' | 'ahead' | 'year';

/**
 * Whether a layout is built for one month at a time or for several.
 *
 * `plan` and `pocket` answer one question about the month you are in; a
 * twelve-cell grid was never part of them. `ledger`, `payguard`, `workrecord`
 * and `calc20` are ledgers — a year of rows is the shape they were drawn to,
 * and one row in them reads as a page that failed to load rather than as a
 * deliberately quiet screen. So focus mode means different things to the two
 * families, and this is which family a layout is in.
 */
export type MonthShape = 'single' | 'many';

export const MONTH_SCOPES: readonly MonthScope[] = ['month', 'sofar', 'ahead', 'year'];

/**
 * The month a scope is measured from: the one you are in when the year on
 * screen is this year, otherwise that year's December, so a list is never
 * empty and a finished year opens at its end.
 */
export function anchorMonth(year: number, now: Date = new Date()): MonthKey {
  const current = todayMonth(now);
  return yearOf(current) === year ? current : monthKey(year, 12);
}

/** Which months a screen should list, given how much of the year it wants. */
export function scopedMonths(
  year: number,
  scope: MonthScope,
  now: Date = new Date()
): MonthKey[] {
  const all = monthsOfYear(year);
  const anchor = anchorMonth(year, now);
  const before = all.filter((month) => month < anchor).reverse();
  const after = all.filter((month) => month > anchor);
  switch (scope) {
    case 'month': return [anchor];
    case 'sofar': return [anchor, ...before];
    /* A year you are past has no rest: the anchor is its December, so "from
       here forward" would be one row, and the reader would have picked an
       option that does nothing. The whole year read forwards is what "the
       rest of 2025" amounts to once 2025 is over. */
    case 'ahead': return yearOf(todayMonth(now)) === year ? [anchor, ...after] : all;
    case 'year': return [anchor, ...before, ...after];
  }
}

/**
 * What focus mode means on this kind of layout.
 *
 * Focus mode stays the one switch in Settings — it is what takes the charts,
 * the year totals and the calendars off the screen. What it does to the month
 * list depends on the layout: one month on the two built for one month, and
 * the rest of the year on the ones built to hold a year.
 */
export function defaultScope(focus: boolean, shape: MonthShape): MonthScope {
  if (!focus) return 'year';
  return shape === 'single' ? 'month' : 'ahead';
}

/**
 * The scope in force: what the reader picked, or what focus mode implies.
 *
 * The dropdown belongs to the layouts built to hold a year — it is the answer
 * to "one month looks wrong on this screen". A layout built for one month has
 * nowhere to put eleven more, so it keeps following focus mode however the
 * dropdown on the ledger was left.
 */
export function resolveScope(
  chosen: MonthScope | undefined,
  focus: boolean,
  shape: MonthShape,
  /**
   * What focus mode should mean on THIS surface, when the reader has not said.
   *
   * `many` defaults to `ahead` because a year-shaped table showing one row
   * reads as a page that failed to load. That is true of a table — it is not
   * true of a surface that answers `month` by drawing something else
   * entirely. `MonthGrid` does exactly that: at one-month range it renders
   * `MonthUpClose`, which is a different and complete drawing showing the
   * paydays on the days they fall, not a calendar with eleven twelfths
   * removed.
   *
   * Those two facts used to sit in two files contradicting each other, and
   * the grid lost: Overview drew nine months nobody can act on in order to
   * show the one they can. A surface that can draw a single month properly
   * says so here, and the reader's own choice still outranks it.
   */
  fallback?: MonthScope
): MonthScope {
  if (shape === 'single') return defaultScope(focus, shape);
  if (chosen) return chosen;
  if (!focus) return 'year';
  return fallback ?? defaultScope(focus, shape);
}

/**
 * What the month list on screen actually covers, in words.
 *
 * el-16owyjf: "1 of 12 months" over a grid holding one row — the label was
 * counting the calendar instead of the screen, so in focus mode it read as a
 * page that had lost eleven rows. A section heading beside a month list has
 * to answer "which period?" about the rows under it and nothing else, and
 * that question has the same answer on every layout, so it is answered here
 * rather than in each editor.
 *
 * Ranges use short names (Sep–Dec) so the meta beside a section title stays
 * compact; a single month still gets the full name.
 */
export function monthsShownLabel(months: MonthKey[]): string {
  if (months.length === 0) return 'No months';
  if (months.length === 1) return longMonthName(months[0]);
  if (months.length === 12) return 'All 12 months';
  const ordered = [...months].sort();
  return shortMonthName(ordered[0]) + '–' + shortMonthName(ordered[ordered.length - 1]);
}

export function monthOfDate(date: DateKey): MonthKey {
  return date.slice(0, 7);
}

export function todayMonth(now: Date = new Date()): MonthKey {
  return monthKey(now.getFullYear(), now.getMonth() + 1);
}

const SHORT = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const LONG = ['January','February','March','April','May','June','July',
  'August','September','October','November','December'];

export function shortMonthName(key: MonthKey): string {
  return SHORT[parseMonth(key).month1 - 1];
}

export function longMonthName(key: MonthKey): string {
  return LONG[parseMonth(key).month1 - 1];
}

export function formatMonth(key: MonthKey): string {
  const { year, month1 } = parseMonth(key);
  return LONG[month1 - 1] + ' ' + year;
}
