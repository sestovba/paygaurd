// The console on a phone: one dock, stuck to the bottom edge, with the
// console's two rooms folded into it as accordions.
//
// Nothing here floats. A palette that hovers over the page, comes apart into
// three pieces and is dragged around by its title bands is a mouse object;
// on a 375px screen it covers the thing under review and every one of its
// gestures fights the browser for the same touch. So: a tab you can always
// reach, a row of verbs when it is open, and Journal and Archive as folds
// that open in place instead of as windows that land on top of the page.

import { useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import {
  Archive, ChevronUp, Columns2, EyeOff, MousePointerSquareDashed, NotebookPen,
  SlidersHorizontal, Trash2, Undo2, X
} from 'lucide-react';
import type { ReviewMode } from './context';
import { Fold, Tool } from './DockParts';

export function MobileDock({
  open,
  onToggle,
  onClose,
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
  /** Open means the dock is showing its contents. Shut, the tab is still
   *  there — on a phone it is the only way into the console. */
  open: boolean;
  onToggle: () => void;
  onClose: () => void;
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
  /** Replies that came back since the journal was last read. This is news,
   *  not a total, so it outranks the count wherever the two compete. */
  journalNew: number;
  /** The journal's contents, built by the console — the same thing the
   *  desktop window shows, in a fold instead of a frame. */
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
  const rootRef = useRef<HTMLDivElement>(null);
  /** Folded to its tab with the review still running. Distinct from the
   *  console being off: Done ends the review, this just gets the dock out of
   *  the way of the screen it is reviewing. */
  const [min, setMin] = useState(false);
  /** The Review section — the verbs — starts open: you opened the dock to
   *  do something with them. It folds away like every other section. */
  const [toolsOpen, setToolsOpen] = useState(true);
  /** The journal filling the dock. Reading a thread in a 42vh slot on a
   *  phone is reading through a letterbox. */
  const [journalBig, setJournalBig] = useState(false);
  const shown = open && !min;

  // A console that was shut and reopened starts on its feet, not folded.
  useEffect(() => { if (!open) setMin(false); }, [open]);

  /* The dock stands in front of the app's own bottom furniture, so the page
     needs to know how much of itself is behind it. */
  useEffect(() => {
    const el = rootRef.current;
    const root = document.documentElement;
    if (!el) return;
    const sync = () => root.style.setProperty('--review-mdock-h', `${el.offsetHeight}px`);
    sync();
    const observer = new ResizeObserver(sync);
    observer.observe(el);
    return () => {
      observer.disconnect();
      root.style.removeProperty('--review-mdock-h');
    };
  }, []);

  const auditLeft = auditTotal - auditSettled;

  return (
    <div ref={rootRef} data-review-ui className="review-mdock" data-open={shown || undefined}>
      {/* The tab: a chevron in the corner, and nothing else. It is the way
          in when the dock is down, and the way to put everything down when
          it is up — one control, in the one place it is always found. */}
      <div className="review-mdock-tab" data-band={shown || undefined}>
        <button
          type="button"
          className="review-mdock-min"
          aria-expanded={shown}
          aria-label={shown ? 'Minimise the review dock' : 'Open the review dock'}
          title={shown ? 'Minimise everything' : 'Review'}
          onClick={() => {
            if (!open) { onToggle(); setMin(false); setToolsOpen(true); return; }
            if (!shown) { setMin(false); setToolsOpen(true); return; }
            setToolsOpen(false);
            onJournal(false);
            onStash(false);
            onHidden(false);
            setJournalBig(false);
            setMin(true);
          }}
        >
          <ChevronUp className="size-4 review-mdock-caret" />
          {/* Down to a chevron, the console still has to be able to say that
              an answer came back. A dot is the smallest way to say it. */}
          {journalNew ? <span className="review-mdock-dot" /> : null}
        </button>
      </div>

      {shown ? (
        <div className="review-mdock-body">
          {/* The verbs — what you do to the page. A fold like the others:
              nothing in this dock is fixed furniture that cannot be got out
              of the way. */}
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
                on={mode === 'audit'}
                badge={auditTotal ? (auditLeft || '✓') : undefined}
                badgeDone={auditTotal > 0 && auditLeft === 0}
                onClick={() => onMode(mode === 'audit' ? 'off' : 'audit')}
              />
              <Tool
                icon={MousePointerSquareDashed}
                label="Select"
                on={mode === 'pick'}
                onClick={() => onMode(mode === 'pick' ? 'off' : 'pick')}
              />
              {variants ? (
                <Tool
                  icon={Columns2}
                  label="A / B"
                  on={mode === 'variants'}
                  badge={variants}
                  onClick={() => onMode(mode === 'variants' ? 'off' : 'variants')}
                />
              ) : null}
              <Tool
                icon={Undo2}
                label="Undo"
                disabled={!undoDepth}
                badge={undoDepth || undefined}
                onClick={onUndo}
              />
              <Tool icon={X} label="Done" onClick={onClose} />
            </div>
          </Fold>

          {/* Each fold answers to itself. Minimising everything is one
              control, top right of the tab, and it is not this. */}
          <Fold
            icon={NotebookPen}
            name="Journal"
            tone="paper"
            count={journalCount}
            news={journalNew}
            open={journalOpen}
            onToggle={() => onJournal(!journalOpen)}
            big={journalBig}
            onBig={() => setJournalBig((current) => !current)}
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
      ) : null}
    </div>
  );
}
