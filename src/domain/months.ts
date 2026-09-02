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
 * `sofar` is the honest default for a layout built to hold a year: the months
 * with anything in them are the ones behind you, so the screen is never empty
 * and nothing about the future is being guessed at.
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
 * the months behind you on the ones built to hold a year.
 */
export function defaultScope(focus: boolean, shape: MonthShape): MonthScope {
  if (!focus) return 'year';
  return shape === 'single' ? 'month' : 'sofar';
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
  shape: MonthShape
): MonthScope {
  if (shape === 'single') return defaultScope(focus, shape);
  return chosen ?? defaultScope(focus, shape);
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
