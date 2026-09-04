// One popover primitive, used by every menu.
//
// Two shapes: anchored next to the trigger on desktop, where there is room
// to look around it; a bottom-center sheet on a phone, where a small trigger
// in a corner is a poor anchor and thumb reach matters more than proximity.
//
// The anchored shape never needs to know a menu's content height in advance
// (a hardcoded guess is exactly what caused it to collide with the header
// before) — it measures the actual space above and below the trigger and
// picks whichever side has more, then caps its own height to fit there,
// scrolling internally if the content is still taller than that.

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { CloseIcon } from './Icons';
import { useIsWide } from './useIsWide';
import { useMountTransition } from './useMountTransition';
import { useSwipeToDismiss } from './useSwipeToDismiss';

import { ButtonBase } from '../../design-system';
import { useDialogFocus } from '../ui/useDialogFocus';
const EXIT_MS = 180;

const GAP = 4;
const EDGE = 8;
const DRAWER_BELOW = 640;
/** Prefer anchoring below unless that space is smaller than this AND above has more. */
const MIN_ROOM = 160;

/**
 * Walks up from the trigger to the first ancestor with a substantially
 * opaque background and classifies it light or dark by relative luminance.
 * This is what lets the glass compensate automatically wherever a trigger
 * happens to sit — the header today, but nothing here is specific to it —
 * instead of a fixed rule that only covers the cases seen so far.
 */
function isOnDarkBackground(node: HTMLElement | null): boolean {
  let el: HTMLElement | null = node;
  while (el) {
    const bg = getComputedStyle(el).backgroundColor;
    const match = bg.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?\)/);
    if (match) {
      const alpha = match[4] === undefined ? 1 : Number(match[4]);
      if (alpha > 0.5) {
        const [r, g, b] = [Number(match[1]), Number(match[2]), Number(match[3])];
        const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
        return luminance < 0.5;
      }
    }
    el = el.parentElement;
  }
  return false;
}

export interface AnchorState {
  open: boolean;
  rect: DOMRect | null;
  /** True when the trigger sits on a dark surface (the header today) — the
   * anchored popover uses this to opt into a less-transparent fill so it
   * doesn't pick up that darkness through its own glass. */
  onDark: boolean;
  triggerRef: React.RefObject<HTMLButtonElement>;
  surfaceRef: React.RefObject<HTMLDivElement>;
  toggle: (event: React.MouseEvent) => void;
  close: () => void;
}

export function useAnchoredPopover(): AnchorState {
  const [open, setOpen] = useState(false);
  const [rect, setRect] = useState<DOMRect | null>(null);
  const [onDark, setOnDark] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const surfaceRef = useRef<HTMLDivElement>(null);

  const measure = useCallback(() => {
    const node = triggerRef.current;
    if (node) setRect(node.getBoundingClientRect());
  }, []);

  const close = useCallback(() => setOpen(false), []);

  useEffect(() => {
    if (!open) return;

    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as Node;
      if (triggerRef.current?.contains(target)) return;
      if (surfaceRef.current?.contains(target)) return;
      setOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') { setOpen(false); triggerRef.current?.focus(); }
    };

    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    window.addEventListener('scroll', measure, true);
    window.addEventListener('resize', measure);

    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('scroll', measure, true);
      window.removeEventListener('resize', measure);
    };
  }, [open, measure]);

  const toggle = useCallback((event: React.MouseEvent) => {
    event.stopPropagation();
    if (!open) {
      measure();
      setOnDark(isOnDarkBackground(triggerRef.current));
    }
    setOpen((v) => !v);
  }, [open, measure]);

  return { open, rect, onDark, triggerRef, surfaceRef, toggle, close };
}

