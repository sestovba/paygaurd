import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import {
  Archive, ArrowDown, ArrowLeft, ArrowRight, ArrowUp, Check, ChevronDown,
  ChevronsDownUp, ChevronsUpDown, Copy, Crosshair, Expand, Eye, EyeOff, FileCode2,
  MessageSquarePlus, Minus, Plus, SquareCheck, Tag, Trash2, X
} from 'lucide-react';
import type { LayoutMode } from '../state/storage';
import { anchorId, describeElement, elementPath, labelFor, shortName } from './anchor';
import { actionable, notesToMarkdown } from './markdown';
import { fetchRemote, loadLocal, mergeNotes, pushRemote, saveLocal, uploadShot } from './store';
import type {
  ReviewAnchor, ReviewLane, ReviewNote, ReviewNotes, ReviewVerdict, TrayEdge
} from './types';
import { LANE_NAME, LANE_OPEN, laneOf } from './types';
import {
  BUCKET_NAME, CERTAINTY_BLURB, CERTAINTY_NAME, CERTAINTY_RANK,
  STATE_NAME, STATE_BLURB, VERDICT_NAME,
  altStep, bucketOf, canMove, certaintyOf, decisionsFor, nextStep, progressOf, stateOf
} from './state';
import type { Certainty, Decision, NoteState } from './state';
import { ReviewContext } from './context';
import type { ReviewContextValue, ReviewMode, SuggestedTarget } from './context';
import { MobileDock } from './MobileDock';
import { DesktopDock } from './DesktopDock';
import {
  applyPlacements, applyStowAttributes, dropTargetAt, isOffPage as offPage,
  isStowed, safeQuery
} from './stow';
import type { DropTarget } from './stow';
import '../styles/review.css';

/** How close to an edge a drag has to get before that tray takes it. */
const EDGE_GRAB = 72;


/** The horizontal shelves run across the app's own header and bottom nav, so
 *  they start off the screen. `t` and `b` bring them back, and a drag reveals
 *  all four whether they are hidden or not. */

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
  /** Screenshots pasted onto this note, as repo-relative paths. */
  shots?: string[];
  /** Prior back-and-forth, shown so a follow-up has its context. */
  thread?: ReviewNote['thread'];
  /** Live element, when the note was opened from the page. It lets the halo
   *  and card follow a resize or scroll instead of pointing at stale pixels. */
  target?: Element;
  /** The starting values make backdrop/Escape dismissal safe: an untouched
   *  editor can close immediately; a real draft asks before it is discarded. */
  initialDraft: string;
  initialTags: string[];
}

/** The kinds of change a note usually asks for. Picking one is faster than
 *  typing it, and it makes the notes file sortable by intent.
 *
 *  These are the one place a word from here reaches the Do column: with no
 *  verdict on a note, `actOf` uses its first tag. So a tag called "cut" put
 *  CUT back on the board months after the word was retired — the same act
 *  under the old name, in the same column as the new one. It is `remove`,
 *  and every tag here has to stay a word the vocabulary knows. */
const TAG_GROUPS = [
  { label: 'Action', tags: ['remove', 'move', 'reword', 'resize'] },
  { label: 'Polish', tags: ['spacing', 'contrast'] },
  { label: 'Concern', tags: ['confusing', 'wrong', 'later'] }
] as const;

/** One note per side per layout, so a group comment survives the items
 *  coming and going. */

/** What has been looked at, per note: the note's `updatedAt` as it stood the
 *  last time it was read. One timestamp for the whole journal marks a dozen
 *  things read because you opened a drawer, which is how you lose track of
 *  which ones you actually went through.
 *
 *  Local to the browser on purpose. Which of these you have read is yours,
 *  not part of the record both sides write. */
const READ_KEY = 'pg-review-read-v1';

/** Which parts of the console were open. Furniture, not findings — it never
 *  goes near the notes file — but resetting it on every reload means picking
 *  the same three things open again every time the page rebuilds, which on a
 *  dev server is constantly. */
const PANELS_KEY = 'pg-review-panels-v1';

interface Panels {
  open: boolean;
  min: boolean;
  tools: boolean;
  journal: boolean;
  wide: boolean;
  scope: 'screen' | 'all';
  /** The order the sections are stacked in, yours to rearrange. */
  order: string[];
}

/*
 * Two rooms, not five.
 *
 * Comments, Hidden and Archive were each a section in the rail with its own
 * count, its own empty state and its own restore button — three rooms holding
 * rows the notes list already held, so the same item was in two places with
 * two different counts beside it (My Comments said 44 while the list said
 * 49). They are not places. They are ways of looking at one list, and they
 * are filters now: see `LENSES` below.
 *
 * 'journal' keeps its key because it is persisted in localStorage and named
 * in the stylesheet; what changed is the word on it, which is "Notes".
 */
export const SECTIONS = ['tools', 'journal'] as const;

const PANELS: Panels = {
  open: false,
  min: false,
  tools: true,
  journal: true,
  wide: false,
  scope: 'screen',
  order: [...SECTIONS]
};

