// Grid geometry. The column count is the real width control: inputs never
// carry a fixed width, they fill whatever cell the count produces.
//
// Overrides exist because mobile is not a preference. An expanded row on a
// phone is always one pivoted column — twelve columns cannot fit, and the
// user should not have to discover that.

import type { UiState } from './state';

const MIN_STACKED = { compact: 88, comfortable: 124 };
const PANEL_AUTO_MIN = { compact: 132, comfortable: 156 };

export function gridColumns(
  ui: UiState,
  pivot: boolean,
  columns: UiState['columns'] = ui.columns,
  columnAdjustment?: number,
  handset = false
): string {
  if (columns !== 'auto') return `repeat(${columns}, minmax(0, 1fr))`;
  // Pivoted is a ledger: one month per row, dates forming a column down the
  // left. Flowing pivoted cells into several columns breaks that alignment,
  // which is the whole reason to pivot.
  if (pivot) return '1fr';
  if (typeof columnAdjustment !== 'number') {
    return `repeat(auto-fit, minmax(${MIN_STACKED[ui.density]}px, 1fr))`;
  }
  if (ui.monthColumnsAuto) {
    const min = handset ? MIN_STACKED[ui.density] : PANEL_AUTO_MIN[ui.density];
    return `repeat(auto-fit, minmax(${min}px, 1fr))`;
  }
  const adjustment = Math.max(-1, Math.min(1, columnAdjustment));
  return `repeat(${2 + adjustment}, minmax(0, 1fr))`;
}
