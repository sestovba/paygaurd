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
  MoveVertical, ScanSearch, Smartphone, Squircle, Sun, Tablet, Undo2, X
} from 'lucide-react';
import type { ComponentType } from 'react';
import type { FrameSetup, ReviewMode } from './context';
import { useTracker } from '../state/TrackerProvider';
import { LAYOUT_GROUPS } from '../components/LayoutSwitcher';

const RAIL_KEY = 'pg-review-rail-v2';
const MIN = 300;
const MAX = 720;
/** What the page keeps for itself, whatever the rail was dragged to. A width
 *  remembered from a monitor must not swallow a laptop. */
const PAGE_FLOOR = 420;

/**
 * The devices the page can be reviewed at.
 *
 * Real dimensions in CSS pixels, not round numbers. The height matters as
 * much as the width and is the thing a narrow column could never give — this
 * app has ten rules keyed on `100dvh`, and a frame stretched to a desktop
 * window's height puts the fold where no phone has it, so everything below it
 * reads as visible when it is not.
 *
 * What the frame is: a real viewport. Media queries resolve against it, so
 * 640 and 1024 break where they actually break, and the app inside is the app.
 *
 * What it is not, and cannot be made into: Safari on a phone. It is the same
 * engine as this window, so font rasterisation, `env(safe-area-inset-*)` —
 * which the browser supplies and no stylesheet can fake — rubber-band
 * scrolling, the shrinking URL bar and iOS text inflation are all absent. For
 * those, open the dev server on the phone itself: `npm run dev:lan` prints a
 * LAN address, the console runs there too, and that is a real device.
 */
export interface Device {
  id: string;
  label: string;
  w: number;
  h: number;
  kind: 'phone' | 'tablet';
}

export const DEVICES: ReadonlyArray<Device> = [
  { id: 'se', label: 'iPhone SE', w: 375, h: 667, kind: 'phone' },
  { id: 'ip', label: 'iPhone 15/16', w: 393, h: 852, kind: 'phone' },
  { id: 'max', label: 'iPhone Pro Max', w: 440, h: 956, kind: 'phone' },
  { id: 'px', label: 'Pixel 7', w: 412, h: 915, kind: 'phone' },
  { id: 'mini', label: 'iPad mini', w: 744, h: 1133, kind: 'tablet' },
  { id: 'pad', label: 'iPad 11"', w: 834, h: 1194, kind: 'tablet' }
];

/** The two defaults the icon buttons snap to. A width found by dragging is
 *  worth keeping; getting back to a known device has to be one click. */
export const DEFAULT_PHONE = DEVICES.find((d) => d.id === 'ip')!;
export const DEFAULT_TABLET = DEVICES.find((d) => d.id === 'pad')!;

/** Which preset a size matches, or null when the width was dragged. */
export function deviceFor(w: number, h: number): Device | null {
  return DEVICES.find((device) => device.w === w && device.h === h) ?? null;
}

const THEMES: [string, ComponentType<{ className?: string }>, string][] = [
  ['light', Sun, 'Light'],
  ['dark', Moon, 'Dark'],
  ['system', Monitor, 'System']
];

/**
 * The device controls: which preset, how tall, and whether to round it off.
 *
 * The width is also draggable on the frame itself, and that is the control
 * that finds where a layout actually breaks — but a width arrived at by
 * dragging has to be one click away from a known device again, or every
 * session ends at some number nobody can reproduce. That is what the preset
 * list is for, and why it says "Custom" out loud rather than quietly showing
 * the nearest match.
 */
