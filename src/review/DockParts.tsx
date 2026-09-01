// The two pieces both docks are built from. A phone stacks them on the bottom
// edge and a desktop stands them in a rail down the side, but a tool is a tool
// and a section is a section, and they behave the same in both.

import { useEffect, useRef, useState } from 'react';
import type { ComponentType, ReactNode } from 'react';
import { ChevronDown, GripVertical, Maximize2, Minimize2 } from 'lucide-react';

/** Dragging the sections into the order you want them in.
 *
 *  The grip is its own control rather than the header being press-and-hold:
 *  a header that is sometimes a button and sometimes a handle is a header you
 *  have to be careful with, and these are pressed constantly. */
export function useReorder(
  order: string[],
  onOrder: (next: string[]) => void,
  axis: 'y' | 'x'
) {
  const rootRef = useRef<HTMLDivElement>(null);
  const [dragging, setDragging] = useState<string | null>(null);

  useEffect(() => {
    if (!dragging) return;
    const onMove = (event: PointerEvent) => {
      const root = rootRef.current;
      if (!root) return;
      event.preventDefault();
      const at = axis === 'y' ? event.clientY : event.clientX;
      const mids = order.map((key) => {
        const box = root.querySelector(`[data-section="${key}"]`)?.getBoundingClientRect();
        if (!box) return { key, mid: Number.POSITIVE_INFINITY };
        return { key, mid: axis === 'y' ? box.top + box.height / 2 : box.left + box.width / 2 };
      });
      const over = mids.findIndex((item) => at < item.mid);
      const target = over < 0 ? order.length - 1 : over;
      const next = order.filter((key) => key !== dragging);
      next.splice(Math.min(Math.max(target, 0), next.length), 0, dragging);
      if (next.join('|') !== order.join('|')) onOrder(next);
    };
    const stop = () => setDragging(null);
    window.addEventListener('pointermove', onMove, { passive: false });
    window.addEventListener('pointerup', stop);
    window.addEventListener('pointercancel', stop);
    return () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', stop);
      window.removeEventListener('pointercancel', stop);
    };
  }, [dragging, order, onOrder, axis]);

  return {
    rootRef,
    dragging,
    grip: (key: string) => (event: React.PointerEvent) => {
      event.preventDefault();
      event.stopPropagation();
      setDragging(key);
    }
  };
}

export function Tool({
  icon: Icon,
  label,
  hint,
  on,
  badge,
  badgeDone,
  disabled,
  onClick
}: {
  icon: ComponentType<{ className?: string }>;
  label: string;
  /** The key that does the same thing, where there is a keyboard. */
  hint?: string;
  on?: boolean;
  badge?: ReactNode;
  badgeDone?: boolean;
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      className="review-dock-tool"
      data-on={on || undefined}
      disabled={disabled}
      aria-pressed={on}
      title={hint ? `${label} · ${hint}` : label}
      onClick={onClick}
    >
      <span className="review-dock-icon">
        <Icon className="size-[18px]" />
        {badge ? <span className="review-badge" data-done={badgeDone || undefined}>{badge}</span> : null}
      </span>
      <span className="review-dock-name">{label}</span>
      {hint ? <kbd className="review-dock-key">{hint}</kbd> : null}
    </button>
  );
}

/** One room of the console. The header is the hit area and always says how
 *  much is inside, so a shut section is still a reading of what it holds. */
export function Fold({
  icon: Icon,
  name,
  count,
  news,
  hint,
  tone,
  open,
  onToggle,
  big,
  onBig,
  action,
  section,
  onGrip,
  dragging,
  children
}: {
  icon: ComponentType<{ className?: string }>;
  name: string;
  count?: number;
  news?: number;
  /** A word about what is running inside, readable with the fold shut. */
  hint?: ReactNode;
  /** 'paper' for the journal, which is a document and is read; 'glass' for
   *  console furniture, which sits on the page. */
  tone: 'paper' | 'glass';
  open: boolean;
  onToggle: () => void;
  /** Sections holding something worth reading can take the dock's whole
   *  height. Absent, the section has no such button and keeps its share. */
  big?: boolean;
  onBig?: () => void;
  /** Anything else that belongs in the band, left of the controls. */
  action?: ReactNode;
  /** This section's key, for putting the sections in your own order. */
  section?: string;
  onGrip?: (event: React.PointerEvent) => void;
  dragging?: boolean;
  children: ReactNode;
}) {
  return (
    <section
      className="review-fold"
      data-section={section}
      data-tone={tone}
      data-open={open || undefined}
      data-big={(open && big) || undefined}
      data-dragging={dragging || undefined}
    >
      {/* A band, not one big button: it has controls of its own in it, and a
          button cannot hold another button. */}
      <div className="review-fold-head">
        {onGrip ? (
          <span
            className="review-fold-grip"
            onPointerDown={onGrip}
            title={`Drag to move ${name}`}
            aria-hidden="true"
          >
            <GripVertical className="size-3.5" />
          </span>
        ) : null}
        <button
          type="button"
          className="review-fold-face"
          aria-expanded={open}
          onClick={onToggle}
        >
          <Icon className="size-4" />
          <span className="review-fold-name">{name}</span>
          {hint ? <span className="review-fold-hint">{hint}</span> : null}
          {news ? <span className="review-fold-new">{news} new</span> : null}
          {count ? <span className="review-fold-count">{count}</span> : null}
        </button>

        {open ? action : null}

        {/* Only while it is open: a control that grows something folded away
            is a control for a thing you cannot see. */}
        {onBig && open ? (
          <button
            type="button"
            className="review-fold-big"
            aria-pressed={big}
            aria-label={big ? `Shrink ${name}` : `Give ${name} the whole dock`}
            title={big ? 'Back to its share' : 'Fill the dock'}
            onClick={onBig}
          >
            {big ? <Minimize2 className="size-4" /> : <Maximize2 className="size-4" />}
          </button>
        ) : null}

        <button
          type="button"
          className="review-fold-toggle"
          aria-expanded={open}
          aria-label={open ? `Fold ${name} away` : `Open ${name}`}
          onClick={onToggle}
        >
          <ChevronDown className="size-4 review-fold-caret" />
        </button>
      </div>
      {open ? <div className="review-fold-body">{children}</div> : null}
    </section>
  );
}
