import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import {
  Archive, ArrowDown, ArrowLeft, ArrowRight, ArrowUp, Check, ChevronDown,
  ChevronUp, Columns2, Copy, Expand, GripVertical, Keyboard, Link2,
  List, MessageSquarePlus, Minus, MousePointerSquareDashed, NotebookPen,
  Sparkles, StretchHorizontal, StretchVertical, Trash2, Undo2, Unlink, X
} from 'lucide-react';
import type { LayoutMode } from '../state/storage';
import { anchorId, describeElement, elementPath, labelFor, shortName } from './anchor';
import { actionable, notesToMarkdown } from './markdown';
import { fetchRemote, loadLocal, mergeNotes, pushRemote, saveLocal } from './store';
import type {
  ReviewAnchor, ReviewNote, ReviewNotes, ReviewVerdict, TrayEdge, TraySettings
} from './types';
import { ReviewContext } from './context';
import type { ReviewContextValue, ReviewMode, SuggestedTarget } from './context';
import { EdgeTrays } from './EdgeTrays';
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

interface WindowBox {
  x: number;
  y: number;
  w: number;
  h: number;
  min: boolean;
}

const WINDOW_KEY = 'pg-review-window-v1';
const DOCK_KEY = 'pg-review-dock-v1';

/** The toolbar is a palette, not a fixture: it remembers where it was put and
 *  whether it was rolled up. Undefined coordinates mean "never moved" — it
 *  stays in its corner until it is dragged out of it. */
type DockDir = 'v' | 'h' | 'wide';

interface DockBox {
  x?: number;
  y?: number;
  min: boolean;
  dir?: DockDir;
  help?: boolean;
  /** Wide shape only: drag it narrow and the names clip away until only the
   *  icons are left, so the same palette covers both looks. */
  w?: number;
  /** 'with' clips the stashes onto the toolbar so the two move as one object.
   *  'free' breaks them apart into a second panel with a grip of its own.
   *  'edges' is the untouched default on a wide screen: four screen edges. */
  stash?: 'with' | 'free' | 'edges';
  /** Distance from the right edge, kept alongside x. Parked on the right the
   *  compound is anchored by its right edge, so opening the drawer grows it
   *  leftwards into the page instead of off the side of the screen. */
  rx?: number;
  /** Where the free-floating stash panel was left. */
  sx?: number;
  sy?: number;
  /** The order of the compound's three parts, top to bottom. Rearranged by
   *  long-pressing one of them and dragging it past its neighbour. */
  order?: DockPart[];
}

export type DockPart = 'fab' | 'tools' | 'stash';

const DEFAULT_ORDER: DockPart[] = ['fab', 'tools', 'stash'];

/** Thin upright strip, thin flat bar, or wide with names. Three buttons in
 *  the title band rather than one that cycles: a cycle never says what the
 *  next press will give you. */

/** Inside the window, and never negative on a screen smaller than the thing
 *  being placed. */
function clamp(value: number, max: number): number {
  return Math.min(Math.max(8, value), Math.max(8, max));
}

function loadDockBox(): DockBox {
  try {
    const fallback: DockBox = { min: false, dir: 'v' };
    const saved = localStorage.getItem(DOCK_KEY);
    return saved ? { ...fallback, ...JSON.parse(saved) as Partial<DockBox> } : fallback;
  } catch {
    return { min: false, dir: 'v' };
  }
}

function defaultWindowBox(): WindowBox {
  return {
    x: Math.max(12, window.innerWidth - 372),
    y: Math.max(12, window.innerHeight - 520),
    w: 344,
    h: 380,
    min: false
  };
}

/** The log is a window, so it remembers where you left it. */
function loadWindowBox(): WindowBox {
  const fallback = defaultWindowBox();
  try {
    const saved = localStorage.getItem(WINDOW_KEY);
    return saved ? { ...fallback, ...JSON.parse(saved) as Partial<WindowBox> } : fallback;
  } catch {
    return fallback;
  }
}

