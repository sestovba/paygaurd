import {
  createContext, useCallback, useContext, useEffect, useMemo, useRef, useState
} from 'react';
import type { ReactNode } from 'react';
import type {
  MonthEntry, MonthKey, Paycheck, Stream, StreamType, TrackerData, TwpAssessment
} from '../domain/types';
import { resolveScope, scopedMonths, todayMonth } from '../domain/months';
import type { MonthScope, MonthShape } from '../domain/months';
import { EMPTY_DATA } from '../domain/types';
import {
  loadData, loadUi, saveData, saveUi
} from './storage';
import type { ThemePref, UiState } from './storage';
import { canSync, deleteCloudData, loadCloudData, saveCloudData } from './cloudSync';
import type { Session } from '../auth/session';

export type CloudSyncStatus = 'idle' | 'syncing' | 'synced' | 'error';

/** One transient message. */
export interface Toast {
  id: number;
  message: string;
  /** Present when the action behind it can be undone from the toast. */
  undo?: boolean;
}

interface TrackerContextValue {
  data: TrackerData;
  ui: UiState;
  /** Accepts an updater as well as a patch, so two preference writes in one
   *  handler compose instead of the second overwriting the first. */
  setUi: (patch: Partial<UiState> | ((current: UiState) => Partial<UiState>)) => void;
  addStream: (type: StreamType) => string;
  updateStream: (id: string, patch: Partial<Stream>) => void;
  removeStream: (id: string) => void;
  updateMonthEntry: (streamId: string, month: MonthKey, patch: Partial<MonthEntry>) => void;
  updateMonthEntries: (
    streamId: string,
    entries: Array<{ month: MonthKey; patch: Partial<MonthEntry> }>
  ) => void;
  addPaycheck: (streamId: string, check: Omit<Paycheck, 'id'>) => void;
  removePaycheck: (streamId: string, checkId: string) => void;
  setTwpAssessment: (assessment: TwpAssessment) => void;
  setPriorTrialMonths: (months: MonthKey[]) => void;
  setIrwe: (month: MonthKey, amount: number) => void;
  /** A whole-dataset edit that still takes one undo step — for the operations
   *  the named mutators above cannot express (clearing a year, duplicating a
   *  stream). Snapshots first, exactly like they do. */
  commit: (updater: (current: TrackerData) => TrackerData) => void;
  resetAll: () => void;
  /** Wholesale replace, for restoring a JSON export. Tolerates a partial or
   *  older-shaped object the same way loadData does. */
  replaceAll: (next: Partial<TrackerData>) => void;

  /** Single-level-per-step undo across every mutator below (not reset/replace). */
  undoCount: number;
  undo: () => void;

  /* Transient feedback.
   *
   * This lived only in calc20, so six of the seven layouts could delete a
   * source or clear a year and say nothing at all. It belongs here, with the
   * data it reports on, rather than in whichever layout happened to invent
   * it — a confirmation is a property of the edit, not of the skin. */
  toasts: Toast[];
  /** `undoable` puts an Undo on the toast, which is the only place a
   *  destructive edit is offered back before it scrolls out of mind. */
  pushToast: (message: string, undoable?: boolean) => void;
  dismissToast: (id: number) => void;

  /** True only for the allowlisted account — see state/cloudSync.ts. */
  canSync: boolean;
  cloudSyncEnabled: boolean;
  cloudSyncStatus: CloudSyncStatus;
  setCloudSyncEnabled: (enabled: boolean) => void;

  /** Null when signed out / auth bypassed (local dev). */
  session: Session | null;
  signOut: () => Promise<void>;
}

const TrackerContext = createContext<TrackerContextValue | null>(null);

