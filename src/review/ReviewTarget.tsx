import { useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { Eye, EyeOff, MessageSquarePlus } from 'lucide-react';
import type { ReviewLayoutId } from './types';
import { useReview } from './context';

/**
 * Wraps a section that has a proposal attached to it. Invisible until the
 * console is pointing, then it outlines itself and offers the two things you
 * can do to an element *while looking at it*.
 *
 * There were six buttons here — Hide, Archive, Unsure, Change, Keep, Remove —
 * four of which set a verdict, which was a second state axis running beside
 * the note's own. Deciding is now done in one place, on the note, where the
 * state actually lives. What is left is the pair that only make sense with
 * the page in front of you:
 *
 *   Hide   Switch it off and look at the page without it. This is how the
 *          question gets answered — you cannot tell whether a thing should go
 *          by staring at it, only by seeing what is left without it.
 *   Say    You know what you want instead: say it, right here.
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
  layout: ReviewLayoutId;
  className?: string;
  children: ReactNode;
}) {
  const review = useReview();
  const host = useRef<HTMLDivElement>(null);
  const register = review?.register;

  useEffect(() => register?.(id, label, reason), [register, id, label, reason]);

  const active = review?.mode === 'pick';
  const [tiny, setTiny] = useState(false);

  // Round buttons sitting inside a 32px-tall row cover the very thing they
  // are asking about, so small sections put their controls underneath.
  useEffect(() => {
    const el = host.current;
    if (!el || !active) return;
    const measure = () => {
      const box = el.getBoundingClientRect();
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

  const hidden = Boolean(review?.isHidden(id));
  const target = { id, label, reason, layout };

  function stop(event: React.MouseEvent) {
    event.preventDefault();
    event.stopPropagation();
  }

  if (hidden) {
    if (!review || !active) return null;
    return (
      <div className={`review-slot ${className}`} data-review-id={id} data-review-ui data-hidden>
        <EyeOff className="size-3.5 shrink-0" />
        <span className="review-slot-label">Hidden · {label}</span>
        <button
          type="button"
          onClick={() => review.setHidden(target, false, null)}
          title="Put it back on the page"
        >
          <Eye className="size-3.5" /> Restore
        </button>
      </div>
    );
  }

  return (
    <div
      ref={host}
      className={`review-target ${className}`}
      data-review-transparent={className ? undefined : true}
      data-review-on={active || undefined}
      data-review-focus={active && review?.focusId === id ? true : undefined}
      data-review-dim={active && review?.focusId && review.focusId !== id ? true : undefined}
      data-review-size={active && tiny ? 'tiny' : undefined}
      data-review-id={id}
      onClick={() => {
        if (active && review?.focusId !== id) review?.focusProposal?.(id);
      }}
    >
      {children}
      {active ? (
        <>
          <span className="review-target-tag">{label}</span>
          <span className="review-target-tools" data-review-ui>
            <button
              type="button"
              className="review-target-btn review-look"
              onClick={(event) => { stop(event); review?.setHidden(target, true, host.current); }}
              aria-label={`Hide ${label}`}
              title="Hide (H) — see the page without it. Reversible, no code touched."
            >
              <Eye className="size-4" />
            </button>
            <button
              type="button"
              className="review-target-btn review-maybe"
              onClick={(event) => { stop(event); review?.commentOn(label, host.current, { id, reason }); }}
              aria-label={`Say what should change about ${label}`}
              title={`Say (C) — what should change instead. ${reason}`}
            >
              <MessageSquarePlus className="size-4" />
            </button>
          </span>
        </>
      ) : null}
    </div>
  );
}
