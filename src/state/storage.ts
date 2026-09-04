// Persistence. Local-only, one key, one dataset, multi-year.

import type { MonthKey, TrackerData } from '../domain/types';
import type { MonthScope } from '../domain/months';
import { EMPTY_DATA } from '../domain/types';

const DATA_KEY = 'pg-data-v1';
const UI_KEY = 'pg-ui-v1';

export type ThemePref = 'system' | 'light' | 'dark';
export type LayoutMode = 'overview' | 'ledger' | 'payguard' | 'workrecord' | 'calc20' | 'horizon' | 'pocket' | 'charm' | 'plan' | 'beautiful';

/**
 * How the Overview layout is navigated.
 *
 * There used to be three layouts here — classic, v2 and responsive — and
 * they were one layout drawn three ways. Every content surface they render
 * (ActionBanner, SafetyHero, PaycheckRadar, MonthGrid, StreamsPanel,
 * YearTotal, and all six detail views) is used by those three and by nothing
 * else in the app; what differed was the chrome around them and where a
 * detail opens. That is an option, not a layout.
 *
 *   scroll     One page, everything down it. Details open as sheets over it.
 *   pages      Overview / Income / Your limit as separate pages, with a
 *              sidebar on a desktop and tabs on a phone. A detail replaces
 *              the page and offers a way back.
 *   workspace  The same pages, but a detail opens BESIDE what you were
 *              looking at and both stay on screen.
 */
export type OverviewShell = 'scroll' | 'pages' | 'workspace';

/** What the three used to be called. Review notes are anchored to these —
 *  103 of them — and a note records which shell it was written against, so
 *  the ids are translated on the way in rather than rewritten in the file. */
export type LegacyLayoutId = 'classic' | 'v2' | 'responsive';

export const SHELL_FOR_LEGACY: Record<LegacyLayoutId, OverviewShell> = {
  classic: 'scroll',
  v2: 'pages',
  responsive: 'workspace'
};

export function isLegacyLayoutId(value: unknown): value is LegacyLayoutId {
  return value === 'classic' || value === 'v2' || value === 'responsive';
}
/**
 * The palette, for the whole app.
 *
 * The name is historical — it was `LedgerTheme` when only the Ledger layout
 * had one. Three fields then grew off it (`ledgerTheme`, `payguardTheme`,
 * `workRecordTheme`) for what is one decision, and two of the three indexed
 * the *same* CSS, so keeping payguard and workrecord looking alike meant
 * setting the same value twice. They are one field now: `palette`.
 */
export type Palette = 'paper' | 'slate' | 'ledger' | 'carbon' | 'calc20' | 'calm';

/** @deprecated The old name. Kept so imports elsewhere keep compiling. */
export type LedgerTheme = Palette;
export type PayBasis = 'bank' | 'paystub';

/**
 * Presentation state belonging to the Calc20 layout alone.
 *
 * It is nested rather than flattened because that layout arrived with two
 * dozen of its own switches, and spreading them across the shared record
 * would make it impossible to see which preference belongs to which screen.
 * Everything the layouts genuinely share — year, monthScope, theme, sync,
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
  /**
   * How much of the year the month lists show, when the reader has said.
   *
   * Unset means "whatever focus mode implies" — see `defaultScope` in
   * domain/months.ts — so the switch in Settings still moves every screen,
   * and picking from a layout's own dropdown takes over from it. One field
   * rather than two: this replaced `hideFuture`, which was the same axis
   * with two of the four positions.
   */
  monthScope?: MonthScope;
  theme: ThemePref;
  /** Layout selection is kept beside the other device-local preferences so
   *  comparing modes does not reset on every refresh. */
  layout: LayoutMode;
  /** Which shell the Overview layout wears. See `OverviewShell`. */
  overviewShell: OverviewShell;
  /**
   * Which palette the app wears. One field for every layout that has one —
   * see `Palette` above for why there used to be three. Independent of
   * `theme`: that is the light/dark axis, this is the hue, and
   * styles/palette.css crosses them.
   */
  palette: Palette;
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
  /**
   * How the user prefers to enter pay across the app.
   * 'bank' = Net pay (what actually reached the bank account).
   * 'paystub' = Gross pay before taxes (from the paystub).
   * Defaults to 'bank' (net pay).
   */
  payBasis: PayBasis;
}

