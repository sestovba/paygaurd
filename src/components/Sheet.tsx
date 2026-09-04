import { useId, useRef, useState } from 'react';
import { ChevronLeft, X } from 'lucide-react';
import type { ReactNode } from 'react';
import { IconButton } from './ui';

import { ButtonBase } from '../design-system';
import { useDialogFocus } from './ui/useDialogFocus';
const DISMISS_PX = 80;
const DISMISS_VELOCITY = 0.45;

/* How much room the header gives back when it collapses — padding, the
 * eyebrow, and a step down in title size. Measured off the classes below
 * and rounded up: below this much overflow, collapsing would remove the
 * very scroll that triggered it. */
const COLLAPSE_MIN_OVERFLOW = 56;

/** Shared modal chrome for every bottom/center sheet in the app — also
 *  reusable as a plain inline pane (variant="inline") for a persistent
 *  detail column instead of a popup. */
export function Sheet({
  title, eyebrow, size = 'md', footer, headerActions, onClose, children, variant = 'modal', backLabel, onBack
}: {
  title: string;
  eyebrow?: string;
  /** 'lg' for sheets with enough fields to earn a wider desktop layout. */
  size?: 'md' | 'lg';
  /** Renders as its own full-bleed row below the scrollable content. */
  footer?: ReactNode;
  /** Extra icon buttons in the header's top-right corner, beside the close
   *  button (or in its place when inline hides the X). */
  headerActions?: ReactNode;
  onClose: () => void;
  children: ReactNode;
  /** 'inline' fills its container as a plain pane — no backdrop, no
   *  floating card — for a persistent column instead of a popup. */
  variant?: 'modal' | 'inline';
  /** Inline: replaces the X with a breadcrumb-style back link. Modal: shown
   *  alongside the close button when `onBack` is given. */
  backLabel?: string;
  /** Makes this sheet a page you can step back from rather than a sheet you
   *  have to close.
   *
   *  Settings used to open Layout, Terms and the income help as sheets on
   *  top of itself: three surfaces deep, each with its own X, and closing
   *  the top one looked identical to closing the lot. A drill-down is one
   *  surface that changes what it is showing, so Back means back to where
   *  you were and Close still means done. The X stays, because the fastest
   *  way out of a settings screen should not be three taps. */
  onBack?: () => void;
}) {
  const [scrolled, setScrolled] = useState(false);
  const cardRef = useRef<HTMLDivElement>(null);
  const titleId = useId();
  const startY = useRef(0);
  const startTime = useRef(0);
  const dragging = useRef(false);
  const inline = variant === 'inline';

  useDialogFocus(cardRef, onClose, {
    enabled: !inline
  });

  const onTouchStart = (event: React.TouchEvent) => {
    if (inline) return;
    const target = event.target as HTMLElement;
    if (target.closest('button, input, select, a, textarea')) return;

    startY.current = event.touches[0].clientY;
    startTime.current = Date.now();
    dragging.current = true;
    const node = cardRef.current;
    if (node) node.style.transition = 'none';
  };

  const onTouchMove = (event: React.TouchEvent) => {
    if (!dragging.current) return;
    const delta = event.touches[0].clientY - startY.current;
    if (delta <= 0) return;
    const node = cardRef.current;
    if (node) node.style.transform = `translateY(${delta}px)`;
  };

  const onTouchEnd = (event: React.TouchEvent) => {
    if (!dragging.current) return;
    dragging.current = false;
    const delta = event.changedTouches[0].clientY - startY.current;
    const elapsed = Math.max(1, Date.now() - startTime.current);
    const velocity = delta / elapsed;
    const node = cardRef.current;
    if (node) node.style.transition = 'transform 0.22s cubic-bezier(0.16, 1, 0.3, 1)';
    if (delta > DISMISS_PX || (delta > 0 && velocity > DISMISS_VELOCITY)) {
      if (node) node.style.transform = 'translateY(100%)';
      setTimeout(onClose, 180);
      return;
    }
    if (node) node.style.transform = '';
  };

  const swipeHandlers = inline ? undefined : {
    onTouchStart,
    onTouchMove,
    onTouchEnd
  };

  const card = (
    <div
      ref={cardRef}
      tabIndex={inline ? undefined : -1}
      role={inline ? undefined : 'dialog'}
      aria-modal={inline ? undefined : true}
      aria-labelledby={inline ? undefined : titleId}
      /* A stable hook so a layout can restyle its own popups. Purely an
         attribute — it changes nothing for layouts that do not use it. */
      data-sheet=""
      data-sheet-inline={inline ? '' : undefined}
      className={
        inline
          ? 'flex h-full min-h-0 w-full flex-col bg-surface'
          : (
            'flex max-h-[92dvh] w-full flex-col overflow-hidden rounded-t-2xl bg-surface shadow-2xl sm:max-h-[85dvh] sm:rounded-2xl sm:border sm:border-border '
            + (size === 'lg' ? 'sm:max-w-2xl' : 'sm:max-w-md')
          )
      }
      onClick={inline ? undefined : (e) => e.stopPropagation()}
    >
      {/* Mobile Slide-Down Grab Handle */}
      {inline ? null : (
        <div
          data-sheet-grab=""
          className="flex shrink-0 cursor-grab touch-none select-none flex-col items-center pt-2.5 pb-1 active:cursor-grabbing sm:hidden"
          {...swipeHandlers}
        >
          <div className="h-1.5 w-14 rounded-full bg-border transition-colors" />
        </div>
      )}

      {(onBack || (inline && backLabel)) ? (
        <ButtonBase
          type="button"
          onClick={onBack ?? onClose}
          className="flex shrink-0 items-center gap-1 px-4 pt-4 text-sm sm:text-base font-semibold text-muted-foreground transition-colors hover:text-foreground sm:px-6 sm:pt-6"
        >
          <ChevronLeft className="size-5" /> {backLabel ?? 'Back'}
        </ButtonBase>
      ) : null}

      {/* Header with swipe-to-dismiss support on mobile */}
      <div
        data-sheet-head=""
        className={
          'app-bar-surface sticky top-0 z-10 flex shrink-0 items-center justify-between gap-3 border-b transition-[padding] duration-200 '
          + (scrolled ? 'px-4 py-3 sm:px-6 sm:py-3.5' : 'p-4 sm:px-6 sm:py-4')
        }
        {...(!inline && !scrolled ? swipeHandlers : undefined)}
      >
        <div className="min-w-0 flex-1">
          {/* Collapsing used to clamp the eyebrow to `max-h-5` — one line —
              while leaving it able to wrap. At a phone's width "A job that
              pays me" is two lines, and the second one came out on top of
              the title. Nothing clamps it while it is open now; the clamp is
              only what closes it. */}
          {eyebrow ? (
            <p className={
              'overflow-hidden text-xs font-bold uppercase tracking-wider text-muted-foreground transition-all duration-200 '
              + (scrolled ? 'max-h-0 opacity-0' : 'opacity-100')
            }>
              {eyebrow}
            </p>
          ) : null}
          <h2 id={titleId} className={
            'truncate font-bold tracking-tight text-foreground transition-all duration-200 '
            + (scrolled ? 'mt-0 text-lg sm:text-xl' : 'mt-0.5 text-xl sm:text-2xl')
          }>
            {title}
          </h2>
        </div>
        {headerActions || !(inline && backLabel) ? (
          <div className="flex shrink-0 items-center gap-1.5">
            {headerActions}
            {inline && backLabel ? null : (
              <IconButton label="Close" onClick={onClose}>
                <X className="size-5" />
              </IconButton>
            )}
          </div>
        ) : null}
      </div>

      {/* Scrollable Body */}
      <div
        data-sheet-body=""
        className={
          'flex flex-1 flex-col gap-4 sm:gap-5 overflow-y-auto px-4 sm:px-6 text-sm sm:text-base '
          + (footer ? 'py-4 sm:py-5' : 'py-4 pb-[max(1.25rem,env(safe-area-inset-bottom))] sm:pb-6')
        }
        onScroll={(e) => {
          const body = e.currentTarget;
          const overflow = body.scrollHeight - body.clientHeight;
          setScrolled((was) => {
            /*
             * The header shrinks once you scroll, which makes the body
             * taller, which can take the scroll away again — and then the
             * header grows back, and the browser clamps the scroll, and it
             * happens again. That loop is the jitter reported on short
             * windows: "little scroll happens, this thing glitches out".
             *
             * Two guards. The collapse never engages unless there is more
             * to scroll than the collapse itself gives back, so on a body
             * that barely overflows nothing moves at all. And once it has
             * engaged it only lets go at the very top, so a few pixels of
             * clamped scroll cannot flip it back.
             */
            if (overflow < COLLAPSE_MIN_OVERFLOW) return false;
            return was ? body.scrollTop > 2 : body.scrollTop > 24;
          });
        }}
      >
        {children}
      </div>

      {/* Sticky Footer */}
      {footer ? (
        <div data-sheet-foot="" className="app-bar-surface sticky bottom-0 z-10 flex shrink-0 items-center justify-between gap-3 border-t px-4 pt-3 pb-[max(1.25rem,env(safe-area-inset-bottom))] sm:px-6 sm:py-4">
          {footer}
        </div>
      ) : null}
    </div>
  );

  if (inline) return card;

  return (
    <div
      data-sheet-scrim=""
      className="fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:p-6 bg-black/50 transition-opacity duration-200"
      onClick={onClose}
    >
      <div className="flex w-full justify-center">
        {card}
      </div>
    </div>
  );
}
