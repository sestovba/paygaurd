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

/** Current/latest month first, then earlier months in reverse order.
 * Future months stay hidden unless explicitly requested. */
export function displayMonths(
  year: number,
  hideFuture: boolean,
  now: Date = new Date()
): MonthKey[] {
  const all = monthsOfYear(year);
  const current = todayMonth(now);
  const currentAndPast = all.filter((month) => month <= current).reverse();
  if (hideFuture) return currentAndPast;
  return [...currentAndPast, ...all.filter((month) => month > current)];
}

/**
 * Which months a dashboard should list.
 *
 * Focus mode collapses every month list in the app to the one you are in —
 * the current month when the year on screen is this year, otherwise that
 * year's last month, so a list is never empty. One helper rather than the
 * same conditional in nine components, which is how they would drift.
 */
export function listedMonths(
  year: number,
  hideFuture: boolean,
  focus: boolean,
  now: Date = new Date()
): MonthKey[] {
  if (!focus) return displayMonths(year, hideFuture, now);
  const all = monthsOfYear(year);
  const current = todayMonth(now);
  return [all.includes(current) ? current : all[all.length - 1]];
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