function newId(): string {
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

function newActivity(message: string) {
  return { id: newId(), message, at: new Date().toISOString() };
}

function newStream(type: StreamType): Stream {
  return {
    id: newId(),
    /* Review note: "'1099' is on our own banned list and here it is as the
       default name we hand people... 'Delivery or gig work' is what I tapped
       to create it, and that is what it should be called until I rename it."
       Both defaults now echo the button that made them (see AddJobButton in
       components/ui.tsx). This is the only place a stream is created —
       calc20's store delegates to it — so the other layouts get it too. */
    name: type === 'w2' ? 'New job' : 'Delivery or gig work',
    type,
    activeFrom: todayMonth(),
    activeTo: null,
    lifecycle: 'active',
    locked: false,
    payFrequency: type === 'w2' ? 'biweekly' : undefined,
    months: {},
    checks: []
  };
}

export function TrackerProvider({ children, session, onSignOut }: {
  children: ReactNode;
  session?: Session | null;
  onSignOut?: () => Promise<void>;
}) {
  const [data, setData] = useState<TrackerData>(() => loadData());
  const [ui, setUiState] = useState<UiState>(() => loadUi());
  const dataRef = useRef(data);
  dataRef.current = data;

  /* Transient feedback, moved up from calc20 so every layout has it. Three
     at a time and five seconds each: a stack that grows without bound is a
     log, and a log is not feedback. */
  const [toasts, setToasts] = useState<Toast[]>([]);
  const toastId = useRef(0);

  const pushToast = useCallback((message: string, undoable?: boolean) => {
    if (!message) return;
    toastId.current += 1;
    const id = toastId.current;
    setToasts((list) => [...list.slice(-2), { id, message, undo: undoable }]);
    setTimeout(() => setToasts((list) => list.filter((t) => t.id !== id)), 5000);
  }, []);

  const dismissToast = useCallback((id: number) => {
    setToasts((list) => list.filter((t) => t.id !== id));
  }, []);


  const HISTORY_LIMIT = 20;
  const [history, setHistory] = useState<TrackerData[]>([]);

  /** Snapshot before a mutation, so undo can step back one edit at a time.
   *  Not used by resetAll (its own confirm dialog already guards it) or
   *  replaceAll (a wholesale JSON import, not a single edit to undo). */
  const snapshot = useCallback(() => {
    setHistory((h) => [...h, dataRef.current].slice(-HISTORY_LIMIT));
  }, []);

  const undo = useCallback(() => {
    setHistory((h) => {
      if (!h.length) return h;
      setData(h[h.length - 1]);
      return h.slice(0, -1);
    });
  }, []);

  useEffect(() => { saveData(data); }, [data]);
  useEffect(() => { saveUi(ui); }, [ui]);

  const setUi = useCallback((
    patch: Partial<UiState> | ((current: UiState) => Partial<UiState>)
  ) => {
    setUiState((current) => ({
      ...current,
      ...(typeof patch === 'function' ? patch(current) : patch)
    }));
  }, []);

  // Cloud sync: off by default on every device, flagged accounts only, and
  // only after the person explicitly turns it on. No signed-in session, no
  // sync — signed-out / non-allowlisted use is byte-for-byte the local-only
  // behavior this app always had.
  const [cloudReadyUid, setCloudReadyUid] = useState<string | null>(null);
  const [cloudSyncStatus, setCloudSyncStatus] = useState<CloudSyncStatus>('idle');
  const allowed = canSync(session?.email);
  const syncActive = Boolean(session && allowed && ui.cloudSyncEnabled);

  useEffect(() => {
    if (!syncActive || !session) { setCloudSyncStatus('idle'); return; }
    const uid = session.uid;
    let cancelled = false;
    setCloudSyncStatus('syncing');

    (async () => {
      try {
        const cloud = await loadCloudData(uid);
        if (cancelled) return;
        if (cloud) setData({ ...EMPTY_DATA, ...cloud });
        else await saveCloudData(uid, dataRef.current);
        if (!cancelled) setCloudSyncStatus('synced');
      } catch {
        // Offline, or the account's Firestore rules are not deployed yet —
        // local storage keeps working either way.
        if (!cancelled) setCloudSyncStatus('error');
      } finally {
        if (!cancelled) setCloudReadyUid(uid);
      }
    })();

    return () => { cancelled = true; };
  }, [syncActive, session?.uid]);

  useEffect(() => {
    if (!syncActive || !session || cloudReadyUid !== session.uid) return;
    setCloudSyncStatus('syncing');
    const timer = setTimeout(() => {
      saveCloudData(session.uid, data)
        .then(() => setCloudSyncStatus('synced'))
        .catch(() => setCloudSyncStatus('error'));
    }, 1200);
    return () => clearTimeout(timer);
  }, [data, syncActive, session, cloudReadyUid]);

  const setCloudSyncEnabled = useCallback((enabled: boolean) => {
    const uid = session?.uid;
    const email = session?.email;
    setUiState((current) => ({
      ...current,
      cloudSyncEnabled: enabled,
      cloudSyncConsentedAt: enabled ? new Date().toISOString() : current.cloudSyncConsentedAt
    }));
    if (!enabled && uid && canSync(email)) {
      setCloudReadyUid(null);
      setCloudSyncStatus('idle');
      deleteCloudData(uid).catch(() => { /* nothing else to do if this fails offline */ });
    }
  }, [session]);

  const addStream = useCallback((type: StreamType) => {
    snapshot();
    const stream = newStream(type);
    setData((current) => ({
      ...current,
      streams: [...current.streams, stream],
      activity: [
        ...current.activity,
        newActivity(`Added ${type === 'w2' ? 'a job' : 'gig work'} — ${stream.name}`)
      ].slice(-50)
    }));
    return stream.id;
  }, [snapshot]);

  const updateStream = useCallback((id: string, patch: Partial<Stream>) => {
    snapshot();
    setData((current) => ({
      ...current,
      streams: current.streams.map((s) => {
        if (s.id !== id) return s;
        // A job that ends and later resumes needs a fresh anchor payday —
        // the old one may no longer land on a real check date.
        const endedJustNow = patch.lifecycle === 'completed' && s.lifecycle !== 'completed';
        return { ...s, ...patch, ...(endedJustNow && patch.anchorDate === undefined ? { anchorDate: undefined } : {}) };
      })
    }));
  }, [snapshot]);

  const removeStream = useCallback((id: string) => {
    snapshot();
    // Named before it goes, because "Removed" is no help when you have three
    // sources and cannot remember which one you had selected.
    const name = dataRef.current.streams.find((s) => s.id === id)?.name;
    setData((current) => ({ ...current, streams: current.streams.filter((s) => s.id !== id) }));
    pushToast(`${name ?? 'Source'} removed`, true);
  }, [snapshot, pushToast]);

  const updateMonthEntry = useCallback((streamId: string, month: MonthKey, patch: Partial<MonthEntry>) => {
    snapshot();
    setData((current) => ({
      ...current,
      streams: current.streams.map((s) => {
        if (s.id !== streamId) return s;
        const existing = s.months[month] ?? {};
        return { ...s, months: { ...s.months, [month]: { ...existing, ...patch } } };
      })
    }));
  }, [snapshot]);

  /** Commit a related set of month edits as one user action. This is used by
   *  the YTD/year-total fields so splitting one 1099 total across eight
   *  elapsed months takes one undo step, not eight. */
  const updateMonthEntries = useCallback((
    streamId: string,
    entries: Array<{ month: MonthKey; patch: Partial<MonthEntry> }>
  ) => {
    if (!entries.length) return;
    snapshot();
    setData((current) => ({
      ...current,
      streams: current.streams.map((stream) => {
        if (stream.id !== streamId) return stream;
        const months = { ...stream.months };
        entries.forEach(({ month, patch }) => {
          months[month] = { ...(months[month] ?? {}), ...patch };
        });
        return { ...stream, months };
      })
    }));
  }, [snapshot]);

  const addPaycheck = useCallback((streamId: string, check: Omit<Paycheck, 'id'>) => {
    snapshot();
    setData((current) => ({
      ...current,
      streams: current.streams.map((s) => (
        s.id === streamId ? { ...s, checks: [...s.checks, { ...check, id: newId() }] } : s
      ))
    }));
  }, [snapshot]);

  const removePaycheck = useCallback((streamId: string, checkId: string) => {
    snapshot();
    setData((current) => ({
      ...current,
      streams: current.streams.map((s) => (
        s.id === streamId ? { ...s, checks: s.checks.filter((c) => c.id !== checkId) } : s
      ))
    }));
  }, [snapshot]);

  const setTwpAssessment = useCallback((assessment: TwpAssessment) => {
    snapshot();
    setData((current) => {
      const changed = current.twpAssessment.state !== assessment.state;
      /* The activity log is on screen, so it obeys the same rule as every
         other line: no abbreviations, and it says what happened rather than
         which field was set. */
      const label = assessment.state === 'remaining' ? 'you still have trial work months left'
        : assessment.state === 'complete' ? 'your trial work months are used up'
        : 'you are not sure about your trial work months';
      return {
        ...current,
        twpAssessment: assessment,
        activity: changed
          ? [...current.activity, newActivity(`You told us ${label}`)].slice(-50)
          : current.activity
      };
    });
  }, [snapshot]);

  const setPriorTrialMonths = useCallback((months: MonthKey[]) => {
    snapshot();
    setData((current) => ({ ...current, priorTrialMonths: months }));
  }, [snapshot]);

  const setIrwe = useCallback((month: MonthKey, amount: number) => {
    snapshot();
    setData((current) => ({ ...current, irwe: { ...current.irwe, [month]: amount } }));
  }, [snapshot]);

  const commit = useCallback((updater: (current: TrackerData) => TrackerData) => {
    snapshot();
    setData(updater);
  }, [snapshot]);

  const resetAll = useCallback(() => {
    if (!confirm('Delete every job, every month and your trial work record from this device? This cannot be undone.')) return;
    setHistory([]);
    setData({
      version: 1, streams: [], priorTrialMonths: [],
      twpAssessment: { state: 'unknown', basis: 'unconfirmed' }, irwe: {}, activity: []
    });
    // No undo offered: resetAll clears the history too, and an Undo that
    // cannot undo is worse than none.
    pushToast('Everything cleared');
  }, [pushToast]);

  const replaceAll = useCallback((next: Partial<TrackerData>) => {
    setHistory([]);
    setData({ ...EMPTY_DATA, ...next });
    pushToast('Tracker imported');
  }, [pushToast]);

  const signOut = useCallback(async () => {
    if (onSignOut) await onSignOut();
  }, [onSignOut]);

  const value = useMemo<TrackerContextValue>(() => ({
    data, ui, setUi, addStream, updateStream, removeStream, updateMonthEntry, updateMonthEntries,
    addPaycheck, removePaycheck, setTwpAssessment, setPriorTrialMonths, setIrwe, commit, resetAll, replaceAll,
    undoCount: history.length, undo,
    toasts, pushToast, dismissToast,
    canSync: allowed, cloudSyncEnabled: ui.cloudSyncEnabled, cloudSyncStatus, setCloudSyncEnabled,
    session: session ?? null, signOut
  }), [
    data, ui, setUi, addStream, updateStream, removeStream, updateMonthEntry, updateMonthEntries,
    addPaycheck, removePaycheck, setTwpAssessment, setPriorTrialMonths, setIrwe, commit, resetAll, replaceAll,
    history.length, undo, toasts, pushToast, dismissToast,
    allowed, cloudSyncStatus, setCloudSyncEnabled, session, signOut
  ]);

  return <TrackerContext.Provider value={value}>{children}</TrackerContext.Provider>;
}

export function useTracker(): TrackerContextValue {
  const ctx = useContext(TrackerContext);
  if (!ctx) throw new Error('useTracker must be used within TrackerProvider');
  return ctx;
}

/**
 * Which months this screen should list, and the setter its dropdown needs.
 *
 * `shape` is what the layout is for — one month at a time, or a year of rows
 * (see MonthShape in domain/months.ts). It only decides the default: focus
 * mode leaves one month standing on a layout built for one, and the months
 * behind you on a layout built for twelve, because a one-row ledger reads as
 * a page that failed to load. Once the reader picks from the dropdown their
 * choice is what is in force, on every layout, until they change it.
 */
export function useMonthScope(shape: MonthShape, fallback?: MonthScope): {
  scope: MonthScope;
  months: MonthKey[];
  setScope: (scope: MonthScope) => void;
} {
  const { ui, setUi } = useTracker();
  const scope = resolveScope(ui.monthScope, ui.focusMode, shape, fallback);
  const months = useMemo(() => scopedMonths(ui.year, scope), [ui.year, scope]);
  const setScope = useCallback((next: MonthScope) => setUi({ monthScope: next }), [setUi]);
  return { scope, months, setScope };
}


export type { ThemePref };