function clampWindow(box: WindowBox): WindowBox {
  return {
    ...box,
    w: Math.min(Math.max(box.w, 260), window.innerWidth - 24),
    h: Math.min(Math.max(box.h, 180), window.innerHeight - 24),
    x: Math.min(Math.max(box.x, 8), Math.max(8, window.innerWidth - 120)),
    y: Math.min(Math.max(box.y, 8), Math.max(8, window.innerHeight - 60))
  };
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
  const [notes, setNotes] = useState<ReviewNotes>(loadLocal);
  const [panelOpen, setPanelOpen] = useState(false);
  const [hovered, setHovered] = useState<Element | null>(null);
  const [picked, setPicked] = useState<Element | null>(null);
  const [, setTick] = useState(0); // scroll/resize nudge so overlays follow
  const [composer, setComposer] = useState<ComposerState | null>(null);
  const [replyTo, setReplyTo] = useState<string | null>(null);
  const [focusId, setFocusId] = useState<string | null>(null);
  const [win, setWin] = useState<WindowBox>(loadWindowBox);
  const [travelling, setTravelling] = useState<{ note: ReviewNote; tries: number } | null>(null);
  const winDrag = useRef<{ mode: 'move' | 'size'; x: number; y: number; box: WindowBox } | null>(null);
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
  const [moreOpen, setMoreOpen] = useState(false);
  /** The stash drawer's open state lives up here because the toolbar carries
   *  the button that opens it — it belongs in the group with Undo and Log. */
  const [stashOpen, setStashOpen] = useState(false);
  /** True while the compound is actually being carried, so it reads as
   *  picked up rather than as a page element that happens to be moving. */
  const [lifted, setLifted] = useState(false);
  /** The part being carried within the compound, once a long press has taken
   *  hold. Null means a plain drag, which moves the whole thing. */
  const [rearranging, setRearranging] = useState<DockPart | null>(null);
  /** The alignment held for the length of a drag; null when at rest, where
   *  the compound's own position decides. */
  const [dragSide, setDragSide] = useState<'left' | 'right' | null>(null);
  const [compact, setCompact] = useState(() => window.innerWidth < 640);
  const [dock, setDock] = useState<DockBox>(loadDockBox);
  /** Shelves taken off the screen for now. Not persisted — a hidden shelf is
   *  a thing you did a second ago, not a decision about the product. */
  const [hiddenTrays, setHiddenTrays] = useState<TrayEdge[]>(DEFAULT_HIDDEN);
  const firstSync = useRef(true);
  const suggestedRef = useRef<Record<string, { label: string; reason: string }>>({});
  const notesRef = useRef<ReviewNotes>({});
  const dragStart = useRef<{ x: number; y: number; el: HTMLElement } | null>(null);
  const draggedJustNow = useRef(false);
  const advanceRef = useRef<(() => void) | null>(null);
  const rearrangingRef = useRef<DockPart | null>(null);
  const dockRef = useRef<HTMLDivElement>(null);
  const dockDrag = useRef<{ x: number; y: number; box: { x: number; y: number } } | null>(null);
  const dockPress = useRef<{ x: number; y: number; moved: boolean; part: DockPart | null } | null>(null);
  const holdTimer = useRef<number | undefined>(undefined);
  const sizeDrag = useRef<{ x: number; from: number } | null>(null);
  const stashRef = useRef<HTMLDivElement>(null);
  const stashDrag = useRef<{ x: number; y: number; box: { x: number; y: number } } | null>(null);
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
        setNotes((current) => mergeNotes(current, remote));
      }
    });
  }, []);

  useEffect(() => {
    saveLocal(notes);
    if (firstSync.current) {
      firstSync.current = false;
      return;
    }
    const timer = setTimeout(() => {
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
  pickedRef.current = picked;
  rearrangingRef.current = rearranging;

  /** Every action says what it did, briefly, the way a game confirms a pickup
   *  instead of leaving you to check an inventory screen. */
  const say = useCallback((text: string, tone: 'good' | 'warn' | 'info' = 'info') => {
    setToast({ text, tone, at: Date.now() });
  }, []);

  const startDockDrag = useCallback((x: number, y: number) => {
    const rect = dockRef.current?.getBoundingClientRect();
    if (!rect) return;
    dockDrag.current = { x, y, box: { x: rect.left, y: rect.top } };
    // Hold the current alignment for the length of the drag. The parts are
    // different widths, so realigning them the moment the compound crosses
    // the middle of the screen throws whichever one you are holding out from
    // under the cursor. It settles the instant you let go.
    setDragSide(rect.left < window.innerWidth / 2 ? 'left' : 'right');
    setDock((current) => ({ ...current, x: rect.left, y: rect.top }));
  }, []);

  /** Everything is draggable, and nothing loses its click.
   *
   *  Press anywhere on the compound — the gaps, the title band, a button. A
   *  press that goes nowhere is a click, and the button under it does its
   *  job. A press that moves becomes a drag, and the click it would have
   *  fired is swallowed on release. Movement is the whole signal; there is
   *  nothing to hold down and nothing to learn. */
  const armDockDrag = useCallback((event: React.PointerEvent) => {
    const target = event.target as HTMLElement;
    if (target.closest('.review-tools-grip')) return;
    const part: DockPart | null = target.closest('.review-fab') ? 'fab'
      : target.closest('.review-dock-stash') ? 'stash'
        : target.closest('.review-dock-tools') ? 'tools' : null;
    dockPress.current = { x: event.clientX, y: event.clientY, moved: false, part };

    // Hold still for a moment and you are holding that piece, not the whole
    // compound: moving now reorders it against its neighbours instead of
    // carrying everything across the screen.
    window.clearTimeout(holdTimer.current);
    if (part) {
      holdTimer.current = window.setTimeout(() => {
        if (!dockPress.current || dockPress.current.moved) return;
        setRearranging(part);
        setLifted(true);
      }, 400);
    }
  }, []);

  /** Grab a part by its grip: that piece is being sorted from the first move,
   *  with no hold needed. Dragging anywhere else still carries the whole
   *  compound, so both gestures are available and neither blocks the other. */
  const startRearrange = useCallback((part: DockPart, event: React.PointerEvent) => {
    event.preventDefault();
    event.stopPropagation();
    dockPress.current = { x: event.clientX, y: event.clientY, moved: false, part };
    setRearranging(part);
    setLifted(true);
  }, []);

  /** Slot the carried part into whichever slot the pointer is over. */
  const reorderAt = useCallback((part: DockPart, y: number) => {
    const dock = dockRef.current;
    if (!dock) return;
    const parts: { part: DockPart; mid: number }[] = [];
    for (const [name, selector] of [
      ['fab', '.review-fab'],
      ['tools', '.review-dock-tools'],
      ['stash', '.review-dock-stash']
    ] as const) {
      const el = dock.querySelector(selector);
      if (!el) continue;
      const box = el.getBoundingClientRect();
      parts.push({ part: name, mid: box.top + box.height / 2 });
    }
    parts.sort((a, b) => a.mid - b.mid);
    const over = parts.findIndex((item) => y < item.mid);
    const target = over < 0 ? parts.length - 1 : over;
    setDock((current) => {
      const order = (current.order ?? DEFAULT_ORDER).filter((item) => item !== part);
      const at = Math.min(Math.max(0, target), order.length);
      order.splice(at, 0, part);
      return { ...current, order };
    });
  }, []);


  useEffect(() => {
    try {
      localStorage.setItem(DOCK_KEY, JSON.stringify(dock));
    } catch {
      // Private mode; the palette just starts in its corner next time.
    }
  }, [dock]);

  useEffect(() => {
    const onMove = (event: PointerEvent) => {
      // A press that has travelled far enough stops being a press and starts
      // being a drag — from anywhere on the compound, buttons included. The
      // click it would have fired is swallowed on release.
      const press = dockPress.current;
      // Holding a single piece: the move sorts it, it does not carry the rest.
      if (rearrangingRef.current && press) {
        event.preventDefault();
        press.moved = true;
        reorderAt(rearrangingRef.current, event.clientY);
        return;
      }
      if (press && !press.moved && !dockDrag.current && !sizeDrag.current && !stashDrag.current) {
        if (Math.hypot(event.clientX - press.x, event.clientY - press.y) < 5) return;
        window.clearTimeout(holdTimer.current);
        press.moved = true;
        setLifted(true);
        startDockDrag(press.x, press.y);
      }
      const sizing = sizeDrag.current;
      if (sizing) {
        event.preventDefault();
        // 3rem is one icon plus its padding: past that there is nothing left
        // to show but the icons, which is the point of dragging it in.
        setDock((current) => ({
          ...current,
          w: Math.min(Math.max(48, sizing.from + event.clientX - sizing.x), 340)
        }));
        return;
      }
      const loose = stashDrag.current;
      if (loose) {
        event.preventDefault();
        const box = stashRef.current?.getBoundingClientRect();
        setDock((current) => ({
          ...current,
          sx: clamp(loose.box.x + event.clientX - loose.x, window.innerWidth - (box?.width ?? 240) - 8),
          sy: clamp(loose.box.y + event.clientY - loose.y, window.innerHeight - 48)
        }));
        return;
      }
      const grip = dockDrag.current;
      if (!grip) return;
      event.preventDefault();
      // Clamped by the whole palette, not just its title bar — dragging it
      // low must not push the Done button off the bottom of the screen.
      const box = dockRef.current?.getBoundingClientRect();
      const width = box?.width ?? 200;
      const height = box?.height ?? 220;
      const x = clamp(grip.box.x + event.clientX - grip.x, window.innerWidth - width - 8);
      setDock((current) => ({
        ...current,
        x,
        rx: Math.max(8, window.innerWidth - (x + width)),
        y: clamp(grip.box.y + event.clientY - grip.y, window.innerHeight - height - 8)
      }));
    };
    const onUp = () => {
      // The parts realign to wherever it came to rest.
      setDragSide(null);
      // A drag ate the click; a press that never moved leaves it alone.
      if (dockPress.current?.moved) {
        const swallow = (click: MouseEvent) => {
          click.preventDefault();
          click.stopPropagation();
        };
        window.addEventListener('click', swallow, true);
        window.setTimeout(() => window.removeEventListener('click', swallow, true), 0);
      }
      window.clearTimeout(holdTimer.current);
      setLifted(false);
      setRearranging(null);
      dockPress.current = null;
      dockDrag.current = null;
      sizeDrag.current = null;
      stashDrag.current = null;
    };
    window.addEventListener('pointermove', onMove, true);
    window.addEventListener('pointerup', onUp, true);
    return () => {
      window.removeEventListener('pointermove', onMove, true);
      window.removeEventListener('pointerup', onUp, true);
    };
  }, [startDockDrag, reorderAt]);

  useEffect(() => {
    const onResize = () => {
      setCompact(window.innerWidth < 640);
      // A palette parked in a corner of a big window must not end up outside
      // a small one.
      setDock((current) => {
        if (current.x === undefined) return current;
        const box = dockRef.current?.getBoundingClientRect();
        return {
          ...current,
          x: clamp(current.x, window.innerWidth - (box?.width ?? 200) - 8),
          y: clamp(current.y ?? 8, window.innerHeight - (box?.height ?? 220) - 8)
        };
      });
    };
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(null), 1900);
    return () => clearTimeout(timer);
  }, [toast]);

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
  const toggleTray = useCallback((which: TrayEdge | 'all') => {
    // From here on the shelves are yours: picking stops rearranging them.
    shelvesTouched.current = true;
    setHiddenTrays((current) => {
      if (which === 'all') {
        const next = current.length === EDGES.length ? [] : [...EDGES];
        shelvesTouched.current = true;
        say(next.length ? 'Shelves hidden — h brings them back' : 'Shelves back');
        return next;
      }
      const hiding = !current.includes(which);
      say(`${which} shelf ${hiding ? 'hidden' : 'back'}`);
      return hiding ? [...current, which] : current.filter((edge) => edge !== which);
    });
  }, [say]);

  // A shelf standing over the thing you are aiming at makes it hard to pick,
  // so selecting starts with them out of the way. A default, not a rule: the
  // first time you press a shelf key, that choice sticks and this stops.
  useEffect(() => {
    if (shelvesTouched.current) return;
    setHiddenTrays(mode === 'pick' ? [...EDGES] : [...DEFAULT_HIDDEN]);
  }, [mode]);

  /** Put the furniture back. Everything the console lets you move — the
   *  palette, the log window, where the shelves sit and whether they are
   *  showing — goes home. Notes are decisions, not furniture: nothing here
   *  touches them. */
  const tidy = useCallback(() => {
    setDock({ min: false, dir: 'h', help: false });
    setWin(defaultWindowBox());
    setMoreOpen(false);
    shelvesTouched.current = false;
    setHiddenTrays([...DEFAULT_HIDDEN]);
    for (const edge of EDGES) {
      // Only shelves that were actually moved: this must not mint a note for
      // a shelf that has never been touched.
      const settings = notesRef.current[trayNoteId(layout, edge)]?.tray;
      if (settings && (settings.offset !== undefined || settings.open !== undefined)) {
        setTray(edge, { offset: undefined, open: undefined });
      }
    }
    say('Everything back in its place', 'good');
  }, [layout, setTray, say]);

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

  useEffect(() => {
    try {
      localStorage.setItem(WINDOW_KEY, JSON.stringify(win));
    } catch {
      // Private mode; the window just starts in its default spot next time.
    }
  }, [win]);

  useEffect(() => {
    if (!winDrag.current && !panelOpen) return;
    const onMove = (event: PointerEvent) => {
      const grip = winDrag.current;
      if (!grip) return;
      event.preventDefault();
      const dx = event.clientX - grip.x;
      const dy = event.clientY - grip.y;
      setWin(clampWindow(grip.mode === 'move'
        ? { ...grip.box, x: grip.box.x + dx, y: grip.box.y + dy }
        : { ...grip.box, w: grip.box.w + dx, h: grip.box.h + dy }));
    };
    const onUp = () => { winDrag.current = null; };
    window.addEventListener('pointermove', onMove, true);
    window.addEventListener('pointerup', onUp, true);
    return () => {
      window.removeEventListener('pointermove', onMove, true);
      window.removeEventListener('pointerup', onUp, true);
    };
  }, [panelOpen]);

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

      // Shelves. Arrows move them out of the way — but only when nothing is
      // selected, because with a selection the arrows are how you aim it.
      const byLetter = ({ l: 'left', r: 'right', t: 'top', b: 'bottom' } as const)[
        event.key as 'l' | 'r' | 't' | 'b'
      ];
      const byArrow = ({
        ArrowLeft: 'left', ArrowRight: 'right', ArrowUp: 'top', ArrowDown: 'bottom'
      } as const)[event.key as 'ArrowLeft' | 'ArrowRight' | 'ArrowUp' | 'ArrowDown'];
      const shelf = byLetter ?? (pickedRef.current ? undefined : byArrow);
      if (shelf) {
        event.preventDefault();
        toggleTray(shelf);
      }
      if (event.key === 'h') toggleTray('all');

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
  }, [open, mode, panelOpen, composer, variantSets.length, undo]);

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
    isStowed: (id: string) => Boolean(notes[id] && isStowed(notes[id]))
  }), [mode, notes, focusId, register, registerVariants, decide, commentOn, chooseVariant, restore, stow]);

  // A phone has no room for four shelves, and the flat bar has a natural
  // shelf underneath it — both default to carrying them. Upright and wide
  // leave them on the edges, where a tall strip is not in their way.
  const attached = dock.stash ?? (compact || dock.dir === 'h' ? 'with' : 'edges');
  const stashCount = Object.values(notes)
    .filter((note) => note.stow && note.anchor.layout === layout).length;
  const shelves = (
    <EdgeTrays
      notes={notes}
      layout={layout}
      shape={attached === 'edges' ? 'edges' : 'stack'}
      stackOpen={stashOpen}
      onStackToggle={() => setStashOpen((current) => !current)}
      onGripDown={(event) => {
        if (attached === 'free') {
          // Loose, the grip moves the panel itself around the screen.
          event.preventDefault();
          const box = stashRef.current?.getBoundingClientRect();
          if (!box) return;
          stashDrag.current = { x: event.clientX, y: event.clientY, box: { x: box.left, y: box.top } };
          setDock((current) => ({ ...current, sx: box.left, sy: box.top }));
          return;
        }
        startRearrange('stash', event);
      }}
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

  const openCount = findings.filter((note) => note.status === 'open').length;
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
      status: 'open',
      anchor: composer.anchor
    });
    setComposer(null);
    setPicked(null);
    say('Comment saved', 'good');
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
    return found instanceof HTMLElement ? found : null;
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
  function flashElement(target: HTMLElement) {
    target.scrollIntoView({ block: 'center', behavior: 'smooth' });
    target.classList.remove('review-flash');
    void target.offsetWidth; // restart the animation on a repeat click
    target.classList.add('review-flash');
    window.setTimeout(() => target.classList.remove('review-flash'), 1600);
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
      say(`Lives in the ${note.anchor.layout} layout`, 'info');
      return;
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
        say('Could not find it on that screen', 'warn');
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

      {panelOpen ? (
        <div
          data-review-ui
          className="review-panel"
          data-min={win.min || undefined}
          style={{ left: win.x, top: win.y, width: win.w, height: win.min ? undefined : win.h }}
        >
          <header
            className="review-panel-head"
            onPointerDown={(event) => {
              if ((event.target as HTMLElement).closest('button')) return;
              winDrag.current = { mode: 'move', x: event.clientX, y: event.clientY, box: win };
            }}
          >
            <span>Log · {openCount} open</span>
            <span className="review-panel-buttons">
              <button
                type="button"
                onClick={() => setWin({ ...win, min: !win.min })}
                aria-label={win.min ? 'Expand log' : 'Minimise log'}
                title={win.min ? 'Expand' : 'Minimise'}
              >
                {win.min ? <ChevronUp className="size-4" /> : <Minus className="size-4" />}
              </button>
              <button type="button" onClick={() => setPanelOpen(false)} aria-label="Close log">
                <X className="size-4" />
              </button>
            </span>
          </header>
          <p className="review-panel-sync">
            {synced === 'file'
              ? 'Written to review/REVIEW-NOTES.md'
              : synced === 'local'
                ? 'This device only — dev server is not writing'
                : 'Saved on this device'}
          </p>
          <ul className="review-panel-list">
            {findings.length === 0 ? (
              <li className="review-panel-empty">
                Nothing marked yet. Every layout's notes land here, not just this one's.
              </li>
            ) : null}
            {Array.from(new Set(findings.map((note) => note.anchor.layout)))
              // The screen you are on first; the rest are still listed, because
              // a comment is about the product, not about this tab.
              .sort((a, b) => (a === layout ? -1 : b === layout ? 1 : a.localeCompare(b)))
              .map((noteLayout) => (
                <li key={noteLayout} className="review-panel-group">
                  <span className="review-panel-group-head">
                    {noteLayout}
                    {noteLayout === layout ? ' · on screen' : ''}
                  </span>
                  <ul>
                    {findings
                      .filter((note) => note.anchor.layout === noteLayout)
                      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
                      .map((note) => (
                        <li key={note.id} data-kind={note.kind} data-verdict={note.verdict}>
                          <button type="button" className="review-note-body" onClick={() => pointAtNote(note)}>
                            <span className="review-note-kind">{verdictLabel(note)}</span>
                            <span className="review-note-label">{note.label}</span>
                            {note.tags?.length ? (
                              <span className="review-note-tags">
                                {note.tags.map((tag) => <span key={tag}>{tag}</span>)}
                              </span>
                            ) : null}
                            {note.comment ? <span className="review-note-text">“{note.comment}”</span> : null}
                            {note.anchor.source
                              ? <span className="review-note-source">{fileOf(note.anchor.source)}</span>
                              : null}
                            {note.thread?.length ? (
                              <span className="review-note-thread">
                                {note.thread.map((reply, index) => (
                                  <span key={index} data-from={reply.from}>
                                    <b>{reply.from === 'claude' ? 'Claude' : 'You'}:</b> {reply.text}
                                  </span>
                                ))}
                              </span>
                            ) : null}
                          </button>
                          <button
                            type="button"
                            className="review-note-remove"
                            onClick={() => setReplyTo(replyTo === note.id ? null : note.id)}
                            aria-label={`Reply to ${note.label}`}
                            title="Reply"
                          >
                            <MessageSquarePlus className="size-4" />
                          </button>
                          <button
                            type="button"
                            className="review-note-remove"
                            onClick={() => remove(note.id)}
                            aria-label="Remove note"
                          >
                            <X className="size-4" />
                          </button>
                        </li>
                      ))}
                  </ul>
                </li>
              ))}
          </ul>

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
                <button type="button" className="review-ghost" onClick={() => setReplyTo(null)}>Cancel</button>
                <button type="submit" className="review-primary">Send</button>
              </div>
            </form>
          ) : null}

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
          <span
            className="review-panel-grip"
            onPointerDown={(event) => {
              winDrag.current = { mode: 'size', x: event.clientX, y: event.clientY, box: win };
            }}
            aria-hidden="true"
          />
        </div>
      ) : null}

      {open && attached === 'edges' ? shelves : null}

      {open && attached === 'free' ? (
        <div
          ref={stashRef}
          data-review-ui
          className="review-stash-float"
          data-drop={(dock.sy ?? window.innerHeight * 0.7) > window.innerHeight * 0.55 ? 'up' : 'down'}
          style={{
            left: dock.sx ?? Math.max(8, window.innerWidth - 340),
            top: dock.sy ?? Math.max(8, window.innerHeight * 0.5)
          }}
        >
          {shelves}
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

      <div
        ref={dockRef}
        data-review-ui
        className="review-dock"
        data-placed={dock.x !== undefined || undefined}
        data-side={dragSide ?? (dock.x !== undefined && dock.x < window.innerWidth / 2 ? 'left' : 'right')}
        /* Parked low — including its home in the bottom corner — the drawer
           has nowhere to go but up, and the toolbar stays where it was put. */
        data-drop={dock.y === undefined || dock.y > window.innerHeight * 0.55 ? 'up' : 'down'}
        onPointerDown={armDockDrag}
        data-lifted={lifted || undefined}
        data-sorting={rearranging || undefined}
        style={{
          // Anchored to whichever edge it is nearest: on the right that is the
          // right edge, so anything that opens inside it grows inwards.
          ...(dock.x !== undefined
            ? dock.x < window.innerWidth / 2
              ? { left: dock.x, top: dock.y, right: 'auto', bottom: 'auto' }
              : { right: dock.rx ?? 8, top: dock.y, left: 'auto', bottom: 'auto' }
            : {}),
          ...Object.fromEntries((dock.order ?? DEFAULT_ORDER).map((part, index) => (
            [`--order-${part}`, index]
          )))
        }}

      >
        {open ? (
          <div
            className="review-dock-tools"
            data-min={dock.min || undefined}
            data-dir={dock.dir ?? 'v'}
            style={dock.dir === 'wide' && dock.w ? { width: dock.w } : undefined}
          >
            {/* Title band: the handle, and the way out. */}
            {/* Each object is dragged by its own top band — this one for the
                toolbar, the stash panel's own header for the stashes. When
                they are clipped together, either band moves the pair. */}
            <div
              className="review-hud-head"
              /* Double-click rolls it up and down — the gesture every title
                 bar has had for thirty years. A button for it only ever said
                 "minus" to anyone who had not already guessed. Sending it home
                 lives on Tidy up, where the rest of the arranging is. */
              onDoubleClick={(event) => {
                if ((event.target as HTMLElement).closest('button')) return;
                setDock((current) => ({ ...current, min: !current.min }));
              }}
              title="Drag the grip to reorder · drag to move · double-click to roll it up"
            >
              <span
                className="review-hud-grip review-part-grip"
                onPointerDown={(event) => startRearrange('tools', event)}
                title="Drag to reorder the toolbar within the console"
              >
                <GripVertical className="size-3.5" />
              </span>
              {/* Window controls belong in the window's own title band. */}
              <span className="review-hud-window">
                {/* One button, cycling. It wears the shape it is about to
                    give you, not the one you are already looking at — the
                    current shape is on screen, so showing it again tells you
                    nothing you cannot see. */}
                {(() => {
                  const shapes = [
                    { id: 'v' as const, Icon: StretchVertical, name: 'Upright' },
                    { id: 'h' as const, Icon: StretchHorizontal, name: 'Flat' },
                    { id: 'wide' as const, Icon: List, name: 'Wide' }
                  ];
                  const at = Math.max(0, shapes.findIndex((item) => item.id === (dock.dir ?? 'v')));
                  const next = shapes[(at + 1) % shapes.length];
                  const Icon = next.Icon;
                  return (
                    <button
                      type="button"
                      title={`Switch to ${next.name.toLowerCase()}`}
                      aria-label={`Switch the toolbar to ${next.name.toLowerCase()}`}
                      onClick={() => setDock((current) => ({ ...current, dir: next.id }))}
                    >
                      <Icon className="size-[18px]" />
                    </button>
                  );
                })()}
              </span>
            </div>

            <button
              type="button"
              data-on={mode === 'audit' || undefined}
              data-label="Audit"
              data-key="a"
              title="Audit · a"
              aria-label="Audit"
              onClick={() => {
                const next = mode === 'audit' ? 'off' : 'audit';
                setMode(next);
                setPicked(null);
                if (next === 'audit') setTimeout(() => stepProposal(1), 60);
                else setFocusId(null);
              }}
            >
              <Trash2 className="size-[18px]" />
              {suggestedIds.length ? (
                // How many are still waiting, not how many exist — and a tick
                // once the screen is fully answered. A fraction would not fit
                // the corner of a 36px icon anyway.
                <span
                  className="review-badge"
                  data-done={settled === suggestedIds.length || undefined}
                  title={`${settled} of ${suggestedIds.length} answered on this screen`}
                >
                  {settled === suggestedIds.length
                    ? <Check className="size-2.5" strokeWidth={4} />
                    : suggestedIds.length - settled}
                </span>
              ) : null}
            </button>

            <button
              type="button"
              data-on={mode === 'pick' || undefined}
              data-label="Pick"
              data-key="p"
              title="Pick · p"
              aria-label="Pick"
              onClick={() => { setMode(mode === 'pick' ? 'off' : 'pick'); setPicked(null); }}
            >
              <MousePointerSquareDashed className="size-[18px]" />
            </button>

            {variantSets.length ? (
              <button
                type="button"
                data-on={mode === 'variants' || undefined}
                data-label="A / B"
                data-key="v"
                title="Compare alternatives · v"
                aria-label="Compare alternatives"
                onClick={() => { setMode(mode === 'variants' ? 'off' : 'variants'); setPicked(null); }}
              >
                <Columns2 className="size-[18px]" />
                <span className="review-badge">{variantSets.length}</span>
              </button>
            ) : null}

            <span className="review-tools-rule" />

            <button
              type="button"
              disabled={!undoDepth}
              data-label="Undo"
              data-key="u"
              title="Undo · u"
              aria-label="Undo the last decision"
              onClick={undo}
            >
              <Undo2 className="size-[18px]" />
              {undoDepth ? <span className="review-badge">{undoDepth}</span> : null}
            </button>

            <button
              type="button"
              data-on={panelOpen || undefined}
              data-label="Log"
              data-key="4"
              title="Notes log · 4"
              aria-label="Notes log"
              onClick={() => setPanelOpen(!panelOpen)}
            >
              <NotebookPen className="size-[18px]" />
              {findings.length ? <span className="review-badge">{findings.length}</span> : null}
            </button>

            {attached === 'edges' ? null : (
              <button
                type="button"
                data-on={stashOpen || undefined}
                data-label="Stash"
                data-key="what you set aside"
                title="Stashes"
                aria-label="Stashes"
                aria-expanded={stashOpen}
                onClick={() => setStashOpen(!stashOpen)}
              >
                <Archive className="size-[18px]" />
                {stashCount ? <span className="review-badge">{stashCount}</span> : null}
              </button>
            )}

            <span className="review-tools-rule" />

            <button
              type="button"
              className="review-tools-more"
              data-on={moreOpen || undefined}
              /* No hover label: a chevron under a toolbar explains itself, and
                 a tooltip that says "Arrange" says nothing the arrow did not. */
              aria-label="More controls"
              aria-expanded={moreOpen}
              onClick={() => setMoreOpen(!moreOpen)}
            >
              {/* A chevron, not an ellipsis: it opens a floor downward, and
                  the arrow says which way. */}
              <ChevronDown className="size-[18px] review-more-caret" />
            </button>


            {/* The flat bar has width to spend, so it spends it on whatever
                tool is running — answering the focused proposal here means the
                buttons stay put instead of moving with every outline. */}
            {dock.dir === 'h' && mode === 'audit' && focusId && suggested[focusId] ? (
              <span className="review-bar-context">
                <button
                  type="button"
                  className="review-bar-step"
                  onClick={() => stepProposal(-1)}
                  aria-label="Previous proposal"
                >‹</button>
                <span className="review-bar-name">{suggested[focusId].label}</span>
                <button
                  type="button"
                  className="review-bar-step"
                  onClick={() => stepProposal(1)}
                  aria-label="Next proposal"
                >›</button>
                {([
                  ['approved', Trash2, 'Cut it'],
                  ['rejected', X, 'Keep it'],
                  ['revise', MessageSquarePlus, 'Say what is wrong']
                ] as const).map(([verdict, Icon, label]) => (
                  <button
                    key={verdict}
                    type="button"
                    className={`review-bar-verdict review-${
                      verdict === 'approved' ? 'yes' : verdict === 'rejected' ? 'no' : 'maybe'
                    }`}
                    data-on={notes[focusId]?.verdict === verdict || undefined}
                    title={label}
                    aria-label={`${label} — ${suggested[focusId].label}`}
                    onClick={() => decide(
                      {
                        id: focusId,
                        label: suggested[focusId].label,
                        reason: suggested[focusId].reason,
                        layout
                      },
                      verdict,
                      document.querySelector(`[data-review-id="${focusId}"]`)
                    )}
                  >
                    <Icon className="size-3.5" />
                  </button>
                ))}
              </span>
            ) : null}

            {dock.dir === 'wide' ? (
              <span
                className="review-tools-grip"
                aria-hidden="true"
                onPointerDown={(event) => {
                  event.stopPropagation();
                  const rect = dockRef.current?.getBoundingClientRect();
                  if (!rect) return;
                  sizeDrag.current = { x: event.clientX, from: rect.width };
                }}
              />
            ) : null}

          </div>
        ) : null}

        {/* A second floor rather than a longer bar: the extras drop below the
            toolbar, in their own strip, so the bar itself never changes
            length and nothing has to scroll to reach them. */}
        <div className="review-tools-tray" data-open={moreOpen || undefined}>
            <button
              type="button"
              data-label="Tidy up"
              data-key="layout"
              title="Tidy up — everything back to its default place"
              aria-label="Put the console furniture back in its default places"
              onClick={tidy}
            >
              <Sparkles className="size-[18px]" />
            </button>

            <button
              type="button"
              data-on={dock.help || undefined}
              data-label="Keys"
              data-key="?"
              title="Show the key card"
              aria-label="Show or hide the key card"
              onClick={() => setDock((current) => ({ ...current, help: !current.help }))}
            >
              <Keyboard className="size-[18px]" />
            </button>

            <button
              type="button"
              data-on={attached === 'with' || undefined}
              data-label={attached === 'with' ? 'Unclip stashes' : 'Clip stashes on'}
              data-key={attached === 'with' ? 'move together' : 'move apart'}
              aria-label="Clip the stashes to the toolbar, or set them loose"
              title={attached === 'with' ? 'Unclip the stashes' : 'Clip the stashes to the toolbar'}
              onClick={() => setDock((current) => ({
                ...current,
                stash: attached === 'with' ? 'free' : 'with'
              }))}
            >
              {attached === 'with'
                ? <Unlink className="size-[18px]" />
                : <Link2 className="size-[18px]" />}
            </button>

            </div>

        {/* Clipped on: the shelves are part of the same object as the toolbar,
            and the drag on the dock moves the pair. */}
        {open && attached === 'with' ? (
          <div className="review-dock-stash">{shelves}</div>
        ) : null}

        {/* Its own object, not a tool: this is the way in and the way out of
            the console, so it never sits among the things the console does. */}
        <span className="review-fab-wrap">
        <button
          type="button"
          className="review-fab"
          data-open={open || undefined}
          aria-expanded={open}
          onClick={() => { setOpen(!open); if (open) { setMode('off'); setPicked(null); } }}
        >
          {/* The handle lives inside the capsule rather than beside it: two
              chips for one object was one chip too many. */}
          {open ? (
            <span
              className="review-part-grip review-fab-grip"
              onPointerDown={(event) => startRearrange('fab', event)}
              title="Drag to reorder"
            >
              <GripVertical className="size-3.5" />
            </span>
          ) : null}
          {open ? <Check className="size-4" /> : <NotebookPen className="size-5" />}
          <span>
            {open ? 'Done' : 'Review'}
            {!open && openCount ? ` · ${openCount}` : ''}
            <kbd>{open ? 'esc' : '⌘R'}</kbd>
          </span>
        </button>
        </span>

        {/* Silent by default. The tools carry their own names on hover and the
            badge carries the count, so prose here would only be repeating
            them — the card is opt-in, from the ? in the title bar. */}
        {open && dock.help ? (
          <div className="review-help" data-review-ui>
            <p className="review-help-now">
              {mode === 'pick'
                ? picked
                  ? '↑ wider · ↓ narrower · ←/→ along the row · shift+arrow stashes'
                  : 'Click anything on the page, or drag it to an edge to stash it'
                : mode === 'audit'
                  ? '✓ cut it · ✗ keep it · 💬 say what is wrong'
                  : mode === 'variants'
                    ? 'Flip between the alternatives, then keep one'
                    : 'Pick works on anything · Audit walks the cuts I proposed'}
            </p>
            <span><kbd>⌘R</kbd> console</span>
            <span><kbd>a</kbd> audit</span>
            <span><kbd>p</kbd> pick</span>
            <span><kbd>n</kbd> note</span>
            <span><kbd>f</kbd> flag</span>
            <span><kbd>u</kbd> undo</span>
            <span><kbd>[</kbd><kbd>]</kbd> step</span>
            <span><kbd>←</kbd><kbd>→</kbd><kbd>↑</kbd><kbd>↓</kbd> shelves</span>
            <span data-on={hiddenTrays.length ? true : undefined}>
              <kbd>h</kbd> {hiddenTrays.length ? `${hiddenTrays.length} hidden` : 'all shelves'}
            </span>
          </div>
        ) : null}

      </div>
    </ReviewContext.Provider>
  );
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


