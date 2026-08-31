import { useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { Check, MessageSquarePlus } from 'lucide-react';
import type { LayoutMode } from '../state/storage';
import { useReview } from './context';

export interface ReviewVariant {
  /** Short name shown on the chip and written into the notes file. */
  key: string;
  node: ReactNode;
}

/**
 * A/B a section: the reviewer flips between alternatives in place and keeps
 * one. The kept variant is what the app renders from then on, so the choice
 * is lived with rather than judged from a screenshot.
 */
export function ReviewVariants({
  id,
  label,
  layout,
  options,
  className = ''
}: {
  id: string;
  label: string;
  layout: LayoutMode;
  options: ReviewVariant[];
  className?: string;
}) {
  const review = useReview();
  const host = useRef<HTMLDivElement>(null);
  const registerVariants = review?.registerVariants;

  useEffect(() => registerVariants?.(id), [registerVariants, id]);
  const chosen = review?.notes[id]?.choice;
  const [preview, setPreview] = useState<string | null>(null);

  // A kept choice wins; while comparing, the previewed one shows instead.
  const showing = preview ?? chosen ?? options[0]?.key;
  const current = options.find((option) => option.key === showing) ?? options[0];
  const active = review?.mode === 'variants';

  useEffect(() => {
    if (!active) setPreview(null);
  }, [active]);

  return (
    <div
      ref={host}
      className={`review-variants ${className}`}
      data-review-on={active || undefined}
      data-review-id={id}
    >
      {active ? (
        <div className="review-variant-bar" data-review-ui>
          <span className="review-variant-name">{label}</span>
          {options.map((option) => (
            <button
              key={option.key}
              type="button"
              data-on={option.key === showing || undefined}
              onClick={() => setPreview(option.key)}
            >
              {option.key}
              {chosen === option.key ? <Check className="size-3.5" /> : null}
            </button>
          ))}
          <button
            type="button"
            className="review-variant-keep"
            onClick={() => {
              review?.chooseVariant(
                { id, label, layout },
                showing,
                options.map((option) => option.key),
                host.current
              );
              setPreview(null);
            }}
          >
            Keep this
          </button>
          <button
            type="button"
            className="review-variant-note"
            aria-label={`Comment on ${label}`}
            onClick={() => review?.commentOn(`${label} (${showing})`, host.current, { id: `${id}-note` })}
          >
            <MessageSquarePlus className="size-4" />
          </button>
        </div>
      ) : null}
      {current?.node}
    </div>
  );
}
