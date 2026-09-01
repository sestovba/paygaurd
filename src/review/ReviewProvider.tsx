import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import {
  Archive, ArrowDown, ArrowLeft, ArrowRight, ArrowUp, Check, Copy, Expand,
  Eye, EyeOff, MessageSquarePlus, Minus, Trash2, X
} from 'lucide-react';
import type { LayoutMode } from '../state/storage';
import { anchorId, describeElement, elementPath, labelFor, shortName } from './anchor';
import { actionable, notesToMarkdown } from './markdown';
import { fetchRemote, loadLocal, mergeNotes, pushRemote, saveLocal } from './store';
import type {
  ReviewAnchor, ReviewLane, ReviewNote, ReviewNotes, ReviewVerdict, TrayEdge, TraySettings
} from './types';
import { LANE_NAME, LANE_OPEN, LANES, laneOf } from './types';
import { ReviewContext } from './context';
import type { ReviewContextValue, ReviewMode, SuggestedTarget } from './context';
import { EdgeTrays } from './EdgeTrays';
import { MobileDock } from './MobileDock';
import { DesktopDock } from './DesktopDock';
import {
  applyPlacements, applyStowAttributes, dropTargetAt, isStowed, safeQuery
} from './stow';
import type { DropTarget } from './stow';
import '../styles/review.css';

/** How close to an edge a drag has to get before that tray takes it. */
const EDGE_GRAB = 72;

const EDGES: TrayEdge[] = ['left', 'right', 'top', 'bottom'];

/** The horizontal shelves run across the app's own header and bottom nav, so
 *  they start off the screen. `t` and `b` bring them back, and a drag reveals
 *  all four whether they are hidden or not. */
const DEFAULT_HIDDEN: TrayEdge[] = ['top', 'bottom'];

/** Height of the picker's toolbar, used to flip it above a selection that
 *  sits too near the bottom of the window. */
const ACTIONS_H = 88;

/** The console is a workshop tool: dev server or localhost only, never in a
 *  build someone else is using. */
const ENABLED = import.meta.env.DEV
  || /^(localhost|127\.0\.0\.1|\[::1\])$/.test(window.location.hostname);

type DragState =
  | { from: 'page'; el: HTMLElement; label: string; x: number; y: number; edge: TrayEdge | null }
  | {
      from: 'tray';
      id: string;
      label: string;
      x: number;
      y: number;
      drop: DropTarget | null;
      /** Set while the pointer is over another stash: the drop moves it
       *  between panels instead of putting it back on the page. */
      edge: TrayEdge | null;
    };

function edgeAt(x: number, y: number): TrayEdge | null {
  if (x < EDGE_GRAB) return 'left';
  if (window.innerWidth - x < EDGE_GRAB) return 'right';
  if (y < EDGE_GRAB) return 'top';
  if (window.innerHeight - y < EDGE_GRAB) return 'bottom';
  return null;
}

/** Where the element sits, frozen when the composer opened. The composer is
 *  see-through and pinned beside it, so the thing being described stays in
 *  view while it is described. */
interface Box { top: number; left: number; bottom: number; width: number; height: number }

interface ComposerState {
  id: string;
  label: string;
  anchor: ReviewAnchor;
  draft: string;
  tags: string[];
  reason?: string;
  /** Labels of the parked items a tray-group comment covers. */
  members?: string[];
  /** Absent for tray-group comments, which belong to a side, not an element. */
  at?: Box;
  /** Prior back-and-forth, shown so a follow-up has its context. */
  thread?: ReviewNote['thread'];
}

/** The kinds of change a note usually asks for. Picking one is faster than
 *  typing it, and it makes the notes file sortable by intent. */
const TAGS = [
  'cut', 'move', 'reword', 'resize', 'spacing', 'contrast', 'confusing', 'wrong', 'later'
] as const;

/** One note per side per layout, so a group comment survives the items
 *  coming and going. */
function trayNoteId(layout: LayoutMode, edge: TrayEdge): string {
  return `tray-${layout}-${edge}`;
}

/** What has been looked at, per note: the note's `updatedAt` as it stood the
 *  last time it was read. One timestamp for the whole journal marks a dozen
 *  things read because you opened a drawer, which is how you lose track of
 *  which ones you actually went through.
 *
 *  Local to the browser on purpose. Which of these you have read is yours,
 *  not part of the record both sides write. */
const READ_KEY = 'pg-review-read-v1';

type ReadMarks = Record<string, string>;

function loadRead(): ReadMarks {
  try {
    const raw = localStorage.getItem(READ_KEY);
    return raw ? JSON.parse(raw) as ReadMarks : {};
  } catch {
    return {};
  }
}

/** Lanes come and go, and the file outlives any one version of them: it is
 *  edited by hand, written by a code pass, and read back months later. A
 *  status the app no longer knows lands back in To do on the way in, with no
 *  timestamp bumped — so it is visible immediately and written back clean the
 *  next time that note is touched, rather than silently vanishing. */
function normalizeLanes(notes: ReviewNotes): ReviewNotes {
  let changed = false;
  const out: ReviewNotes = {};
  for (const [id, note] of Object.entries(notes)) {
    const lane = laneOf(note);
    if (lane === note.status) {
      out[id] = note;
      continue;
    }
    changed = true;
    out[id] = { ...note, status: lane };
  }
  return changed ? out : notes;
}

/** Unread until it has been looked at since it last changed — so a note you
 *  read a week ago comes back the moment an answer lands on it. */
function isUnread(note: ReviewNote, read: ReadMarks): boolean {
  const at = read[note.id];
  return !at || note.updatedAt > at;
}

/** Unread, and the last word on it is mine. Worth saying louder than the
 *  rest: it is the half of the conversation that arrives while the app is
 *  shut, written straight into the file. */
function isReply(note: ReviewNote, read: ReadMarks): boolean {
  const last = note.thread?.[note.thread.length - 1];
  return last?.from === 'claude' && isUnread(note, read);
}

/** Beside the element, never over it — clamped so the composer is always
 *  fully on screen even when the element is at a corner. */
function composerAt(at: Box): { top: number; left: number } {
  const width = 336;
  const height = 340;
  const gap = 14;
  const right = at.left + at.width + gap;
  const left = right + width < window.innerWidth - 8
    ? right
    : at.left - gap - width > 8
      ? at.left - gap - width
      : Math.max(8, Math.min(at.left, window.innerWidth - width - 8));
  return {
    top: Math.max(8, Math.min(at.top, window.innerHeight - height - 8)),
    left
  };
}

function isReviewUi(node: EventTarget | null): boolean {
  return node instanceof Element && Boolean(node.closest('[data-review-ui]'));
}

export function ReviewProvider({
  layout,
  onNavigate,
  children
}: {
  layout: LayoutMode;
  /** Switch the app to the layout and palette a note was taken in. */
  onNavigate?: (anchor: ReviewAnchor) => void;
  children: ReactNode;
}) {
  if (!ENABLED) return <>{children}</>;
  return <ReviewConsole layout={layout} onNavigate={onNavigate}>{children}</ReviewConsole>;
}

