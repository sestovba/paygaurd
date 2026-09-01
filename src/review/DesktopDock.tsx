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

import { useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import {
  Archive, ChevronDown, ChevronRight, Columns2, EyeOff, ListChecks,
  MousePointerSquareDashed, PanelBottom, PanelLeft, PanelRight, ScanSearch,
  SlidersHorizontal, Trash2, Undo2, X
} from 'lucide-react';
import type { ReviewMode } from './context';
import { Fold, Tool } from './DockParts';

const RAIL_KEY = 'pg-review-rail-v1';

/** Which edge the console is welded to. Not a floating panel: it takes a
 *  strip of the screen and the page takes the rest, whichever edge it is on,
 *  so nothing ever sits on top of the thing under review. */
type Side = 'right' | 'left' | 'bottom';

interface Rail {
  side: Side;
  /** Width when it is down a side, height when it is along the bottom. */
  size: number;
}

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

function loadRail(): Rail {
  try {
    const raw = localStorage.getItem(RAIL_KEY);
    if (!raw) return { side: 'right', size: LIMITS.right.start };
    // The key used to hold a bare width.
    const saved = raw.startsWith('{') ? JSON.parse(raw) as Partial<Rail> : { size: Number(raw) };
    const side: Side = saved.side === 'left' || saved.side === 'bottom' ? saved.side : 'right';
    const { min, max, start } = LIMITS[side];
    const size = Number(saved.size);
    return { side, size: size >= min && size <= max ? size : start };
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
  openCount,
  mode,
  onMode,
  auditTotal,
  auditSettled,
  variants,
  undoDepth,
  onUndo,
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
  /** Kept by the console so it survives a reload, like every other panel. */
  toolsOpen: boolean;
  onTools: (next: boolean) => void;
  openCount: number;
  mode: ReviewMode;
  onMode: (next: ReviewMode) => void;
  auditTotal: number;
  auditSettled: number;
  variants: number;
  undoDepth: number;
  onUndo: () => void;
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
  const [rail, setRail] = useState(loadRail);
  const { side, size } = rail;
  const flat = side === 'bottom';
  const drag = useRef<{ at: number; from: number } | null>(null);
  const [sidesOpen, setSidesOpen] = useState(false);

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

  if (!open) {
    return (
      <button
        type="button"
        data-review-ui
        className="review-rail-tab"
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
        <ScanSearch className="size-4" />
        <strong>Review</strong>
        {mode !== 'off' ? (
          <span className="review-rail-mode">
            {mode === 'audit' ? 'Audit' : mode === 'pick' ? 'Select' : 'A / B'}
          </span>
        ) : null}
        {journalNew ? <span className="review-rail-count" data-new>{journalNew} new</span>
          : openCount ? <span className="review-rail-count">{openCount}</span> : null}

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
            aria-label={`Docked ${side === 'bottom' ? 'along the bottom' : `on the ${side}`} — change`}
            title={side === 'bottom' ? 'Along the bottom' : `On the ${side}`}
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
              {SIDES.map(([which, Icon, name]) => (
                <button
                  key={which}
                  type="button"
                  role="menuitemradio"
                  aria-checked={side === which}
                  data-on={side === which || undefined}
                  onClick={() => {
                    setSidesOpen(false);
                    setRail((current) => (current.side === which
                      ? current
                      : { side: which, size: LIMITS[which].start }));
                  }}
                >
                  <Icon className="size-3.5" />
                  {name}
                </button>
              ))}
            </span>
          ) : null}
        </span>

        <button
          type="button"
          className="review-rail-min"
          onClick={onToggle}
          title="Fold the rail away — the review keeps running"
          aria-label="Fold the review rail away"
        >
          <ChevronRight className="size-4" />
        </button>
      </header>

      <div className="review-rail-body">
        <Fold
          icon={SlidersHorizontal}
          name="Tools"
          tone="glass"
          hint={mode === 'off' ? undefined
            : mode === 'audit' ? 'Audit' : mode === 'pick' ? 'Select' : 'A / B'}
          open={toolsOpen}
          onToggle={() => onTools(!toolsOpen)}
        >
          <div className="review-dock-bar">
            <Tool
              icon={Trash2}
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
              icon={Undo2}
              label="Undo"
              hint="u"
              disabled={!undoDepth}
              badge={undoDepth || undefined}
              onClick={onUndo}
            />
            <Tool icon={X} label="Done" hint="esc" onClick={onClose} />
          </div>
        </Fold>

        <Fold
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

        <Fold
          icon={EyeOff}
          name="Hidden"
          tone="glass"
          count={hiddenCount}
          open={hiddenOpen}
          onToggle={() => onHidden(!hiddenOpen)}
        >
          {hiddenList}
        </Fold>

        <Fold
          icon={Archive}
          name="Archive"
          tone="glass"
          count={stashCount}
          open={stashOpen}
          onToggle={() => onStash(!stashOpen)}
        >
          {shelves}
        </Fold>
      </div>
    </aside>
  );
}
