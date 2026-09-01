// The Calc20 layout's store, expressed on top of PayGuard's.
//
// The ported components were written against sga_calc20's own TrackerProvider
// and were left calling exactly that API, so this module answers with the
// shape they expect. Nothing here holds earnings: every read and every write
// goes through PayGuard's TrackerProvider, so this layout edits the same
// `pg-data-v1` record as Classic, Ledger, PayGuard and Work Record. Switching
// layouts changes the screen, never the data.
//
// What this module does own:
//
//   * The seam between two `ui` shapes. Calc20's components expect one flat
//     record of ~30 switches; PayGuard keeps the shared preferences (year,
//     hideFuture, theme, sync, terms) at the top level and this layout's own
//     switches in `ui.calc20`. `setUi` routes each key back to the side it
//     came from, so a component can keep writing `setUi({ statusOpen: true })`
//     and `setUi({ year })` without knowing there are two homes.
//   * Toasts, which are this layout's own idea and have no shared equivalent.
//   * The handful of operations PayGuard has no named mutator for — clearing
//     a year, duplicating a stream — written against its `commit` so they
//     still take exactly one undo step.

import {
  createContext, useCallback, useContext, useEffect, useMemo, useRef, useState
} from 'react';
import type { ReactNode } from 'react';
import type {
  MonthEntry, MonthKey, Paycheck, Stream, StreamType, TrackerData, TwpAssessment
} from '../../domain/types';
import { hasMeaningfulData } from '../../domain/earnings';
import { useTracker as usePayGuard } from '../../state/TrackerProvider';
import type { Calc20Ui, LayoutMode, ThemePref, UiState as PgUiState } from '../../state/storage';
import { DEFAULT_CALC20_UI } from '../../state/storage';
import type { Session } from '../../auth/session';

export type ViewportBand = 'phone' | 'tablet' | 'desktop';

export interface ViewportPrefs {
  layout: 'carousel';
  carouselArrange: 'rail' | 'grid';
  pivot: boolean;
  monthColumnsAuto: boolean;
  monthColumnAdjustment: number;
  density: 'compact' | 'comfortable';
}

/** Built-in layout for each device until someone asks to customize. */
export const DEFAULT_VIEWPORTS: Record<ViewportBand, ViewportPrefs> = {
  phone: {
    layout: 'carousel',
    carouselArrange: 'grid',
    pivot: false,
    monthColumnsAuto: true,
    monthColumnAdjustment: 0,
    density: 'comfortable'
  },
  tablet: {
    layout: 'carousel',
    carouselArrange: 'grid',
    pivot: false,
    monthColumnsAuto: true,
    monthColumnAdjustment: 0,
    density: 'comfortable'
  },
  desktop: {
    layout: 'carousel',
    carouselArrange: 'grid',
    pivot: false,
    monthColumnsAuto: true,
    monthColumnAdjustment: 0,
    density: 'comfortable'
  }
};

/**
 * What the ported components see as `ui`: this layout's own switches, plus
 * the preferences it shares with every other layout.
 */
export interface UiState extends Calc20Ui {
  year: number;
  hideFuture: boolean;
  focusMode: boolean;
  theme: ThemePref;
  cloudSyncEnabled: boolean;
  cloudSyncConsentedAt?: string;
  termsAcceptedVersion?: string;
  termsAcceptedAt?: string;
}

export const DEFAULT_UI: UiState = {
  ...DEFAULT_CALC20_UI,
  year: new Date().getFullYear(),
  hideFuture: true,
  focusMode: true,
  theme: 'system',
  cloudSyncEnabled: false
};

/** Keys that belong to the shared record rather than to `ui.calc20`. */
const SHARED_KEYS = [
  'year', 'hideFuture', 'focusMode', 'theme', 'cloudSyncEnabled', 'cloudSyncConsentedAt',
  'termsAcceptedVersion', 'termsAcceptedAt'
] as const;

const SHARED_KEY_SET = new Set<string>(SHARED_KEYS);

export function layoutFor(ui: UiState, band: ViewportBand): ViewportPrefs {
  const prefs = !ui.customizeLayout
    ? { ...DEFAULT_VIEWPORTS[band] }
    : {
      layout: ui.layout,
      carouselArrange: ui.carouselArrange,
      pivot: ui.pivot,
      monthColumnsAuto: ui.monthColumnsAuto,
      monthColumnAdjustment: ui.monthColumnAdjustment,
      density: ui.density
    };
  if (ui.densityChosen) prefs.density = ui.density;
  // Grid is the only stream arrangement.
  prefs.layout = 'carousel';
  prefs.carouselArrange = 'grid';
  return prefs;
}

