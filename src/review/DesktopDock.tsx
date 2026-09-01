// The console on a desktop: a rail down the right-hand edge.
//
// What was here before was a palette that floated over the page, came apart
// into three draggable pieces, cycled through three shapes and hung four
// coloured shelves off the four screen edges. All of it sat on top of the
// thing under review — which is the one place a review tool must not be.
//
// A rail instead. It takes a column of the screen and gives it back when it
// is folded, the page keeps the rest, and nothing overlaps anything. The
// sections are the same ones the phone has, because they are the same rooms;
// what the desktop adds is room to work — a board that goes to columns when
// the journal is opened wide, and a key for everything.

import { Fragment, useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import {
  AlignLeft, Archive, ChevronDown, Clock, Columns2, EyeOff, ListChecks,
  MessageSquarePlus, Monitor, Moon, MousePointerSquareDashed, PanelBottom,
  PanelLeft, PanelRight, ScanSearch, Sun, Undo2, X
} from 'lucide-react';
import type { ReviewMode } from './context';
import { Fold, Tool, useReorder } from './DockParts';
import { useTracker } from '../state/TrackerProvider';

const RAIL_KEY = 'pg-review-rail-v1';

/** Which edge the console is welded to. Not a floating panel: it takes a
 *  strip of the screen and the page takes the rest, whichever edge it is on,
 *  so nothing ever sits on top of the thing under review. */
type Side = 'right' | 'left' | 'bottom';

interface Rail {
  side: Side;
  /** Width when it is down a side, height when it is along the bottom. */
  size: number;
  /** Along the bottom the panels sit side by side, and how much width each
   *  one wants is a matter of what you are doing — so the splits between
   *  them are yours to drag. Keyed by panel; the last open one takes what is
   *  left, so it never needs a width of its own. ("Column" is taken: the
   *  journal is a table and has columns of its own.) */
  cols?: Record<string, number>;
}

const MIN_COL = 170;

/** What the page keeps for itself, whatever the rail was dragged to. A rail
 *  remembered from a wide monitor must not swallow a laptop. */
const PAGE_FLOOR = 420;

const LIMITS: Record<Side, { min: number; max: number; start: number }> = {
  right: { min: 300, max: 640, start: 420 },
  left: { min: 300, max: 640, start: 420 },
  bottom: { min: 200, max: 640, start: 320 }
};

/* Left and right first — they are the two that read as the same choice, and
   putting bottom between them made picking one a step past the other. */
const SIDES = [
  ['left', PanelLeft, 'Left'],
  ['right', PanelRight, 'Right'],
  ['bottom', PanelBottom, 'Bottom']
] as const;

/* The console's own furniture never changes colour, on purpose — but the
   thing under review does, and light and dark are two different reviews.
   It shares the edge menu because both answer the same question, "how am I
   looking at this", and neither earns a control of its own in the bar. */
const THEMES = [
  ['system', Monitor, 'System'],
  ['light', Sun, 'Light'],
  ['dark', Moon, 'Dark']
] as const;

function loadRail(): Rail {
  try {
    const raw = localStorage.getItem(RAIL_KEY);
    if (!raw) return { side: 'right', size: LIMITS.right.start };
    // The key used to hold a bare width.
    const saved = raw.startsWith('{') ? JSON.parse(raw) as Partial<Rail> : { size: Number(raw) };
    const side: Side = saved.side === 'left' || saved.side === 'bottom' ? saved.side : 'right';
    const { min, max, start } = LIMITS[side];
    const size = Number(saved.size);
    const cols = saved.cols && typeof saved.cols === 'object' ? saved.cols : {};
    return { side, size: size >= min && size <= max ? size : start, cols };
  } catch {
    return { side: 'right', size: LIMITS.right.start };
  }
}

export function DesktopDock({
  open,
  onToggle,
  onClose,
  toolsOpen,
  onTools,
  commentsOpen,
  onComments,
  commentsCount,
  commentsList,
  order,
  onOrder,
  openCount,
  mode,
  onMode,
  commenting,
  onCommentMode,
  auditTotal,
  auditSettled,
  variants,
  undoDepth,
  onUndo,
  onStepProposal,
  journalOpen,
  onJournal,
  journalCount,
  journalNew,
  journalWide,
  onJournalWide,
  journal,
  stashOpen,
  onStash,
  stashCount,
  shelves,
  hiddenOpen,
  onHidden,
  hiddenCount,
  hiddenList
}: {
  open: boolean;
  onToggle: () => void;
  onClose: () => void;
  /** The verbs fold like every other room. They are never far — the keys
   *  still work with the column shut — but nothing in the console is fixed
   *  furniture you cannot get out of the way. */
  toolsOpen: boolean;
  onTools: (next: boolean) => void;
  /** Dedicated comments section */
  commentsOpen: boolean;
  onComments: (next: boolean) => void;
  commentsCount: number;
  commentsList: ReactNode;
  /** The sections, in the order they are stacked. Dragged by their grips and
   *  kept by the console, so the rail stays arranged the way you left it. */
  order: string[];
  onOrder: (next: string[]) => void;
  openCount: number;
  mode: ReviewMode;
  onMode: (next: ReviewMode) => void;
  /** Select is the precision tool; Comment is the fast path that borrows its
   *  hit-testing and opens the note card on the very next click. They share a
   *  mode, so only one of them is ever lit. */
  commenting: boolean;
  onCommentMode: () => void;
  auditTotal: number;
  auditSettled: number;
  variants: number;
  undoDepth: number;
  onUndo: () => void;
  onStepProposal?: (direction: 1 | -1) => void;
  journalOpen: boolean;
  onJournal: (next: boolean) => void;
  journalCount: number;
  journalNew: number;
  /** The board spread into columns across most of the screen. Desktop only:
   *  it is the one thing here a phone genuinely cannot do. */
  journalWide: boolean;
  onJournalWide: (next: boolean) => void;
  journal: ReactNode;
  stashOpen: boolean;
  onStash: (next: boolean) => void;
  stashCount: number;
  shelves: ReactNode;
  /** Switched off on the page. Its own room — the archive is for things
   *  carried away, this is for lights left off. */
  hiddenOpen: boolean;
  onHidden: (next: boolean) => void;
  hiddenCount: number;
  hiddenList: ReactNode;
}) {
  const { ui, setUi } = useTracker();
  const [rail, setRail] = useState(loadRail);
  const [room, setRoom] = useState(() => ({ w: window.innerWidth, h: window.innerHeight }));
  const { side } = rail;
  const flat = side === 'bottom';
  /* Clamped for this screen, not saved clamped: drag it wide on a monitor,
     come back on a laptop, and it fits — then go back to the monitor and it
     is wide again. */
  const size = flat
    ? Math.min(rail.size, Math.max(LIMITS.bottom.min, room.h - 220))
    : Math.min(rail.size, Math.max(LIMITS[side].min, room.w - PAGE_FLOOR));

  useEffect(() => {
    const onResize = () => setRoom({ w: window.innerWidth, h: window.innerHeight });
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);
  const drag = useRef<{ at: number; from: number } | null>(null);
  const [sidesOpen, setSidesOpen] = useState(false);
  // Down a side the sections stack, so they are sorted top to bottom; along
  // the bottom they sit in a row, and the same drag has to read left to right.
  /* The verbs are a room again — a column at the head of the row rather than
     a band across the top of it — so they are in the stack with the rest,
     dragged by the same grip and folded by the same chevron. */
  const panelOrder = order;
  const sort = useReorder(panelOrder, onOrder, flat ? 'x' : 'y');
  /** The split being dragged: which section is growing or shrinking, and how
   *  wide it was when the drag started. */
  const split = useRef<{ key: string; at: number; from: number } | null>(null);

  useEffect(() => {
    const onMove = (event: PointerEvent) => {
      const held = split.current;
      if (!held) return;
      event.preventDefault();
      const room = sort.rootRef.current?.getBoundingClientRect().width ?? window.innerWidth;
      const width = Math.max(MIN_COL, Math.min(held.from + (event.clientX - held.at), room - MIN_COL));
      setRail((current) => ({ ...current, cols: { ...current.cols, [held.key]: width } }));
    };
    const stop = () => { split.current = null; };
    window.addEventListener('pointermove', onMove, { passive: false });
    window.addEventListener('pointerup', stop);
    window.addEventListener('pointercancel', stop);
    return () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', stop);
      window.removeEventListener('pointercancel', stop);
    };
  }, []);

  // A menu that stays open after you have looked away is a menu you have to
  // close on purpose.
  useEffect(() => {
    if (!sidesOpen) return;
    const shut = (event: Event) => {
      if (!(event.target as HTMLElement)?.closest?.('.review-rail-sides')) setSidesOpen(false);
    };
    const onKey = (event: KeyboardEvent) => { if (event.key === 'Escape') setSidesOpen(false); };
    window.addEventListener('pointerdown', shut, true);
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('pointerdown', shut, true);
      window.removeEventListener('keydown', onKey);
    };
  }, [sidesOpen]);

  useEffect(() => {
    try {
      localStorage.setItem(RAIL_KEY, JSON.stringify(rail));
    } catch {
      // Private mode; the rail starts on its default edge next time.
    }
  }, [rail]);

  /* The page is laid out beside the rail rather than under it, so the app can
     be judged at the width it actually has. A console that covers the thing
     it is reviewing is not reviewing it.
   *
   * Set on the element, not through a stylesheet: this has to beat whatever
   * the app's own CSS says about the padding of its root, and every layer it
   * says it in. It is one property on one element, and it is put back when
   * the rail folds away. */
  useEffect(() => {
    const inset = open && !journalWide ? `${size}px` : '';
    const edge = side === 'bottom' ? 'padding-bottom' : `padding-${side}`;
    document.body.style.setProperty(edge, inset, 'important');
    document.documentElement.style.setProperty('--review-rail-w', inset || '0px');
    return () => {
      document.body.style.removeProperty(edge);
      document.documentElement.style.removeProperty('--review-rail-w');
    };
  }, [open, size, side, journalWide]);

  useEffect(() => {
    const onMove = (event: PointerEvent) => {
      const held = drag.current;
      if (!held) return;
      event.preventDefault();
      // Dragging the inner edge always makes the rail bigger when it moves
      // away from the edge the rail is welded to.
      const now = flat ? event.clientY : event.clientX;
      const grew = side === 'left' ? now - held.at : held.at - now;
      const { min, max } = LIMITS[side];
      setRail((current) => ({
        ...current,
        size: Math.min(max, Math.max(min, held.from + grew))
      }));
    };
    const stop = () => { drag.current = null; };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', stop);
    window.addEventListener('pointercancel', stop);
    return () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', stop);
      window.removeEventListener('pointercancel', stop);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [side, flat]);

  const auditLeft = auditTotal - auditSettled;
  /** The last open panel takes whatever is left, so it never needs a width
   *  of its own — and the row always adds up however the others are dragged. */
  const colStyle = (key: string) => {
    if (!flat || !isOpen(key)) return undefined;
    const openKeys = panelOrder.filter(isOpen);
    if (key === openKeys[openKeys.length - 1]) return undefined;
    const width = rail.cols?.[key];
    if (!width) return undefined;
    // Two open panels at least, so a remembered width can never leave the
    // one after it with nothing.
    const share = Math.max(MIN_COL, Math.min(width, room.w - MIN_COL * 2));
    return { flex: `0 0 ${share}px` };
  };

  const isOpen = (key: string) => (
    key === 'tools' ? toolsOpen
      : key === 'comments' ? commentsOpen
        : key === 'journal' ? journalOpen
          : key === 'hidden' ? hiddenOpen
            : key === 'archive' ? stashOpen : false
  );

  const sections: Record<string, ReactNode> = {
    /* The verbs — what you do to the page rather than to any one room. A
       fold like the others: the keys still work with the column shut, so
       folding it costs nothing but the width it was taking. */
    tools: (
      <Fold
        key="tools"
        section="tools"
        style={colStyle('tools')}
        onGrip={sort.grip('tools')}
        dragging={sort.dragging === 'tools'}
        icon={AlignLeft}
        name="Tools"
        tone="glass"
        hint={mode === 'off' && !commenting ? undefined
          : mode === 'audit' ? 'Audit'
            : commenting ? 'Comment'
              : mode === 'pick' ? 'Select' : 'A / B'}
        open={toolsOpen}
        onToggle={() => onTools(!toolsOpen)}
      >
            <div
              className="review-rail-tools review-dock-bar"
              role="toolbar"
              aria-label="Review tools"
            >
              <Tool
                icon={ScanSearch}
                label="Audit"
                hint="a"
                on={mode === 'audit'}
                badge={auditTotal ? (auditLeft || '✓') : undefined}
                badgeDone={auditTotal > 0 && auditLeft === 0}
                onClick={() => onMode(mode === 'audit' ? 'off' : 'audit')}
              />
              <Tool
                icon={MousePointerSquareDashed}
                label="Select"
                hint="p"
                on={mode === 'pick'}
                onClick={() => onMode(mode === 'pick' ? 'off' : 'pick')}
              />
              {variants ? (
                <Tool
                  icon={Columns2}
                  label="A / B"
                  hint="v"
                  on={mode === 'variants'}
                  badge={variants}
                  onClick={() => onMode(mode === 'variants' ? 'off' : 'variants')}
                />
              ) : null}
              <Tool
                icon={MessageSquarePlus}
                label="Comment"
                hint="c"
                on={commenting}
                onClick={onCommentMode}
              />
            </div>
      </Fold>
    ),

    comments: (
      <Fold
        key="comments"
        section="comments"
        style={colStyle('comments')}
        onGrip={sort.grip('comments')}
        dragging={sort.dragging === 'comments'}
        icon={MessageSquarePlus}
        name="My Comments"
        tone="paper"
        count={commentsCount}
        open={commentsOpen}
        onToggle={() => onComments(!commentsOpen)}
      >
        {commentsList}
      </Fold>
    ),

    journal: (
      <Fold
        key="journal"
        section="journal"
        style={colStyle('journal')}
        onGrip={sort.grip('journal')}
        dragging={sort.dragging === 'journal'}
        icon={ListChecks}
        name="Journal"
        tone="paper"
        count={journalCount}
        news={journalNew}
        open={journalOpen}
        onToggle={() => onJournal(!journalOpen)}
        big={journalWide}
        onBig={() => onJournalWide(!journalWide)}
      >
        {journal}
      </Fold>
    ),

    hidden: (
      <Fold
        key="hidden"
        section="hidden"
        style={colStyle('hidden')}
        onGrip={sort.grip('hidden')}
        dragging={sort.dragging === 'hidden'}
        icon={EyeOff}
        name="Hidden"
        tone="glass"
        count={hiddenCount}
        open={hiddenOpen}
        onToggle={() => onHidden(!hiddenOpen)}
      >
        {hiddenList}
      </Fold>
    ),

    archive: (
      <Fold
        key="archive"
        section="archive"
        style={colStyle('archive')}
        onGrip={sort.grip('archive')}
        dragging={sort.dragging === 'archive'}
        icon={Archive}
        name="Archive"
        tone="glass"
        count={stashCount}
        open={stashOpen}
        onToggle={() => onStash(!stashOpen)}
      >
        {shelves}
      </Fold>
    )
  };

  if (!open) {
    return (
      <button
        type="button"
        data-review-ui
        className="review-rail-tab"
        data-side={side}
        onClick={onToggle}
        aria-label="Open the review console"
      >
        <ScanSearch className="size-4" />
        <span>Review</span>
        {journalNew ? <span className="review-rail-count" data-new>{journalNew}</span>
          : openCount ? <span className="review-rail-count">{openCount}</span> : null}
        <kbd>⌘R</kbd>
      </button>
    );
  }

  return (
    <aside
      data-review-ui
      className="review-rail"
      data-side={side}
      data-wide={journalWide || undefined}
      style={journalWide ? undefined : flat ? { height: size } : { width: size }}
    >
      {/* Drag the edge to give the rail more or less of the screen. The page
          reflows to what is left, so this is a real split, not an overlay. */}
      {journalWide ? null : (
        <span
          className="review-rail-grip"
          aria-hidden="true"
          onPointerDown={(event) => {
            drag.current = { at: flat ? event.clientY : event.clientX, from: size };
          }}
        />
      )}

      <header className="review-rail-head">
        <Clock className="size-4" />
        <strong>Review</strong>
        {mode !== 'off' ? (
          <span className="review-rail-mode">
            {mode === 'audit' ? 'Audit' : mode === 'pick' ? 'Select' : 'A / B'}
          </span>
        ) : null}
        {mode === 'audit' && onStepProposal ? (
          <span className="review-rail-nav">
            <button
              type="button"
              className="review-rail-step"
              onClick={() => onStepProposal(-1)}
              title="Previous proposal (‹)"
            >
              ‹
            </button>
            <button
              type="button"
              className="review-rail-step"
              onClick={() => onStepProposal(1)}
              title="Next proposal (›)"
            >
              ›
            </button>
          </span>
        ) : null}
        {journalNew ? <span className="review-rail-count" data-new>{journalNew} new</span>
          : openCount ? <span className="review-rail-count">{openCount}</span> : null}

        <button
          type="button"
          className="review-rail-undo"
          disabled={!undoDepth}
          onClick={onUndo}
          title={undoDepth
            ? `Undo · u · ${undoDepth} step${undoDepth === 1 ? '' : 's'} back`
            : 'Nothing to undo'}
          aria-label="Undo the last change"
        >
          <Undo2 className="size-3.5" />
          {undoDepth ? <span>{undoDepth}</span> : null}
        </button>


        {/* Which edge it lives on. A menu rather than a row of three: the
            trigger wears the edge it is on, so the band shows the current
            state in one slot instead of three, and the other two are one
            press away. */}
        <span className="review-rail-sides">
          <button
            type="button"
            className="review-rail-side-now"
            aria-haspopup="menu"
            aria-expanded={sidesOpen}
            aria-label={`Dock edge and theme — docked ${side === 'bottom' ? 'along the bottom' : `on the ${side}`}`}
            title="Dock edge · theme"
            onClick={() => setSidesOpen((current) => !current)}
          >
            {(() => {
              const Now = SIDES.find(([which]) => which === side)?.[1] ?? PanelRight;
              return <Now className="size-3.5" />;
            })()}
            <ChevronDown className="size-3" />
          </button>

          {sidesOpen ? (
            <span className="review-rail-side-menu" role="menu">
              <span className="review-rail-menu-label">Edge</span>
              {SIDES.map(([which, Icon, name]) => (
                <button
                  key={which}
                  type="button"
                  role="menuitemradio"
                  aria-checked={side === which}
                  data-on={side === which || undefined}
                  onClick={() => {
                    setSidesOpen(false);
                    // The panel widths belong to the bottom edge, not to
                    // this visit to it: going away and coming back should
                    // find the row laid out the way it was left.
                    setRail((current) => (current.side === which
                      ? current
                      : { ...current, side: which, size: LIMITS[which].start }));
                  }}
                >
                  <Icon className="size-3.5" />
                  {name}
                </button>
              ))}

              <span className="review-rail-menu-label">Theme</span>
              {THEMES.map(([which, Icon, name]) => (
                <button
                  key={which}
                  type="button"
                  role="menuitemradio"
                  aria-checked={ui.theme === which}
                  data-on={ui.theme === which || undefined}
                  onClick={() => {
                    setSidesOpen(false);
                    setUi({ theme: which });
                  }}
                >
                  <Icon className="size-3.5" />
                  {name}
                </button>
              ))}
            </span>
          ) : null}
        </span>

        {/* The corner. There was a chevron here that folded the rail away
            and a Close in the tools that shut it — two controls, both of
            which put the console behind the same tab, one of which also let
            go of whatever mode you were in. One control, in the corner every
            close in every window has been in. */}
        <button
          type="button"
          className="review-rail-quit"
          onClick={onClose}
          title="Close · esc — the tab brings it back"
          aria-label="Close the review console"
        >
          <X className="size-4" />
        </button>
      </header>

      <div className="review-rail-body" ref={sort.rootRef}>
        {/* Along the bottom, a handle sits between each pair of open panels
            and drags the one on its left. Only between two open ones: a shut
            panel is a spine of its own name and has no width to give. */}
        {panelOrder.map((key, index) => {
          const previous = panelOrder.slice(0, index).reverse().find((other) => isOpen(other));
          const grip = flat && previous && isOpen(key) ? (
            <span
              key={`${key}-split`}
              className="review-panel-grip-x"
              aria-hidden="true"
              onPointerDown={(event) => {
                const box = sort.rootRef.current
                  ?.querySelector(`[data-section="${previous}"]`)
                  ?.getBoundingClientRect();
                split.current = { key: previous, at: event.clientX, from: box?.width ?? MIN_COL };
              }}
            />
          ) : null;
          return (
            <Fragment key={key}>
              {grip}
              {sections[key] ?? null}
            </Fragment>
          );
        })}
      </div>
    </aside>
  );
}
