// Formatting. Kept in one place so figures read the same everywhere.

export function money(n: number): string {
  const rounded = Math.round(n);
  return '$' + rounded.toLocaleString('en-US');
}

export function rate(n: number): string {
  return '$' + n.toFixed(3).replace(/0$/, '');
}

export function hours(n: number): string {
  return Math.round(n).toLocaleString('en-US') + ' hrs';
}

export function miles(n: number): string {
  return Math.round(n).toLocaleString('en-US') + ' mi';
}
