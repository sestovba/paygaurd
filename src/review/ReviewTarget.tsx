import { useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { Archive, Check, MessageSquarePlus, Trash2, Undo2, X } from 'lucide-react';
import type { LayoutMode } from '../state/storage';
import { useReview } from './context';

/**
 * Wraps a section the audit proposes cutting. Invisible until Delete mode is
 * on, then it outlines itself and offers the three answers: agree, keep, or
 * comment. Nothing here can touch tracker data.
 */
export function ReviewTarget({
  id,
  label,
  reason,
  layout,
  className = '',
  children
}: {
  id: string;
  label: string;
  reason: string;
  layout: LayoutMode;
  className?: string;
  children: ReactNode;
}) {
  const review = useReview();
  const host = useRef<HTMLDivElement>(null);
  const register = review?.register;

  useEffect(() => register?.(id, label, reason), [register, id, label, reason]);

  const verdict = review?.notes[id]?.verdict;
  const active = review?.mode === 'audit';
  const [tiny, setTiny] = useState(false);

  // Three round buttons sitting inside a 32px-tall row cover the very thing
  // they are asking about, so small sections put their controls underneath.
  useEffect(() => {
    const el = host.current;
    if (!el || !active) return;
    const measure = () => {
      const box = el.getBoundingClientRect();
      // A wrapper that was display:contents a frame ago measures zero. That
      // is "not laid out yet", not "small", and calling it small would send a
      // whole card's controls somewhere they do not belong.
      if (!box.width && !box.height) return;
      setTiny(box.height < 76 || box.width < 280);
    };
    const first = requestAnimationFrame(measure);
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => {
      cancelAnimationFrame(first);
      observer.disconnect();
    };
  }, [active]);
  const stowed = Boolean(review?.isStowed(id));
  const target = { id, label, reason, layout };

  function stop(event: React.MouseEvent) {
    event.preventDefault();
    event.stopPropagation();
  }

  // Stowed means out of the page, not gone: nothing renders while the console
  // is closed, and a slot stands in its place while reviewing so it can be
  // dropped back or dragged somewhere else.
  if (stowed) {
    if (!review || review.mode === 'off') return null;
    return (
      <div className={`review-slot ${className}`} data-review-id={id} data-review-ui>
        <Archive className="size-3.5 shrink-0" />
        <span className="review-slot-label">Stowed · {label}</span>
        <button type="button" onClick={() => review.restore(id)} title="Put it back here">
          <Undo2 className="size-3.5" /> Restore
        </button>
      </div>
    );
  }

  return (
    <div
      ref={host}
      className={`review-target ${className}`}
      /* With no class of its own the wrapper has no business in the layout —
         display:contents hands the child straight to the parent's flex or
         grid, so wrapping a section cannot resize it. */
      data-review-transparent={className ? undefined : true}
      data-review-on={active || undefined}
      data-review-focus={active && review?.focusId === id ? true : undefined}
      data-review-dim={active && review?.focusId && review.focusId !== id ? true : undefined}
      data-review-verdict={verdict}
      data-review-size={active && tiny ? 'tiny' : undefined}
      data-review-id={id}
    >
      {children}
      {active ? (
        <>
          <span className="review-target-tag">{label}</span>
          <span className="review-target-tools" data-review-ui>
            <button
              type="button"
              className="review-target-btn review-yes"
              data-on={verdict === 'approved' || undefined}
              onClick={(event) => { stop(event); review?.decide(target, 'approved', host.current); }}
              aria-label={`Agree: delete ${label}`}
              title={`Agree, cut it. ${reason}`}
            >
              <Trash2 className="size-4" />
            </button>
            <button
              type="button"
              className="review-target-btn review-no"
              data-on={verdict === 'rejected' || undefined}
              onClick={(event) => { stop(event); review?.decide(target, 'rejected', host.current); }}
              aria-label={`Keep ${label}`}
              title="Keep it — reject this suggestion."
            >
              {verdict === 'rejected' ? <Check className="size-4" /> : <X className="size-4" />}
            </button>
            <button
              type="button"
              className="review-target-btn review-maybe"
              data-on={verdict === 'revise' || undefined}
              onClick={(event) => { stop(event); review?.decide(target, 'revise', host.current); }}
              aria-label={`Comment on ${label}`}
              title="Neither — say what should change."
            >
              <MessageSquarePlus className="size-4" />
            </button>
          </span>
        </>
      ) : null}
    </div>
  );
}
