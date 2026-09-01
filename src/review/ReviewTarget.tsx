import { useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { Archive, CircleEllipsis, Eye, EyeOff, MessageSquarePlus, Trash2, Undo2, X } from 'lucide-react';
import type { LayoutMode } from '../state/storage';
import type { Certainty } from './state';
import { useReview } from './context';

/**
 * Wraps a section the audit proposes cutting. Invisible until Audit mode is
 * on, then it outlines itself and offers what you need to answer the
 * proposal. Nothing here can touch tracker data.
 *
 * Five controls, in the order you actually reach for them. Everything left
 * of the rule keeps the question open; everything right of it closes it.
 *
 *   Preview Cut  Switch it off and look at the page without it. This is how the
 *                question gets answered — you cannot tell whether a thing should
 *                go by staring at it, only by seeing what is left without it.
 *                Costs nothing, changes no code, and is the reason it is first.
 *   Archive      Carry it onto a shelf. Hide's companion: the same "off the page
 *                without deciding anything", but it keeps the thing somewhere
 *                you can find it again and drag it back.
 *   Unsure       You looked and cannot call it.
 *   Change       You know what you want instead: say it.
 *   ─────
 *   Keep As-Is   Not doing this. The proposal comes off the board.
 *   Remove       Agree to the cut. The one control here that reaches the code.
 */
export function ReviewTarget({
  id,
  label,
  reason,
  certainty = 'likely',
  layout,
  className = '',
  children
}: {
  id: string;
  label: string;
  reason: string;
  /** How sure this proposal is. Defaults to 'likely' — the honest answer
   *  when nobody has thought about it, and never 'sure', which has to be
   *  earned by the claim being checkable. */
  certainty?: Certainty;
  layout: LayoutMode;
  className?: string;
  children: ReactNode;
}) {
  const review = useReview();
  const host = useRef<HTMLDivElement>(null);
  const register = review?.register;

  useEffect(() => register?.(id, label, reason, certainty), [register, id, label, reason, certainty]);

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
  const hidden = Boolean(review?.isHidden(id));
  const target = { id, label, reason, layout };

  function stop(event: React.MouseEvent) {
    event.preventDefault();
    event.stopPropagation();
  }

  if (hidden) {
    if (!review || review.mode !== 'audit') return null;
    return (
      <div className={`review-slot ${className}`} data-review-id={id} data-review-ui data-hidden>
        <EyeOff className="size-3.5 shrink-0" />
        <span className="review-slot-label">Hidden · {label}</span>
        <button
          type="button"
          onClick={() => review.setHidden(target, false, null)}
          title="Restore it to the page"
        >
          <Eye className="size-3.5" /> Restore
        </button>
      </div>
    );
  }

  if (stowed) {
    if (!review || review.mode !== 'audit') return null;
    return (
      <div className={`review-slot ${className}`} data-review-id={id} data-review-ui>
        <Archive className="size-3.5 shrink-0" />
        <span className="review-slot-label">Archived · {label}</span>
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
      data-review-transparent={className ? undefined : true}
      data-review-on={active || undefined}
      data-review-focus={active && review?.focusId === id ? true : undefined}
      data-review-dim={active && review?.focusId && review.focusId !== id ? true : undefined}
      data-review-verdict={verdict}
      data-review-size={active && tiny ? 'tiny' : undefined}
      data-review-id={id}
      onClick={() => {
        if (active && review?.focusId !== id) {
          review?.focusProposal?.(id);
        }
      }}
    >
      {children}
      {active ? (
        <>
          <span className="review-target-tag" data-verdict={verdict}>
            {label}
            {verdict === 'approved' ? ' · ✂️ Remove'
              : verdict === 'rejected' ? ' · ✓ Kept'
                : verdict === 'revise' ? ' · 💬 Note'
                  : verdict === 'unsure' ? ' · … Unsure' : ''}
          </span>
          <span className="review-target-tools" data-review-ui>
            <button
              type="button"
              className="review-target-btn review-look"
              data-on={hidden || undefined}
              onClick={(event) => { stop(event); review?.setHidden(target, !hidden, host.current); }}
              aria-label={hidden ? `Show ${label}` : `Preview hide ${label}`}
              title={hidden
                ? 'Back on the page. Nothing was decided.'
                : 'Preview cut (H) — see the page without it. Reversible, no code touched.'}
            >
              {hidden ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
            </button>
            <button
              type="button"
              className="review-target-btn review-shelve"
              data-on={stowed || undefined}
              onClick={(event) => {
                stop(event);
                if (host.current) review?.stow(host.current, 'right', { label });
              }}
              aria-label={`Archive ${label}`}
              title="Archive / Stow — onto the right shelf."
            >
              <Archive className="size-4" />
            </button>
            <button
              type="button"
              className="review-target-btn review-unsure"
              data-on={verdict === 'unsure' || undefined}
              onClick={(event) => { stop(event); review?.decide(target, 'unsure', host.current); }}
              aria-label={`Unsure about ${label}`}
              title="Unsure — looked at it, cannot call it yet."
            >
              <CircleEllipsis className="size-4" />
            </button>
            <button
              type="button"
              className="review-target-btn review-maybe"
              data-on={verdict === 'revise' || undefined}
              onClick={(event) => { stop(event); review?.decide(target, 'revise', host.current); }}
              aria-label={`Change / Comment on ${label}`}
              title="Change / Note (C) — say what should change instead."
            >
              <MessageSquarePlus className="size-4" />
            </button>
            <span className="review-target-rule" aria-hidden="true" />
            <button
              type="button"
              className="review-target-btn review-no"
              data-on={verdict === 'rejected' || undefined}
              onClick={(event) => { stop(event); review?.decide(target, 'rejected', host.current); }}
              aria-label={`Keep ${label} as-is`}
              title="Keep As-Is (K) — reject proposal, keep in product."
            >
              <X className="size-4" />
            </button>
            <button
              type="button"
              className="review-target-btn review-yes"
              data-on={verdict === 'approved' || undefined}
              onClick={(event) => { stop(event); review?.decide(target, 'approved', host.current); }}
              aria-label={`Remove ${label}`}
              title={`Remove (R) — agree to delete from code. ${reason}`}
            >
              <Trash2 className="size-4" />
            </button>
          </span>
        </>
      ) : null}
    </div>
  );
}
