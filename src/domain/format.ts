// Formatting. Kept in one place so figures read the same everywhere.

export function money(n: number): string {
  const rounded = Math.round(n);
  return '$' + rounded.toLocaleString('en-US');
}

export function rate(n: number): string {
  return '$' + n.toFixed(3).replace(/0$/, '');
}

/* Spelled out, both of them. "12 hrs" and "1,200 mi" were the last two
   abbreviations left in the formatters, and a unit is exactly the place not
   to abbreviate: it is the word that says what the number is. */
export function hours(n: number): string {
  const rounded = Math.round(n);
  return rounded.toLocaleString('en-US') + (rounded === 1 ? ' hour' : ' hours');
}

export function miles(n: number): string {
  const rounded = Math.round(n);
  return rounded.toLocaleString('en-US') + (rounded === 1 ? ' mile' : ' miles');
}
