// Persistence. Local-only, one key, one dataset, multi-year.

import type { TrackerData } from '../domain/types';
import { EMPTY_DATA } from '../domain/types';

const DATA_KEY = 'pg-data-v1';
const UI_KEY = 'pg-ui-v1';

export type ThemePref = 'system' | 'light' | 'dark';
export type LayoutMode = 'classic' | 'v2' | 'responsive' | 'ledger' | 'payguard' | 'workrecord';
export type LedgerTheme = 'paper' | 'slate' | 'ledger' | 'carbon' | 'calc20';

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
  layout: 'payguard',
  ledgerTheme: 'paper',
  payguardTheme: 'paper',
  workRecordTheme: 'calc20',
  wrStreamsOpen: true,
  wrMonthsOpen: true,
  wrStatusOpen: false,
  onboarded: false,
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
    return { ...DEFAULT_UI, ...saved };
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
