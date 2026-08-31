import { useEffect, useId, useRef, useState } from 'react';
import { ChevronLeft, X } from 'lucide-react';
import type { ReactNode } from 'react';

const DISMISS_PX = 80;
const DISMISS_VELOCITY = 0.45;

/** Shared modal chrome for every bottom/center sheet in the app — also
 *  reusable as a plain inline pane (variant="inline") for a persistent
 *  detail column instead of a popup. */
export function Sheet({
  title, eyebrow, size = 'md', footer, headerActions, onClose, children, variant = 'modal', backLabel
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
  /** Inline only: replaces the X with a breadcrumb-style back link. */
  backLabel?: string;
}) {
  const [scrolled, setScrolled] = useState(false);
  const cardRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  const titleId = useId();
  const startY = useRef(0);
  const startTime = useRef(0);
  const dragging = useRef(false);
  const inline = variant === 'inline';

  useEffect(() => {
    if (inline) return;
    const previouslyFocused = document.activeElement as HTMLElement | null;
    const frame = requestAnimationFrame(() => {
      const first = cardRef.current?.querySelector<HTMLElement>(
        'button:not(:disabled), input:not(:disabled), select:not(:disabled), textarea:not(:disabled), a[href], [tabindex]:not([tabindex="-1"])'
      );
      (first ?? cardRef.current)?.focus();
    });

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        closeRef.current();
        return;
      }
      if (event.key !== 'Tab' || !cardRef.current) return;
      const focusable = Array.from(cardRef.current.querySelectorAll<HTMLElement>(
        'button:not(:disabled), input:not(:disabled), select:not(:disabled), textarea:not(:disabled), a[href], [tabindex]:not([tabindex="-1"])'
      ));
      if (!focusable.length) {
        event.preventDefault();
        cardRef.current.focus();
        return;
      }
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener('keydown', onKeyDown);
    return () => {
      cancelAnimationFrame(frame);
      document.removeEventListener('keydown', onKeyDown);
      previouslyFocused?.focus();
    };
  }, [inline]);

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
          className="flex shrink-0 cursor-grab touch-none select-none flex-col items-center pt-2.5 pb-1 active:cursor-grabbing sm:hidden"
          {...swipeHandlers}
        >
          <div className="h-1.5 w-14 rounded-full bg-border transition-colors" />
        </div>
      )}

      {inline && backLabel ? (
        <button
          type="button"
          onClick={onClose}
          className="flex shrink-0 items-center gap-1 px-4 pt-4 text-sm sm:text-base font-semibold text-muted-foreground transition-colors hover:text-foreground sm:px-6 sm:pt-6"
        >
          <ChevronLeft className="size-5" /> {backLabel}
        </button>
      ) : null}

      {/* Header with swipe-to-dismiss support on mobile */}
      <div
        className={
          'sticky top-0 z-10 flex shrink-0 items-center justify-between gap-3 border-b border-border/60 bg-surface/95 backdrop-blur-md transition-[padding] duration-200 '
          + (scrolled ? 'px-4 py-3 sm:px-6 sm:py-3.5' : 'p-4 sm:px-6 sm:py-4')
        }
        {...(!inline && !scrolled ? swipeHandlers : undefined)}
      >
        <div className="min-w-0 flex-1">
          {eyebrow ? (
            <p className={
              'text-xs font-bold uppercase tracking-wider text-muted-foreground transition-all duration-200 '
              + (scrolled ? 'max-h-0 opacity-0' : 'max-h-5 opacity-100')
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
              <button
                type="button"
                aria-label="Close"
                onClick={onClose}
                className="icon-btn grid text-muted-foreground hover:bg-muted hover:text-foreground"
              >
                <X className="size-5" />
              </button>
            )}
          </div>
        ) : null}
      </div>

      {/* Scrollable Body */}
      <div
        className={
          'flex flex-1 flex-col gap-4 sm:gap-5 overflow-y-auto px-4 sm:px-6 text-sm sm:text-base '
          + (footer ? 'py-4 sm:py-5' : 'py-4 pb-[max(1.25rem,env(safe-area-inset-bottom))] sm:pb-6')
        }
        onScroll={(e) => setScrolled(e.currentTarget.scrollTop > 8)}
      >
        {children}
      </div>

      {/* Sticky Footer */}
      {footer ? (
        <div className="sticky bottom-0 z-10 flex shrink-0 items-center justify-between gap-3 border-t border-border/60 bg-surface/95 backdrop-blur-md px-4 pt-3 pb-[max(1.25rem,env(safe-area-inset-bottom))] sm:px-6 sm:py-4">
          {footer}
        </div>
      ) : null}
    </div>
  );

  if (inline) return card;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:p-6 bg-black/50 backdrop-blur-xs transition-opacity duration-200"
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      onClick={onClose}
    >
      <div className="flex w-full justify-center">
        {card}
      </div>
    </div>
  );
}