function loadPanels(): Panels {
  try {
    const raw = localStorage.getItem(PANELS_KEY);
    const saved = raw ? { ...PANELS, ...JSON.parse(raw) as Partial<Panels> } : PANELS;
    // A section added or removed since the order was saved must not vanish
    // from the dock, and one that no longer exists must not hold a slot.
    const kept = (saved.order ?? []).filter((key) => SECTIONS.includes(key as typeof SECTIONS[number]));
    return {
      ...saved,
      order: [...kept, ...SECTIONS.filter((key) => !kept.includes(key))]
    };
  } catch {
    return PANELS;
  }
}

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
function composerAt(at: Box, width = 376, height = 520): { top: number; left: number } {
  const gap = 14;
  const root = getComputedStyle(document.documentElement);
  const inset = (name: string) => Number.parseFloat(root.getPropertyValue(name)) || 0;
  const bounds = {
    left: inset('--review-rail-left') + 10,
    right: window.innerWidth - inset('--review-rail-right') - 10,
    top: 10,
    bottom: window.innerHeight - inset('--review-rail-bottom') - 10
  };
  const right = at.left + at.width + gap;
  const left = right + width <= bounds.right
    ? right
    : at.left - gap - width >= bounds.left
      ? at.left - gap - width
      : Math.max(bounds.left, Math.min(at.left, bounds.right - width));
  return {
    top: Math.max(bounds.top, Math.min(at.top, bounds.bottom - height)),
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
  const panels = useRef(loadPanels()).current;
  const [mode, setMode] = useState<ReviewMode>('off');
  const [open, setOpen] = useState(panels.open);
  /** Folded to its tab with the review still running. */
  const [dockMin, setDockMin] = useState(panels.min);
  /** The verbs. Their own section, like everything else in the dock. */
  const [toolsOpen, setToolsOpen] = useState(panels.tools);
  /** The order the sections are stacked in. */
  const [order, setOrder] = useState<string[]>(panels.order);
  const [notes, setNotes] = useState<ReviewNotes>(() => normalizeLanes(loadLocal()));
  const [panelOpen, setPanelOpen] = useState(panels.journal);
  /** The journal opens on the screen you are looking at. Everything ever
   *  said is a tab away, but it is not the thing you are handed first. */
  const [journalScope, setJournalScope] = useState<'screen' | 'all'>(panels.scope);
  /** The board spread into columns across the screen. Desktop only — it is
   *  the one thing here a phone genuinely cannot do. */
  const [journalWide, setJournalWide] = useState(panels.wide);
  /** The row under the pointer, or under the keyboard cursor. On a desktop
   *  the page is beside the console rather than behind it, so a row can point
   *  at the thing it is about without anyone having to click anything. */
  const [peek, setPeek] = useState<string | null>(null);
  const [cursor, setCursor] = useState<string | null>(null);
  /** A note that is off the page, and whose section is being marked on the
   *  page so it can be switched back on from where it belongs. */
  const [nest, setNest] = useState<string | null>(null);
  /** The note you were actually looking for, when the marker is on the thing
   *  that swallowed it. */
  const [nestFor, setNestFor] = useState<string | null>(null);
  /** The row that is open for reading and answering. One at a time: two open
   *  rows is a page, not a list. */
  const [openRow, setOpenRow] = useState<string | null>(null);
  /** The row whose state menu is open. */
  const [laneMenu, setLaneMenu] = useState<string | null>(null);
  /** Rows ticked for a bulk action. */
  const [chosen, setChosen] = useState<Set<string>>(() => new Set());
  /** Whether the board is picking rows at all. A checkbox on every row of a
   *  list you are mostly reading is forty controls for something you do
   *  occasionally — so selection is a mode, and the one tick above the board
   *  is the way into it. Off, the rows are notes; on, they are a selection. */
  const [selecting, setSelecting] = useState(false);
  /** Lanes folded away, so a board with forty done things is still a board. */
  const [laneShut, setLaneShut] = useState<Set<string>>(() => new Set());
  /** Which kinds of decision to show. Chips, not a dropdown: they are not
   *  mutually exclusive, so an empty set means all of them and anything else
   *  means exactly those. */
  const [only, setOnly] = useState<Set<string>>(() => new Set());
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
  /** Select is the precision workshop. Comment is the fast path: it borrows
   *  the same hit-testing, then opens the note card on the very next click. */
  const [commentIntent, setCommentIntent] = useState(false);
  const [, setTick] = useState(0); // scroll/resize nudge so overlays follow
  const [composer, setComposer] = useState<ComposerState | null>(null);
  /** Where the composer has been dragged to. A comment is about something you
   *  are looking at, and the panel is 26rem wide — anchored beside a wide
   *  element it covers the next one along, and there was nothing to do about
   *  it but close the panel, scroll, and open it again. Grab its head and
   *  move it. Cleared when a new one opens, so it never comes back somewhere
   *  you cannot see. */
  const [composerMoved, setComposerMoved] = useState<{ top: number; left: number } | null>(null);
  const composerGrab = useRef<{ x: number; y: number; top: number; left: number } | null>(null);
  const [composerLayout, setComposerLayout] = useState<{
    top: number;
    left: number;
    anchor: Box;
  } | null>(null);
  const [confirmDiscard, setConfirmDiscard] = useState(false);
  const [focusId, setFocusId] = useState<string | null>(null);
  const [travelling, setTravelling] = useState<{ note: ReviewNote; tries: number } | null>(null);
  const [toast, setToast] = useState<{ text: string; tone: 'good' | 'warn' | 'info'; at: number } | null>(null);
  /** A reply belongs to its row. Keeping one global string can accidentally
   *  send note A's half-written answer from note B. */
  const [replyDrafts, setReplyDrafts] = useState<Record<string, string>>({});
  const [synced, setSynced] = useState<'unknown' | 'file' | 'local'>('unknown');
  const [suggested, setSuggested] = useState<Record<string, { label: string; reason: string; certainty?: Certainty }>>({});
  const [variantSets, setVariantSets] = useState<string[]>([]);
  const [drag, setDrag] = useState<DragState | null>(null);
  /** How many steps back are available — a ref alone would never re-render
   *  the button that has to grey itself out. */
  const [undoDepth, setUndoDepth] = useState(0);
  /** The arrangement controls — tidy, keys, shape, clip, minimise — live
   *  behind one button. There are two tools here, not nine. */
  /** The stash drawer's open state lives up here because the toolbar carries
   *  the button that opens it — it belongs in the group with Undo and Log. */
  /** Under this, the console is a bar on the bottom edge; over it, a rail
   *  down the side. They are different objects, not one thing squeezed. */
  const [compact, setCompact] = useState(() => window.matchMedia('(max-width: 40rem)').matches);
  /** Shelves taken off the screen for now. Not persisted — a hidden shelf is
   *  a thing you did a second ago, not a decision about the product. */
  const firstSync = useRef(true);
  /** Set once the notes file has been read, successfully or not. Nothing is
   *  written back before then. */
  const readFile = useRef(false);
  /** The same fact as `readFile`, as state — a ref flipping cannot wake an
   *  effect, and the anchor repair below has to run once the file has landed
   *  even though nothing else changes at that moment. */
  const [loaded, setLoaded] = useState(false);
  /** False until the read marks have been seeded. A browser that has never
   *  opened the console has read nothing and everything by the same token —
   *  starting it on "all read" is the honest reading of "nothing has changed
   *  since you last looked", and every later change stands out properly. */
  const seeded = useRef(Object.keys(loadRead()).length > 0);
  const suggestedRef = useRef<Record<string, { label: string; reason: string; certainty?: Certainty }>>({});
  const notesRef = useRef<ReviewNotes>({});
  const readRef = useRef<ReadMarks>({});
  /** The board in the order it is drawn, for the keys that walk it. */
  const orderedRef = useRef<ReviewNote[]>([]);
  const dragStart = useRef<{ x: number; y: number; el: HTMLElement } | null>(null);
  const draggedJustNow = useRef(false);
  const advanceRef = useRef<(() => void) | null>(null);
  /** Read by the global key handler, which must not re-bind on every hover. */
  const pickedRef = useRef<Element | null>(null);
  const composerRef = useRef<HTMLFormElement>(null);
  /** The attach menu on the composer, and the file input it drives. */
  const [attachOpen, setAttachOpen] = useState(false);
  const shotInput = useRef<HTMLInputElement>(null);
  const composerInvoker = useRef<HTMLElement | null>(null);
  /** Snapshots of the notes before each change, newest last. */
  const history = useRef<ReviewNotes[]>([]);

  // The repo copy is the shared one: pull it in on mount so notes taken in
  // another browser (or restored from git) show up here too.
  useEffect(() => {
    fetchRemote().then((remote) => {
      if (remote && Object.keys(remote).length) {
        setNotes((current) => mergeNotes(current, normalizeLanes(remote)));
      }
    }).finally(() => { readFile.current = true; setLoaded(true); });
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
    const query = window.matchMedia('(max-width: 40rem)');
    const onResize = () => setCompact(query.matches);
    query.addEventListener('change', onResize);
    return () => query.removeEventListener('change', onResize);
  }, []);

  /** On a phone the dock and composer are both bottom furniture. Put the dock
   *  down while writing so the note card gets the screen and the keyboard,
   *  then restore exactly the state the reviewer had before. */
  useEffect(() => {
    if (!composer || !compact) return;
    const wasMin = dockMin;
    setDockMin(true);
    return () => setDockMin(wasMin);
    // Opening/closing is the boundary; typing must not re-run this effect.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [Boolean(composer), compact]);

  // A menu left open after you have looked away is a menu you have to close
  // on purpose.
  useEffect(() => {
    if (!laneMenu) return;
    const shut = (event: Event) => {
      if (!(event.target as HTMLElement)?.closest?.('.review-lane-pick')) setLaneMenu(null);
    };
    const onKey = (event: KeyboardEvent) => { if (event.key === 'Escape') setLaneMenu(null); };
    window.addEventListener('pointerdown', shut, true);
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('pointerdown', shut, true);
      window.removeEventListener('keydown', onKey);
    };
  }, [laneMenu]);

  // Hover and keyboard share one highlight: whichever moved last wins.
  useEffect(() => {
    showPeek(peek ?? cursor);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [peek, cursor, notes, layout, mode]);

  useEffect(() => {
    const note = nest ? notes[nest] : undefined;
    if (nest && (!note || !offPage(note))) setNest(null);
  }, [nest, notes]);

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
      localStorage.setItem(PANELS_KEY, JSON.stringify({
        open, min: dockMin, tools: toolsOpen, journal: panelOpen,
        wide: journalWide,
        scope: journalScope, order
      } satisfies Panels));
    } catch {
      // Private mode; the console opens on its defaults each session.
    }
  }, [open, dockMin, toolsOpen, panelOpen, journalWide, journalScope, order]);

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

  const register = useCallback((id: string, label: string, reason: string, certainty?: Certainty) => {
    setSuggested((current) => (
      current[id]?.label === label && current[id]?.certainty === certainty
        ? current
        : { ...current, [id]: { label, reason, certainty } }
    ));
    return () => setSuggested((current) => {
      if (!(id in current)) return current;
      const next = { ...current };
      delete next[id];
      return next;
    });
  }, []);

  /**
   * Describe the element a proposal is about, whether or not the caller had
   * it in hand.
   *
   * Answering a proposal from its own badge passes the live element and the
   * note gets a full anchor. Answering the same proposal from the queue, the
   * toolbar or a keyboard shortcut passed `null`, and the note was written
   * with `{ layout }` and nothing else — no file, no text, no path. Thirteen
   * of eighteen payguard notes were recorded that way, which is why Locate
   * could not find them and why no amount of cleverness at lookup time
   * helped: there was nothing recorded to look up.
   *
   * Every audited section renders `data-review-id`, so the element is sitting
   * in the DOM under a known key. Find it and describe it properly.
   */
  function anchorFor(target: { id: string; layout: LayoutMode }, el: Element | null): ReviewAnchor {
    const found = el
      ?? document.querySelector(`[data-review-id="${CSS.escape(target.id)}"]`);
    // A transparent wrapper describes itself as the wrapper; the child is the
    // thing the reviewer is actually looking at.
    const subject = found?.getAttribute('data-review-transparent') && found.firstElementChild
      ? found.firstElementChild
      : found;
    return subject ? describeElement(subject, target.layout) : { layout: target.layout };
  }

  const commentOn = useCallback((
    label: string,
    el: Element | null,
    opts?: { id?: string; reason?: string }
  ) => {
    if (!el) return;
    // A new comment opens beside its own element, never where the last one
    // happened to be dragged to.
    setComposerMoved(null);
    const anchor = describeElement(el, layout);
    const id = opts?.id ?? anchorId(anchor);
    const rect = el.getBoundingClientRect();
    const prior = notesRef.current[id];
    const draft = prior?.comment ?? '';
    const tags = prior?.tags ?? [];
    const active = document.activeElement;
    composerInvoker.current = active instanceof HTMLElement && active !== document.body
      ? active
      : el instanceof HTMLElement ? el : null;
    setConfirmDiscard(false);
    setComposer({
      id,
      label,
      anchor,
      reason: opts?.reason,
      at: { top: rect.top, left: rect.left, bottom: rect.bottom, width: rect.width, height: rect.height },
      target: el,
      // Re-opening a note reopens what is already there rather than starting
      // a blank one over the top of it.
      draft,
      tags,
      initialDraft: draft,
      initialTags: tags,
      thread: prior?.thread
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

  const registerVariants = useCallback((id: string) => {
    setVariantSets((current) => (current.includes(id) ? current : [...current, id]));
    return () => setVariantSets((current) => current.filter((item) => item !== id));
  }, []);

  const commentOnNote = useCallback((id: string) => {
    const note = notes[id];
    if (!note) return;
    const draft = note.comment ?? '';
    const tags = note.tags ?? [];
    composerInvoker.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    setConfirmDiscard(false);
    setComposer({
      id,
      label: note.label,
      anchor: note.anchor,
      reason: note.reason,
      draft,
      tags,
      initialDraft: draft,
      initialTags: tags,
      thread: note.thread
    });
  }, [notes]);

  /** Measure the real card and keep both it and its spotlight attached to the
   *  live element. Reasons, threads, labels and a growing textarea all change
   *  the height, so a guessed rectangle is never quite right. */
  useLayoutEffect(() => {
    if (!composer?.at || !composerRef.current) {
      setComposerLayout(null);
      return;
    }
    const panel = composerRef.current;
    let frame = 0;
    const place = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const live = composer.target?.isConnected ? composer.target.getBoundingClientRect() : null;
        const anchor: Box = live
          ? {
              top: live.top,
              left: live.left,
              bottom: live.bottom,
              width: live.width,
              height: live.height
            }
          : composer.at!;
        const card = panel.getBoundingClientRect();
        const next = { ...composerAt(anchor, card.width, card.height), anchor };
        setComposerLayout((current) => (
          current
          && Math.abs(current.top - next.top) < 0.5
          && Math.abs(current.left - next.left) < 0.5
          && Math.abs(current.anchor.top - next.anchor.top) < 0.5
          && Math.abs(current.anchor.left - next.anchor.left) < 0.5
            ? current
            : next
        ));
      });
    };
    const observer = new ResizeObserver(place);
    observer.observe(panel);
    place();
    window.addEventListener('resize', place);
    window.addEventListener('scroll', place, true);
    window.visualViewport?.addEventListener('resize', place);
    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
      window.removeEventListener('resize', place);
      window.removeEventListener('scroll', place, true);
      window.visualViewport?.removeEventListener('resize', place);
    };
  }, [composer?.id, composer?.at, composer?.target]);

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
      say(verdict === 'approved' ? `Flagged to cut · ${target.label}`
        : verdict === 'unsure' ? `Unsure · ${target.label}`
          : `Dismissed · ${target.label}`,
      verdict === 'approved' ? 'warn' : verdict === 'unsure' ? 'info' : 'good');
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
          certainty: target.certainty ?? suggestedRef.current[target.id]?.certainty,
          status: 'open',
          anchor: anchorFor(target, el),
          createdAt: current[target.id]?.createdAt ?? now,
          updatedAt: now
        }
      };
    });
  }, [commentOn, say]);

  /** The eye, from the page rather than from a journal row. Whether a note
   *  exists yet or not: auditing a proposed cut, the first thing you want is
   *  the page without it, and that has to work before any verdict is given. */
  const setHiddenById = useCallback((
    target: SuggestedTarget,
    hidden: boolean,
    el: Element | null
  ) => {
    changeNotes((current) => {
      const existing = current[target.id];
      // Switching it back on when nothing else was ever said about it leaves
      // an empty note behind, and an empty note is a row in the journal
      // asking you to do nothing.
      if (!hidden && existing && !existing.verdict && !existing.comment && !existing.thread?.length) {
        const next = { ...current };
        delete next[target.id];
        return next;
      }
      const now = new Date().toISOString();
      return {
        ...current,
        [target.id]: {
          ...existing,
          id: target.id,
          kind: existing?.kind ?? 'delete',
          origin: 'suggested',
          label: target.label,
          reason: target.reason,
          certainty: target.certainty ?? existing?.certainty ?? suggestedRef.current[target.id]?.certainty,
          status: existing?.status ?? 'open',
          hidden: hidden || undefined,
          anchor: existing?.anchor ?? (el ? describeElement(el, target.layout) : { layout: target.layout }),
          createdAt: existing?.createdAt ?? now,
          updatedAt: now
        }
      };
    });
    say(hidden ? `${target.label} hidden` : `${target.label} back on the page`, hidden ? 'info' : 'good');
  }, [say]);

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
      anchor: anchorFor(target, el)
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
      if (event.target instanceof Element) {
        if (commentIntent) commentOn(labelFor(event.target), event.target);
        else setPicked(event.target);
      }
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
        else {
          setCommentIntent(false);
          setMode('off');
        }
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
  }, [mode, picked, commentIntent, commentOn]);

  // Keep the page matching the notes: parked hand-picked elements stay out of
  // view (React owns that markup, so it is hidden rather than detached), and
  // any live-satisfiable move is re-applied after every re-render.
  useEffect(() => {
    // Only the audit reveals what is stowed — everywhere else the page should
    // look the way stowing made it look.
    const reveal = mode === 'audit';
    let frame = 0;
    const apply = () => {
      // `peek` is whatever is being pointed at right now — from a Locate, or
      // from hovering a row. It is revealed on its own so the page still
      // looks the way the review made it look, minus the one thing you asked
      // to see.
      applyStowAttributes(notes, layout, reveal, peek);
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
  }, [notes, layout, mode, peek]);


  /**
   * Repair anchors that were never captured.
   *
   * A proposal answered from the queue or the toolbar used to be written with
   * `{ layout }` and nothing else, so thirteen of eighteen payguard notes had
   * no file, no text and no DOM path — nothing Locate could aim at, and
   * nothing a code pass could grep for. `anchorFor` stops that happening
   * again, but the notes already written stay broken until something touches
   * them, and nothing ever does.
   *
   * So they heal as you browse: whenever an audited section is on screen and
   * its note has no anchor, the anchor is filled in from the live element.
   * `updatedAt` is deliberately left alone — this is the record catching up
   * with what was always true, not news, and it should not mark thirteen
   * notes unread or claim either side said something.
   */
  useEffect(() => {
    if (!loaded) return;
    const timer = setTimeout(() => {
      let repaired = 0;
      changeNotes((current) => {
        let next = current;
        for (const note of Object.values(current)) {
          if (note.anchor.layout !== layout) continue;
          if (note.anchor.text || note.anchor.domPath) continue;
          const el = document.querySelector(`[data-review-id="${CSS.escape(note.anchor.reviewId ?? note.id)}"]`);
          if (!el) continue;
          /* The id sits on a transparent wrapper — `display: contents`, so it
             has no box of its own and no client rects. Testing *it* for being
             on screen answers no every time. The child is the element. */
          const subject = el.getAttribute('data-review-transparent') && el.firstElementChild
            ? el.firstElementChild
            : el;
          /* Deliberately not gated on visibility. Being on a tab that is not
             showing makes an element impossible to *flash*, which is why
             Locate cares; it does not make its text or its DOM path any less
             true, which is all an anchor is. Requiring visibility here meant
             every section behind a closed tab stayed unanchored forever. */
          if (!subject.textContent?.trim()) continue;
          if (next === current) next = { ...current };
          next[note.id] = { ...note, anchor: { ...describeElement(subject, layout), ...note.anchor, layout } };
          repaired += 1;
        }
        return next;
      });
      if (repaired) say(`Anchored ${repaired} note${repaired === 1 ? '' : 's'} to this screen`, 'info');
    }, 800);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [layout, notes, loaded]);

  // Entering the audit hands you the first proposal, however you got there.
  useEffect(() => {
    if (mode !== 'audit') { setFocusId(null); return; }
    const timer = setTimeout(() => stepProposal(1), 80);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode]);

  const triageNote = triage ? notes[triage.ids[triage.at]] : undefined;

  // Keyboard first, like any game HUD: one chord summons the console, single
  // letters switch tools, Escape backs out one step.
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      // Dialog controls are review UI too. Once focus is in the composer its
      // letters must describe the note, never switch a tool behind it.
      if (target?.closest('.review-composer')) return;
      const typing = target
        && (target.isContentEditable || /^(input|textarea|select)$/i.test(target.tagName));
      if (typing) return;

      // ⌘R / Ctrl+R summons the console. It costs the page reload, which on a
      // dev server is one click away anyway, and this is dev-only code.
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'r') {
        event.preventDefault();
        setOpen((current) => !current);
        return;
      }
      if (event.metaKey || event.ctrlKey || event.altKey) return;

      if (event.key === '`') {
        event.preventDefault();
        setOpen((current) => !current);
        return;
      }
      if (!open) return;

      if (triage && triageNote && !composer) {
        if (event.key === 'k' || event.key === '1') {
          event.preventDefault();
          decide({ id: triageNote.id, label: triageNote.label, reason: triageNote.reason ?? '', layout: triageNote.anchor.layout }, 'rejected', null);
          triageStep(1);
          return;
        }
        if (event.key === 'r' || event.key === '2') {
          event.preventDefault();
          decide({ id: triageNote.id, label: triageNote.label, reason: triageNote.reason ?? '', layout: triageNote.anchor.layout }, 'approved', null);
          triageStep(1);
          return;
        }
        if (event.key === 'c' || event.key === '3') {
          event.preventDefault();
          commentOnNote(triageNote.id);
          return;
        }
        if (event.key === 'h' || event.key === ' ') {
          event.preventDefault();
          toggleHidden(triageNote);
          return;
        }
        if (event.key === 'l') {
          event.preventDefault();
          triageFile('second');
          return;
        }
        if (event.key === 'ArrowLeft' || event.key === 'p') {
          event.preventDefault();
          triageStep(-1);
          return;
        }
        if (event.key === 'ArrowRight' || event.key === 'n') {
          event.preventDefault();
          triageStep(1);
          return;
        }
        if (event.key === 'Escape') {
          event.preventDefault();
          setTriage(null);
          return;
        }
      }

      if (event.key === 'a' || event.key === '1') {
        setCommentIntent(false);
        setMode((current) => (current === 'audit' ? 'off' : 'audit'));
      }
      if (event.key === 'p' || event.key === '2') {
        setCommentIntent(false);
        setMode((current) => (current === 'pick' ? 'off' : 'pick'));
      }
      if ((event.key === 'v' || event.key === '3') && variantSets.length) {
        setCommentIntent(false);
        setMode((current) => (current === 'variants' ? 'off' : 'variants'));
      }
      if (event.key === '4') setPanelOpen((current) => !current);
      if (event.key === 'u') undo();

      // On whatever is selected. A key is named for the word on the button
      // it stands in for, or it is a second vocabulary to learn.
      if (event.key === 'c') {
        const chosen = pickedRef.current;
        if (chosen) commentOn(labelFor(chosen), chosen);
        else {
          setMode('pick');
          setCommentIntent(true);
          say('Comment mode · click anything on the page');
        }
      }
      if (event.key === 'x' && pickedRef.current) markPicked();
      if (event.key === 'h' && pickedRef.current) hidePicked();

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
        if (composer) dismissComposer();
        else if (panelOpen) setPanelOpen(false);
        else if (mode !== 'off') setMode('off');
        else setOpen(false);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, mode, panelOpen, composer, variantSets.length, undo, triage, triageNote, cursor, notes]);

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

  /** Proposals in the order the reader meets them, not the order they mounted. */
  const proposalsInOrder = useCallback((): string[] => {
    return Array.from(document.querySelectorAll('[data-review-id]'))
      .map((el) => el.getAttribute('data-review-id') ?? '')
      .filter((id) => id in suggested);
  }, [suggested]);

  const focusProposal = useCallback((id: string | null) => {
    setFocusId(id);
    if (!id) return;
    const el = document.querySelector(`[data-review-id="${id}"]`);
    if (!(el instanceof HTMLElement)) return;
    const target = (el.getAttribute('data-review-transparent') && el.firstElementChild instanceof HTMLElement)
      ? el.firstElementChild
      : el;
    target.scrollIntoView({ block: 'center', behavior: 'smooth' });
    target.classList.remove('review-flash');
    void target.offsetWidth;
    target.classList.add('review-flash');
    window.setTimeout(() => target.classList.remove('review-flash'), 1600);
  }, []);

  const stepProposal = useCallback((direction: 1 | -1) => {
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
  }, [focusId, focusProposal, notes, proposalsInOrder]);

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
    focusProposal,
    isStowed: (id: string) => Boolean(notes[id] && isStowed(notes[id])),
    isHidden: (id: string) => Boolean(notes[id]?.hidden),
    setHidden: setHiddenById
  }), [
    mode, notes, focusId, focusProposal, register, registerVariants, decide, commentOn,
    chooseVariant, restore, stow, setHiddenById
  ]);

  /* The edge shelves are gone.
   *
   * They were a second home for elements taken off the page — four coloured
   * trays you dragged things onto, each with a name, a colour, a sort order
   * and a folded state, all of it stored in review-notes.json as notes that
   * asked for nothing. They had stopped painting at all, and the concept they
   * carried was already covered twice over: an element that is not on the
   * page is off the page, which is a property with a filter, and a note that
   * is settled is Closed, which is a group.
   *
   * There is no Archive. "Where did the note go?" is answered by Closed;
   * "where did the element go?" is answered by Off the page and by Locate,
   * which now reveals it. Two questions, one answer each, no folders to file
   * anything into.
   */

  const all = Object.values(notes);
  // Tray names, colours and folded state are the console's own settings, not
  // findings — they should never inflate the badge or the report.
  /* Dismissing a proposal takes it off the board. Keeping it there as a row
     that says "nothing is owed on this" is a row you have to read and skip
     every time — which is the whole complaint about a Keep category. The
     verdict is still stored, because that is what stops the same section
     being proposed again, and Undo still brings it back. */
  const findings = all.filter((note) => actionable(note) && note.verdict !== 'rejected');

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

  /** Switch off whatever is selected, from the selection itself. */
  function hidePicked() {
    if (!picked) return;
    const anchor = describeElement(picked, layout);
    upsert({
      id: anchorId(anchor),
      kind: 'stow',
      origin: 'user',
      label: labelFor(picked),
      status: 'open',
      hidden: true,
      anchor
    });
    setPicked(null);
    say('Hidden — the eye in the journal puts it back', 'info');
  }

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

  function returnComposerFocus() {
    const target = composerInvoker.current;
    requestAnimationFrame(() => {
      if (target?.isConnected) target.focus({ preventScroll: true });
    });
  }

  function dismissComposer(force = false) {
    if (!composer) return;
    const tagsChanged = composer.tags.join('\u0000') !== composer.initialTags.join('\u0000');
    const dirty = composer.draft !== composer.initialDraft || tagsChanged;
    if (dirty && !force) {
      setConfirmDiscard(true);
      return;
    }
    setConfirmDiscard(false);
    setComposer(null);
    returnComposerFocus();
  }

  function saveComment() {
    // Tags alone are a note: "cut · spacing" on the right element says plenty.
    // So is a screenshot on its own — a picture of the thing that is wrong is
    // an ask, and refusing to save it would throw away the upload.
    if (!composer || (!composer.draft.trim() && !composer.tags.length && !composer.shots?.length)) return;
    const existing = Boolean(notes[composer.id]?.comment || notes[composer.id]?.tags?.length);
    upsert({
      id: composer.id,
      label: composer.label,
      comment: composer.draft.trim() || undefined,
      tags: composer.tags.length ? composer.tags : undefined,
      shots: composer.shots?.length ? composer.shots : undefined,
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
    setConfirmDiscard(false);
    setComposer(null);
    setPicked(null);
    returnComposerFocus();
    say(existing
      ? 'Comment updated'
      : commentIntent ? 'Comment added · click another element' : 'Comment added', 'good');
  }

  /** Send pasted images to the dev server and hang the paths on the draft.
   *  Anything that fails to upload is reported rather than silently dropped:
   *  a screenshot you think you attached and did not is worse than none. */
  async function attachShots(files: File[]) {
    const id = composer?.id ?? `shot-${Date.now().toString(36)}`;
    const saved: string[] = [];
    for (const file of files) {
      const path = await uploadShot(id, file);
      if (path) saved.push(path);
    }
    if (!saved.length) { say('Could not save that image', 'warn'); return; }
    setComposer((current) => (current
      ? { ...current, shots: [...(current.shots ?? []), ...saved] }
      : current));
    say(`${saved.length === 1 ? 'Screenshot' : `${saved.length} screenshots`} attached`, 'good');
  }

  /** The journal itself — what has been said, and by whom. It is the same
   *  thing in both docks: a window on a desktop, a fold in the phone's dock.
   *  Only its frame changes. */
  /** Every verb actually present, so the filter never offers an empty one. */
  const acts = Array.from(new Set(journalNotes.map(actOf))).filter(Boolean).sort();

  /* The two views that are not verbs.
   *
   * "My comments" and "Off the page" were sections; they are lenses on the
   * one list. A lens answers "show me only…", which is exactly what the act
   * chips beside them already do, so they sit in the same strip and behave
   * the same way — one strip, one idea, no new control. */
  const lenses = [
    {
      id: 'lens:mine',
      name: 'Comments',
      match: (note: ReviewNote) => Boolean(note.comment?.trim())
    },
    {
      id: 'lens:offpage',
      name: 'Hidden',
      match: (note: ReviewNote) => offPage(note)
    }
  ].map((lens) => ({ ...lens, count: journalNotes.filter(lens.match).length }))
    .filter((lens) => lens.count > 0);

  const lensById = new Map(lenses.map((lens) => [lens.id, lens]));
  const shownNotes = only.size
    ? journalNotes.filter((note) => (
      // Any selected chip matching is enough, the way the act chips have
      // always behaved — chips narrow by adding, never by intersecting.
      [...only].some((key) => {
        const lens = lensById.get(key);
        return lens ? lens.match(note) : actOf(note) === key;
      })
    ))
    : journalNotes;

  /* An inbox, not a board.
   *
   * The five lanes were an axis the reviewer had to hold in their head — a
   * note was somewhere among To do, Commented, Second look, Done and Not now,
   * and moving it meant knowing which. Worse, nothing ever left: a lane with
   * forty finished things is still forty rows to scroll past, so the list
   * could not empty and there was no way to tell it was finished.
   *
   * Three groups replace them, and the question each answers is the whole
   * reason to look:
   *
   *   Needs you    — your move. This is the list you are trying to clear.
   *   With Claude  — handed over. Visible so nothing feels lost, never in
   *                  your way, and it is not work you can do.
   *   Closed       — everything settled, folded away with a count. The
   *                  drawer that makes clearing the inbox safe.
   *
   * When Needs you is empty the inbox is clear, and says so. */
  const inboxGroups = ([
    { key: 'needsYou', name: BUCKET_NAME.needsYou, hint: 'Your move. Clear these.' },
    { key: 'withClaude', name: BUCKET_NAME.withClaude, hint: 'Handed over. Nothing to do.' },
    { key: 'closed', name: BUCKET_NAME.closed, hint: 'Settled. Still findable.' }
  ] as const).map((group) => ({
    ...group,
    notes: shownNotes
      .filter((note) => bucketOf(stateOf(note)) === group.key)
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
  }));

  /** The inbox read top to bottom, which is what the arrow keys walk. */
  const ordered = inboxGroups.flatMap((group) => group.notes);
  orderedRef.current = ordered;

  /** What Go Through hands over: your move only. It never offers something
   *  that is waiting on Claude, because there is no answer you could give. */
  const queue = journalNotes.filter((note) => bucketOf(stateOf(note)) === 'needsYou');

  /** The one number in the header. Closed over everything, so it only moves
   *  when something actually settles. */
  const progress = progressOf(journalNotes);

  /** Everything that could be closed right now without asserting anything
   *  untrue: Claude has answered it, or it never owed a change. */
  const closeable = journalNotes.filter((note) => (
    bucketOf(stateOf(note)) !== 'closed' && canMove(note, 'done').ok
  ));

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
        // Then the checkable ones, which clear fast and build the sense of
        // progress; hunches last, when there is room to think about them.
        || (CERTAINTY_RANK[certaintyOf(a) ?? 'likely'] - CERTAINTY_RANK[certaintyOf(b) ?? 'likely'])
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

  useEffect(() => {
    if (triageNote) {
      focusProposal(triageNote.id);
    }
  }, [triageNote?.id, focusProposal]);

    const copyAiPrompt = useCallback(() => {
    const allNotes = Object.values(notesRef.current);
    const toDelete = allNotes.filter((n) => n.verdict === 'approved');
    const toKeep = allNotes.filter((n) => n.verdict === 'rejected');
    const commented = allNotes.filter((n) => Boolean(n.comment));
    const parts: string[] = ['# Review Feedback & Action Items', ''];
    if (toDelete.length) {
      parts.push('## Approved Deletions (Remove from code):');
      for (const n of toDelete) parts.push(`- **${n.label}** (${n.anchor.layout}): ${n.reason ?? "Remove"}`);
      parts.push('');
    }
    if (commented.length) {
      parts.push('## Requested Changes & Feedback:');
      for (const n of commented) parts.push(`- **${n.label}** (${n.anchor.layout}): "${n.comment}"`);
      parts.push('');
    }
    if (toKeep.length) {
      parts.push('## Kept As-Is (Rejected Cuts):');
      for (const n of toKeep) parts.push(`- **${n.label}** (${n.anchor.layout})`);
      parts.push('');
    }
    parts.push('Please implement these changes across the codebase.');
    navigator.clipboard.writeText(parts.join("\n"));
    say('Copied review prompt to clipboard!', 'good');
  }, [say]);

/** Everything switched off on this screen, newest first. */
  /** All user comments on this screen / everywhere */

  const journalBody = (
    <>
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
                        {/* The same chip the board's Do column wears, in the
                            same colour, so the card you are answering says
                            what it is asking for in the words and the colour
                            you have been reading it in all along. */}
                        {/* Nothing is being asked of a trial, so no chip is
                            drawn. Rendering it regardless left an empty
                            outlined capsule sitting beside the layout name —
                            a control-shaped object with no content and no
                            behaviour. In the list the cell is kept (blank) to
                            hold the column; here there is no column to hold. */}
                        {actOf(triageNote) ? (
                          <span className="review-cell-what" data-act={actOf(triageNote)}>
                            {actOf(triageNote)}
                          </span>
                        ) : null}
                        <span className="review-note-where">{triageNote.anchor.layout}</span>
                      </span>
                      <strong className="review-queue-label">{triageNote.label}</strong>
                      {triageNote.comment
                        ? <span className="review-note-text">“{triageNote.comment}”</span>
                        : null}
                      {triageNote.reason
                        ? (
                          <span className="review-queue-reason">
                            {/* How sure I was, said out loud. Every proposal
                                used to arrive at the same volume, so the
                                reviewer had to work out how much to trust
                                each one — the work the proposal was meant to
                                save. */}
                            <b>I propose cutting it</b>
                            {certaintyOf(triageNote) ? (
                              <i
                                className="review-certainty"
                                data-level={certaintyOf(triageNote)}
                                title={CERTAINTY_BLURB[certaintyOf(triageNote)!]}
                              >
                                {CERTAINTY_NAME[certaintyOf(triageNote)!]}
                              </i>
                            ) : null}
                            <span>{triageNote.reason}</span>
                          </span>
                        )
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
                        {/* "Find it" and the journal's Locate are one act
                            under two names, which is the collision the
                            vocabulary file exists to catch. */}
                        <button type="button" onClick={() => pointAtNote(triageNote)}>
                          <Crosshair className="size-4" /> Locate
                        </button>
                        {/* A switch, so it reads as the state it is in rather
                            than as an instruction about what pressing it does.
                            You can see what happens by pressing it. */}
                        <button
                          type="button"
                          role="switch"
                          aria-checked={offPage(triageNote)}
                          data-on={offPage(triageNote) || undefined}
                          onClick={() => toggleHidden(triageNote)}
                        >
                          {offPage(triageNote) ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                          {offPage(triageNote) ? 'Hidden' : 'Visible'}
                        </button>
                        <button
                          type="button"
                          onClick={() => { markRead(triageNote.id); setTriage(null); setOpenRow(triageNote.id); }}
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
                      {/* The same six answers as everywhere else, in the
                          same order and the same words. This card used to
                          offer Keep As-Is / Remove / Change / Later while the
                          element badge offered Remove / Kept / Note / Unsure
                          and the list offered five lanes — three vocabularies
                          for one question. There is now one list, and it
                          lives in state.ts. */}
                      <div className="review-queue-acts">
                        {decisionsFor(triageNote).map((decision) => (
                          <button
                            key={decision.id}
                            type="button"
                            className="review-queue-act"
                            data-act={decision.id}
                            title={decision.hint}
                            onClick={() => {
                              // A decision that needs prose opens the composer
                              // instead of filing something empty. The queue
                              // is left, not advanced: you come back to it
                              // having actually said the thing.
                              if (decision.needsWords) {
                                setTriage(null);
                                commentOnNote(triageNote.id);
                                return;
                              }
                              answer(triageNote, decision);
                              triageStep(1);
                            }}
                          >
                            {decision.id === 'cut' ? <Trash2 className="size-4" />
                              : decision.id === 'rework' ? <MessageSquarePlus className="size-4" />
                                : decision.id === 'trial' ? <EyeOff className="size-4" />
                                  : decision.id === 'note' ? <MessageSquarePlus className="size-4" />
                                    : decision.id === 'keep' ? <Check className="size-4" />
                                      : <Minus className="size-4" />}
                            {decision.verb}
                          </button>
                        ))}
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

                  {/* Close everything that is genuinely finished.
                      It runs each note through the same check a single row
                      does, so it closes the answered ones and the decisions
                      that owe nothing, and leaves anything still waiting on a
                      code pass exactly where it is. A "close all" that could
                      clear the board regardless is precisely how forty-nine
                      notes came to claim work that never happened. */}
                  {closeable.length ? (
                    <button
                      type="button"
                      className="review-closeall"
                      title="Close every item that is answered or owes nothing"
                      onClick={() => {
                        for (const note of closeable) moveTo(note, 'done');
                        say(`Closed ${closeable.length}`, 'good');
                      }}
                    >
                      <Check className="size-3.5" /> Close {closeable.length}
                    </button>
                  ) : null}
                  {unread.length ? (
                    <button type="button" className="review-panel-readall" onClick={markAllRead}>
                      Mark {unread.length} read
                    </button>
                  ) : null}
                  {/* Picking rows lives here now. It used to be reachable
                      only from a 15px tick in the table head — which is not
                      drawn at all below 30rem, so on a narrow rail there was
                      no way into multi-select whatsoever. */}
                  <button
                    type="button"
                    className="review-panel-pick"
                    aria-pressed={selecting}
                    data-on={selecting || undefined}
                    title={selecting ? 'Stop selecting' : 'Select rows for a bulk action'}
                    aria-label={selecting ? 'Stop selecting' : 'Select rows'}
                    onClick={() => {
                      if (selecting) { setChosen(new Set()); setSelecting(false); return; }
                      setSelecting(true);
                    }}
                  >
                    <SquareCheck className="size-3.5" />
                    <span>Select</span>
                  </button>

                  {/* One button, not two: "collapse all" and "expand all" are
                      the same control in its two states, and a board with
                      every group already shut has nothing to collapse. */}
                  {inboxGroups.filter((g) => g.notes.length).length > 1 ? (() => {
                    const allShut = inboxGroups.every(({ key }) => laneShut.has(key));
                    return (
                      <button
                        type="button"
                        className="review-panel-foldall"
                        aria-expanded={!allShut}
                        title={allShut ? 'Open every group' : 'Shut every group'}
                        onClick={() => setLaneShut(allShut
                          ? new Set()
                          : new Set(inboxGroups.map(({ key }) => key)))}
                      >
                        {allShut ? <ChevronsUpDown className="size-3.5" /> : <ChevronsDownUp className="size-3.5" />}
                        <span>{allShut ? 'Expand all' : 'Collapse all'}</span>
                      </button>
                    );
                  })() : null}
                </div>

                {compact ? null : (
                  <p className="review-panel-keys">
                    <kbd>↑</kbd><kbd>↓</kbd> walk · <kbd>↵</kbd> show it ·
                    {' '}<kbd>d</kbd> did it · <kbd>s</kbd> second look ·
                    {' '}<kbd>l</kbd> not now · <kbd>h</kbd> hide · <kbd>r</kbd> reply
                  </p>
                )}

                {acts.length > 1 || lenses.length ? (
                  <div className="review-filter" role="group" aria-label="Show only">
                    <button
                      type="button"
                      data-on={!only.size || undefined}
                      onClick={() => setOnly(new Set())}
                    >
                      {DO.all} {journalNotes.length}
                    </button>
                    {/* Comments and Hidden used to be sections in the rail.
                        They are the same rows the list already holds, so they
                        are chips in the same strip as everything else — and
                        they lead, because "show me what I wrote" and "show me
                        what is off the page" are the two you reach for. */}
                    {lenses.map((lens) => (
                      <button
                        key={lens.id}
                        type="button"
                        data-lens={lens.id.slice(5)}
                        data-on={only.has(lens.id) || undefined}
                        aria-pressed={only.has(lens.id)}
                        onClick={() => setOnly((current) => {
                          const next = new Set(current);
                          if (next.has(lens.id)) next.delete(lens.id); else next.add(lens.id);
                          return next;
                        })}
                      >
                        {lens.name}
                        <span>{lens.count}</span>
                      </button>
                    ))}
                    {acts.map((act) => (
                      <button
                        key={act}
                        type="button"
                        data-act={act}
                        data-on={only.has(act) || undefined}
                        aria-pressed={only.has(act)}
                        onClick={() => setOnly((current) => {
                          const next = new Set(current);
                          if (next.has(act)) next.delete(act); else next.add(act);
                          return next;
                        })}
                      >
                        {act}
                        <span>{journalNotes.filter((note) => actOf(note) === act).length}</span>
                      </button>
                    ))}
                  </div>
                ) : null}

                {chosen.size ? (
                  /* A band of its own, directly above the groups whose ticks
                     filled it — it used to replace the filter strip, which
                     put what to do with a selection at the far end of the
                     panel from the selection itself, and took the filters
                     away for as long as you were choosing. */
                  <div className="review-bulk">
                    <span className="review-bulk-count">{chosen.size} selected</span>
                    <span className="review-bulk-move">Mark all as</span>
                    {/* The bulk bar still offered the five old lanes, which no
                        longer exist. It offers the states now — and it goes
                        through the same check a single row does, so a bulk
                        action cannot do what one row is forbidden to do.
                        Anything refused is counted and named rather than
                        silently skipped: "closed 6" with four quietly left
                        behind is how you stop trusting a button. */}
                    {(['done', 'later', 'wontDo', 'needsYou'] as NoteState[]).map((next) => (
                      <button
                        key={next}
                        type="button"
                        title={STATE_BLURB[next]}
                        onClick={() => {
                          let moved = 0;
                          let refused = 0;
                          for (const id of chosen) {
                            const note = notesRef.current[id];
                            if (!note) continue;
                            if (canMove(note, next).ok) { moveTo(note, next); moved += 1; }
                            else refused += 1;
                          }
                          setChosen(new Set());
                          say(
                            refused
                              ? `${moved} → ${STATE_NAME[next]} · ${refused} still owed a change`
                              : `${moved} → ${STATE_NAME[next]}`,
                            refused ? 'warn' : 'good'
                          );
                        }}
                      >
                        {STATE_NAME[next]}
                      </button>
                    ))}
                    <button
                      type="button"
                      onClick={() => {
                        for (const id of chosen) {
                          const note = notesRef.current[id];
                          if (note && !offPage(note)) upsert({ id, hidden: true });
                        }
                        setChosen(new Set());
                      }}
                    >
                      <EyeOff className="size-3.5" /> Hide
                    </button>
                    <button
                      type="button"
                      className="review-bulk-kill"
                      onClick={() => {
                        if (!confirm(`Delete ${chosen.size} note(s) and their threads?`)) return;
                        for (const id of chosen) remove(id);
                        setChosen(new Set());
                      }}
                    >
                      <Trash2 className="size-3.5" />
                    </button>
                    <button
                      type="button"
                      className="review-bulk-clear"
                      onClick={() => { setChosen(new Set()); setSelecting(false); }}
                    >
                      Clear
                    </button>
                  </div>
                ) : null}

                {/* Just the column names. The tick that used to live here was a
                    15px control in a 20px cell that nobody could find, and it
                    is not where the thing it selects is: each group's tick
                    sits in that group's band, beside its dot, where "all of
                    these" is a sentence about something you can see. */}
                {/* How much is left, as one bar and one sentence. The old
                    console showed five lane counts, which is five numbers to
                    add up before you know whether you are nearly finished. */}
                <div className="review-progress" role="group" aria-label="Review progress">
                  <span className="review-progress-text">
                    <b>{progress.needsYou}</b> yours
                    {progress.withClaude ? <> · {progress.withClaude} sent</> : null}
                    {' '}· {progress.closed}/{progress.total} settled
                  </span>
                  <span className="review-progress-bar" aria-hidden="true">
                    <i style={{ width: `${Math.round(progress.ratio * 100)}%` }} />
                  </span>
                </div>

                <div className="review-table-head" data-selecting={selecting || undefined}>
                  <span />
                  <span>Do</span>
                  <span>Item</span>
                  <span>Where</span>
                  <span>State</span>
                  <span />
                </div>

                <ul className="review-panel-list" data-selecting={selecting || undefined}>
                  {journalNotes.length === 0 ? (
                    <li className="review-panel-empty">
                      {journalScope === 'screen' && findings.length
                        ? 'Nothing marked on this screen yet — the other screens are under Everywhere.'
                        : 'Nothing marked yet. Select something on the page to start.'}
                    </li>
                  ) : progress.needsYou === 0 ? (
                    /* The whole point of the redesign, and it has to be said
                       out loud: nothing here is waiting on you. Anything
                       still moving is named, so an empty list never reads as
                       a list that lost something. */
                    <li className="review-panel-empty" data-clear="true">
                      <strong>You are clear.</strong>
                      {progress.withClaude
                        ? ` ${progress.withClaude} sent. `
                        : ' '}
                      {progress.closed} settled.
                    </li>
                  ) : null}

                  {/* A board, not an inbox. The lanes are the sections and a
                      note is moved between them by either side — the point is
                      where a thing has got to, not whether it has been read. */}
                  {inboxGroups.map(({ key, name, hint, notes: inLane }) => {
                    /* Closed folds itself away. It is the drawer that makes
                       clearing the list safe — nothing is destroyed, it is
                       just not in the way — so it opens on request and never
                       on arrival. An empty group renders nothing at all
                       rather than an empty heading. */
                    if (!inLane.length) return null;
                    const shut = key === 'closed' ? !laneShut.has(key) : laneShut.has(key);
                    return (
                      <li key={key} className="review-panel-lane" data-lane={key} data-shut={shut || undefined}>
                        {/* A band, not one button: taking a whole lane in one
                            go is a thing you want per lane, not only for the
                            board — "everything in To do" is the selection you
                            actually make. */}
                        <div className="review-panel-lane-head">
                          {(() => {
                            const ids = inLane.map((note) => note.id);
                            const all = ids.every((id) => chosen.has(id));
                            const some = ids.some((id) => chosen.has(id));
                            return (
                              <button
                                type="button"
                                role="checkbox"
                                aria-checked={all ? true : some ? 'mixed' : false}
                                className="review-tick"
                                data-some={(!all && some) || undefined}
                                title={all ? `Select none in ${name}` : `Select all ${ids.length} in ${name}`}
                                aria-label={all ? `Select none in ${name}` : `Select all in ${name}`}
                                onClick={() => {
                                  setSelecting(true);
                                  setChosen((current) => {
                                    const next = new Set(current);
                                    if (all) ids.forEach((id) => next.delete(id));
                                    else ids.forEach((id) => next.add(id));
                                    return next;
                                  });
                                }}
                              >
                                {all ? <Check className="size-3" strokeWidth={3.5} /> : null}
                              </button>
                            );
                          })()}
                          <button
                            type="button"
                            className="review-lane-face"
                            aria-expanded={!shut}
                            title={hint}
                            onClick={() => setLaneShut((current) => {
                              const next = new Set(current);
                              if (next.has(key)) next.delete(key); else next.add(key);
                              return next;
                            })}
                          >
                            <ChevronDown className="size-3 review-lane-caret" />
                            {name}
                            <span>{inLane.length}</span>
                          </button>

                        </div>
                        {shut ? null : <ul>{inLane.map(noteRow)}</ul>}
                      </li>
                    );
                  })}
                </ul>
              </>
            )}

            {/* Not while going through them: mid-pass the only things worth
                pressing are the three answers, and this was competing with
                them for the bottom of the sheet. */}
            {triage ? null : (
              <div className="review-panel-foot">
                <span className="review-panel-sync" data-state={synced}>
                  {synced === 'file'
                    ? 'review/REVIEW-NOTES.md'
                    : synced === 'local'
                      ? 'This device only'
                      : 'Saved on this device'}
                </span>
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
    if (event.key === 'h' && !pickedRef.current) {
      event.preventDefault();
      toggleHidden(note);
      return true;
    }
    if (event.key === 'r') { event.preventDefault(); markRead(note.id); setOpenRow(note.id); return true; }
    if (event.key === 'Enter') { event.preventDefault(); pointAtNote(note); return true; }
    return false;
  }

  /** Move a note to the next lane, wrapping round. The board is shared —
   *  a code pass moves the same field in review-notes.json — so this is a
   *  message as much as a state change. */
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

  /**
   * Move a note to a state, or refuse and say why.
   *
   * This is the only way a state changes, and the refusal is the feature: the
   * console will not let the reviewer file something as Done while the change
   * behind it is still owed. That single check is what the old board was
   * missing — forty-nine notes claimed to be finished and a third of them had
   * never been touched, because Done was a lane you could drag anything into.
   */
  function moveTo(note: ReviewNote, next: NoteState) {
    const allowed = canMove(note, next);
    if (!allowed.ok) {
      say(allowed.why, 'warn');
      return false;
    }
    upsert({ id: note.id, status: next as unknown as ReviewLane });
    say(`${note.label} → ${STATE_NAME[next]}`, next === 'done' ? 'good' : 'info');
    setMoved(note.id);
    return true;
  }

  /**
   * Answer a note with one of the six decisions — the same six wherever you
   * are. Recording the verdict, switching the element off, and moving the
   * state are one act here, so no surface can do two of the three and leave
   * a note half-answered.
   */
  function answer(note: ReviewNote, decision: Decision) {
    const patch: Partial<ReviewNote> & { id: string } = { id: note.id };
    if (decision.verdict) patch.verdict = decision.verdict;
    if (decision.hides) patch.hidden = true;
    // Coming out of a trial, the element goes back on the page unless the
    // answer was to cut it — leaving it invisible after "Keep it" is how you
    // end up with a page missing something you decided to keep.
    if (!decision.hides && decision.id !== 'cut' && note.hidden) patch.hidden = undefined;

    const allowed = canMove(note, decision.to);
    if (!allowed.ok) { say(allowed.why, 'warn'); return; }
    upsert({ ...patch, status: decision.to as unknown as ReviewLane });
    say(`${note.label} → ${STATE_NAME[decision.to]}`, decision.to === 'sent' ? 'good' : 'info');
    setMoved(note.id);
  }

  /** Switch the element this note is about off, or back on. A layer eye:
   *  not the archive, which is where things carried off the page are kept,
   *  and not a verdict — the code is untouched either way. It sticks to the
   *  layout it was hidden in and travels in the file like everything else,
   *  so the page can be judged without something and then put back. */
  function toggleHidden(note: ReviewNote) {
    // One switch, two ways of being off. Whether a thing was carried onto a
    // shelf or just switched off where it stood, what the reviewer wants
    // from a journal row is the same: put it back, or take it away.
    if (offPage(note)) {
      // A note that only ever recorded "this is off the page" has nothing
      // left to say once it is back.
      if (note.kind === 'stow' && !note.verdict && !note.comment && !note.thread?.length) {
        remove(note.id);
      } else {
        upsert({ id: note.id, stow: undefined, hidden: undefined });
      }
      say(`${note.label} back on the page`, 'good');
      return;
    }
    upsert({ id: note.id, hidden: true });
    say(`${note.label} hidden`, 'info');
  }


  /** One note in the journal — a table row, and the columns are the
   *  questions in the order they get asked: what has to happen, to what,
   *  where in the code, and where it has got to.
   *
   *  A row opens. What was said about a thing is the whole reason the note
   *  exists, and it does not fit on one line — so the line is a summary and
   *  the row itself is where you read it, answer it, and see what came back. */
  function noteRow(note: ReviewNote) {
    const fresh = isUnread(note, read);
    const answered = isReply(note, read);
    const said = note.comment ?? note.reason;
    const shown = openRow === note.id;
    const ticked = chosen.has(note.id);

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
        data-open={shown || undefined}
        data-ticked={ticked || undefined}
        onMouseEnter={compact ? undefined : () => setPeek(note.id)}
        onMouseLeave={compact ? undefined : () => setPeek(null)}
        /* The whole row opens it. A "Read it all" link in the corner of the
           cell was a control for something the row was already offering —
           and on a phone, where nothing hovers, it was the only way in and
           it was the loudest thing in the list. The row is the hit area, and
           opening it reveals its controls too, which is the finger's version
           of hovering it. */
        onClick={(event) => {
          if ((event.target as HTMLElement).closest('button, a, textarea, input, label')) return;
          // While the board is picking rows, the row is a checkbox. Opening a
          // thread on the way to selecting eight things is the opposite of
          // what the mode is for — and having to hit a 14px tick when the
          // whole row is sitting there is the reason nobody uses it.
          if (selecting) {
            setChosen((current) => {
              const next = new Set(current);
              if (next.has(note.id)) next.delete(note.id); else next.add(note.id);
              return next;
            });
            return;
          }
          setCursor(note.id);
          markRead(note.id);
          setOpenRow(shown ? null : note.id);
        }}
      >
        <span className="review-cell-mark">
          <button
            type="button"
            role="checkbox"
            aria-checked={ticked}
            className="review-tick"
            aria-label={`Select ${note.label}`}
            onClick={() => setChosen((current) => {
              const next = new Set(current);
              if (next.has(note.id)) next.delete(note.id); else next.add(note.id);
              return next;
            })}
          >
            {ticked ? <Check className="size-3" strokeWidth={3.5} /> : null}
          </button>
          {fresh ? <i className="review-note-dot" data-reply={answered || undefined} /> : null}
        </span>

        {/* What has to happen, in one word, in its own column so a screenful
            of notes can be read down rather than across. */}
        {actOf(note)
          ? <span className="review-cell-what" data-act={actOf(note)}>{actOf(note)}</span>
          : <span className="review-cell-what" data-act="none" aria-hidden="true" />}

        <span className="review-cell-item">
          <button
            type="button"
            className="review-note-label"
            aria-expanded={shown}
            title="Read it, and answer it"
            onClick={() => {
              setCursor(note.id);
              markRead(note.id);
              setOpenRow(shown ? null : note.id);
            }}
          >
            {note.label}
          </button>
          {/* The first tag is what the Do column is showing — `actOf` reads
              it when there is no verdict — so repeating it under the name is
              the same word twice on one row. Any tags after it are new
              information and stay. */}
          {note.tags && note.tags.length > 1 ? (
            <span className="review-note-tags">
              {note.tags.slice(1).map((tag) => <span key={tag}>{tag}</span>)}
            </span>
          ) : null}
          {said && !shown ? <span className="review-note-text">{said}</span> : null}
          {/* How much conversation is under the row, said as a fact rather
              than as a link — the row itself is the way in. */}
          {!shown && note.thread?.length ? (
            <span className="review-note-replies">
              {note.thread.length} {note.thread.length === 1 ? 'reply' : 'replies'}
            </span>
          ) : null}
        </span>

        <span className="review-cell-where" title={note.anchor.source ?? note.anchor.layout}>
          {journalScope === 'all' ? <b>{note.anchor.layout}</b> : null}
          {/* The component, not the file: every one of these ends in the
              same four characters, and the column is 5rem wide. */}
          {fileOf(note.anchor.source)?.split('/').pop()?.replace(/\.[jt]sx?$/, '') ?? '—'}
        </span>

        {/* A menu, not a cycle. Cycling meant you could not tell what the
            next press would give you, and getting from To do to Not now was
            three presses through states you did not want it in. */}
        <span className="review-lane-pick review-cell-lane">
          {/* The state, and the one move that follows from it.
              The menu used to list five lanes and let you drag a note into
              any of them — which is how Done came to mean nothing. Now the
              row states where it is, and offers the step that is actually
              next; anything else is a decision, and decisions live in the
              same six-button set as every other surface. */}
          <button
            type="button"
            className="review-note-lane"
            data-lane={stateOf(note)}
            aria-haspopup="menu"
            aria-expanded={laneMenu === note.id}
            aria-label={`${note.label} is ${STATE_NAME[stateOf(note)]} — change`}
            title={STATE_BLURB[stateOf(note)]}
            onClick={() => setLaneMenu(laneMenu === note.id ? null : note.id)}
          >
            {STATE_NAME[stateOf(note)]}
            {note.verdict && VERDICT_NAME[note.verdict]
              ? <i className="review-note-verdict">{VERDICT_NAME[note.verdict]}</i>
              : null}
          </button>
          {(() => {
            const step = nextStep(note);
            const alt = altStep(note);
            if (!step) return null;
            return (
              <span className="review-note-step">
                <button
                  type="button"
                  className="review-note-go"
                  title={step.hint}
                  onClick={() => moveTo(note, step.to)}
                >
                  {step.verb}
                </button>
                {alt ? (
                  <button
                    type="button"
                    className="review-note-go review-note-go-alt"
                    title={alt.hint}
                    onClick={() => moveTo(note, alt.to)}
                  >
                    {alt.verb}
                  </button>
                ) : null}
              </span>
            );
          })()}
          {laneMenu === note.id ? (
            <span className="review-lane-menu" role="menu">
              {decisionsFor(note).map((decision) => (
                <button
                  key={decision.id}
                  type="button"
                  role="menuitem"
                  data-act={decision.id}
                  title={decision.hint}
                  onClick={() => {
                    setLaneMenu(null);
                    if (decision.needsWords) { commentOnNote(note.id); return; }
                    answer(note, decision);
                  }}
                >
                  {decision.verb}
                </button>
              ))}
            </span>
          ) : null}
        </span>

        <span className="review-cell-acts">
          {/* Where the thing itself is. It switches layout and opens the page
              if that is what it takes, scrolls it into view, and flashes it —
              the whole of "show me" in one control, so the name beside it is
              free to be the way into what was said about it. */}
          <button
            type="button"
            className="review-note-locate"
            onClick={() => { setCursor(note.id); markRead(note.id); pointAtNote(note); }}
            aria-label={`Locate ${note.label} on the page`}
            title="Locate it — scroll to it and flash it"
          >
            <Crosshair className="size-4" />
          </button>
          <button
            type="button"
            className="review-note-eye"
            data-hidden={offPage(note) || undefined}
            onClick={() => toggleHidden(note)}
            role="switch"
            aria-checked={offPage(note)}
            aria-label={`${note.label} — ${note.stow ? 'archived' : note.hidden ? 'hidden' : 'visible'}`}
            title={note.stow
              ? `Archived on the ${note.stow.edge} shelf`
              : note.hidden ? 'Hidden' : 'Visible'}
          >
            {offPage(note) ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
          </button>
          {/* No control for opening the thread: the name is the control.
              An icon that did the same thing as the words beside it was one
              more button in a row that already had too many.

              And no delete. A bin on every row of a list you are reading
              says the main thing you might do here is destroy something, and
              it needed a confirm dialog to be safe — which is two frictions
              paying for one act. Dismiss is the honest word: this comes off
              the board. A proposal I made is remembered as dismissed, so it
              is not proposed again; a note you wrote yourself has nothing to
              remember, so it goes. Undo covers both. */}
          <button
            type="button"
            className="review-note-remove review-note-dismiss"
            onClick={() => {
              if (note.origin === 'suggested') {
                upsert({ id: note.id, verdict: 'rejected' });
              } else {
                remove(note.id);
              }
              say(`Dismissed · ${note.label}`, 'good');
            }}
            aria-label={`Dismiss ${note.label}`}
            title="Dismiss — take it off the board. Undo brings it back."
          >
            <X className="size-4" />
          </button>
        </span>

        {/* Open: the whole of what was said, what came back, and the box to
            answer in — under the row it belongs to, not at the foot of the
            panel where it could be about anything. */}
        {shown ? (
          <div className="review-row-open">
            {said ? <p className="review-row-said">{said}</p> : null}
            {note.thread?.length ? (
              <ul className="review-row-thread">
                {note.thread.map((reply, index) => (
                  <li key={index} data-from={reply.from}>
                    <b>{reply.from === 'claude' ? 'Claude' : 'You'}</b>
                    <span>{reply.text}</span>
                  </li>
                ))}
              </ul>
            ) : null}
            <form
              className="review-row-reply"
              onSubmit={(event) => {
                event.preventDefault();
                const text = (replyDrafts[note.id] ?? '').trim();
                if (!text) return;
                upsert({
                  id: note.id,
                  ...(laneOf(note) === 'open' ? { status: 'commented' as ReviewLane } : {}),
                  thread: [...(note.thread ?? []), { from: 'you', text, at: new Date().toISOString() }]
                });
                setReplyDrafts((current) => ({ ...current, [note.id]: '' }));
              }}
            >
              <textarea
                rows={2}
                value={replyDrafts[note.id] ?? ''}
                placeholder={`Reply about “${note.label}”…`}
                onChange={(event) => {
                  const value = event.currentTarget.value;
                  setReplyDrafts((current) => ({ ...current, [note.id]: value }));
                }}
                onKeyDown={(event) => {
                  if (event.key === 'Escape') setOpenRow(null);
                  if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) {
                    event.currentTarget.form?.requestSubmit();
                  }
                }}
              />
              <div className="review-row-reply-foot">
                <span>⌘↵ to send</span>
                <button type="button" className="review-ghost" onClick={() => setOpenRow(null)}>Close</button>
                <button type="submit" className="review-primary">Send</button>
              </div>
            </form>
          </div>
        ) : null}
      </li>
    );
  }

  /** On the screen, as the browser understands it. getClientRects() was the
   *  test, and it answers 0 for any element with `display: contents` — which
   *  every audited section the review layer wraps transparently has. So every
   *  one of those counted as "not on screen" whether it was there or not. */
  function onScreen(el: Element): boolean {
    return typeof el.checkVisibility === 'function'
      ? el.checkVisibility({ checkVisibilityCSS: true })
      : el.getClientRects().length > 0;
  }

  /** The note whose element is the reason this one is not showing: a section
   *  that was stashed or hidden with something else inside it. Restoring the
   *  thing you are looking at will not help; restoring what swallowed it
   *  will, and the console should say which that is. */
  function blockedBy(note: ReviewNote): ReviewNote | undefined {
    const el = (note.anchor.reviewId
      ? document.querySelector(`[data-review-id="${note.anchor.reviewId}"]`)
      : null) ?? safeQuery(note.anchor.domPath);
    const swallowed = el?.closest('[data-review-stowed]');
    if (!swallowed) return undefined;
    return Object.values(notesRef.current).find((other) => {
      if (other.id === note.id || !offPage(other) || other.anchor.layout !== layout) return false;
      const target = (other.anchor.reviewId
        ? document.querySelector(`[data-review-id="${other.anchor.reviewId}"]`)
        : null) ?? safeQuery(other.anchor.domPath);
      return target === swallowed;
    });
  }

  /** Text as the reader sees it: one line, no case, no runs of space. Both
   *  sides of every comparison go through this, so "AUGUST  COUNTABLE" and
   *  "August countable" are the same string. */
  function flatten(text: string): string {
    return text.replace(/\s+/g, ' ').trim().toLowerCase();
  }

  /**
   * Find the element a note points at, when the easy handles have failed.
   *
   * A recorded DOM path is exact and brittle: one wrapper div added anywhere
   * above the element and it resolves to nothing, which is most of what
   * "Locate does nothing" was. The text the reviewer actually saw survives
   * that, because restructuring the page rarely rewrites the words on it.
   *
   * So candidates are gathered from whatever handles exist and scored, rather
   * than tried in a fixed order and given up on. The smallest element that
   * contains the remembered text wins — a container that merely encloses it
   * is technically a match and useless to point at.
   */
  function searchForNote(note: ReviewNote): HTMLElement | null {
    const wanted = flatten(note.anchor.text ?? '');
    const hooks = (note.anchor.hooks ?? '').split(' ').filter(Boolean);
    if (wanted.length < 4 && !hooks.length) return null;

    let best: { el: HTMLElement; score: number } | null = null;

    // Class hooks narrow the field enormously when they exist; otherwise the
    // sweep is over elements that carry their own text rather than every node.
    const pool = hooks.length
      ? document.querySelectorAll<HTMLElement>(hooks.map((h) => `.${CSS.escape(h)}`).join(''))
      : document.querySelectorAll<HTMLElement>('[class]');

    for (const el of pool) {
      if (isReviewUi(el) || !onScreen(el)) continue;
      const text = flatten(el.textContent ?? '');
      if (!text) continue;

      let score = 0;
      if (wanted) {
        if (text === wanted) score += 1;
        else if (text.startsWith(wanted) || wanted.startsWith(text)) score += 0.8;
        else if (text.includes(wanted)) score += 0.55;
        else {
          // Nothing shared at the start; fall back to how much of the
          // remembered opening line this element still carries.
          const words = wanted.split(' ').slice(0, 6);
          const hit = words.filter((w) => w.length > 2 && text.includes(w)).length;
          if (!hit) continue;
          score += 0.3 * (hit / words.length);
        }
      }
      if (hooks.length) {
        score += 0.3 * (hooks.filter((h) => el.classList.contains(h)).length / hooks.length);
      }
      // Prefer the tightest wrapper: an element ten times longer than the text
      // it was remembered by is a section, not the thing.
      if (wanted && text.length > wanted.length) {
        score -= Math.min(0.35, (text.length / Math.max(wanted.length, 1) - 1) * 0.05);
      }
      if (score > (best?.score ?? 0.34)) best = { el, score };
    }

    return best?.el ?? null;
  }

  function elementForNote(note: ReviewNote): HTMLElement | null {
    const byId = note.anchor.reviewId
      ? document.querySelector(`[data-review-id="${note.anchor.reviewId}"]`)
      : document.querySelector(`[data-review-id="${note.id}"]`);
    // Exact handles first, then the search — which is what keeps Locate
    // working after the layout it was recorded against has been rebuilt.
    const found = byId ?? safeQuery(note.anchor.domPath) ?? searchForNote(note);
    if (!(found instanceof HTMLElement)) return null;
    const resolved = (found.getAttribute('data-review-transparent') && found.firstElementChild instanceof HTMLElement)
      ? found.firstElementChild
      : found;
    // In the tree but not on the screen — inside a shut accordion, on a tab
    // that is not showing — is the same as absent for the purpose of
    // pointing at it, and flashing it would flash nothing.
    return onScreen(resolved) ? found : null;
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
        if (onScreen(node) && !node.closest('[data-review-ui]')) return node;
        node = node.parentElement;
      }
    }
    // Not in the tree at all: shorten the recorded path a step at a time.
    const parts = (note.anchor.domPath ?? '').split(' > ');
    for (let take = parts.length - 1; take > 0; take -= 1) {
      const found = safeQuery(parts.slice(0, take).join(' > '));
      if (found && onScreen(found)) return found;
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
    // Three answers, and they are different: here it is; here is the section
    // holding the thing you switched off; here is roughly where it lived.
    if (el) el.setAttribute('data-review-peek', exact ? 'exact' : offPage(note) ? 'holds' : 'near');
  }

  /** Point at the section holding it, and say why the thing itself is not
   *  being pointed at. Off the page on purpose reads differently from not
   *  found, and the reviewer is owed the difference. */
  function flashNearest(note: ReviewNote): boolean {
    const near = nearestVisible(note);
    if (!near) return false;
    const off = offPage(note);
    flashElement(near, off ? 'holds' : 'near');
    say(off
      ? `${note.stow ? 'Archived' : 'Hidden'} — this is the section it sits in`
      : 'Not on screen — flashing what holds it', off ? 'info' : 'warn');
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
  function flashElement(target: HTMLElement, tone: 'exact' | 'near' | 'holds' = 'exact') {
    const mark = tone === 'exact' ? 'review-flash' : 'review-flash-near';
    const targetEl = (target.getAttribute('data-review-transparent') && target.firstElementChild instanceof HTMLElement)
      ? target.firstElementChild
      : target;
    targetEl.scrollIntoView({ block: 'center', behavior: 'smooth' });
    targetEl.classList.remove(mark);
    void targetEl.offsetWidth; // restart the animation on a repeat click
    targetEl.classList.add(mark);
    // The near miss holds longer: it is asking you to look for something
    // inside it, which takes longer than being shown the thing itself.
    window.setTimeout(() => targetEl.classList.remove(mark), tone === 'near' ? 2600 : 1600);
  }

  /** Clicking a note takes you to it — switching layout, palette and page if
   *  that is what it takes — then flashes the element itself. */
  function pointAtNote(note: ReviewNote) {
    // Off the page is still somewhere: it sits inside a section that is on
    // the screen, and that is the honest answer to "where is this?". Saying
    // "stashed in the left shelf" told you which drawer it was in, not which
    // part of the product it came out of.
    if (offPage(note)) {
      if (note.anchor.layout !== layout) {
        if (onNavigate) { onNavigate(note.anchor); setNest(note.id); return; }
        say(`Lives in the ${note.anchor.layout} layout`, 'info');
        return;
      }
      /* Show the thing, not the shelf it is on.
       *
       * Locate used to flash the nearest visible section instead, which on a
       * page where most notes are off-page looked exactly like a button that
       * does nothing — and it only appeared to start working once the audit
       * was open, because the audit is what reveals stowed markup. Peeking
       * the one element reveals it here and now, in any mode. */
      setPeek(note.id);
      const shown = elementForNote(note);
      if (shown) {
        flashElement(shown);
        window.history.replaceState(null, '', `#note=${note.id}`);
        say(`Showing ${note.label} — hidden, peeking`, 'info');
        return;
      }
      if (flashNearest(note)) { setNest(note.id); setNestFor(null); return; }
      say('Hidden — its section is not on this screen', 'warn');
      return;
    }

    // Not off the page itself, but sitting inside something that is. The
    // switch worth offering is the one on whatever swallowed it.
    const blocker = blockedBy(note);
    if (blocker) {
      flashNearest(blocker);
      setNest(blocker.id);
      setNestFor(note.id);
      say(`Inside “${blocker.label}”, which is hidden`, 'warn');
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

  const composerCanSave = Boolean(composer && (composer.draft.trim() || composer.tags.length));
  const composerExisting = Boolean(composer && (
    notes[composer.id]?.comment || notes[composer.id]?.tags?.length
  ));
  const composerCta = composer?.reason
    ? 'Request changes'
    : composerExisting ? 'Update comment' : 'Add comment';
  const composerAnchor = composerLayout?.anchor ?? composer?.at;
  const composerPosition = composerMoved ?? (composer?.at
    ? composerLayout ?? composerAt(composer.at)
    : undefined);

  /** Grab the head and move it. Clamped to the window on the way, so it can
   *  never be dragged somewhere it cannot be dragged back from. */
  function startComposerDrag(event: React.PointerEvent) {
    if ((event.target as HTMLElement).closest('button')) return;
    const box = composerRef.current?.getBoundingClientRect();
    if (!box) return;
    event.preventDefault();
    composerGrab.current = { x: event.clientX, y: event.clientY, top: box.top, left: box.left };
    const onMove = (move: PointerEvent) => {
      const held = composerGrab.current;
      if (!held) return;
      setComposerMoved({
        top: Math.max(4, Math.min(held.top + (move.clientY - held.y), window.innerHeight - 60)),
        left: Math.max(4, Math.min(held.left + (move.clientX - held.x), window.innerWidth - 120))
      });
    };
    const stop = () => {
      composerGrab.current = null;
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', stop);
      window.removeEventListener('pointercancel', stop);
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', stop);
    window.addEventListener('pointercancel', stop);
  }

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
              <span className="review-aim-label">Selected</span>
              <span className="review-aim-path">
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
              </span>
              <span className="review-aim-size">
                {Math.round(pickedRect.width)}×{Math.round(pickedRect.height)}
              </span>
              {/* A bare ✕ at the end of a row of verbs reads as a sixth verb,
                  and nobody could say which of the two things it did: shut
                  the panel, or undo the selection. It is one act — this stops
                  pointing at anything — and it sits where a close sits. */}
              <button
                type="button"
                className="review-aim-close"
                title="Nothing selected · Esc"
                aria-label="Clear the selection"
                onClick={() => setPicked(null)}
              >
                <X className="size-3.5" />
              </button>
            </div>

            <div className="review-actions-row">
              {/* The same three words the journal and the report use. This
                  said "Note" for a comment and "Flag" for a cut, which meant
                  the act had one name where it was done and another name
                  everywhere it was read. */}
              <button type="button" onClick={() => commentOn(labelFor(picked), picked)}>
                <MessageSquarePlus className="size-4" /> Comment <kbd>c</kbd>
              </button>
              <button type="button" className="review-actions-cut" onClick={markPicked}>
                <Trash2 className="size-4" /> Remove <kbd>x</kbd>
              </button>
              {/* Hiding is a first-class answer now, so it belongs where you
                  are actually looking at the thing. */}
              <button type="button" onClick={hidePicked}>
                <EyeOff className="size-4" /> Hide <kbd>h</kbd>
              </button>
              <span className="review-stow-group" title="Archive it on a shelf — pick a side. Shift+arrow does the same.">
                <Archive className="size-4" />
                <span className="review-stow-name">Archive</span>
                {([
                  ['left', ArrowLeft],
                  ['top', ArrowUp],
                  ['bottom', ArrowDown],
                  ['right', ArrowRight]
                ] as const).map(([edge, Icon]) => (
                  <button
                    key={edge}
                    type="button"
                    aria-label={`Archive on the ${edge} shelf`}
                    title={`Archive · ${edge} shelf`}
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
            </div>
          </div>
        </>
      ) : null}

      {composer ? (
        <div
          data-review-ui
          className="review-composer-scrim"
          data-anchored={composer.at ? true : undefined}
          onClick={() => dismissComposer()}
        >
          {/* The element keeps its own light: a comment is about something you
              are looking at, so nothing covers it while you write. */}
          {composerAnchor ? (
            <span
              className="review-composer-halo"
              style={{
                top: composerAnchor.top,
                left: composerAnchor.left,
                width: composerAnchor.width,
                height: composerAnchor.height
              }}
            />
          ) : null}
          <form
            ref={composerRef}
            className="review-composer review-compose"
            role="dialog"
            aria-modal="true"
            aria-labelledby="review-compose-title"
            aria-describedby="review-compose-help"
            data-moved={composerMoved ? true : undefined}
            style={composerPosition
              ? { top: composerPosition.top, left: composerPosition.left }
              : undefined}
            onClick={(event) => event.stopPropagation()}
            onSubmit={(event) => { event.preventDefault(); saveComment(); }}
            onKeyDown={(event) => {
              event.stopPropagation();
              if (event.key === 'Escape') {
                event.preventDefault();
                dismissComposer();
                return;
              }
              if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) {
                event.preventDefault();
                if (composerCanSave) saveComment();
                return;
              }
              if (event.key !== 'Tab') return;
              const focusable = Array.from(event.currentTarget.querySelectorAll<HTMLElement>(
                'button:not(:disabled), textarea, summary, [href], [tabindex]:not([tabindex="-1"])'
              )).filter((item) => item.getClientRects().length > 0);
              const first = focusable[0];
              const last = focusable[focusable.length - 1];
              if (!first || !last) return;
              if (event.shiftKey && document.activeElement === first) {
                event.preventDefault();
                last.focus();
              } else if (!event.shiftKey && document.activeElement === last) {
                event.preventDefault();
                first.focus();
              }
            }}
          >
            <header
              className="review-compose-head"
              onPointerDown={startComposerDrag}
              title="Drag to move — a comment should never cover the thing it is about"
            >
              <span className="review-compose-mark" aria-hidden="true">
                <MessageSquarePlus className="size-[18px]" />
              </span>
              <span className="review-compose-heading">
                <span className="review-compose-kicker">
                  {composer.reason ? 'Feedback on a suggested cut'
                    : composerExisting ? 'Edit anchored comment' : 'New anchored comment'}
                </span>
                <h2 id="review-compose-title">{composer.label}</h2>
              </span>
              <button
                type="button"
                className="review-compose-close"
                aria-label="Close comment editor"
                onClick={() => dismissComposer()}
              >
                <X className="size-4" />
              </button>
            </header>

            <div className="review-compose-scroll">
              <div className="review-compose-context">
                <span className="review-compose-layout">{composer.anchor.layout}</span>
                <details className="review-compose-details">
                  <summary><FileCode2 className="size-3.5" /> Technical details</summary>
                  <code>
                    {composer.members
                      ? `${composer.members.length} item(s) parked here`
                      : fileOf(composer.anchor.source) ?? composer.anchor.domPath ?? 'Source unavailable'}
                  </code>
                </details>
              </div>

              {composer.reason ? (
                <div className="review-compose-reason">
                  <strong>Suggested change</strong>
                  <span>{composer.reason}</span>
                </div>
              ) : null}
              {composer.members?.length ? (
                <div className="review-compose-members">
                  <strong>Covers this stash</strong>
                  <span>{composer.members.join(' · ')}</span>
                </div>
              ) : null}
              {composer.thread?.length ? (
                <section className="review-compose-thread" aria-label="Earlier conversation">
                  <h3>Conversation</h3>
                  {composer.thread.map((reply, index) => (
                    <p key={index} data-from={reply.from}>
                      <b>{reply.from === 'claude' ? 'Claude' : 'You'}</b>
                      <span>{reply.text}</span>
                    </p>
                  ))}
                </section>
              ) : null}

              <label className="review-compose-label" htmlFor="review-compose-text">
                Your comment
                <span>Describe the friction, the outcome you want, or both.</span>
              </label>
              {/* Paste or drop a picture straight into the box you are
                  already typing in. No button, no file dialog: a screenshot
                  is on the clipboard the instant you take one, and the whole
                  reason for attaching it is that describing the thing in
                  words is the part that was not working. */}
              <textarea
                id="review-compose-text"
                autoFocus
                rows={4}
                value={composer.draft}
                placeholder={composer.members
                  ? 'What should happen to this group?'
                  : 'What feels off, and what would make it better? Paste a screenshot too.'}
                onChange={(event) => {
                  setConfirmDiscard(false);
                  setComposer({ ...composer, draft: event.currentTarget.value });
                }}
                onPaste={(event) => {
                  const images = [...event.clipboardData.files].filter((f) => f.type.startsWith('image/'));
                  if (images.length) { event.preventDefault(); void attachShots(images); }
                }}
                onDragOver={(event) => { if (event.dataTransfer.types.includes('Files')) event.preventDefault(); }}
                onDrop={(event) => {
                  const images = [...event.dataTransfer.files].filter((f) => f.type.startsWith('image/'));
                  if (images.length) { event.preventDefault(); void attachShots(images); }
                }}
              />
              <div className="review-compose-tools">
                <p id="review-compose-help" className="review-compose-help">
                  Text or a change type is enough to save a useful note.
                </p>
                {/* Paste and drop both work, and neither announces itself.
                    One visible control so the ability is discoverable — the
                    menu holds the two ways in that actually exist, and will
                    not grow a third for the sake of looking like a menu. */}
                <span className="review-attach">
                  <button
                    type="button"
                    className="review-attach-btn"
                    aria-haspopup="menu"
                    aria-expanded={attachOpen}
                    title="Attach a screenshot"
                    onClick={() => setAttachOpen((current) => !current)}
                  >
                    <Plus className="size-3.5" /> Attach
                  </button>
                  {attachOpen ? (
                    <span className="review-attach-menu" role="menu">
                      <button
                        type="button"
                        role="menuitem"
                        onClick={() => { setAttachOpen(false); shotInput.current?.click(); }}
                      >
                        Screenshot…
                      </button>
                      <button
                        type="button"
                        role="menuitem"
                        onClick={async () => {
                          setAttachOpen(false);
                          // Reading the clipboard needs permission the paste
                          // event never does, so this is the fallback rather
                          // than the main road — and it says so when refused.
                          try {
                            const items = await navigator.clipboard.read();
                            const files: File[] = [];
                            for (const item of items) {
                              const type = item.types.find((t) => t.startsWith('image/'));
                              if (!type) continue;
                              const blob = await item.getType(type);
                              files.push(new File([blob], 'pasted', { type }));
                            }
                            if (files.length) await attachShots(files);
                            else say('No image on the clipboard', 'info');
                          } catch {
                            say('Clipboard blocked — press ⌘V in the box instead', 'warn');
                          }
                        }}
                      >
                        Paste from clipboard
                      </button>
                    </span>
                  ) : null}
                  <input
                    ref={shotInput}
                    type="file"
                    accept="image/*"
                    multiple
                    hidden
                    onChange={(event) => {
                      const files = [...(event.currentTarget.files ?? [])];
                      event.currentTarget.value = '';
                      if (files.length) void attachShots(files);
                    }}
                  />
                </span>
              </div>

              {composer.shots?.length ? (
                <ul className="review-compose-shots" aria-label="Screenshots on this note">
                  {composer.shots.map((path) => (
                    <li key={path}>
                      <img src={`/${path}`} alt="" />
                      <button
                        type="button"
                        aria-label={`Remove ${path.split('/').pop()}`}
                        title="Remove"
                        onClick={() => setComposer((current) => (current
                          ? { ...current, shots: current.shots?.filter((p) => p !== path) }
                          : current))}
                      >
                        <X className="size-3" />
                      </button>
                    </li>
                  ))}
                </ul>
              ) : null}

              {/* Faster than typing it, and it sorts the notes file by intent. */}
              <section className="review-compose-types" aria-labelledby="review-compose-types-title">
                <h3 id="review-compose-types-title"><Tag className="size-3.5" /> Change type <span>optional</span></h3>
                <div className="review-tag-groups">
                  {TAG_GROUPS.map((group) => (
                    <div key={group.label} className="review-tag-group">
                      <span>{group.label}</span>
                      <div className="review-tag-row">
                        {group.tags.map((tag) => (
                          <button
                            key={tag}
                            type="button"
                            aria-pressed={composer.tags.includes(tag)}
                            data-on={composer.tags.includes(tag) || undefined}
                            onClick={() => {
                              setConfirmDiscard(false);
                              setComposer({
                                ...composer,
                                tags: composer.tags.includes(tag)
                                  ? composer.tags.filter((item) => item !== tag)
                                  : [...composer.tags, tag]
                              });
                            }}
                          >
                            {tag}
                          </button>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            </div>

            {confirmDiscard ? (
              <div className="review-compose-discard" role="alert">
                <span><strong>Discard this draft?</strong><small>Your changes have not been saved.</small></span>
                <button type="button" autoFocus onClick={() => setConfirmDiscard(false)}>Keep writing</button>
                <button type="button" data-danger onClick={() => dismissComposer(true)}>Discard</button>
              </div>
            ) : (
              <footer className="review-compose-foot">
                <span className="review-composer-keys">⌘↵ save · esc close</span>
                <button type="button" className="review-compose-cancel" onClick={() => dismissComposer()}>Cancel</button>
                <button type="submit" className="review-compose-submit" disabled={!composerCanSave}>
                  <MessageSquarePlus className="size-4" /> {composerCta}
                </button>
              </footer>
            )}
          </form>
        </div>
      ) : null}

      {/* Where a hidden thing lives. Anchored to the section holding it, so
          the answer to "which part of the page is this in?" is on the page
          rather than in a file path — and it is the switch that puts it back,
          because that is what you want the moment you have found it. */}
      {(() => {
        const note = nest ? notes[nest] : undefined;
        if (!note) return null;
        const box = nearestVisible(note)?.getBoundingClientRect();
        if (!box) return null;
        return (
          <div
            data-review-ui
            className="review-nest"
            style={{ top: Math.max(4, box.top + 6), left: Math.max(4, box.left + 6) }}
          >
            <button
              type="button"
              role="switch"
              aria-checked="true"
              className="review-nest-switch"
              onClick={() => toggleHidden(note)}
            >
              <EyeOff className="size-3.5" />
              <span>{note.label}</span>
              <b>{note.stow ? 'archived here' : 'hidden here'}</b>
            </button>
            {nestFor && notes[nestFor] ? (
              <span className="review-nest-holding">holds “{notes[nestFor].label}”</span>
            ) : null}
            <button
              type="button"
              className="review-nest-close"
              onClick={() => { setNest(null); setNestFor(null); }}
              aria-label="Stop marking this"
            >
              <X className="size-3" />
            </button>
          </div>
        );
      })()}

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
        <div
          key={toast.at}
          data-review-ui
          className="review-toast"
          data-tone={toast.tone}
          role="status"
          aria-live="polite"
        >
          {toast.text}
        </div>
      ) : null}

      {compact ? (
        <MobileDock
          open={open}
          onToggle={() => setOpen((current) => !current)}
          onClose={() => {
            setOpen(false);
            setMode('off');
            setCommentIntent(false);
            setPicked(null);
          }}
          min={dockMin}
          onMin={setDockMin}
          toolsOpen={toolsOpen}
          onTools={setToolsOpen}
          order={order}
          onOrder={setOrder}
          mode={mode}
          commenting={mode === 'pick' && commentIntent}
          onCommentMode={() => {
            const next = !(mode === 'pick' && commentIntent);
            setCommentIntent(next);
            setMode(next ? 'pick' : 'off');
            setPicked(null);
          }}
          onMode={(next) => {
            setCommentIntent(false);
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
        />
      ) : (
        <DesktopDock
          open={open}
          onToggle={() => setOpen((current) => !current)}
          toolsOpen={toolsOpen}
          onTools={setToolsOpen}
          onClose={() => {
            setOpen(false);
            setMode('off');
            setCommentIntent(false);
            setPicked(null);
          }}
          order={order}
          onOrder={setOrder}
          openCount={openCount}
          mode={mode}
          commenting={mode === 'pick' && commentIntent}
          onCommentMode={() => {
            const next = !(mode === 'pick' && commentIntent);
            setCommentIntent(next);
            setMode(next ? 'pick' : 'off');
            setPicked(null);
          }}
          onMode={(next) => {
            setCommentIntent(false);
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
          onStepProposal={stepProposal}
          journalOpen={panelOpen}
          onJournal={setPanelOpen}
          journalCount={findings.length}
          journalNew={unread.length}
          journalWide={journalWide}
          onJournalWide={setJournalWide}
          journal={journalBody}
          onCopyAiPrompt={copyAiPrompt}
        />
      )}

      {/* Floating Walkthrough Zen Triage HUD */}
      {triage && triageNote ? (
        <aside data-review-ui className="review-walkthrough-hud" role="region" aria-label="Review Walkthrough">
          <div className="review-hud-progress-pill">
            {/* Same words and same arithmetic as the card's counter, because
                they are two views of one queue and were disagreeing: the bar
                here filled to (at + 1) / total, counting the card you are
                still looking at as finished, so the first of ten opened at
                10% while the card behind it correctly read 0%. Progress is
                what you have answered, never what you have been shown. */}
            <span className="review-hud-step-num">
              {Math.min(triage.at + 1, triage.ids.length)} of {triage.ids.length}
            </span>
            <span className="review-hud-step-bar" aria-hidden="true">
              <i style={{ width: `${(triage.at / triage.ids.length) * 100}%` }} />
            </span>
          </div>

          <div className="review-hud-info">
            <strong className="review-hud-target-name">{triageNote.label}</strong>
            <span className="review-hud-target-layout">{triageNote.anchor.layout}</span>
          </div>

          <div className="review-hud-actions">
            <button
              type="button"
              className="review-hud-btn review-hud-prev"
              disabled={triage.at === 0}
              onClick={() => triageStep(-1)}
              title="Previous item (← or P)"
            >
              ‹
            </button>
            {/* The same six answers as the Go Through card and the note row,
                in the same order and the same words.

                This bar had grown a fourth vocabulary — Keep / Remove /
                Change / Hidden — of which "Hidden" was an adjective on a row
                of verbs, and it was missing the two answers that get used
                most: leaving a note without deciding, and Later. The words
                come from DECISIONS now, so there is one place to change them
                and no way for a surface to drift again. */}
            {decisionsFor(triageNote).map((decision, index) => (
              <button
                key={decision.id}
                type="button"
                className="review-hud-btn"
                data-act={decision.id}
                data-on={decision.id === 'trial' && offPage(triageNote) ? true : undefined}
                title={`${decision.verb} (${index + 1}) — ${decision.hint}`}
                onClick={() => {
                  if (decision.needsWords) { commentOnNote(triageNote.id); return; }
                  answer(triageNote, decision);
                  triageStep(1);
                }}
              >
                {decision.id === 'cut' ? <Trash2 className="size-4" />
                  : decision.id === 'rework' || decision.id === 'note' ? <MessageSquarePlus className="size-4" />
                    : decision.id === 'trial' ? <EyeOff className="size-4" />
                      : decision.id === 'keep' ? <Check className="size-4" />
                        : <Minus className="size-4" />}
                <span>{decision.verb}</span>
              </button>
            ))}
            <button
              type="button"
              className="review-hud-btn review-hud-next"
              onClick={() => triageStep(1)}
              title="Next / Skip (→ or N)"
            >
              ›
            </button>
            <button
              type="button"
              className="review-hud-btn review-hud-exit"
              onClick={() => setTriage(null)}
              title="Exit Walkthrough (Esc)"
            >
              <X className="size-4" />
            </button>
          </div>
        </aside>
      ) : null}
    </ReviewContext.Provider>
  );
}

/** What has to happen about this note, in one word — the move that is still
 *  owed, not the state it is already in.
 *
 *  Reading is not one of them. A note said "Read" when it carried a comment,
 *  which put a non-action in the column of actions and made every remark
 *  look like a chore. What a comment actually carries is either a proposed
 *  change or a question waiting on an answer, and which of those it is
 *  depends on whose word came last. */
/** The Do column's words, in one place.
 *
 *  ────────────────────────────────────────────────────────────────────────
 *  THIS IS WHERE YOU EDIT THEM. Change a value here and the word changes
 *  everywhere at once: the chip on the row, the filter chip above the board,
 *  and — through `markdown.ts` — the report in review/REVIEW-NOTES.md.
 *  ────────────────────────────────────────────────────────────────────────
 *
 *  What you cannot do here is add one, or take one away, and it is worth
 *  saying why: these are not labels anybody applies. `actOf` below works
 *  each one out from the note itself — a cut you approved *is* `remove`, the
 *  same cut turned down *is* `keep`, a note sitting on a shelf *is*
 *  `archived`. There is no field to set, so there is nothing to delete: a
 *  "delete the Keep chip" would have to mean "delete the notes you kept".
 *
 *  A key here is a meaning, and the string beside it is what that meaning is
 *  called. Two keys with the same string is the collision VOCABULARY.md
 *  exists to catch — `change` and `edit` are the same act, so if Edit is the
 *  better word, `change` becomes 'Edit' and there is still one of it.
 *
 *  The colours are set in review.css, keyed off `data-act` with the value
 *  from this map — so a renamed verb needs its selector renamed with it. */
/** Tags that name a decision, mapped to that decision's word. Tags with no
 *  equivalent — spacing, contrast, confusing — keep their own name, because
 *  they describe a kind of change rather than an answer. */
const TAG_AS_ACT: Record<string, string> = {
  remove: 'Cut',
  cut: 'Cut',
  reword: 'Rework',
  resize: 'Rework',
  move: 'Move'
};

export const DO: Record<string, string> = {
  /* A proposed cut you agreed with. ("Cut" read as cut-and-paste beside Move
     and Archive, and never said what was being cut — the element, or the
     note about it.) */
  remove: 'Cut',
  /* Legacy only. "Unsure" was picked by reviewers as the least permanent
     option available, not because they were undecided — what they wanted was
     to say something without deciding. That is now its own answer, Note, and
     old notes render under the same word so the vocabulary has no seams. */
  unsure: 'Note',
  /* An approved suggestion that is not a deletion. */
  apply: 'Apply',
  /* You asked for something; my move. (Revise and Change were two words for
     one thing: make a change. Which side owes it is what `reply` says.) */
  change: 'Rework',
  /* I answered; your move. */
  reply: 'Reply',
  /* The element should sit somewhere else. */
  move: 'Move',
  /* An A/B choice was made. */
  picked: 'Picked',
  /* Carried onto a shelf. Nothing owed. */
  archived: 'Archived',
  /* Switched off where it stood. Nothing owed. */
  hidden: 'Hidden',
  /* Marked, with nothing asked of it. "Noted" sat one letter from "Notes",
     the panel it lives inside, and two from "Note", the button beside it —
     three near-identical words in one column. This one is the odd meaning
     out: it is not a note being made, it is a note that asks for nothing. */
  noted: 'Marked',
  /* The filter chip that turns filtering off. Not a verb, but it sits in the
     same strip wearing the same shape, so it is named in the same place. */
  all: 'All'
};

/** Which of the above a note is asking for. Derived, never stored: both
 *  sides write the same `review-notes.json`, and a word that is computed
 *  from the record cannot drift out of step with it. */
function actOf(note: ReviewNote): string {
  /* A trial has not decided anything, so the Do column has nothing to say
     about it. It used to print the reviewer's intent tag — a red REMOVE
     beside a chip reading "Trying without it" — which is the row telling you
     the decision is made and still open in the same breath. The state chip
     and its two answers carry it alone. */
  if (stateOf(note) === 'trial') return '';
  if (note.kind === 'choice') return DO.picked;
  if (note.placement) return DO.move;
  if (note.verdict === 'approved') return note.kind === 'delete' ? DO.remove : DO.apply;
  if (note.verdict === 'unsure') return DO.unsure;
  // 'rejected' is a dismissal and never reaches the board — see `findings`.
  if (note.verdict === 'rejected') return DO.noted;
  if (note.verdict === 'revise') return DO.change;
  /* A tag is the reviewer naming the change themselves; nothing beats it —
     but it says it in the tag vocabulary, and the strip has to speak one
     language. A 'remove' tag and an approved cut are the same instruction,
     and they were producing two chips, "Remove 2" and "Cut 2", side by side.
     Tags that mean a decision are shown in that decision's word. */
  if (note.tags?.length) {
    const tag = note.tags[0];
    const asDecision = TAG_AS_ACT[tag];
    if (asDecision) return asDecision;
    return tag[0].toUpperCase() + tag.slice(1);
  }
  const last = note.thread?.[note.thread.length - 1];
  if (last?.from === 'claude') return DO.reply;
  if (note.comment) return DO.change;
  /* Being off the page is not something anyone is being asked to do — it is
     a fact about where the element currently is, and it now shows as a mark
     on the row and a lens in the filter strip. As verbs, Archived and Hidden
     split one idea across two chips and crowded out the actual ask. */
  // Nothing is asked of this one yet. It is not owed anything, and the
  // column should not pretend otherwise.
  return DO.noted;
}


/** Dev source line numbers count the HMR prelude, so they are ~19 lines off.
 *  The dev server rewrites them to real lines when it writes the notes file;
 *  in the app itself, only the file name is trustworthy. */
function fileOf(source?: string): string | undefined {
  return source?.split(':')[0];
}
