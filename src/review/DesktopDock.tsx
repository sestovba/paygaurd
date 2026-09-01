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
  Archive, ChevronRight, Columns2, EyeOff, MousePointerSquareDashed,
  NotebookPen, SlidersHorizontal, Trash2, Undo2, X
} from 'lucide-react';
import type { ReviewMode } from './context';
import { Fold, Tool } from './DockParts';

const WIDTH_KEY = 'pg-review-rail-v1';
const MIN_WIDTH = 300;
const MAX_WIDTH = 560;

function loadWidth(): number {
  try {
    const saved = Number(localStorage.getItem(WIDTH_KEY));
    return saved >= MIN_WIDTH && saved <= MAX_WIDTH ? saved : 380;
  } catch {
    return 380;
  }
}

export function DesktopDock({
  open,
  onToggle,
  onClose,
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
  const [width, setWidth] = useState(loadWidth);
  const [toolsOpen, setToolsOpen] = useState(true);
  const drag = useRef<{ x: number; from: number } | null>(null);

  useEffect(() => {
    try {
      localStorage.setItem(WIDTH_KEY, String(width));
    } catch {
      // Private mode; the rail just starts at its default width next time.
    }
  }, [width]);

  /* The page is laid out beside the rail rather than under it, so the app can
     be judged at the width it actually has. A console that covers the thing
     it is reviewing is not reviewing it.
   *
   * Set on the element, not through a stylesheet: this has to beat whatever
   * the app's own CSS says about the padding of its root, and every layer it
   * says it in. It is one property on one element, and it is put back when
   * the rail folds away. */
  useEffect(() => {
    const inset = open && !journalWide ? `${width}px` : '';
    document.body.style.setProperty('padding-right', inset, 'important');
    document.documentElement.style.setProperty('--review-rail-w', inset || '0px');
    return () => {
      document.body.style.removeProperty('padding-right');
      document.documentElement.style.removeProperty('--review-rail-w');
    };
  }, [open, width, journalWide]);

  useEffect(() => {
    const onMove = (event: PointerEvent) => {
      const held = drag.current;
      if (!held) return;
      event.preventDefault();
      setWidth(Math.min(MAX_WIDTH, Math.max(MIN_WIDTH, held.from + (held.x - event.clientX))));
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
  }, []);

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
        <NotebookPen className="size-4" />
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
      data-wide={journalWide || undefined}
      style={journalWide ? undefined : { width }}
    >
      {/* Drag the edge to give the rail more or less of the screen. The page
          reflows to what is left, so this is a real split, not an overlay. */}
      {journalWide ? null : (
        <span
          className="review-rail-grip"
          aria-hidden="true"
          onPointerDown={(event) => { drag.current = { x: event.clientX, from: width }; }}
        />
      )}

      <header className="review-rail-head">
        <NotebookPen className="size-4" />
        <strong>Review</strong>
        {mode !== 'off' ? (
          <span className="review-rail-mode">
            {mode === 'audit' ? 'Audit' : mode === 'pick' ? 'Select' : 'A / B'}
          </span>
        ) : null}
        {journalNew ? <span className="review-rail-count" data-new>{journalNew} new</span>
          : openCount ? <span className="review-rail-count">{openCount}</span> : null}
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
          onToggle={() => setToolsOpen((current) => !current)}
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
          icon={NotebookPen}
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