function ReviewConsole({
  layout,
  onNavigate,
  children
}: {
  layout: LayoutMode;
  onNavigate?: (anchor: ReviewAnchor) => void;
  children: ReactNode;
}) {
  const [mode, setMode] = useState<ReviewMode>('off');
  const [open, setOpen] = useState(false);
  const [notes, setNotes] = useState<ReviewNotes>(() => normalizeLanes(loadLocal()));
  const [panelOpen, setPanelOpen] = useState(false);
  /** The journal opens on the screen you are looking at. Everything ever
   *  said is a tab away, but it is not the thing you are handed first. */
  const [journalScope, setJournalScope] = useState<'screen' | 'all'>('screen');
  /** The board spread into columns across the screen. Desktop only — it is
   *  the one thing here a phone genuinely cannot do. */
  const [journalWide, setJournalWide] = useState(false);
  /** The row under the pointer, or under the keyboard cursor. On a desktop
   *  the page is beside the console rather than behind it, so a row can point
   *  at the thing it is about without anyone having to click anything. */
  const [peek, setPeek] = useState<string | null>(null);
  const [cursor, setCursor] = useState<string | null>(null);
  const [read, setRead] = useState<ReadMarks>(loadRead);
  /** The row that just changed lane, so it can be found again in its new
   *  home instead of being hunted for. */
  const [moved, setMoved] = useState<string | null>(null);
  /** Going through them one at a time: the queue, and where you are in it.
   *  A list you scan is where you lose your place; a queue hands you the
   *  next one and remembers which ones it already handed you. */
  const [triage, setTriage] = useState<{ ids: string[]; at: number } | null>(null);
  const [hovered, setHovered] = useState<Element | null>(null);
  const [picked, setPicked] = useState<Element | null>(null);
  const [, setTick] = useState(0); // scroll/resize nudge so overlays follow
  const [composer, setComposer] = useState<ComposerState | null>(null);
  const [replyTo, setReplyTo] = useState<string | null>(null);
  const [focusId, setFocusId] = useState<string | null>(null);
  const [travelling, setTravelling] = useState<{ note: ReviewNote; tries: number } | null>(null);
  const [toast, setToast] = useState<{ text: string; tone: 'good' | 'warn' | 'info'; at: number } | null>(null);
  const [replyDraft, setReplyDraft] = useState('');
  const [synced, setSynced] = useState<'unknown' | 'file' | 'local'>('unknown');
  const [suggested, setSuggested] = useState<Record<string, { label: string; reason: string }>>({});
  const [variantSets, setVariantSets] = useState<string[]>([]);
  const [drag, setDrag] = useState<DragState | null>(null);
  /** How many steps back are available — a ref alone would never re-render
   *  the button that has to grey itself out. */
  const [undoDepth, setUndoDepth] = useState(0);
  /** The arrangement controls — tidy, keys, shape, clip, minimise — live
   *  behind one button. There are two tools here, not nine. */
  /** The stash drawer's open state lives up here because the toolbar carries
   *  the button that opens it — it belongs in the group with Undo and Log. */
  const [stashOpen, setStashOpen] = useState(false);
  /** The Hidden section's own open state. */
  const [hiddenOpen, setHiddenOpen] = useState(false);
  /** Under this, the console is a bar on the bottom edge; over it, a rail
   *  down the side. They are different objects, not one thing squeezed. */
  const [compact, setCompact] = useState(() => window.innerWidth < 640);
  /** Shelves taken off the screen for now. Not persisted — a hidden shelf is
   *  a thing you did a second ago, not a decision about the product. */
  const [hiddenTrays, setHiddenTrays] = useState<TrayEdge[]>(DEFAULT_HIDDEN);
  const firstSync = useRef(true);
  /** Set once the notes file has been read, successfully or not. Nothing is
   *  written back before then. */
  const readFile = useRef(false);
  /** False until the read marks have been seeded. A browser that has never
   *  opened the console has read nothing and everything by the same token —
   *  starting it on "all read" is the honest reading of "nothing has changed
   *  since you last looked", and every later change stands out properly. */
  const seeded = useRef(Object.keys(loadRead()).length > 0);
  const suggestedRef = useRef<Record<string, { label: string; reason: string }>>({});
  const notesRef = useRef<ReviewNotes>({});
  const readRef = useRef<ReadMarks>({});
  /** The board in the order it is drawn, for the keys that walk it. */
  const orderedRef = useRef<ReviewNote[]>([]);
  const dragStart = useRef<{ x: number; y: number; el: HTMLElement } | null>(null);
  const draggedJustNow = useRef(false);
  const advanceRef = useRef<(() => void) | null>(null);
  /** Read by the global key handler, which must not re-bind on every hover. */
  const pickedRef = useRef<Element | null>(null);
  /** Snapshots of the notes before each change, newest last. */
  const history = useRef<ReviewNotes[]>([]);
  /** Set once the reviewer has said what they want the shelves to do. */
  const shelvesTouched = useRef(false);

  // The repo copy is the shared one: pull it in on mount so notes taken in
  // another browser (or restored from git) show up here too.
  useEffect(() => {
    fetchRemote().then((remote) => {
      if (remote && Object.keys(remote).length) {
        setNotes((current) => mergeNotes(current, normalizeLanes(remote)));
      }
    }).finally(() => { readFile.current = true; });
  }, []);

  useEffect(() => {
    saveLocal(notes);
    if (firstSync.current) {
      firstSync.current = false;
      return;
    }
    const timer = setTimeout(() => {
      // The file is the other half of the conversation. Writing to it before
      // reading it would drop whatever came back while the app was closed.
      if (!readFile.current) return;
      pushRemote(notes).then((ok) => setSynced(ok ? 'file' : 'local'));
    }, 500);
    return () => clearTimeout(timer);
  }, [notes]);

  /** Every change to the notes goes through here, so every change can be
   *  taken back. A review is a series of quick judgements — the cost of a
   *  wrong one has to be one click, or the quick judgements stop. */
  const changeNotes = useCallback((update: (current: ReviewNotes) => ReviewNotes) => {
    setNotes((current) => {
      const next = update(current);
      if (next === current) return current;
      // StrictMode runs updaters twice in dev; the same snapshot must not
      // land on the stack twice or one undo would take two presses.
      if (history.current[history.current.length - 1] !== current) {
        history.current = [...history.current.slice(-29), current];
        setUndoDepth(history.current.length);
      }
      return next;
    });
  }, []);


  const upsert = useCallback((patch: Partial<ReviewNote> & Pick<ReviewNote, 'id'>) => {
    const now = new Date().toISOString();
    changeNotes((current) => {
      const base: ReviewNote = current[patch.id] ?? {
        id: patch.id,
        kind: 'comment',
        origin: 'user',
        label: patch.id,
        status: 'open',
        anchor: { layout },
        createdAt: now,
        updatedAt: now
      };
      return { ...current, [patch.id]: { ...base, ...patch, updatedAt: now } };
    });
    // Written from this browser, so it is read from this browser. Only the
    // other side's writes — merged in from the file — arrive unread.
    setRead((current) => ({ ...current, [patch.id]: now }));
  }, [layout]);

  const remove = useCallback((id: string) => {
    changeNotes((current) => {
      if (!current[id]) return current;
      const next = { ...current };
      delete next[id];
      return next;
    });
  }, []);

  // Read inside callbacks that must not re-create themselves whenever a
  // screen mounts or unmounts one more proposal, or whenever a note changes.
  suggestedRef.current = suggested;
  notesRef.current = notes;
  readRef.current = read;
  pickedRef.current = picked;

  /** Every action says what it did, briefly, the way a game confirms a pickup
   *  instead of leaving you to check an inventory screen. */
  const say = useCallback((text: string, tone: 'good' | 'warn' | 'info' = 'info') => {
    setToast({ text, tone, at: Date.now() });
  }, []);



  useEffect(() => {
    // Both docks are welded to an edge, so a resize only ever decides which
    // of the two is the right object for the screen.
    const onResize = () => {
      setCompact(window.innerWidth < 640);
    };
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  // Hover and keyboard share one highlight: whichever moved last wins.
  useEffect(() => {
    showPeek(peek ?? cursor);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [peek, cursor, notes, layout, mode]);

  useEffect(() => {
    if (!moved) return;
    const timer = window.setTimeout(() => {
      const row = document.querySelector(`[data-note-id="${moved}"]`);
      row?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    }, 30);
    const clear = window.setTimeout(() => setMoved(null), 1400);
    return () => { clearTimeout(timer); clearTimeout(clear); };
  }, [moved]);

  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(null), 1900);
    return () => clearTimeout(timer);
  }, [toast]);

  /* First run in this browser: everything that already exists counts as
     read. "Nothing has changed since you last looked" is true — there was no
     last look — and it means the marks that appear later mean something. */
  useEffect(() => {
    if (seeded.current || !readFile.current) return;
    const ids = Object.keys(notes);
    if (!ids.length) return;
    seeded.current = true;
    setRead((current) => {
      const next = { ...current };
      for (const note of Object.values(notes)) next[note.id] ??= note.updatedAt;
      return next;
    });
  }, [notes]);

  useEffect(() => {
    try {
      localStorage.setItem(READ_KEY, JSON.stringify(read));
    } catch {
      // Private mode; everything simply reads as new next session.
    }
  }, [read]);

  /** Looked at, as of how it stands now. */
  const markRead = useCallback((id: string, at?: string) => {
    setRead((current) => ({ ...current, [id]: at ?? notesRef.current[id]?.updatedAt ?? new Date().toISOString() }));
  }, []);

  const markAllRead = useCallback(() => {
    setRead(() => {
      const next: ReadMarks = {};
      for (const note of Object.values(notesRef.current)) next[note.id] = note.updatedAt;
      return next;
    });
  }, []);

  /** One step back through the notes. Not a page undo: the app's own data is
   *  never touched by this console, so this only ever rewinds judgements. */
  const undo = useCallback(() => {
    const previous = history.current[history.current.length - 1];
    if (!previous) {
      say('Nothing to undo');
      return;
    }
    history.current = history.current.slice(0, -1);
    setUndoDepth(history.current.length);
    setNotes(previous);
    setPicked(null);
    say('Undone', 'good');
  }, [say]);

  /** Unpark. The note survives if it carries a verdict or a comment — those
   *  are the audit record; the stow was only storage. */
  const restore = useCallback((id: string) => {
    changeNotes((current) => {
      const note = current[id];
      if (!note) return current;
      const next = { ...current };
      const { stow: _parked, ...rest } = note;
      if (!rest.verdict && !rest.comment && rest.kind === 'stow') {
        delete next[id];
        return next;
      }
      next[id] = { ...rest, updatedAt: new Date().toISOString() };
      return next;
    });
    say('Back on the page', 'good');
  }, [say]);

  /** Stash exactly what was picked. Widening to the whole audited section is
   *  a separate, deliberate act (`section: true`) — a flag has to land on the
   *  thing that was aimed at, never on the card it happens to sit in. */
  const stow = useCallback((
    el: Element,
    edge: TrayEdge,
    opts?: { label?: string; section?: boolean }
  ) => {
    const host = (opts?.section ? el.closest('[data-review-id]') : null) ?? el;
    const anchor = describeElement(host, layout);
    // Only a note *on* the section may take the section's id; a child stashed
    // out of one gets its own, or the two would overwrite each other.
    const sectionId = host.getAttribute('data-review-id') ?? undefined;
    const id = sectionId ?? anchorId(anchor);
    const name = (sectionId ? suggestedRef.current[sectionId]?.label : undefined)
      ?? opts?.label
      ?? labelFor(host);
    changeNotes((current) => {
      const now = new Date().toISOString();
      const base: ReviewNote = current[id] ?? {
        id,
        kind: 'stow',
        origin: 'user',
        label: name,
        status: 'open',
        anchor,
        createdAt: now,
        updatedAt: now
      };
      return {
        ...current,
        [id]: { ...base, anchor, stow: { edge, at: now }, updatedAt: now }
      };
    });
    say(`Stashed · ${name}`, 'warn');
  }, [layout, say]);

  /** Drag a chip from one stash to another. Which panel something is in is
   *  the reviewer's filing system, so it has to be changeable after the fact
   *  without taking the element back on to the page first. */
  const moveStow = useCallback((id: string, edge: TrayEdge) => {
    const note = notesRef.current[id];
    if (!note?.stow) return;
    if (note.stow.edge === edge) {
      say(`Already in the ${edge} stash`);
      return;
    }
    upsert({ id, stow: { edge, at: new Date().toISOString() } });
    say(`Moved to the ${edge} stash`, 'good');
  }, [upsert, say]);

  const register = useCallback((id: string, label: string, reason: string) => {
    setSuggested((current) => (
      current[id]?.label === label ? current : { ...current, [id]: { label, reason } }
    ));
    return () => setSuggested((current) => {
      if (!(id in current)) return current;
      const next = { ...current };
      delete next[id];
      return next;
    });
  }, []);

  const commentOn = useCallback((
    label: string,
    el: Element | null,
    opts?: { id?: string; reason?: string }
  ) => {
    if (!el) return;
    const anchor = describeElement(el, layout);
    const id = opts?.id ?? anchorId(anchor);
    const rect = el.getBoundingClientRect();
    setComposer({
      id,
      label,
      anchor,
      reason: opts?.reason,
      at: { top: rect.top, left: rect.left, bottom: rect.bottom, width: rect.width, height: rect.height },
      // Re-opening a note reopens what is already there rather than starting
      // a blank one over the top of it.
      draft: notesRef.current[id]?.comment ?? '',
      tags: notesRef.current[id]?.tags ?? [],
      thread: notesRef.current[id]?.thread
    });
  }, [layout]);

  /** Restore, then record where it was dropped. The app can only honour a
   *  move inside one container; anything else is an instruction in the notes
   *  file for the code pass. */
  const restoreWhere = useCallback((id: string, drop: DropTarget | null) => {
    const note = notes[id];
    restore(id);
    if (!note || !drop) return;
    const anchorPath = describeElement(drop.anchor, layout).domPath;
    const anchorLabel = labelFor(drop.anchor);
    if (!anchorPath) return;

    // A timer, not an animation frame: a backgrounded tab stops painting but
    // the note still has to be written.
    setTimeout(() => {
      const moved = note.anchor.reviewId
        ? document.querySelector(`[data-review-id="${note.anchor.reviewId}"]`)
        : safeQuery(note.anchor.domPath);
      const sameContainer = Boolean(moved && moved.parentElement === drop.anchor.parentElement);
      const home = moved?.nextElementSibling === drop.anchor || moved?.previousElementSibling === drop.anchor;
      // Dropped back where it already sits: a plain restore, not a move.
      if (sameContainer && home) return;
      upsert({
        id,
        label: note.label,
        anchor: note.anchor,
        placement: {
          anchor: anchorPath,
          anchorLabel,
          position: drop.position,
          applied: sameContainer
        }
      });
    });
  }, [notes, restore, layout, upsert]);

  const setTray = useCallback((edge: TrayEdge, patch: TraySettings) => {
    const id = trayNoteId(layout, edge);
    const note = notesRef.current[id];
    upsert({
      id,
      label: note?.label ?? `${edge} stash`,
      tray: { ...note?.tray, ...patch },
      anchor: note?.anchor ?? { layout }
    });
  }, [layout, upsert]);

  /** Take a shelf off the screen entirely, or all four at once. This is a
   *  view toggle, not a setting: shelves sit over the page and get in the way
   *  of choosing something underneath, so it lives in memory and is never
   *  written to the notes file. Dragging brings them back as drop targets. */

  // A shelf standing over the thing you are aiming at makes it hard to pick,
  // so selecting starts with them out of the way. A default, not a rule: the
  // first time you press a shelf key, that choice sticks and this stops.
  useEffect(() => {
    if (shelvesTouched.current) return;
    setHiddenTrays(mode === 'pick' ? [...EDGES] : [...DEFAULT_HIDDEN]);
  }, [mode]);

  const registerVariants = useCallback((id: string) => {
    setVariantSets((current) => (current.includes(id) ? current : [...current, id]));
    return () => setVariantSets((current) => current.filter((item) => item !== id));
  }, []);

  const commentOnTray = useCallback((edge: TrayEdge) => {
    const id = trayNoteId(layout, edge);
    const members = Object.values(notes)
      .filter((note) => note.stow?.edge === edge && note.anchor.layout === layout)
      .map((note) => note.label);
    setComposer({
      id,
      label: `${edge} stash · ${members.length} item${members.length === 1 ? '' : 's'}`,
      anchor: { layout, page: undefined },
      draft: notes[id]?.comment ?? '',
      tags: notes[id]?.tags ?? [],
      thread: notes[id]?.thread,
      members
    });
  }, [layout, notes]);

  const commentOnNote = useCallback((id: string) => {
    const note = notes[id];
    if (!note) return;
    setComposer({
      id,
      label: note.label,
      anchor: note.anchor,
      reason: note.reason,
      draft: note.comment ?? '',
      tags: note.tags ?? [],
      thread: note.thread
    });
  }, [notes]);

  const flagStowed = useCallback((id: string) => {
    const note = notes[id];
    if (!note) return;
    upsert({
      id,
      kind: 'delete',
      verdict: note.verdict === 'approved' ? undefined : 'approved',
      label: note.label
    });
  }, [notes, upsert]);

  const decide = useCallback((
    target: SuggestedTarget,
    verdict: ReviewVerdict,
    el: Element | null
  ) => {
    if (verdict === 'revise') {
      commentOn(target.label, el, { id: target.id, reason: target.reason });
      return;
    }
    changeNotes((current) => {
      if (current[target.id]?.verdict === verdict) {
        const next = { ...current };
        delete next[target.id];
        return next;
      }
      const now = new Date().toISOString();
      say(verdict === 'approved' ? `Flagged to cut · ${target.label}` : `Kept · ${target.label}`,
        verdict === 'approved' ? 'warn' : 'good');
      // Answering one should hand you the next, the way a quest chain does.
      setTimeout(() => advanceRef.current?.(), 350);
      return {
        ...current,
        [target.id]: {
          ...current[target.id],
          id: target.id,
          kind: 'delete',
          origin: 'suggested',
          verdict,
          label: target.label,
          reason: target.reason,
          status: 'open',
          anchor: el ? describeElement(el, target.layout) : { layout: target.layout },
          createdAt: current[target.id]?.createdAt ?? now,
          updatedAt: now
        }
      };
    });
  }, [commentOn, say]);

  const chooseVariant = useCallback((
    target: { id: string; label: string; layout: LayoutMode },
    option: string,
    options: string[],
    el: Element | null
  ) => {
    upsert({
      id: target.id,
      kind: 'choice',
      origin: 'suggested',
      verdict: 'approved',
      label: target.label,
      choice: option,
      options,
      status: 'open',
      anchor: el ? describeElement(el, target.layout) : { layout: target.layout }
    });
    say(`Keeping "${option}"`, 'good');
  }, [upsert, say]);

  // --- Select mode: hover to highlight, click to lock on -------------------

  useEffect(() => {
    if (mode !== 'pick') {
      setHovered(null);
      return;
    }

    const onOver = (event: PointerEvent) => {
      if (isReviewUi(event.target)) return;
      setHovered(event.target instanceof Element ? event.target : null);
    };
    const onDown = (event: PointerEvent) => {
      if (isReviewUi(event.target) || !(event.target instanceof HTMLElement)) return;
      dragStart.current = { x: event.clientX, y: event.clientY, el: event.target };
    };
    const onClick = (event: MouseEvent) => {
      if (isReviewUi(event.target)) return;
      // The page works normally when review is off; while picking, a click
      // means "this one", never "submit the form underneath".
      event.preventDefault();
      event.stopPropagation();
      if (draggedJustNow.current) {
        draggedJustNow.current = false;
        return;
      }
      if (event.target instanceof Element) setPicked(event.target);
    };
    const onKey = (event: KeyboardEvent) => {
      // The composer is a text box that opens straight out of this mode, so
      // its keystrokes must never double as picker commands.
      const target = event.target as HTMLElement | null;
      if (target && (target.isContentEditable || /^(input|textarea|select)$/i.test(target.tagName))) {
        return;
      }
      if (event.key === 'Escape') {
        if (picked) setPicked(null);
        else setMode('off');
        return;
      }
      if (!picked) return;
      // Shift turns the aiming arrows into "throw it that way".
      if (event.shiftKey) {
        const edge = ({
          ArrowLeft: 'left', ArrowRight: 'right', ArrowUp: 'top', ArrowDown: 'bottom'
        } as const)[event.key as 'ArrowLeft' | 'ArrowRight' | 'ArrowUp' | 'ArrowDown'];
        if (edge) {
          event.preventDefault();
          stow(picked, edge);
          setPicked(null);
        }
        return;
      }
      // Aim without the mouse: out to the parent, in to the first child, and
      // along the row of siblings. Getting to the exact element is the whole
      // job here, so all four directions have to do something.
      const aim: Record<string, Element | null | undefined> = {
        ArrowUp: picked.parentElement,
        ArrowDown: picked.firstElementChild,
        ArrowLeft: picked.previousElementSibling,
        ArrowRight: picked.nextElementSibling
      };
      const next = aim[event.key];
      if (next) {
        event.preventDefault();
        setPicked(next);
        return;
      }
      if (event.key === 'f') {
        event.preventDefault();
        markPicked();
      }
    };
    const onMove = () => setTick((t) => t + 1);

    document.addEventListener('pointerover', onOver, true);
    document.addEventListener('pointerdown', onDown, true);
    document.addEventListener('click', onClick, true);
    document.addEventListener('keydown', onKey);
    window.addEventListener('scroll', onMove, true);
    window.addEventListener('resize', onMove);
    document.body.classList.add('review-picking');

    return () => {
      document.removeEventListener('pointerover', onOver, true);
      document.removeEventListener('pointerdown', onDown, true);
      document.removeEventListener('click', onClick, true);
      document.removeEventListener('keydown', onKey);
      window.removeEventListener('scroll', onMove, true);
      window.removeEventListener('resize', onMove);
      document.body.classList.remove('review-picking');
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, picked]);

  // Keep the page matching the notes: parked hand-picked elements stay out of
  // view (React owns that markup, so it is hidden rather than detached), and
  // any live-satisfiable move is re-applied after every re-render.
  useEffect(() => {
    // Only the audit reveals what is stowed — everywhere else the page should
    // look the way stowing made it look.
    const reveal = mode === 'audit';
    let frame = 0;
    const apply = () => {
      applyStowAttributes(notes, layout, reveal);
      applyPlacements(notes, layout);
    };
    apply();
    const observer = new MutationObserver(() => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(apply);
    });
    observer.observe(document.body, { childList: true, subtree: true });
    return () => {
      observer.disconnect();
      cancelAnimationFrame(frame);
      applyStowAttributes({}, layout, reveal);
    };
  }, [notes, layout, mode]);


  // Entering the audit hands you the first proposal, however you got there.
  useEffect(() => {
    if (mode !== 'audit') { setFocusId(null); return; }
    const timer = setTimeout(() => stepProposal(1), 80);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode]);

  // Keyboard first, like any game HUD: one chord summons the console, single
  // letters switch tools, Escape backs out one step.
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      const typing = target
        && (target.isContentEditable || /^(input|textarea|select)$/i.test(target.tagName));
      if (typing) return;

      // ⌘R / Ctrl+R summons the console. It costs the page reload, which on a
      // dev server is one click away anyway, and this is dev-only code.
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'r') {
        event.preventDefault();
        setOpen((current) => {
          if (current) { setMode('off'); setPicked(null); }
          return !current;
        });
        return;
      }
      if (event.metaKey || event.ctrlKey || event.altKey) return;

      if (event.key === '`') {
        event.preventDefault();
        setOpen((current) => {
          if (current) { setMode('off'); setPicked(null); }
          return !current;
        });
        return;
      }
      if (!open) return;

      if (event.key === 'a' || event.key === '1') {
        setMode((current) => (current === 'audit' ? 'off' : 'audit'));
      }
      if (event.key === 'p' || event.key === '2') {
        setMode((current) => (current === 'pick' ? 'off' : 'pick'));
      }
      if ((event.key === 'v' || event.key === '3') && variantSets.length) {
        setMode((current) => (current === 'variants' ? 'off' : 'variants'));
      }
      if (event.key === '4') setPanelOpen((current) => !current);
      if (event.key === 'u') undo();

      // Note: on whatever is selected, or go and select something first.
      if (event.key === 'n') {
        const chosen = pickedRef.current;
        if (chosen) commentOn(labelFor(chosen), chosen);
        else { setMode('pick'); say('Pick what the note is about'); }
      }

      // The board, driven from the keyboard. The letters that used to hide
      // the four screen shelves are free: those shelves are the Archive
      // section now, and a key that moves furniture nobody can see was
      // costing the journal every good letter it needed.
      if (journalKeys(event)) return;

      if (mode === 'audit' && event.key === ']') stepProposal(1);
      if (mode === 'audit' && event.key === '[') stepProposal(-1);
      // Escape while picking is already handled there: it clears the selection
      // before it closes anything.
      if (event.key === 'Escape' && mode !== 'pick') {
        if (composer) setComposer(null);
        else if (panelOpen) setPanelOpen(false);
        else if (mode !== 'off') setMode('off');
        else setOpen(false);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, mode, panelOpen, composer, variantSets.length, undo, triage, cursor, notes]);

  // Dragging: out of the page into an edge tray, or out of a tray back on to
  // the page. Both run off pointer events so the same code works on a phone.
  useEffect(() => {
    if (!open) return;

    const onMove = (event: PointerEvent) => {
      const start = dragStart.current;
      if (start && !drag) {
        if (Math.hypot(event.clientX - start.x, event.clientY - start.y) < 6) return;
        setDrag({
          from: 'page',
          el: start.el,
          label: labelFor(start.el),
          x: event.clientX,
          y: event.clientY,
          edge: edgeAt(event.clientX, event.clientY)
        });
        return;
      }
      if (!drag) return;
      event.preventDefault();
      const edge = edgeAt(event.clientX, event.clientY);
      setDrag(drag.from === 'page'
        ? { ...drag, x: event.clientX, y: event.clientY, edge }
        : {
            ...drag,
            x: event.clientX,
            y: event.clientY,
            edge,
            // Over a stash it is a move between panels; anywhere else it is a
            // drop back on to the page, so only one of the two is ever live.
            drop: edge ? null : dropTargetAt(event.clientX, event.clientY)
          });
    };

    const onUp = () => {
      dragStart.current = null;
      if (!drag) return;
      draggedJustNow.current = true;
      if (drag.from === 'page') {
        if (drag.edge) stow(drag.el, drag.edge, { label: drag.label });
      } else if (drag.edge) {
        moveStow(drag.id, drag.edge);
      } else {
        restoreWhere(drag.id, drag.drop);
      }
      setDrag(null);
    };

    window.addEventListener('pointermove', onMove, true);
    window.addEventListener('pointerup', onUp, true);
    window.addEventListener('pointercancel', onUp, true);
    return () => {
      window.removeEventListener('pointermove', onMove, true);
      window.removeEventListener('pointerup', onUp, true);
      window.removeEventListener('pointercancel', onUp, true);
    };
  });

  advanceRef.current = () => { if (mode === 'audit') stepProposal(1); };

  const value = useMemo<ReviewContextValue>(() => ({
    mode,
    notes,
    register,
    registerVariants,
    decide,
    commentOn,
    chooseVariant,
    restore,
    stow,
    focusId,
    isStowed: (id: string) => Boolean(notes[id] && isStowed(notes[id])),
    isHidden: (id: string) => Boolean(notes[id]?.hidden)
  }), [mode, notes, focusId, register, registerVariants, decide, commentOn, chooseVariant, restore, stow]);

  const stashCount = Object.values(notes)
    .filter((note) => note.stow && note.anchor.layout === layout).length;
  const shelves = (
    <EdgeTrays
      notes={notes}
      layout={layout}
      shape="stack"
      embedded
      stackOpen
      onStackToggle={() => setStashOpen((current) => !current)}
      activeEdge={drag?.edge ?? null}
      dragging={Boolean(drag)}
      hidden={hiddenTrays}
      onGrabChip={(id, event) => {
        const note = notes[id];
        if (!note) return;
        event.preventDefault();
        setDrag({
          from: 'tray',
          id,
          label: note.label,
          x: event.clientX,
          y: event.clientY,
          drop: null,
          edge: null
        });
      }}
      onFlag={flagStowed}
      onComment={commentOnNote}
      onRestore={restore}
      onCommentGroup={commentOnTray}
      groupNote={(edge) => notes[trayNoteId(layout, edge)]?.comment}
      traySettings={(edge) => notes[trayNoteId(layout, edge)]?.tray ?? {}}
      onTraySettings={setTray}
    />
  );

  const all = Object.values(notes);
  // Tray names, colours and folded state are the console's own settings, not
  // findings — they should never inflate the badge or the report.
  const findings = all.filter(actionable);

  const openCount = findings.filter((note) => LANE_OPEN.includes(laneOf(note))).length;
  /** What came back since the journal was last read. The console is a
   *  two-way channel, so an answer arriving is worth saying out loud —
   *  otherwise a reply written into the file sits there unseen. */
  const unread = findings.filter((note) => isUnread(note, read));
  const onThisScreen = findings.filter((note) => note.anchor.layout === layout);
  const journalNotes = journalScope === 'screen' ? onThisScreen : findings;
  const suggestedIds = Object.keys(suggested);
  const settled = suggestedIds.filter((id) => notes[id]?.verdict).length;
  const hoverRect = mode === 'pick' && hovered && hovered !== picked
    ? hovered.getBoundingClientRect()
    : null;
  const pickedRect = picked ? picked.getBoundingClientRect() : null;

  function markPicked() {
    if (!picked) return;
    const anchor = describeElement(picked, layout);
    upsert({
      id: anchorId(anchor),
      kind: 'delete',
      origin: 'user',
      verdict: 'approved',
      label: labelFor(picked),
      status: 'open',
      anchor
    });
    setPicked(null);
  }

  function saveComment() {
    // Tags alone are a note: "cut · spacing" on the right element says plenty.
    if (!composer || (!composer.draft.trim() && !composer.tags.length)) return;
    upsert({
      id: composer.id,
      label: composer.label,
      comment: composer.draft.trim() || undefined,
      tags: composer.tags.length ? composer.tags : undefined,
      reason: composer.reason,
      members: composer.members,
      // Commenting on a cut I proposed is the "needs revision" answer.
      // Anything else is just a comment — and editing one must not quietly
      // promote it to a verdict on a proposal that was never made.
      ...(!composer.members && (composer.reason || notes[composer.id]?.origin === 'suggested')
        ? { verdict: 'revise' as ReviewVerdict }
        : { kind: 'comment' as const, origin: 'user' as const }),
      // Said out loud, so it is filed under said — the board's whole job is
      // to show which of these have been dealt with and how.
      status: !notes[composer.id] || laneOf(notes[composer.id]) === 'open'
        ? 'commented' as ReviewLane
        : laneOf(notes[composer.id]),
      anchor: composer.anchor
    });
    setComposer(null);
    setPicked(null);
    say('Comment saved', 'good');
  }

  /** The journal itself — what has been said, and by whom. It is the same
   *  thing in both docks: a window on a desktop, a fold in the phone's dock.
   *  Only its frame changes. */
  const laneGroups = LANES
    .map((lane) => ({
      lane,
      notes: journalNotes
        .filter((note) => laneOf(note) === lane)
        .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
    }))
    .filter((group) => group.notes.length);
  /** The board read top to bottom, which is what the arrow keys walk. */
  const ordered = laneGroups.flatMap((group) => group.notes);
  orderedRef.current = ordered;
  const triageNote = triage ? notes[triage.ids[triage.at]] : undefined;
  const queue = journalNotes.filter((note) => LANE_OPEN.includes(laneOf(note)));

  /** Hand them over one at a time, unread first, oldest first. Scanning a
   *  list is where the place gets lost — this remembers which ones it has
   *  already handed you and how many are left. */
  function startTriage() {
    if (!queue.length) {
      say('Nothing left to go through', 'good');
      return;
    }
    const ids = [...queue]
      .sort((a, b) => (
        Number(!isUnread(a, read)) - Number(!isUnread(b, read))
        || a.createdAt.localeCompare(b.createdAt)
      ))
      .map((note) => note.id);
    setTriage({ ids, at: 0 });
  }

  function triageStep(delta: number) {
    setTriage((current) => (current
      ? { ...current, at: Math.max(0, Math.min(current.at + delta, current.ids.length)) }
      : current));
  }

  /** Answer the card in front of you, and be handed the next one. */
  function triageFile(lane: ReviewLane) {
    if (triageNote) setLane(triageNote, lane);
    triageStep(1);
  }

