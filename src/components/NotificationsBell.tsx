import { useEffect, useRef, useState } from 'react';
import { AlertTriangle, Bell, CalendarClock, CheckCircle2, ChevronDown, TrendingUp, Zap } from 'lucide-react';
import { useTracker } from '../state/TrackerProvider';
import { actionItems } from '../domain/notifications';
import type { MonthKey } from '../domain/types';

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
  const triggerRef = useRef<HTMLButtonElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);

  const items = actionItems(data, ui.year);
  const activity = [...data.activity].reverse();
  const latestAt = data.activity.length ? data.activity[data.activity.length - 1].at : null;
  const hasUnseenActivity = Boolean(latestAt) && (!ui.notificationsViewedAt || latestAt! > ui.notificationsViewedAt);
  const showDot = items.length > 0 || hasUnseenActivity;

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
    <div className="relative">
      <button
        ref={triggerRef}
        type="button"
        id="notifications-bell-anchor"
        aria-label={items.length ? `${items.length} notice${items.length === 1 ? '' : 's'} need attention` : 'Notifications and recent activity'}
        aria-expanded={open}
        aria-haspopup="dialog"
        aria-controls="notifications-popover"
        onClick={() => {
          onOpenChange(!open);
          if (!open) {
            setUi({ notificationsViewedAt: new Date().toISOString() });
          }
        }}
        className={variant === 'summary'
          ? `pg-notice-trigger ${items.length ? 'pg-notice-trigger-active' : ''}`
          : 'pg-icon-btn pg-icon-btn-bordered relative'}
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
        {showDot ? (
          <span className={variant === 'summary' ? 'sr-only' : 'absolute top-1.5 right-1.5 flex size-2'}>
            <span className="absolute inline-flex h-full w-full motion-safe:animate-ping rounded-full bg-[var(--pg-over)] opacity-75" />
            <span className="relative inline-flex size-2 rounded-full bg-[var(--pg-over)]" />
          </span>
        ) : null}
      </button>

      {open ? (
        <>
          <div
            className="fixed inset-0 z-30 bg-black/20 backdrop-blur-[2px] sm:bg-transparent sm:backdrop-blur-none"
            aria-hidden="true"
            onClick={() => onOpenChange(false)}
          />
          <div
            ref={popoverRef}
            id="notifications-popover"
            role="dialog"
            aria-modal="false"
            aria-labelledby="notifications-heading"
            className="fixed top-16 left-3 right-3 z-40 w-auto max-w-sm mx-auto sm:absolute sm:top-full sm:right-0 sm:left-auto sm:mt-2 sm:w-80 sm:max-w-none rounded-[var(--pg-radius)] border border-[var(--pg-border)] bg-[var(--pg-surface)] p-3.5 shadow-[var(--pg-shadow-lg)]"
          >
            <div className="flex items-center justify-between px-1 pb-1">
              <h2 id="notifications-heading" className="pg-label font-bold">Needs attention</h2>
              {items.length > 0 ? (
                <span className="pg-badge pg-badge-warn text-[0.625rem]">
                  {items.length} action{items.length === 1 ? '' : 's'}
                </span>
              ) : null}
            </div>

            {items.length ? (
              <ul className="mt-2 flex flex-col gap-1.5">
                {items.map((item) => (
                  <li key={item.id}>
                    <button
                      type="button"
                      onClick={() => {
                        onOpenChange(false);
                        if (item.action.kind === 'setPayday') onSetPayday(item.action.streamId);
                        else if (item.action.kind === 'reviewStream') onReviewStream(item.action.streamId);
                        else onOpenMonth(item.action.month);
                      }}
                      className={`flex w-full items-start gap-2.5 rounded-[var(--pg-radius-md)] border p-2.5 text-left text-xs font-medium transition-all ${
                        item.severity === 'warn'
                          ? 'border-[var(--pg-warn-border)] bg-[var(--pg-warn-bg)] text-[var(--pg-warn-text)] hover:brightness-95'
                          : 'border-[var(--pg-info-border)] bg-[var(--pg-info-bg)] text-[var(--pg-info-text)] hover:brightness-95'
                      }`}
                    >
                      {item.action.kind === 'setPayday' ? <CalendarClock className="mt-0.5 size-4 shrink-0" />
                        : item.action.kind === 'reviewStream' ? <TrendingUp className="mt-0.5 size-4 shrink-0" />
                        : <Zap className="mt-0.5 size-4 shrink-0" />}
                      <span className="flex-1 leading-snug">{item.message}</span>
                    </button>
                  </li>
                ))}
              </ul>
            ) : (
              <div className="my-2 flex items-center gap-2 rounded-[var(--pg-radius-md)] bg-[var(--pg-surface-2)] px-3 py-2.5 text-xs pg-muted">
                <CheckCircle2 className="size-4 shrink-0 text-[var(--pg-safe)]" />
                <span>All paychecks and income sources are up to date.</span>
              </div>
            )}

            <div className="mt-3 border-t border-[var(--pg-rule)] pt-2">
              <button
                type="button"
                onClick={() => setShowActivity((v) => !v)}
                className="flex w-full items-center justify-between rounded-[var(--pg-radius-sm)] px-1.5 py-1 text-left text-xs font-semibold pg-muted transition-colors hover:bg-[var(--pg-hover)] hover:text-[var(--pg-fg)]"
              >
                <span className="pg-label">Recent activity</span>
                <ChevronDown className={`size-3.5 transition-transform duration-150 ${showActivity ? 'rotate-180' : ''}`} />
              </button>
              {showActivity ? (
                activity.length ? (
                  <ul className="mt-1.5 max-h-48 overflow-y-auto flex flex-col gap-1 pr-1">
                    {activity.slice(0, 8).map((entry) => (
                      <li key={entry.id} className="truncate rounded px-1.5 py-1 text-[0.6875rem] pg-dim hover:bg-[var(--pg-surface-2)]">
                        {entry.message}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="px-1.5 py-1 text-[0.6875rem] pg-dim">No recent changes logged.</p>
                )
              ) : null}
            </div>
          </div>
        </>
      ) : null}
    </div>
  );
}
