// The console's rail: a strip down the right of the screen that the page is
// laid out beside, never on top of.
//
// This replaces DesktopDock (621 lines) and MobileDock (236), which between
// them carried three dock edges, drag grips to reorder the panels, per-panel
// folds, draggable column splitters, a wide mode that hid the app behind the
// tool reviewing it, and per-screen size clamping. None of that was a
// decision about the product; all of it was state to maintain twice.
//
// What is left is one edge, one resize handle, and the two things you
// actually reach for.

import { useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import {
  ChevronDown, Copy, Crosshair, LayoutGrid, MessageSquarePlus, Monitor, Moon,
  ScanSearch, Sun, Undo2, X
} from 'lucide-react';
import type { ComponentType } from 'react';
import type { ReviewMode } from './context';
import { useTracker } from '../state/TrackerProvider';
import { LAYOUT_GROUPS } from '../components/LayoutSwitcher';

const RAIL_KEY = 'pg-review-rail-v2';
const MIN = 300;
const MAX = 720;
/** What the page keeps for itself, whatever the rail was dragged to. A width
 *  remembered from a monitor must not swallow a laptop. */
const PAGE_FLOOR = 420;

const THEMES: [string, ComponentType<{ className?: string }>, string][] = [
  ['light', Sun, 'Light'],
  ['dark', Moon, 'Dark'],
  ['system', Monitor, 'System']
];

function loadSize(): number {
  const saved = Number(localStorage.getItem(RAIL_KEY));
  return Number.isFinite(saved) && saved >= MIN ? saved : 380;
}

export function ReviewDock({
  open,
  onToggle,
  mode,
  onMode,
  onSay,
  counts,
  undoDepth,
  onUndo,
  onCopy,
  children
}: {
  open: boolean;
  onToggle: () => void;
  mode: ReviewMode;
  onMode: (next: ReviewMode) => void;
  onSay: () => void;
  counts: { yours: number; sent: number; replies: number };
  undoDepth: number;
  onUndo: () => void;
  onCopy: () => void;
  children: ReactNode;
}) {
  const { ui, setUi } = useTracker();
  const [size, setSize] = useState(loadSize);
  const [menuOpen, setMenuOpen] = useState(false);
  const drag = useRef<{ at: number; from: number } | null>(null);

  const width = Math.min(size, Math.max(MIN, window.innerWidth - PAGE_FLOOR));

  useEffect(() => {
    localStorage.setItem(RAIL_KEY, String(size));
  }, [size]);

  /* The page is laid out beside the rail rather than under it, so the app can
     be judged at the width it actually has. Set on the element because it has
     to beat whatever the app's own CSS says about the padding of its root. */
  useEffect(() => {
    const inset = open ? `${width}px` : '';
    document.body.style.setProperty('padding-right', inset, 'important');
    document.documentElement.style.setProperty('--review-rail-right', inset || '0px');
    return () => {
      document.body.style.removeProperty('padding-right');
      document.documentElement.style.removeProperty('--review-rail-right');
    };
  }, [open, width]);

  useEffect(() => {
    const onMove = (event: PointerEvent) => {
      const held = drag.current;
      if (!held) return;
      event.preventDefault();
      setSize(Math.min(MAX, Math.max(MIN, held.from + (held.at - event.clientX))));
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

  // A menu that stays open after you have looked away is a menu you have to
  // close on purpose.
  useEffect(() => {
    if (!menuOpen) return;
    const shut = (event: Event) => {
      if (!(event.target as HTMLElement)?.closest?.('.review-rail-sides')) setMenuOpen(false);
    };
    const onKey = (event: KeyboardEvent) => { if (event.key === 'Escape') setMenuOpen(false); };
    window.addEventListener('pointerdown', shut, true);
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('pointerdown', shut, true);
      window.removeEventListener('keydown', onKey);
    };
  }, [menuOpen]);

  if (!open) {
    return (
      <button
        type="button"
        data-review-ui
        className="review-rail-tab"
        data-side="right"
        onClick={onToggle}
        aria-label="Open the review console"
      >
        <ScanSearch className="size-4" />
        <span>Review</span>
        {counts.replies ? <span className="review-rail-count" data-new>{counts.replies}</span>
          : counts.yours ? <span className="review-rail-count">{counts.yours}</span> : null}
        <kbd>⌘R</kbd>
      </button>
    );
  }

  return (
    <aside data-review-ui className="review-rail" data-side="right" style={{ width }}>
      <span
        className="review-rail-grip"
        aria-hidden="true"
        onPointerDown={(event) => { drag.current = { at: event.clientX, from: width }; }}
      />

      <header className="review-rail-head">
        <ScanSearch className="size-4" />
        <strong>Review</strong>
        {counts.sent ? <span className="review-rail-count">{counts.sent} sent</span> : null}
        {counts.replies ? <span className="review-rail-count" data-new>{counts.replies} new</span> : null}

        <button
          type="button"
          className="review-rail-undo"
          disabled={!undoDepth}
          onClick={onUndo}
          title={undoDepth ? `Undo · u · ${undoDepth} back` : 'Nothing to undo'}
          aria-label="Undo the last change"
        >
          <Undo2 className="size-3.5" />
          {undoDepth ? <span>{undoDepth}</span> : null}
        </button>

        <button
          type="button"
          className="review-rail-undo"
          onClick={onCopy}
          title="Copy the whole report as a prompt"
          aria-label="Copy review report"
        >
          <Copy className="size-3.5" />
        </button>

        {/* Layout and theme. The list comes from the app's own switcher rather
            than a copy kept here: this menu used to hold six of the ten
            layouts, including Plan, and nobody could tell by looking. */}
        <span className="review-rail-sides">
          <button
            type="button"
            className="review-rail-side-now"
            aria-haspopup="menu"
            aria-expanded={menuOpen}
            aria-label="Layout and theme"
            title="Layout · theme"
            onClick={() => setMenuOpen((current) => !current)}
          >
            <LayoutGrid className="size-3.5" />
            <ChevronDown className="size-3" />
          </button>

          {menuOpen ? (
            <span className="review-rail-side-menu" role="menu">
              {LAYOUT_GROUPS.map((group) => (
                <span key={group.title} className="review-rail-menu-group">
                  <span className="review-rail-menu-label">{group.title}</span>
                  {group.options.map((option) => (
                    <button
                      key={option.id}
                      type="button"
                      role="menuitemradio"
                      aria-checked={ui.layout === option.id}
                      data-on={ui.layout === option.id || undefined}
                      title={option.description}
                      onClick={() => { setMenuOpen(false); setUi({ layout: option.id }); }}
                    >
                      <LayoutGrid className="size-3.5" />
                      {option.label}
                    </button>
                  ))}
                </span>
              ))}

              <span className="review-rail-menu-label">Theme</span>
              {THEMES.map(([which, Icon, name]) => (
                <button
                  key={which}
                  type="button"
                  role="menuitemradio"
                  aria-checked={ui.theme === which}
                  data-on={ui.theme === which || undefined}
                  onClick={() => { setMenuOpen(false); setUi({ theme: which as typeof ui.theme }); }}
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
          className="review-rail-close"
          onClick={onToggle}
          aria-label="Close the review console"
          title="Close · ⌘R"
        >
          <X className="size-4" />
        </button>
      </header>

      {/* Two verbs. Point at a thing, or say something about the thing you
          are pointing at — the whole tool, in the order you reach for it. */}
      <div className="review-rail-tools review-dock-bar" role="toolbar" aria-label="Review tools">
        <button
          type="button"
          className="review-dock-tool"
          data-on={mode === 'pick' || undefined}
          aria-pressed={mode === 'pick'}
          title="Point · l"
          onClick={() => onMode(mode === 'pick' ? 'off' : 'pick')}
        >
          <span className="review-dock-icon"><Crosshair className="size-[18px]" /></span>
          <span className="review-dock-name">Point</span>
          <kbd className="review-dock-key">l</kbd>
        </button>
        <button
          type="button"
          className="review-dock-tool"
          title="Say · c"
          onClick={onSay}
        >
          <span className="review-dock-icon"><MessageSquarePlus className="size-[18px]" /></span>
          <span className="review-dock-name">Say</span>
          <kbd className="review-dock-key">c</kbd>
        </button>
      </div>

      <div className="review-rail-body">{children}</div>

      <footer className="review-rail-foot">
        <code>review/REVIEW-NOTES.md</code>
      </footer>
    </aside>
  );
}