/** Everything switched off on this screen, newest first. */
  const hiddenHere = Object.values(notes)
    .filter((note) => note.hidden && note.anchor.layout === layout)
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));

  /** What is switched off on this screen. Its own room, not the archive:
   *  the archive holds things carried off the page and this holds lights
   *  left off, and confusing the two loses both. */
  const hiddenList = (
    <div className="review-hidden">
      {hiddenHere.length === 0 ? (
        <p className="review-hidden-empty">
          Nothing hidden on this screen. The eye on a note takes its element
          off the page so you can see whether the page is better without it.
        </p>
      ) : (
        <>
          <ul className="review-hidden-list">
            {hiddenHere.map((note) => (
              <li key={note.id}>
                <button
                  type="button"
                  className="review-hidden-name"
                  onMouseEnter={compact ? undefined : () => setPeek(note.id)}
                  onMouseLeave={compact ? undefined : () => setPeek(null)}
                  onClick={() => pointAtNote(note)}
                >
                  <EyeOff className="size-3.5" />
                  <span>{note.label}</span>
                </button>
                <button
                  type="button"
                  className="review-hidden-back"
                  onClick={() => toggleHidden(note)}
                  title="Put it back on the page"
                >
                  Show
                </button>
              </li>
            ))}
          </ul>
          <button
            type="button"
            className="review-hidden-all"
            onClick={() => {
              for (const note of hiddenHere) upsert({ id: note.id, hidden: undefined });
              say('Everything back on the page', 'good');
            }}
          >
            Show all {hiddenHere.length}
          </button>
        </>
      )}
    </div>
  );

  const journalBody = (
    <>
            <p className="review-panel-sync">
              {synced === 'file'
                ? 'Written to review/REVIEW-NOTES.md'
                : synced === 'local'
                  ? 'This device only — dev server is not writing'
                  : 'Saved on this device'}
            </p>

            {/* Two scopes, contextual first. A journal that opens on every
                note ever written about six layouts is an archive; what you
                want when you tap it is what you just said about this screen. */}
            <div className="review-panel-scope" role="tablist" aria-label="Which notes to show">
              <button
                type="button"
                role="tab"
                aria-selected={journalScope === 'screen'}
                data-on={journalScope === 'screen' || undefined}
                onClick={() => setJournalScope('screen')}
              >
                This screen
                {onThisScreen.length ? <span>{onThisScreen.length}</span> : null}
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={journalScope === 'all'}
                data-on={journalScope === 'all' || undefined}
                onClick={() => setJournalScope('all')}
              >
                Everywhere
                {findings.length ? <span>{findings.length}</span> : null}
              </button>
            </div>

            {triage ? (
              /* One at a time. Every answer files the card and hands over the
                 next, so the work is a sequence rather than a search. */
              <div className="review-queue">
                <div className="review-queue-head">
                  <span className="review-queue-count">
                    {Math.min(triage.at + 1, triage.ids.length)} of {triage.ids.length}
                  </span>
                  <span className="review-queue-bar" aria-hidden="true">
                    <i style={{ width: `${(triage.at / triage.ids.length) * 100}%` }} />
                  </span>
                  <button
                    type="button"
                    className="review-queue-exit"
                    onClick={() => setTriage(null)}
                    aria-label="Back to the board"
                  >
                    <X className="size-4" />
                  </button>
                </div>

                {triageNote ? (
                  <>
                    <div className="review-queue-card">
                      <span className="review-note-kind">
                        {verdictLabel(triageNote)}
                        <span className="review-note-where">{triageNote.anchor.layout}</span>
                      </span>
                      <strong className="review-queue-label">{triageNote.label}</strong>
                      {triageNote.comment
                        ? <span className="review-note-text">“{triageNote.comment}”</span>
                        : null}
                      {triageNote.reason
                        ? <span className="review-queue-reason">I proposed cutting it: {triageNote.reason}</span>
                        : null}
                      {triageNote.anchor.source
                        ? <span className="review-note-source">{triageNote.anchor.source}</span>
                        : null}
                      {triageNote.thread?.length ? (
                        <span className="review-note-thread">
                          {triageNote.thread.map((reply, index) => (
                            <span key={index} data-from={reply.from}>
                              <b>{reply.from === 'claude' ? 'Claude' : 'You'}:</b> {reply.text}
                            </span>
                          ))}
                        </span>
                      ) : null}

                      <div className="review-queue-peek">
                        <button type="button" onClick={() => pointAtNote(triageNote)}>
                          <Eye className="size-4" /> Show me
                        </button>
                        <button
                          type="button"
                          data-on={triageNote.hidden || undefined}
                          onClick={() => toggleHidden(triageNote)}
                          title="Take it off the page to see the screen without it"
                        >
                          {triageNote.hidden ? <Eye className="size-4" /> : <EyeOff className="size-4" />}
                          {triageNote.hidden ? 'Show it' : 'Hide it'}
                        </button>
                        <button
                          type="button"
                          onClick={() => { markRead(triageNote.id); setReplyTo(triageNote.id); }}
                        >
                          <MessageSquarePlus className="size-4" /> Reply
                        </button>
                      </div>
                    </div>

                    {/* Pinned together: the three answers and the way past
                        them. A card long enough to scroll must never push the
                        only useful controls off the bottom. */}
                    <div className="review-queue-foot">
                      <div className="review-queue-nav">
                        <button
                          type="button"
                          disabled={triage.at === 0}
                          onClick={() => triageStep(-1)}
                        >
                          ‹ Back
                        </button>
                        <span className="review-queue-hint">files it and moves on</span>
                        <button type="button" onClick={() => triageStep(1)}>Skip ›</button>
                      </div>
                      <div className="review-queue-acts">
                        <button
                          type="button"
                          className="review-queue-did"
                          onClick={() => triageFile('done')}
                        >
                          <Check className="size-4" /> Did it
                        </button>
                        <button
                          type="button"
                          className="review-queue-again"
                          onClick={() => triageFile('second')}
                        >
                          <Eye className="size-4" /> Second look
                        </button>
                        <button
                          type="button"
                          className="review-queue-later"
                          onClick={() => triageFile('parked')}
                        >
                          <Minus className="size-4" /> Not now
                        </button>
                      </div>
                    </div>
                  </>
                ) : (
                  <div className="review-queue-end">
                    <Check className="size-5" />
                    <strong>That is all of them</strong>
                    <span>{triage.ids.length} gone through on this pass.</span>
                    <button type="button" className="review-primary" onClick={() => setTriage(null)}>
                      Back to the board
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <>
                <div className="review-panel-tools">
                  <button
                    type="button"
                    className="review-panel-go"
                    disabled={!queue.length}
                    onClick={startTriage}
                  >
                    <ArrowRight className="size-4" />
                    {queue.length ? `Go through ${queue.length}` : 'Nothing to go through'}
                  </button>
                  {unread.length ? (
                    <button type="button" className="review-panel-readall" onClick={markAllRead}>
                      Mark {unread.length} read
                    </button>
                  ) : null}
                </div>

                {compact ? null : (
                  <p className="review-panel-keys">
                    <kbd>↑</kbd><kbd>↓</kbd> walk · <kbd>↵</kbd> show it ·
                    {' '}<kbd>d</kbd> did it · <kbd>s</kbd> second look ·
                    {' '}<kbd>l</kbd> not now · <kbd>h</kbd> hide · <kbd>r</kbd> reply
                  </p>
                )}

                <div className="review-table-head" aria-hidden="true">
                  <span />
                  <span>Do</span>
                  <span>Item</span>
                  <span>Where</span>
                  <span>State</span>
                  <span />
                </div>

                <ul className="review-panel-list">
                  {journalNotes.length === 0 ? (
                    <li className="review-panel-empty">
                      {journalScope === 'screen' && findings.length
                        ? 'Nothing marked on this screen yet — the other screens are under Everywhere.'
                        : 'Nothing marked yet. Select something on the page to start.'}
                    </li>
                  ) : null}

                  {/* A board, not an inbox. The lanes are the sections and a
                      note is moved between them by either side — the point is
                      where a thing has got to, not whether it has been read. */}
                  {laneGroups.map(({ lane, notes: inLane }) => (
                    <li key={lane} className="review-panel-lane" data-lane={lane}>
                      <span className="review-panel-lane-head">
                        {LANE_NAME[lane]}
                        <span>{inLane.length}</span>
                      </span>
                      <ul>{inLane.map(noteRow)}</ul>
                    </li>
                  ))}
                </ul>
              </>
            )}

            {replyTo && notes[replyTo] ? (
              <form
                className="review-reply"
                onSubmit={(event) => {
                  event.preventDefault();
                  const text = replyDraft.trim();
                  if (!text) return;
                  const note = notes[replyTo];
                  upsert({
                    id: replyTo,
                    // Saying something about a thing is doing something about
                    // it, so the card moves to say so.
                    ...(laneOf(note) === 'open' ? { status: 'commented' as ReviewLane } : {}),
                    thread: [...(note.thread ?? []), { from: 'you', text, at: new Date().toISOString() }]
                  });
                  setReplyDraft('');
                  setReplyTo(null);
                }}
              >
                <span className="review-reply-target">Reply · {notes[replyTo].label}</span>
                <textarea
                  autoFocus
                  rows={2}
                  value={replyDraft}
                  placeholder="Add to this thread…"
                  onChange={(event) => setReplyDraft(event.currentTarget.value)}
                  onKeyDown={(event) => {
                    if (event.key === 'Escape') setReplyTo(null);
                  }}
                />
                <div className="review-composer-row">
                  {/* Destroying the record lives here, spelled out, and not
                      on the row: there it read as "I am not looking at this",
                      which is what the Not now lane is for — and it threw the
                      thread away instead of parking the item. */}
                  <button
                    type="button"
                    className="review-reply-destroy"
                    onClick={() => {
                      const note = notes[replyTo];
                      if (note && confirm(`Delete the note "${note.label}" and its thread?`)) {
                        remove(replyTo);
                        setReplyTo(null);
                      }
                    }}
                  >
                    <Trash2 className="size-4" /> Delete note
                  </button>
                  <button type="button" className="review-ghost" onClick={() => setReplyTo(null)}>Cancel</button>
                  <button type="submit" className="review-primary">Send</button>
                </div>
              </form>
            ) : null}

            {/* Not while going through them: mid-pass the only things worth
                pressing are the three answers, and this was competing with
                them for the bottom of the sheet. */}
            {triage ? null : (
              <div className="review-panel-foot">
                <button type="button" onClick={() => navigator.clipboard?.writeText(notesToMarkdown(notes))}>
                  <Copy className="size-4" /> Copy for AI
                </button>
                <button
                  type="button"
                  onClick={() => { if (confirm('Clear every review note?')) changeNotes(() => ({})); }}
                >
                  Clear all
                </button>
              </div>
            )}

    </>
  );

  /** The journal's own keys. Returns true when it has taken the press, so
   *  the rest of the console leaves it alone.
   *
   *  Going through a screenful of notes is the tool's main verb, and on a
   *  desktop it should never need the mouse: the arrows walk the board, the
   *  page highlights whatever the cursor is on, and one letter files it. */
  function journalKeys(event: KeyboardEvent): boolean {
    if (compact || !panelOpen) return false;

    // In the queue the keys act on the card in front of you.
    if (triage) {
      const acts: Record<string, ReviewLane> = { d: 'done', s: 'second', l: 'parked' };
      if (acts[event.key]) { event.preventDefault(); triageFile(acts[event.key]); return true; }
      if (event.key === 'ArrowRight') { event.preventDefault(); triageStep(1); return true; }
      if (event.key === 'ArrowLeft') { event.preventDefault(); triageStep(-1); return true; }
      if (triageNote && event.key === 'h') { event.preventDefault(); toggleHidden(triageNote); return true; }
      if (triageNote && event.key === 'Enter') { event.preventDefault(); pointAtNote(triageNote); return true; }
      return false;
    }

    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      if (!orderedRef.current.length) return false;
      event.preventDefault();
      const board = orderedRef.current;
      const at = board.findIndex((note) => note.id === cursor);
      const step = event.key === 'ArrowDown' ? 1 : -1;
      const next = at < 0
        ? (step > 0 ? 0 : board.length - 1)
        : Math.min(Math.max(at + step, 0), board.length - 1);
      const id = board[next].id;
      setCursor(id);
      setPeek(null);
      markRead(id);
      document.querySelector(`[data-note-id="${id}"]`)?.scrollIntoView({ block: 'nearest' });
      return true;
    }

    const note = cursor ? notes[cursor] : undefined;
    if (!note) return false;

    const lanes: Record<string, ReviewLane> = { d: 'done', s: 'second', l: 'parked' };
    if (lanes[event.key]) {
      event.preventDefault();
      // Filing hands over the next row, the way the queue does. Working down
      // a board one key at a time is the same job as going through them, and
      // it must not leave the cursor sitting on something already dealt with.
      const board = orderedRef.current;
      const at = board.findIndex((item) => item.id === note.id);
      setLane(note, lanes[event.key]);
      setCursor(board[at + 1]?.id ?? board[at - 1]?.id ?? null);
      return true;
    }
    if (event.key === 'h') { event.preventDefault(); toggleHidden(note); return true; }
    if (event.key === 'r') { event.preventDefault(); markRead(note.id); setReplyTo(note.id); return true; }
    if (event.key === 'Enter') { event.preventDefault(); pointAtNote(note); return true; }
    return false;
  }

  /** Move a note to the next lane, wrapping round. The board is shared —
   *  a code pass moves the same field in review-notes.json — so this is a
   *  message as much as a state change. */
  function moveLane(note: ReviewNote) {
    const at = LANES.indexOf(laneOf(note));
    setLane(note, LANES[(at + 1) % LANES.length]);
  }

  /** File a note, and do not lose the reader while doing it. Moving lanes
   *  moves the row to another part of the board, which on a phone means it
   *  vanishes from under the thumb that just pressed it — so the row it
   *  became is scrolled to and pulsed in its new home. */
  function setLane(note: ReviewNote, lane: ReviewLane) {
    if (laneOf(note) === lane) return;
    upsert({ id: note.id, status: lane });
    say(`${note.label} → ${LANE_NAME[lane]}`, lane === 'done' ? 'good' : 'info');
    setMoved(note.id);
  }

  /** Switch the element this note is about off, or back on. A layer eye:
   *  not the archive, which is where things carried off the page are kept,
   *  and not a verdict — the code is untouched either way. It sticks to the
   *  layout it was hidden in and travels in the file like everything else,
   *  so the page can be judged without something and then put back. */
  function toggleHidden(note: ReviewNote) {
    const next = !note.hidden;
    upsert({ id: note.id, hidden: next || undefined });
    say(next ? `${note.label} hidden` : `${note.label} back on the page`, next ? 'info' : 'good');
  }


  /** One note in the journal — a table row, and the columns are the
   *  questions in the order they get asked: what has to happen, to what,
   *  where in the code, and where it has got to. */
  function noteRow(note: ReviewNote) {
    const fresh = isUnread(note, read);
    const answered = isReply(note, read);
    const said = note.comment ?? note.reason;
    return (
      <li
        key={note.id}
        className="review-row"
        data-note-id={note.id}
        data-kind={note.kind}
        data-verdict={note.verdict}
        data-unread={fresh || undefined}
        data-moved={moved === note.id || undefined}
        data-cursor={cursor === note.id || undefined}
        onMouseEnter={compact ? undefined : () => setPeek(note.id)}
        onMouseLeave={compact ? undefined : () => setPeek(null)}
      >
        <span className="review-cell-mark">
          {fresh ? <i className="review-note-dot" data-reply={answered || undefined} /> : null}
        </span>

        {/* What has to happen, in one word, in its own column so a screenful
            of notes can be read down rather than across. */}
        <span className="review-cell-what" data-act={actOf(note)}>{actOf(note)}</span>

        <button type="button" className="review-cell-item" onClick={() => pointAtNote(note)}>
          <span className="review-note-label">{note.label}</span>
          {note.tags?.length ? (
            <span className="review-note-tags">
              {note.tags.map((tag) => <span key={tag}>{tag}</span>)}
            </span>
          ) : null}
          {said ? <span className="review-note-text">{said}</span> : null}
          {answered ? <span className="review-note-new">Claude replied</span> : null}
        </button>

        <span className="review-cell-where" title={note.anchor.source ?? note.anchor.layout}>
          {journalScope === 'all' ? <b>{note.anchor.layout}</b> : null}
          {fileOf(note.anchor.source)?.split('/').pop() ?? '—'}
        </span>

        <button
          type="button"
          className="review-note-lane review-cell-lane"
          data-lane={laneOf(note)}
          onClick={() => moveLane(note)}
          aria-label={`${note.label} is ${LANE_NAME[laneOf(note)]} — move it on`}
          title={`${LANE_NAME[laneOf(note)]} — tap to move it on`}
        >
          {LANE_NAME[laneOf(note)]}
        </button>

        <span className="review-cell-acts">
          <button
            type="button"
            className="review-note-eye"
            data-hidden={note.hidden || undefined}
            onClick={() => toggleHidden(note)}
            aria-pressed={Boolean(note.hidden)}
            aria-label={note.hidden ? `Show ${note.label} again` : `Hide ${note.label}`}
            title={note.hidden
              ? 'Hidden on this screen — click to put it back'
              : 'Hide it on this screen. The note stays; the code is untouched.'}
          >
            {note.hidden ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
          </button>
          <button
            type="button"
            className="review-note-remove"
            onClick={() => { markRead(note.id); setReplyTo(replyTo === note.id ? null : note.id); }}
            aria-label={`Reply to ${note.label}`}
            title="Reply"
          >
            <MessageSquarePlus className="size-4" />
          </button>
          {/* Beside the eye, and the opposite of it: the eye takes the
              element off the page and keeps the note, this throws the note
              away and leaves the element alone. */}
          <button
            type="button"
            className="review-note-remove review-note-kill"
            onClick={() => {
              if (confirm(`Delete the note “${note.label}” and its thread? The element itself is not touched.`)) {
                remove(note.id);
              }
            }}
            aria-label={`Delete the note about ${note.label}`}
            title="Delete this note. The element itself is not touched."
          >
            <Trash2 className="size-4" />
          </button>
        </span>
      </li>
    );
  }

  /** Proposals in the order the reader meets them, not the order they mounted. */
  function proposalsInOrder(): string[] {
    return Array.from(document.querySelectorAll('[data-review-id]'))
      .map((el) => el.getAttribute('data-review-id') ?? '')
      .filter((id) => id in suggested);
  }

  function focusProposal(id: string | null) {
    setFocusId(id);
    if (!id) return;
    const el = document.querySelector(`[data-review-id="${id}"]`);
    if (!(el instanceof HTMLElement)) return;
    el.scrollIntoView({ block: 'center', behavior: 'smooth' });
    el.classList.remove('review-flash');
    void el.offsetWidth;
    el.classList.add('review-flash');
    window.setTimeout(() => el.classList.remove('review-flash'), 1600);
  }

  /** Step to the next proposal, preferring ones still unanswered — the point
   *  is to get through them, not to admire the list. */
  function stepProposal(direction: 1 | -1) {
    const order = proposalsInOrder();
    if (!order.length) return;
    const from = focusId ? order.indexOf(focusId) : -1;
    const unanswered = order.filter((id) => !notes[id]?.verdict);
    const pool = unanswered.length ? unanswered : order;
    if (from < 0) {
      focusProposal(pool[direction === 1 ? 0 : pool.length - 1]);
      return;
    }
    const ahead = direction === 1
      ? pool.find((id) => order.indexOf(id) > from)
      : [...pool].reverse().find((id) => order.indexOf(id) < from);
    focusProposal(ahead ?? pool[direction === 1 ? 0 : pool.length - 1]);
  }

  function elementForNote(note: ReviewNote): HTMLElement | null {
    const byId = note.anchor.reviewId
      ? document.querySelector(`[data-review-id="${note.anchor.reviewId}"]`)
      : document.querySelector(`[data-review-id="${note.id}"]`);
    const found = byId ?? safeQuery(note.anchor.domPath);
    if (!(found instanceof HTMLElement)) return null;
    // In the tree but not on the screen — inside a shut accordion, on a tab
    // that is not showing — is the same as absent for the purpose of
    // pointing at it, and flashing it would flash nothing.
    return found.getClientRects().length ? found : null;
  }

  /** The tab or nav item lit up right now, so "is it even on this page?"
   *  can be answered before deciding whether to travel anywhere. */
  function currentPageName(): string | undefined {
    const marker = Array.from(document.querySelectorAll('[aria-current="page"]'))
      .find((el) => el.getClientRects().length);
    const text = (marker?.getAttribute('aria-label') ?? marker?.textContent ?? '')
      .replace(/\s+/g, ' ')
      .trim();
    return text ? text.slice(0, 40) : undefined;
  }

  /** The visible part of where a note lives. When the thing itself is not
   *  showing, the container that holds it usually is, and pointing at that
   *  is the difference between a click that does nothing and a click that
   *  says "in here". Walks up the recorded DOM path, shortest hop first. */
  function nearestVisible(note: ReviewNote): HTMLElement | null {
    const exact = note.anchor.reviewId
      ? document.querySelector(`[data-review-id="${note.anchor.reviewId}"]`)
      : safeQuery(note.anchor.domPath);
    // Found but hidden: its own ancestors are the best answer there is.
    if (exact instanceof HTMLElement) {
      let node: HTMLElement | null = exact.parentElement;
      while (node && node !== document.body) {
        if (node.getClientRects().length && !node.closest('[data-review-ui]')) return node;
        node = node.parentElement;
      }
    }
    // Not in the tree at all: shorten the recorded path a step at a time.
    const parts = (note.anchor.domPath ?? '').split(' > ');
    for (let take = parts.length - 1; take > 0; take -= 1) {
      const found = safeQuery(parts.slice(0, take).join(' > '));
      if (found && found.getClientRects().length) return found;
    }
    return null;
  }

  /** Outline whatever a row is about, for as long as the row is under the
   *  pointer. Not a flash: a flash answers "where is it" once, and this
   *  answers "what am I looking at" continuously, which is the question you
   *  have while sweeping a list of twelve. */
  function showPeek(id: string | null) {
    document.querySelectorAll('[data-review-peek]').forEach((el) => {
      el.removeAttribute('data-review-peek');
    });
    const note = id ? notesRef.current[id] : undefined;
    if (!note) return;
    const exact = elementForNote(note);
    const el = exact ?? nearestVisible(note);
    if (el) el.setAttribute('data-review-peek', exact ? 'exact' : 'near');
  }

  /** Point at the container instead of the thing, and say so. */
  function flashNearest(note: ReviewNote): boolean {
    const near = nearestVisible(note);
    if (!near) return false;
    flashElement(near, 'near');
    say('Not on screen — flashing what holds it', 'warn');
    return true;
  }

  /** Layouts keep their own page state, so the only honest way in from here is
   *  to press the same nav control the reader would press. */
  function openPage(page: string): boolean {
    const wanted = page.trim().toLowerCase();
    const controls = Array.from(document.querySelectorAll<HTMLElement>(
      'nav button, nav a, [role="tab"], .pg-bottom-nav-item, .pg-tab, .v2-nav-item'
    ));
    const hit = controls.find((el) => {
      if (el.closest('[data-review-ui]')) return false;
      if (el.getAttribute('aria-current') === 'page') return false;
      // A layout that keeps its phone tab bar mounted at desktop width would
      // otherwise be navigated by a control the reader cannot even see.
      if (!el.getClientRects().length) return false;
      const name = (el.getAttribute('aria-label') ?? el.textContent ?? '')
        .replace(/\s+/g, ' ')
        .trim()
        .toLowerCase();
      return name === wanted || name.startsWith(wanted);
    });
    hit?.click();
    return Boolean(hit);
  }

  /** Clicking a note should say "this one" out loud: scroll to it and flash
   *  it, every time, even if it is already on screen. */
  function flashElement(target: HTMLElement, tone: 'exact' | 'near' = 'exact') {
    const mark = tone === 'near' ? 'review-flash-near' : 'review-flash';
    target.scrollIntoView({ block: 'center', behavior: 'smooth' });
    target.classList.remove(mark);
    void target.offsetWidth; // restart the animation on a repeat click
    target.classList.add(mark);
    // The near miss holds longer: it is asking you to look for something
    // inside it, which takes longer than being shown the thing itself.
    window.setTimeout(() => target.classList.remove(mark), tone === 'near' ? 2600 : 1600);
  }

  /** Clicking a note takes you to it — switching layout, palette and page if
   *  that is what it takes — then flashes the element itself. */
  function pointAtNote(note: ReviewNote) {
    if (note.stow) {
      const here = note.anchor.layout === layout;
      say(here
        ? `Stashed in the ${note.stow.edge} panel`
        : `Stashed in the ${note.stow.edge} panel over in ${note.anchor.layout}`);
      // Stashing is per screen, so following one means going to that screen.
      if (!here && onNavigate) onNavigate(note.anchor);
      return;
    }

    const here = elementForNote(note);
    if (here) {
      flashElement(here);
      window.history.replaceState(null, '', `#note=${note.id}`);
      return;
    }

    const needsLayout = note.anchor.layout !== layout;
    if (needsLayout && !onNavigate) {
      if (flashNearest(note)) return;
      say(`Lives in the ${note.anchor.layout} layout`, 'info');
      return;
    }

    // Already on the right screen and it still is not showing: there is
    // nowhere to travel to, so point at the part of it that is visible.
    if (!needsLayout && (!note.anchor.page || note.anchor.page === currentPageName())) {
      if (flashNearest(note)) return;
    }

    say(needsLayout ? `Going to ${note.anchor.layout}…` : `Opening ${note.anchor.page}…`, 'info');
    window.history.replaceState(null, '', `#note=${note.id}`);
    if (needsLayout) onNavigate?.(note.anchor);
    else if (note.anchor.page) openPage(note.anchor.page);
    setTravelling({ note, tries: 0 });
  }

  /** The trip takes a few renders: the layout mounts, then its own page has to
   *  be opened, then the element exists. Retry briefly rather than guess. */
  useEffect(() => {
    if (!travelling) return;
    const { note, tries } = travelling;
    const timer = setTimeout(() => {
      const found = elementForNote(note);
      if (found) {
        flashElement(found);
        setTravelling(null);
        return;
      }
      if (tries === 1 && note.anchor.page) openPage(note.anchor.page);
      if (tries >= 8) {
        if (!flashNearest(note)) say('Could not find it on that screen', 'warn');
        setTravelling(null);
        return;
      }
      setTravelling({ note, tries: tries + 1 });
    }, 160);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [travelling, layout]);

  // A note id in the URL is a shareable pointer: open the app on #note=… and
  // it lands you on the right layout, page and element.
  useEffect(() => {
    const match = /#note=(.+)$/.exec(window.location.hash);
    if (!match) return;
    const note = notes[decodeURIComponent(match[1])];
    if (note) pointAtNote(note);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [Object.keys(notes).length === 0]);

  return (
    <ReviewContext.Provider value={value}>
      {children}

      {hoverRect && hovered ? (
        <div
          className="review-outline review-outline-hover"
          style={{ top: hoverRect.top, left: hoverRect.left, width: hoverRect.width, height: hoverRect.height }}
        >
          <span className="review-outline-tag">{labelFor(hovered)}</span>
        </div>
      ) : null}

      {pickedRect && picked ? (
        <>
          <div
            className="review-outline review-outline-picked"
            style={{ top: pickedRect.top, left: pickedRect.left, width: pickedRect.width, height: pickedRect.height }}
          >
            <span className="review-outline-tag">{labelFor(picked)}</span>
          </div>
          <div
            data-review-ui
            className="review-actions"
            style={{
              top: pickedRect.bottom + 8 + ACTIONS_H > window.innerHeight
                ? Math.max(8, pickedRect.top - ACTIONS_H - 8)
                : pickedRect.bottom + 8,
              left: Math.max(8, Math.min(pickedRect.left, window.innerWidth - 380))
            }}
          >
            {/* The path is the aim: click a step to widen the selection to it,
                so a flag lands on the stat rather than on the card holding it. */}
            <div className="review-aim">
              {elementPath(picked).map((node, index) => (
                <button
                  key={index}
                  type="button"
                  data-on={node === picked || undefined}
                  title={`Select ${shortName(node)}`}
                  onClick={() => setPicked(node)}
                >
                  {shortName(node)}
                </button>
              ))}
              <span className="review-aim-size">
                {Math.round(pickedRect.width)}×{Math.round(pickedRect.height)}
              </span>
            </div>

            <div className="review-actions-row">
              <button type="button" onClick={() => commentOn(labelFor(picked), picked)}>
                <MessageSquarePlus className="size-4" /> Note <kbd>n</kbd>
              </button>
              <button type="button" onClick={markPicked}>
                <Trash2 className="size-4" /> Flag <kbd>f</kbd>
              </button>
              <span className="review-stow-group" title="Stash it — pick a side. Shift+arrow does the same.">
                <Archive className="size-4" />
                {([
                  ['left', ArrowLeft],
                  ['top', ArrowUp],
                  ['bottom', ArrowDown],
                  ['right', ArrowRight]
                ] as const).map(([edge, Icon]) => (
                  <button
                    key={edge}
                    type="button"
                    aria-label={`Stash in the ${edge} tray`}
                    title={`Stash · ${edge}`}
                    onClick={() => { stow(picked, edge); setPicked(null); }}
                  >
                    <Icon className="size-3.5" />
                  </button>
                ))}
              </span>
              {picked.closest('[data-review-id]') && !picked.hasAttribute('data-review-id') ? (
                <button
                  type="button"
                  className="review-actions-wide"
                  title="Select the whole audited section around this"
                  onClick={() => {
                    const section = picked.closest('[data-review-id]');
                    if (section) setPicked(section);
                  }}
                >
                  <Expand className="size-4" /> Section
                </button>
              ) : null}
              <button type="button" title="Clear selection · Esc" onClick={() => setPicked(null)}>
                <X className="size-4" />
              </button>
            </div>
          </div>
        </>
      ) : null}

      {composer ? (
        <div
          data-review-ui
          className="review-composer-scrim"
          data-anchored={composer.at ? true : undefined}
          onClick={() => setComposer(null)}
        >
          {/* The element keeps its own light: a comment is about something you
              are looking at, so nothing covers it while you write. */}
          {composer.at ? (
            <span
              className="review-composer-halo"
              style={{
                top: composer.at.top,
                left: composer.at.left,
                width: composer.at.width,
                height: composer.at.height
              }}
            />
          ) : null}
          <form
            className="review-composer"
            style={composer.at ? composerAt(composer.at) : undefined}
            onClick={(event) => event.stopPropagation()}
            onSubmit={(event) => { event.preventDefault(); saveComment(); }}
          >
            <p className="review-composer-target">{composer.label}</p>
            <p className="review-composer-source">
              {composer.members
                ? `${composer.members.length} item(s) parked here · ${composer.anchor.layout}`
                : fileOf(composer.anchor.source) ?? composer.anchor.domPath ?? 'unknown source'}
            </p>
            {composer.reason ? (
              <p className="review-composer-reason">I proposed cutting this: {composer.reason}</p>
            ) : null}
            {composer.members?.length ? (
              <p className="review-composer-members">
                Covers everything in this stash: {composer.members.join(' · ')}
              </p>
            ) : null}
            {composer.thread?.length ? (
              <div className="review-composer-thread">
                {composer.thread.map((reply, index) => (
                  <p key={index} data-from={reply.from}>
                    <b>{reply.from === 'claude' ? 'Claude' : 'You'}</b> {reply.text}
                  </p>
                ))}
              </div>
            ) : null}
            <textarea
              autoFocus
              rows={3}
              value={composer.draft}
              placeholder={composer.members
                ? 'What should happen to all of these?'
                : 'What should change here?'}
              onChange={(event) => setComposer({ ...composer, draft: event.currentTarget.value })}
              onKeyDown={(event) => {
                if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) saveComment();
                // Both key handlers step aside while something is being typed
                // into, so the composer has to close itself.
                if (event.key === 'Escape') setComposer(null);
              }}
            />
            {/* Faster than typing it, and it sorts the notes file by intent. */}
            <div className="review-tag-row">
              {TAGS.map((tag) => (
                <button
                  key={tag}
                  type="button"
                  data-on={composer.tags.includes(tag) || undefined}
                  onClick={() => setComposer({
                    ...composer,
                    tags: composer.tags.includes(tag)
                      ? composer.tags.filter((item) => item !== tag)
                      : [...composer.tags, tag]
                  })}
                >
                  {tag}
                </button>
              ))}
            </div>
            <div className="review-composer-row">
              <span className="review-composer-keys">⌘↵ save · esc cancel</span>
              <button type="button" className="review-ghost" onClick={() => setComposer(null)}>Cancel</button>
              <button type="submit" className="review-primary">Save</button>
            </div>
          </form>
        </div>
      ) : null}

      {drag ? (
        <div
          data-review-ui
          className="review-drag-chip"
          style={{ top: drag.y + 14, left: drag.x + 14 }}
        >
          {drag.label}
        </div>
      ) : null}

      {drag?.from === 'tray' && drag.drop ? (
        <div
          data-review-ui
          className="review-drop-line"
          style={{
            top: drag.drop.line.top,
            left: drag.drop.line.left,
            width: drag.drop.line.width,
            height: drag.drop.line.height
          }}
        />
      ) : null}

      {toast ? (
        <div key={toast.at} data-review-ui className="review-toast" data-tone={toast.tone}>
          {toast.text}
        </div>
      ) : null}

      {compact ? (
        <MobileDock
          open={open}
          onToggle={() => {
            const next = !open;
            setOpen(next);
            if (!next) { setMode('off'); setPicked(null); }
          }}
          onClose={() => { setOpen(false); setMode('off'); setPicked(null); }}
          mode={mode}
          onMode={(next) => {
            setMode(next);
            setPicked(null);
            if (next === 'audit') setTimeout(() => stepProposal(1), 60);
            else setFocusId(null);
          }}
          auditTotal={suggestedIds.length}
          auditSettled={settled}
          variants={variantSets.length}
          undoDepth={undoDepth}
          onUndo={undo}
          journalOpen={panelOpen}
          onJournal={setPanelOpen}
          journalCount={findings.length}
          journalNew={unread.length}
          journal={journalBody}
          stashOpen={stashOpen}
          onStash={setStashOpen}
          stashCount={stashCount}
          shelves={shelves}
          hiddenOpen={hiddenOpen}
          onHidden={setHiddenOpen}
          hiddenCount={hiddenHere.length}
          hiddenList={hiddenList}
        />
      ) : (
        <DesktopDock
          open={open}
          onToggle={() => {
            const next = !open;
            setOpen(next);
            if (!next) { setMode('off'); setPicked(null); }
          }}
          onClose={() => { setOpen(false); setMode('off'); setPicked(null); }}
          openCount={openCount}
          mode={mode}
          onMode={(next) => {
            setMode(next);
            setPicked(null);
            if (next === 'audit') setTimeout(() => stepProposal(1), 60);
            else setFocusId(null);
          }}
          auditTotal={suggestedIds.length}
          auditSettled={settled}
          variants={variantSets.length}
          undoDepth={undoDepth}
          onUndo={undo}
          journalOpen={panelOpen}
          onJournal={setPanelOpen}
          journalCount={findings.length}
          journalNew={unread.length}
          journalWide={journalWide}
          onJournalWide={setJournalWide}
          journal={journalBody}
          stashOpen={stashOpen}
          onStash={setStashOpen}
          stashCount={stashCount}
          shelves={shelves}
          hiddenOpen={hiddenOpen}
          onHidden={setHiddenOpen}
          hiddenCount={hiddenHere.length}
          hiddenList={hiddenList}
        />
      )}
    </ReviewContext.Provider>
  );
}

/** What has to happen about this note, in one word. The old labels named
 *  the note's own state — "Delete", "Approved" — which reads as a thing that
 *  already happened; these name the move that is still owed. */
function actOf(note: ReviewNote): string {
  if (note.kind === 'choice') return 'Chose';
  if (note.placement) return 'Move';
  if (note.verdict === 'approved') return note.kind === 'delete' ? 'Cut' : 'Do';
  if (note.verdict === 'rejected') return 'Keep';
  if (note.verdict === 'revise') return 'Revise';
  if (note.comment) return 'Read';
  if (note.stow) return 'Hidden';
  return 'Look';
}

function verdictLabel(note: ReviewNote): string {
  if (note.kind === 'choice') return `Chose ${note.choice}`;
  if (note.stow && !note.verdict) return 'Stashed';
  if (note.verdict === 'approved') return note.kind === 'delete' ? 'Delete' : 'Approved';
  if (note.verdict === 'rejected') return 'Keep';
  if (note.verdict === 'revise') return 'Revise';
  return 'Comment';
}

/** Dev source line numbers count the HMR prelude, so they are ~19 lines off.
 *  The dev server rewrites them to real lines when it writes the notes file;
 *  in the app itself, only the file name is trustworthy. */
function fileOf(source?: string): string | undefined {
  return source?.split(':')[0];
}