export interface Toast {
  id: number;
  message: string;
  /** Present when the action can be undone from the toast. */
  undo?: boolean;
}

export interface TrackerContextValue {
  data: TrackerData;
  ui: UiState;
  hasData: boolean;
  canUndo: boolean;
  toasts: Toast[];

  setUi: (patch: Partial<UiState>) => void;
  undo: () => void;

  addStream: (type: StreamType) => string;
  removeStream: (id: string) => void;
  duplicateStream: (id: string) => void;
  updateStream: (id: string, patch: Partial<Stream>) => void;

  setMonthEntry: (streamId: string, month: MonthKey, patch: Partial<MonthEntry>) => void;
  /** A related set of month edits committed as one action, so splitting a
   *  year's total across twelve months takes one undo step, not twelve. */
  setMonthEntries: (
    streamId: string,
    entries: Array<{ month: MonthKey; patch: Partial<MonthEntry> }>
  ) => void;
  addPaycheck: (streamId: string, check: Omit<Paycheck, 'id'>) => void;
  removePaycheck: (streamId: string, checkId: string) => void;
  setIrwe: (month: MonthKey, amount: number | undefined) => void;

  toggleCollapsed: (id: string, value?: boolean) => void;
  setAllCollapsed: (collapsed: boolean) => void;
  toggleStreamSettings: (id: string) => void;

  setPriorTrialMonths: (months: MonthKey[]) => void;
  setTwpAssessment: (assessment: TwpAssessment) => void;
  clearYear: (year: number) => void;
  resetAll: () => void;

  canSync: boolean;
  setCloudSyncEnabled: (enabled: boolean) => void;
  cloudSyncStatus: 'idle' | 'syncing' | 'synced' | 'error';
  cloudLastSyncedAt: number | null;

  downloadJson: () => void;
  importFile: (file: File) => Promise<void>;
  dismissToast: (id: number) => void;

  /** Which layout the whole app is showing — Settings offers the switch. */
  appLayout: LayoutMode;
  setAppLayout: (layout: LayoutMode) => void;

  session: Session | null;
  signOut: () => void;
}

const TrackerContext = createContext<TrackerContextValue | null>(null);

function newCheckId(): string {
  return 'check-' + Math.random().toString(36).slice(2, 9);
}

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

