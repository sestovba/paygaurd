import { useEffect, useState } from 'react';
import { CalendarClock, TrendingUp, X } from 'lucide-react';
import { useTracker } from '../state/TrackerProvider';
import { actionItems } from '../domain/notifications';
import type { ActionItem } from '../domain/notifications';
import type { MonthKey } from '../domain/types';

import { ButtonBase } from '../design-system';
/**
 * Unlike the dashboard cards this replaced, a banner can stack one per
 * urgent item — dismissing is the safety valve that keeps that from being
 * spam. Dismissing doesn't discard the item, just moves it out of the way
 * into the bell (still the full list either way) — the fly-to-bell motion
 * is what tells you that, instead of it just vanishing.
 */
export function ActionBanner({
  onSetPayday, onReviewStream, onOpenMonth
}: {
  onSetPayday: (id: string) => void;
  onReviewStream: (id: string) => void;
  onOpenMonth: (month: MonthKey) => void;
}) {
  const { data, ui } = useTracker();
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());
  const [flight, setFlight] = useState<{ from: DOMRect; to: DOMRect } | null>(null);

  const items = actionItems(data, ui.year, ui.focusMode);
  const urgent = items.filter((i) => i.severity === 'warn');
  const shown = (urgent.length ? urgent : items.slice(0, 1)).filter((i) => !dismissed.has(i.id));
  if (!shown.length && !flight) return null;

  function dismiss(item: ActionItem, fromEl: HTMLElement) {
    const bell = document.getElementById('notifications-bell-anchor');
    const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (bell && !prefersReduced) {
      setFlight({ from: fromEl.getBoundingClientRect(), to: bell.getBoundingClientRect() });
      window.setTimeout(() => setFlight(null), 450);
    }
    setDismissed((prev) => new Set(prev).add(item.id));
  }

  return (
    <div className="flex flex-col gap-2 xl:col-span-12">
      {shown.map((item) => (
        <Banner
          key={item.id}
          item={item}
          onResolve={() => {
            if (item.action.kind === 'setPayday') onSetPayday(item.action.streamId);
            else if (item.action.kind === 'reviewStream') onReviewStream(item.action.streamId);
            else onOpenMonth(item.action.month);
          }}
          onDismiss={(fromEl) => dismiss(item, fromEl)}
        />
      ))}
      {flight ? <FlyingDot from={flight.from} to={flight.to} /> : null}
    </div>
  );
}

function Banner({
  item, onResolve, onDismiss
}: {
  item: ActionItem;
  onResolve: () => void;
  onDismiss: (rowEl: HTMLElement) => void;
}) {
  const Icon = item.action.kind === 'reviewStream' ? TrendingUp : CalendarClock;
  const actionLabel = item.action.kind === 'setPayday' ? 'Add payday'
    : item.action.kind === 'reviewStream' ? 'Review job' : 'Open month';
  return (
    <div className="flex flex-col gap-2.5 rounded-[var(--pg-radius-md)] border border-[var(--pg-warn-border)] bg-[var(--pg-warn-bg)] p-3 text-[var(--pg-warn-text)] shadow-[var(--pg-shadow-sm)] sm:flex-row sm:items-center sm:p-4">
      <div className="flex items-center justify-between gap-3 sm:contents">
        <Icon className="size-4 shrink-0 text-[var(--pg-warn-text)] sm:order-1" />
        <div className="flex shrink-0 items-center gap-2 sm:order-3">
          <ButtonBase
            type="button"
            onClick={onResolve}
            className="pg-btn pg-btn-sm border-[var(--pg-warn-border)] bg-[var(--pg-surface)] text-[var(--pg-warn-text)] font-bold uppercase tracking-wider hover:bg-[var(--pg-surface-2)]"
          >
            {actionLabel}
          </ButtonBase>
          <ButtonBase
            type="button"
            aria-label="Dismiss"
            onClick={(e) => onDismiss(e.currentTarget.closest('[data-banner-row]') as HTMLElement)}
            data-banner-row
            className="pg-icon-btn size-7 text-[var(--pg-warn-text)] hover:bg-[var(--pg-warn-border)]/30"
          >
            <X className="size-4" />
          </ButtonBase>
        </div>
      </div>
      <p className="min-w-0 flex-1 text-xs font-semibold leading-relaxed sm:order-2">{item.message}</p>
    </div>
  );
}

/** A small dot easing from the dismissed banner's spot to the bell,
 *  shrinking and fading out — transform/opacity only, so it stays cheap. */
function FlyingDot({ from, to }: { from: DOMRect; to: DOMRect }) {
  const [animate, setAnimate] = useState(false);

  useEffect(() => {
    const raf = requestAnimationFrame(() => setAnimate(true));
    return () => cancelAnimationFrame(raf);
  }, []);

  const startX = from.left + from.width / 2;
  const startY = from.top + from.height / 2;
  const dx = (to.left + to.width / 2) - startX;
  const dy = (to.top + to.height / 2) - startY;

  return (
    <div
      aria-hidden="true"
      className="pointer-events-none fixed z-50 size-2.5 rounded-full bg-[var(--pg-warn)] transition-all duration-[420ms] ease-in"
      style={{
        left: startX - 5,
        top: startY - 5,
        transform: animate ? `translate(${dx}px, ${dy}px) scale(0.25)` : 'translate(0, 0) scale(1)',
        opacity: animate ? 0 : 1
      }}
    />
  );
}
