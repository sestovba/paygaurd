// Ledger-layout formatting. Two decimal places throughout — this layout
// reads as an accounting ledger, where domain/format.ts's whole-dollar
// `money()` (used by the other three layouts) would look imprecise.

export function money2(n: number): string {
  return '$' + (n || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export function money0(n: number): string {
  return '$' + Math.round(n || 0).toLocaleString('en-US');
}

export function miles0(n: number): string {
  return Math.round(n || 0).toLocaleString('en-US') + ' mi';
}