export function Calc20Store({ children }: { children: ReactNode }) {
  const pg = usePayGuard();
  const {
    data, ui: pgUi, setUi: setPgUi, commit, undoCount, undo, session
  } = pg;

  /* Toasts moved up to TrackerProvider so every layout has them. calc20 keeps
     the same three names it always used, forwarded, so nothing here changes
     at the call sites — this layout invented the idea and should not have to
     be rewritten to share it. */
  const { toasts, pushToast, dismissToast } = pg;
  const dataRef = useRef(data);
  dataRef.current = data;

  // PayGuard reports sync as a status only. This layout also says when the
  // last successful sync happened, so remember the moment it flips green.
  const [cloudLastSyncedAt, setCloudLastSyncedAt] = useState<number | null>(null);
  useEffect(() => {
    if (pg.cloudSyncStatus === 'synced') setCloudLastSyncedAt(Date.now());
    if (!pg.cloudSyncEnabled) setCloudLastSyncedAt(null);
  }, [pg.cloudSyncStatus, pg.cloudSyncEnabled]);

  const ui = useMemo<UiState>(() => ({
    ...DEFAULT_CALC20_UI,
    ...pgUi.calc20,
    year: pgUi.year,
    hideFuture: pgUi.hideFuture,
    focusMode: pgUi.focusMode,
    theme: pgUi.theme,
    cloudSyncEnabled: pgUi.cloudSyncEnabled,
    cloudSyncConsentedAt: pgUi.cloudSyncConsentedAt,
    termsAcceptedVersion: pgUi.termsAcceptedVersion,
    termsAcceptedAt: pgUi.termsAcceptedAt
  }), [pgUi]);

  /** Only the keys `ui.calc20` owns. Written as an updater so two preference
   *  writes in one handler compose rather than the second dropping the
   *  first — several toolbar actions do exactly that. */
  const patchCalc20 = useCallback((updater: (current: Calc20Ui) => Partial<Calc20Ui>) => {
    setPgUi((current) => {
      const slice = { ...DEFAULT_CALC20_UI, ...current.calc20 };
      return { calc20: { ...slice, ...updater(slice) } };
    });
  }, [setPgUi]);

  /** One call in, two records out: shared keys stay shared. */
  const setUi = useCallback((patch: Partial<UiState>) => {
    const shared: Record<string, unknown> = {};
    const mine: Record<string, unknown> = {};
    (Object.keys(patch) as Array<keyof UiState>).forEach((key) => {
      if (SHARED_KEY_SET.has(key as string)) shared[key as string] = patch[key];
      else mine[key as string] = patch[key];
    });
    setPgUi((current) => {
      const next: Partial<PgUiState> = { ...shared };
      if (Object.keys(mine).length) {
        next.calc20 = { ...DEFAULT_CALC20_UI, ...current.calc20, ...mine } as Calc20Ui;
      }
      return next;
    });
  }, [setPgUi]);

  const addStream = useCallback((type: StreamType) => {
    const id = pg.addStream(type);
    // Collapse the others so the new one is the thing in view.
    patchCalc20((slice) => {
      const collapsed = { ...slice.collapsed };
      dataRef.current.streams.forEach((s) => { collapsed[s.id] = true; });
      collapsed[id] = false;
      return { collapsed, streamsOpen: true };
    });
    pushToast(type === 'w2' ? 'W-2 job added' : '1099 stream added', true);
    return id;
  }, [pg, patchCalc20, pushToast]);

  const removeStream = useCallback((id: string) => {
    patchCalc20((slice) => {
      const collapsed = { ...slice.collapsed };
      const streamSettings = { ...slice.streamSettings };
      const streamMonthColumnAdjustments = { ...slice.streamMonthColumnAdjustments };
      delete collapsed[id];
      delete streamSettings[id];
      delete streamMonthColumnAdjustments[id];
      return { collapsed, streamSettings, streamMonthColumnAdjustments };
    });
    pg.removeStream(id);
    // The provider toasts this now, for every layout — see removeStream
    // in TrackerProvider. Toasting again here would show it twice.
  }, [pg, patchCalc20, pushToast]);

  const duplicateStream = useCallback((id: string) => {
    commit((current) => {
      const source = current.streams.find((s) => s.id === id);
      if (!source) return current;
      const copy: Stream = {
        ...clone(source),
        id: 'stream-' + Math.random().toString(36).slice(2, 9),
        name: source.name + ' (copy)'
      };
      const streams = current.streams.slice();
      streams.splice(current.streams.findIndex((s) => s.id === id) + 1, 0, copy);
      return { ...current, streams };
    });
    pushToast('Duplicated', true);
  }, [commit, pushToast]);

  const setMonthEntry = useCallback((
    streamId: string,
    month: MonthKey,
    patch: Partial<MonthEntry>
  ) => {
    commit((current) => ({
      ...current,
      streams: current.streams.map((s) => {
        if (s.id !== streamId) return s;
        const merged: MonthEntry = { ...(s.months[month] ?? {}), ...patch };
        // Drop keys that are empty so an untouched month stays absent.
        (Object.keys(merged) as (keyof MonthEntry)[]).forEach((k) => {
          const v = merged[k];
          if (v === undefined || v === null || (typeof v === 'number' && !v)) delete merged[k];
        });
        const months = { ...s.months };
        if (Object.keys(merged).length) months[month] = merged;
        else delete months[month];
        return { ...s, months };
      })
    }));
  }, [commit]);

  const setMonthEntries = useCallback((
    streamId: string,
    entries: Array<{ month: MonthKey; patch: Partial<MonthEntry> }>
  ) => {
    pg.updateMonthEntries(streamId, entries);
  }, [pg]);

  const addPaycheck = useCallback((streamId: string, check: Omit<Paycheck, 'id'>) => {
    commit((current) => ({
      ...current,
      streams: current.streams.map((s) => (
        s.id === streamId
          ? {
            ...s,
            checks: [...s.checks, { ...check, id: newCheckId() }]
              .sort((a, b) => a.date.localeCompare(b.date))
          }
          : s
      ))
    }));
    pushToast('Paycheck added', true);
  }, [commit, pushToast]);

  const removePaycheck = useCallback((streamId: string, checkId: string) => {
    pg.removePaycheck(streamId, checkId);
    pushToast('Paycheck removed', true);
  }, [pg, pushToast]);

  const setIrwe = useCallback((month: MonthKey, amount: number | undefined) => {
    commit((current) => {
      const irwe = { ...current.irwe };
      if (amount && amount > 0) irwe[month] = amount;
      else delete irwe[month];
      return { ...current, irwe };
    });
  }, [commit]);

  const toggleCollapsed = useCallback((id: string, value?: boolean) => {
    patchCalc20((slice) => ({
      collapsed: { ...slice.collapsed, [id]: value ?? !slice.collapsed[id] }
    }));
  }, [patchCalc20]);

  const setAllCollapsed = useCallback((collapsed: boolean) => {
    patchCalc20(() => ({
      collapsed: collapsed
        ? Object.fromEntries(dataRef.current.streams.map((s) => [s.id, true]))
        : {}
    }));
  }, [patchCalc20]);

  const toggleStreamSettings = useCallback((id: string) => {
    patchCalc20((slice) => ({
      streamSettings: { ...slice.streamSettings, [id]: !slice.streamSettings[id] }
    }));
  }, [patchCalc20]);

  const setPriorTrialMonths = useCallback((months: MonthKey[]) => {
    pg.setPriorTrialMonths(Array.from(new Set(months)).sort());
    pushToast('Prior trial work months updated', true);
  }, [pg, pushToast]);

  const setTwpAssessment = useCallback((assessment: TwpAssessment) => {
    pg.setTwpAssessment(assessment);
    pushToast(
      assessment.state === 'unknown' ? 'Trial work status set to unsure'
        : assessment.state === 'complete' ? 'Your trial work months are used up'
          : 'You still have trial work months',
      true
    );
  }, [pg, pushToast]);

  const clearYear = useCallback((year: number) => {
    const prefix = String(year) + '-';
    commit((current) => {
      const irwe = { ...current.irwe };
      Object.keys(irwe).forEach((k) => { if (k.startsWith(prefix)) delete irwe[k]; });
      return {
        ...current,
        irwe,
        streams: current.streams.map((s) => {
          const months = { ...s.months };
          Object.keys(months).forEach((k) => { if (k.startsWith(prefix)) delete months[k]; });
          return { ...s, months, checks: s.checks.filter((c) => !c.month.startsWith(prefix)) };
        })
      };
    });
    pushToast(year + ' cleared', true);
  }, [commit, pushToast]);

  // Export and import are the shared format, byte for byte what every other
  // layout writes and reads — an export taken here opens in PayGuard, and a
  // PayGuard export opens here.
  const downloadJson = useCallback(() => {
    const blob = new Blob([JSON.stringify(dataRef.current, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'paycheck-guard-' + new Date().toISOString().slice(0, 10) + '.json';
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    pushToast('Exported');
  }, [pushToast]);

  const importFile = useCallback(async (file: File) => {
    try {
      const parsed = JSON.parse(await file.text());
      if (!parsed || typeof parsed !== 'object' || !Array.isArray(parsed.streams)) {
        pushToast('That file could not be read as a tracker export.');
        return;
      }
      pg.replaceAll(parsed);
      pushToast('Tracker imported');
    } catch {
      pushToast('That file could not be read as a tracker export.');
    }
  }, [pg, pushToast]);

  const setAppLayout = useCallback((layout: LayoutMode) => {
    setPgUi({ layout });
  }, [setPgUi]);

  const value = useMemo<TrackerContextValue>(() => ({
    data,
    ui,
    hasData: hasMeaningfulData(data),
    canUndo: undoCount > 0,
    toasts,
    setUi,
    undo,
    addStream,
    removeStream,
    duplicateStream,
    updateStream: pg.updateStream,
    setMonthEntry,
    setMonthEntries,
    addPaycheck,
    removePaycheck,
    setIrwe,
    toggleCollapsed,
    setAllCollapsed,
    toggleStreamSettings,
    setPriorTrialMonths,
    setTwpAssessment,
    clearYear,
    resetAll: pg.resetAll,
    canSync: pg.canSync,
    setCloudSyncEnabled: pg.setCloudSyncEnabled,
    cloudSyncStatus: pg.cloudSyncStatus,
    cloudLastSyncedAt,
    downloadJson,
    importFile,
    dismissToast,
    appLayout: pgUi.layout,
    setAppLayout,
    session: session ?? null,
    signOut: pg.signOut
  }), [
    data, ui, undoCount, toasts, setUi, undo, addStream, removeStream, duplicateStream,
    pg, setMonthEntry, setMonthEntries, addPaycheck, removePaycheck, setIrwe, toggleCollapsed, setAllCollapsed,
    toggleStreamSettings, setPriorTrialMonths, setTwpAssessment, clearYear, cloudLastSyncedAt,
    downloadJson, importFile, dismissToast, pgUi.layout, setAppLayout, session
  ]);

  return <TrackerContext.Provider value={value}>{children}</TrackerContext.Provider>;
}

export function useTracker(): TrackerContextValue {
  const ctx = useContext(TrackerContext);
  if (!ctx) throw new Error('useTracker must be used inside Calc20Store');
  return ctx;
}
