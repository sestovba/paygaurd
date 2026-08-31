// The two pieces both docks are built from. A phone stacks them on the bottom
// edge and a desktop stands them in a rail down the side, but a tool is a tool
// and a section is a section, and they behave the same in both.

import type { ComponentType, ReactNode } from 'react';
import { ChevronDown, Maximize2, Minimize2 } from 'lucide-react';

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
  children: ReactNode;
}) {
  return (
    <section
      className="review-fold"
      data-tone={tone}
      data-open={open || undefined}
      data-big={(open && big) || undefined}
    >
      {/* A band, not one big button: it has controls of its own in it, and a
          button cannot hold another button. */}
      <div className="review-fold-head">
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
