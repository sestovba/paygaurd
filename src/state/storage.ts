// Persistence. Local-only, one key, one dataset, multi-year.

import type { MonthKey, TrackerData } from '../domain/types';
import { EMPTY_DATA } from '../domain/types';

const DATA_KEY = 'pg-data-v1';
const UI_KEY = 'pg-ui-v1';

export type ThemePref = 'system' | 'light' | 'dark';
export type LayoutMode = 'classic' | 'v2' | 'responsive' | 'ledger' | 'payguard' | 'workrecord' | 'calc20' | 'horizon' | 'pocket' | 'plan';
export type LedgerTheme = 'paper' | 'slate' | 'ledger' | 'carbon' | 'calc20';

/**
 * Presentation state belonging to the Calc20 layout alone.
 *
 * It is nested rather than flattened because that layout arrived with two
 * dozen of its own switches, and spreading them across the shared record
 * would make it impossible to see which preference belongs to which screen.
 * Everything the layouts genuinely share — year, hideFuture, theme, sync,
 * terms — stays on UiState below and is read straight from there.
 *
 * Note `layout` here is the Calc20 *stream arrangement*, not UiState.layout
 * (the app-wide layout mode). Same word, two scopes, hence the separation.
 */
export interface Calc20Ui {
  layout: 'carousel';
  carouselArrange: 'rail' | 'grid';
  streamMonthColumnAdjustments: Record<string, number>;
  monthColumnAdjustment: number;
  monthColumnsAuto: boolean;
  monthColumnsAutoChosen: boolean;
  expandAllAsStack: boolean;
  view: 'cards' | 'list';
  viewChosen: boolean;
  pivot: boolean;
  pivotChosen: boolean;
  density: 'compact' | 'comfortable';
  densityChosen: boolean;
  columns: 'auto' | number;
  customizeLayout: boolean;
  touchLayout: 'rail' | 'grid' | null;
  streamsOpen: boolean;
  archivedOpen: boolean;
  monthsOpen: boolean;
  statusOpen: boolean;
  editing: boolean;
  collapsed: Record<string, boolean>;
  streamSettings: Record<string, boolean>;
  dismissedMissingMonths: MonthKey[];
  /** 0-100. How opaque the header, menus and sheets are; 0 is see-through. */
  glassStrength: number;
}

export const DEFAULT_CALC20_UI: Calc20Ui = {
  layout: 'carousel',
  carouselArrange: 'grid',
  streamMonthColumnAdjustments: {},
  monthColumnAdjustment: 0,
  monthColumnsAuto: true,
  monthColumnsAutoChosen: false,
  expandAllAsStack: false,
  view: 'list',
  viewChosen: false,
  pivot: false,
  pivotChosen: false,
  density: 'comfortable',
  densityChosen: false,
  columns: 'auto',
  customizeLayout: false,
  touchLayout: null,
  streamsOpen: true,
  archivedOpen: false,
  monthsOpen: true,
  statusOpen: false,
  editing: false,
  collapsed: {},
  streamSettings: {},
  dismissedMissingMonths: [],
  glassStrength: 0
};

export interface UiState {
  year: number;
  hideFuture: boolean;
  theme: ThemePref;
  /** Layout selection is kept beside the other device-local preferences so
   *  comparing modes does not reset on every refresh. */
  layout: LayoutMode;
  /** Sub-theme for the Ledger layout only — independent of light/dark. */
  ledgerTheme: LedgerTheme;
  /** Sub-theme for the PayGuard card layout. */
  payguardTheme?: LedgerTheme;
  /** Sub-theme for the Work Record layout. Defaults to the calc20 palette
   *  it was ported alongside, rather than to PayGuard's own. */
  workRecordTheme?: LedgerTheme;
  /** Work Record's three slabs remember whether they were left open. Stored
   *  flat rather than as a nested object because loadUi merges one level. */
  wrStreamsOpen: boolean;
  wrMonthsOpen: boolean;
  wrStatusOpen: boolean;
  /** Everything the Calc20 layout remembers for itself. */
  calc20: Calc20Ui;
  /**
   * Show only the month you are in.
   *
   * Every calendar, chart and year figure comes off the screen; month lists
   * collapse to a single row. On by default, because a twelve-cell grid is a
   * wall for the reader this app is for and it assumes somebody keeps a
   * benefits tracker current for a year — a few weeks is the honest
   * expectation. Turning it off restores the full-year view every layout
   * was originally built around.
   */
  focusMode: boolean;
  /** Set once someone adds a stream or explicitly skips — after that, an
   *  empty tracker shows the real (empty) dashboard, not onboarding again. */
  onboarded: boolean;
  /** ISO timestamp of the last time the notifications panel was opened —
   *  compared against the newest activity entry to decide the unread dot. */
  notificationsViewedAt?: string;
  /** Off by default on every device — flagged accounts only, and only after
   *  an explicit opt-in. See state/cloudSync.ts. */
  cloudSyncEnabled: boolean;
  cloudSyncConsentedAt?: string;
  /** Matches domain/legal.ts's TERMS_VERSION once accepted; unset re-gates. */
  termsAcceptedVersion?: string;
  termsAcceptedAt?: string;
}

export const DEFAULT_UI: UiState = {
  year: new Date().getFullYear(),
  hideFuture: true,
  theme: 'system',
  layout: 'plan',
  ledgerTheme: 'paper',
  payguardTheme: 'paper',
  workRecordTheme: 'calc20',
  wrStreamsOpen: true,
  wrMonthsOpen: true,
  wrStatusOpen: false,
  calc20: DEFAULT_CALC20_UI,
  onboarded: false,
  focusMode: true,
  cloudSyncEnabled: false
};

export function loadData(): TrackerData {
  try {
    const raw = localStorage.getItem(DATA_KEY);
    if (raw) return { ...EMPTY_DATA, ...JSON.parse(raw) };
  } catch { /* corrupt or unavailable; start fresh */ }
  return { ...EMPTY_DATA };
}

export function saveData(data: TrackerData): void {
  try {
    localStorage.setItem(DATA_KEY, JSON.stringify(data));
  } catch { /* quota or private mode; session continues in memory */ }
}

export function loadUi(): UiState {
  try {
    const raw = localStorage.getItem(UI_KEY);
    if (!raw) return { ...DEFAULT_UI };
    const saved = JSON.parse(raw) as Partial<UiState>;
    // The top-level spread is one level deep, so a nested slice saved before
    // a switch existed would arrive missing that switch. Merge it by hand.
    return {
      ...DEFAULT_UI,
      ...saved,
      calc20: { ...DEFAULT_CALC20_UI, ...(saved.calc20 ?? {}) }
    };
  } catch {
    return { ...DEFAULT_UI };
  }
}

export function saveUi(ui: UiState): void {
  try {
    localStorage.setItem(UI_KEY, JSON.stringify(ui));
  } catch { /* ignore */ }
}

/**
 * Persist one or more device-local preferences outside TrackerProvider.
 * Auth-gated screens use this so changing a preference never replaces the
 * rest of the saved UI record.
 */
export function saveUiPatch(patch: Partial<UiState>): UiState {
  const next = { ...loadUi(), ...patch };
  saveUi(next);
  return next;
}