export const DEFAULT_UI: UiState = {
  year: new Date().getFullYear(),
  theme: 'system',
  layout: 'beautiful',
  overviewShell: 'pages',
  palette: 'paper',
  wrStreamsOpen: true,
  wrMonthsOpen: false,
  wrStatusOpen: false,
  calc20: DEFAULT_CALC20_UI,
  onboarded: false,
  focusMode: true,
  cloudSyncEnabled: false,
  payBasis: 'bank'
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
    const saved = JSON.parse(raw) as Partial<UiState> & {
      hideFuture?: boolean;
      layout?: LayoutMode | LegacyLayoutId;
      ledgerTheme?: Palette;
      payguardTheme?: Palette;
      workRecordTheme?: Palette;
    };
    // `hideFuture: false` was the old way of saying "show me the whole year",
    // and it is one of the four positions monthScope now has. Carry it over
    // once; anything saved after this reads monthScope and ignores it.
    const carried = saved.monthScope ?? (saved.hideFuture === false ? 'year' : undefined);
    /*
     * Three palette fields became one. A record saved before that has up to
     * three answers and no way to know which was set last, so the tie is
     * broken by which one the person is most likely to have chosen on
     * purpose: payguardTheme and ledgerTheme were offered in Settings on the
     * layouts people use, while workRecordTheme defaulted to 'calc20' and
     * most records carry that untouched default rather than a choice.
     */
    /*
     * classic / v2 / responsive became one layout with a shell option. A
     * record saved before that names one of the three, and which one is the
     * whole of what it was saying — so it picks the shell rather than being
     * discarded.
     */
    const legacy = isLegacyLayoutId(saved.layout) ? saved.layout : null;
    const layout: LayoutMode = legacy ? 'overview' : (saved.layout ?? DEFAULT_UI.layout);
    const overviewShell: OverviewShell = saved.overviewShell
      ?? (legacy ? SHELL_FOR_LEGACY[legacy] : DEFAULT_UI.overviewShell);

    const palette: Palette = saved.palette
      ?? saved.payguardTheme
      ?? saved.ledgerTheme
      ?? saved.workRecordTheme
      ?? DEFAULT_UI.palette;
    // The top-level spread is one level deep, so a nested slice saved before
    // a switch existed would arrive missing that switch. Merge it by hand.
    return {
      ...DEFAULT_UI,
      ...saved,
      monthScope: carried,
      layout,
      overviewShell,
      palette,
      payBasis: saved.payBasis === 'paystub' ? 'paystub' : 'bank',
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

/**
 * The TWP quiz's own answers, kept only while the quiz is unfinished.
 *
 * It is a separate key from the UI record because it is not a preference:
 * it is a half-finished conversation that must survive a refresh, a
 * backgrounded tab or an old WebView killing the page mid-question, and
 * then go away. `finish` writes the real assessment into TrackerData and
 * clears this; nothing else reads it.
 */
const QUIZ_KEY = 'pg-quiz-draft-v1';

export interface QuizDraft {
  step: string;
  history: string[];
  startMonth: string;
  monthlyEarnings?: number;
  countMode: 'used' | 'remaining';
  countValue?: number;
  conclusion: { headline: string; detail: string; showCountEscape?: boolean } | null;
  pending: { state: 'remaining' | 'complete' | 'unknown'; basis: 'personal-records' | 'unconfirmed'; priorUsed: number | null } | null;
}

export function loadQuizDraft(): Partial<QuizDraft> | null {
  try {
    const raw = localStorage.getItem(QUIZ_KEY);
    return raw ? (JSON.parse(raw) as Partial<QuizDraft>) : null;
  } catch { return null; }
}

export function saveQuizDraft(draft: QuizDraft): void {
  try {
    localStorage.setItem(QUIZ_KEY, JSON.stringify(draft));
  } catch { /* quota or private mode; the quiz continues in memory */ }
}

export function clearQuizDraft(): void {
  try {
    localStorage.removeItem(QUIZ_KEY);
  } catch { /* ignore */ }
}
