// The bell, and the panel of things that need doing behind it.
//
// This is chrome, not a layout: ten layouts render it and none of them owns
// it. It used to be written in Tailwind utilities plus payguard's --pg-*
// tokens, which are only defined under .pg-payguard — so on classic, v2,
// ledger and the workspace every colour it asked for resolved to nothing and
// the panel came out with unfilled badges and inherited text. That is what
// "unfinished design" was.
//
// Now it draws from the --chrome-* contract in styles/chrome.css, which each
// layout answers with its own palette. Nothing here knows a layout exists.

import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { AlertTriangle, Bell, CalendarClock, CheckCircle2, ChevronDown, TrendingUp, Zap } from 'lucide-react';
import { useTracker } from '../state/TrackerProvider';
import { actionItems } from '../domain/notifications';
import type { MonthKey } from '../domain/types';

import { ButtonBase } from '../design-system';
export function NotificationsBell({
  open, onOpenChange, onSetPayday, onReviewStream, onOpenMonth, variant = 'icon'
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSetPayday: (id: string) => void;
  onReviewStream: (id: string) => void;
  onOpenMonth: (month: MonthKey) => void;
  variant?: 'icon' | 'summary';
}) {
  const { data, ui, setUi } = useTracker();
  const [showActivity, setShowActivity] = useState(false);
  const [host, setHost] = useState<HTMLElement | null>(null);
  const [anchor, setAnchor] = useState<{ top: number; right: number } | null>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);

  const items = actionItems(data, ui.year, ui.focusMode);
  const activity = [...data.activity].reverse();
  const latestAt = data.activity.length ? data.activity[data.activity.length - 1].at : null;
  const hasUnseenActivity = Boolean(latestAt) && (!ui.notificationsViewedAt || latestAt! > ui.notificationsViewedAt);
  const showDot = items.length > 0 || hasUnseenActivity;

  /*
   * Where the panel is rendered, and why it is not rendered here.
   *
   * Every header this bell sits in is `position: sticky` with a backdrop
   * blur. A backdrop-filter makes its subtree a containing block for
   * `position: fixed`, so the scrim — `inset: 0`, meant to cover the screen
   * and catch the tap that closes the panel — was being sized to the header
   * instead. It came out 375x76 on a phone: the page underneath was never
   * dimmed, and a tap on a card behind the open panel hit the card and did
   * whatever that card does.
   *
   * So the panel moves out to the layout root, which carries
   * `data-chrome-root`. That element is also the one that answers the
   * --chrome-* contract, so the panel keeps the palette it is supposed to
   * have; portalling to document.body would escape the header and the theme
   * with it.
   */
  useEffect(() => {
    if (!open) { setHost(null); return; }
    setHost(triggerRef.current?.closest<HTMLElement>('[data-chrome-root]') ?? document.body);
  }, [open]);

  /* Out of the header, the panel is no longer positioned by being next to
   * the button, so it is measured from it instead — and re-measured while it
   * is open, because a sticky header moves under the panel when the page
   * scrolls. */
  useLayoutEffect(() => {
    if (!open || !host) { setAnchor(null); return; }
    const place = () => {
      const rect = triggerRef.current?.getBoundingClientRect();
      if (!rect) return;
      // The panel's width is read rather than recomputed: it is set in rem,
      // and the root font size is 18px on phones and 16px above 40rem, so
      // any copy of the sum here would be wrong on one of them.
      const width = popoverRef.current?.offsetWidth ?? 0;
      const edge = 12;
      // Right-align under the bell, but never past either edge of the
      // screen — on a narrow phone the bell sits far enough right that
      // hanging the panel off it alone puts its left side off-screen.
      const ideal = window.innerWidth - rect.right;
      const furthest = Math.max(edge, window.innerWidth - width - edge);
      setAnchor({
        top: Math.round(rect.bottom + 8),
        right: Math.round(Math.min(Math.max(edge, ideal), furthest))
      });
    };
    place();
    window.addEventListener('resize', place);
    // Capture, because the thing that moves the bell is usually a scroll
    // inside the page rather than on the window.
    window.addEventListener('scroll', place, true);
    return () => {
      window.removeEventListener('resize', place);
      window.removeEventListener('scroll', place, true);
    };
  }, [open, host]);

  useEffect(() => {
    if (!open) return;
    const frame = requestAnimationFrame(() => {
      popoverRef.current?.querySelector<HTMLButtonElement>('button')?.focus();
    });
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      event.preventDefault();
      onOpenChange(false);
    };
    document.addEventListener('keydown', onKeyDown);
    return () => {
      cancelAnimationFrame(frame);
      document.removeEventListener('keydown', onKeyDown);
      triggerRef.current?.focus({ preventScroll: true });
    };
  }, [open, onOpenChange]);

  return (
    <div className="notice">
      <ButtonBase
        ref={triggerRef}
        type="button"
        id="notifications-bell-anchor"
        aria-label={items.length
          ? `${items.length} notice${items.length === 1 ? ' needs' : 's need'} attention`
          : 'Notifications and recent activity'}
        aria-expanded={open}
        aria-haspopup="dialog"
        aria-controls="notifications-popover"
        onClick={() => {
          onOpenChange(!open);
          if (!open) {
            setUi({ notificationsViewedAt: new Date().toISOString() });
          }
        }}
        data-active={items.length > 0}
        className={variant === 'summary' ? 'notice-trigger notice-trigger--summary' : 'notice-trigger'}
      >
        {variant === 'summary' ? (
          <>
            <AlertTriangle className="size-3.5" />
            <span className="hidden sm:inline">
              {items.length ? `${items.length} Notice${items.length === 1 ? '' : 's'}` : 'Activity'}
            </span>
            <span className="sm:hidden">{items.length || '•'}</span>
          </>
        ) : <Bell className="size-4" />}
        {/* The summary trigger already says the count in words, so the dot
            there would be a second copy of the same fact. */}
        {showDot && variant !== 'summary' ? <span className="notice-trigger__dot" /> : null}
      </ButtonBase>

      {open && host ? createPortal(
        <div className="notice-popover">
          <div className="notice-scrim" aria-hidden="true" onClick={() => onOpenChange(false)} />
          <div
            ref={popoverRef}
            id="notifications-popover"
            role="dialog"
            aria-modal="false"
            aria-labelledby="notifications-heading"
            className="notice-panel"
            style={anchor ? { top: anchor.top, right: anchor.right } : undefined}
          >
            <div className="notice-panel__head">
              <h2 id="notifications-heading" className="notice-panel__title">Needs attention</h2>
              {items.length > 0 ? (
                <span className="notice-panel__count">
                  {items.length} action{items.length === 1 ? '' : 's'}
                </span>
              ) : null}
            </div>

            {/* Only the list scrolls. On a short screen the heading and the
                activity toggle staying put is the difference between a panel
                and a runaway column. */}
            <div className="notice-panel__body">
              {items.length ? (
                <ul className="notice-list">
                  {items.map((item) => (
                    <li key={item.id}>
                      <ButtonBase
                        type="button"
                        onClick={() => {
                          onOpenChange(false);
                          if (item.action.kind === 'setPayday') onSetPayday(item.action.streamId);
                          else if (item.action.kind === 'reviewStream') onReviewStream(item.action.streamId);
                          else onOpenMonth(item.action.month);
                        }}
                        className="notice-item"
                        data-severity={item.severity}
                      >
                        {item.action.kind === 'setPayday' ? <CalendarClock className="notice-item__icon size-4" />
                          : item.action.kind === 'reviewStream' ? <TrendingUp className="notice-item__icon size-4" />
                          : <Zap className="notice-item__icon size-4" />}
                        <span className="notice-item__text">{item.message}</span>
                      </ButtonBase>
                    </li>
                  ))}
                </ul>
              ) : (
                <div className="notice-clear">
                  <CheckCircle2 className="notice-clear__icon size-4" />
                  <span>All paychecks and income sources are up to date.</span>
                </div>
              )}
            </div>

            <div className="notice-activity">
              <ButtonBase
                type="button"
                onClick={() => setShowActivity((v) => !v)}
                className="notice-activity__toggle"
                aria-expanded={showActivity}
              >
                <span>Recent activity</span>
                <ChevronDown className="notice-activity__chevron size-3.5" />
              </ButtonBase>
              {showActivity ? (
                activity.length ? (
                  <ul className="notice-activity__list">
                    {activity.slice(0, 8).map((entry) => (
                      <li key={entry.id} className="notice-activity__item">{entry.message}</li>
                    ))}
                  </ul>
                ) : (
                  <p className="notice-activity__empty">No recent changes logged.</p>
                )
              ) : null}
            </div>
          </div>
        </div>,
        host
      ) : null}
    </div>
  );
}