export function AnchoredPopover({
  anchor, width, className = '', label, title, role = 'menu',
  showChrome = true, children
}: {
  anchor: AnchorState;
  /** Only used on desktop, where the shape has a fixed width and grows in height. */
  width: number;
  className?: string;
  label?: string;
  title?: string;
  role?: 'menu' | 'dialog';
  /** False when an embedded detail header owns the one visible close button. */
  showChrome?: boolean;
  children: React.ReactNode;
}) {
  const { open, rect, onDark, surfaceRef, close } = anchor;
  const wide = useIsWide(DRAWER_BELOW);
  const { mounted, closing } = useMountTransition(open, EXIT_MS);
  // The body still needs its own vertical drag for scrolling long menus, so
  // this only ever attaches to the grip/title bar, not the whole drawer.
  useDialogFocus(surfaceRef, close, {
    enabled: mounted && !wide && role === 'dialog'
  });

  const swipe = useSwipeToDismiss(surfaceRef, close);

  if (!mounted) return null;

  // Bottom-center sheet on a phone.
  if (!wide) {
    return createPortal(
      <div className={'popover-scrim' + (closing ? ' popover-scrim--closing' : '')} onClick={close}>
        <div
          ref={surfaceRef}
          tabIndex={role === 'dialog' ? -1 : undefined}
          className={('popover-drawer ' + (closing ? 'popover-drawer--closing ' : '') + className).trim()}
          role={role}
          aria-label={label}
          aria-modal={role === 'dialog' ? true : undefined}
          onClick={(e) => e.stopPropagation()}
        >
          {showChrome ? (
            <div
              className="popover-drawer__top"
              onTouchStart={swipe.onTouchStart}
              onTouchMove={swipe.onTouchMove}
              onTouchEnd={swipe.onTouchEnd}
            >
              <span className="popover-drawer__grip" aria-hidden="true" />
              {title ? <div className="popover-drawer__title">{title}</div> : <span />}
              <ButtonBase className="popover-drawer__close" type="button" aria-label="Close" onClick={close}>
                <CloseIcon size={18} />
              </ButtonBase>
            </div>
          ) : null}
          <div className="popover-drawer__items">{children}</div>
        </div>
      </div>,
      document.body
    );
  }

  if (!rect) return null;

  const spaceBelow = window.innerHeight - rect.bottom - GAP - EDGE;
  const spaceAbove = rect.top - GAP - EDGE;
  const flipUp = spaceBelow < MIN_ROOM && spaceAbove > spaceBelow;

  const style: React.CSSProperties = {
    width,
    maxHeight: Math.max(80, flipUp ? spaceAbove : spaceBelow),
    top: flipUp ? undefined : rect.bottom + GAP,
    bottom: flipUp ? window.innerHeight - rect.top + GAP : undefined,
    left: Math.min(
      Math.max(EDGE, rect.right - width),
      Math.max(EDGE, window.innerWidth - width - EDGE)
    )
  };

  // Written straight to the node, not through React state — a style prop
  // update would re-render on every pointer move for a highlight that
  // never affects layout or anything else on the page.
  const onShineMove = (event: React.MouseEvent<HTMLDivElement>) => {
    const node = event.currentTarget;
    const box = node.getBoundingClientRect();
    node.style.setProperty('--mx', ((event.clientX - box.left) / box.width * 100) + '%');
    node.style.setProperty('--my', ((event.clientY - box.top) / box.height * 100) + '%');
  };

  return createPortal(
    <div
      ref={surfaceRef}
      className={(
        'popover-surface '
        + (closing ? 'popover-surface--closing ' : '')
        + (onDark ? 'popover-surface--on-dark ' : '')
        + className
      ).trim()}
      role={role}
      aria-label={label}
      style={style}
      onMouseMove={onShineMove}
    >
      {title ? (
        <div className="popover-surface__head">
          <span className="popover-surface__title">{title}</span>
          <ButtonBase className="popover-surface__close" type="button" aria-label="Close" onClick={close}>
            <CloseIcon size={16} />
          </ButtonBase>
        </div>
      ) : null}
      {children}
    </div>,
    document.body
  );
}