function FrameBar({
  frame,
  onFrame
}: {
  frame: FrameSetup;
  onFrame: (patch: Partial<FrameSetup>) => void;
}) {
  const preset = deviceFor(frame.w, frame.h);
  return (
    <div className="review-frame-bar" role="group" aria-label="Device">
      <select
        aria-label="Device preset"
        value={preset?.id ?? 'custom'}
        onChange={(event) => {
          const next = DEVICES.find((device) => device.id === event.currentTarget.value);
          if (next) onFrame({ w: next.w, h: next.h });
        }}
      >
        {/* Names only. The readout beside this already carries the numbers,
            and repeating them here just truncates the name in a narrow rail. */}
        {preset ? null : <option value="custom">Custom</option>}
        {DEVICES.map((device) => (
          <option key={device.id} value={device.id}>{device.label}</option>
        ))}
      </select>

      <span className="review-frame-size" aria-live="polite">{frame.w}<span>×</span>{frame.h}</span>

      <button
        type="button"
        data-on={frame.fullHeight || undefined}
        aria-pressed={frame.fullHeight}
        title={frame.fullHeight
          ? 'Full height — the whole layout at once, but the fold is not where a phone puts it'
          : 'Device height — where the fold actually is'}
        onClick={() => onFrame({ fullHeight: !frame.fullHeight })}
      >
        <MoveVertical className="size-3.5" />
        {frame.fullHeight ? 'Full' : 'Device'}
      </button>

      <button
        type="button"
        data-on={frame.round || undefined}
        aria-pressed={frame.round}
        title="Round the corners — how the device clips the page, not how the page draws"
        onClick={() => onFrame({ round: !frame.round })}
      >
        <Squircle className="size-3.5" />
        Corners
      </button>
    </div>
  );
}

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
  frame,
  onFrame,
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
  /** How the PAGE is framed — not `width` below, which is the rail's own.
   *  Two different widths in one component, so both are named. */
  frame: FrameSetup;
  /* A patch, not a whole object. Two of these controls pressed before React
     re-renders would each spread a `frame` captured at the same render, so the
     second would quietly undo the first — toggle the corners and the height
     quickly and only one of them takes. */
  onFrame: (patch: Partial<FrameSetup>) => void;
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
        <kbd>⌥R</kbd>
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
          title="Close · ⌥R"
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
          title="Point · d"
          onClick={() => onMode(mode === 'pick' ? 'off' : 'pick')}
        >
          <span className="review-dock-icon"><Crosshair className="size-[18px]" /></span>
          <span className="review-dock-name">Point</span>
          <kbd className="review-dock-key">d</kbd>
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

        {/* The size the page is drawn at. Narrowing the rail is not the same
            thing and never was: a media query reads the viewport, so a page
            squeezed into a narrow column still resolves every desktop rule
            and shows a layout that ships to nobody. These render the app in a
            frame of that size, where its own breakpoints apply. */}
        <span className="review-dock-widths" role="group" aria-label="Page size">
          <button
            type="button"
            data-on={!frame.on || undefined}
            aria-pressed={!frame.on}
            title="The window as it is"
            onClick={() => onFrame({ on: false })}
          >
            <Monitor className="size-4" />
            <span className="sr-only">Full</span>
          </button>
          <button
            type="button"
            data-on={(frame.on && frame.w < 640) || undefined}
            aria-pressed={frame.on && frame.w < 640}
            title={`Phone — ${DEFAULT_PHONE.w}×${DEFAULT_PHONE.h}`}
            onClick={() => onFrame({ on: true, w: DEFAULT_PHONE.w, h: DEFAULT_PHONE.h })}
          >
            <Smartphone className="size-4" />
            <span className="sr-only">Phone</span>
          </button>
          <button
            type="button"
            data-on={(frame.on && frame.w >= 640) || undefined}
            aria-pressed={frame.on && frame.w >= 640}
            title={`Tablet — ${DEFAULT_TABLET.w}×${DEFAULT_TABLET.h}`}
            onClick={() => onFrame({ on: true, w: DEFAULT_TABLET.w, h: DEFAULT_TABLET.h })}
          >
            <Tablet className="size-4" />
            <span className="sr-only">Tablet</span>
          </button>
        </span>
      </div>

      {/* The device bar. Only while framed, because every control on it is a
          question about a frame that is not there otherwise. */}
      {frame.on ? <FrameBar frame={frame} onFrame={onFrame} /> : null}

      <div className="review-rail-body">{children}</div>

      <footer className="review-rail-foot">
        <code>review/REVIEW-NOTES.md</code>
      </footer>
    </aside>
  );
}
