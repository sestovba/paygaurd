// Small presentational pieces shared by the PayGuard screens. They exist so
// the same readout doesn't get re-typed with slightly different font sizes and
// paddings in three files — the sizes live in payguard.css, not here.

import type { ReactNode } from 'react';
import { ChevronDown } from 'lucide-react';

/** One cell of the overview instrument panel. */
export function Stat({
  label, value, sub, valueColor, children
}: {
  label: string;
  value: ReactNode;
  sub?: ReactNode;
  /** A --pg-* colour, for figures that carry a status. */
  valueColor?: string;
  /** Extra content between the figure and the caption (pips, a meter). */
  children?: ReactNode;
}) {
  return (
    <div className="pg-stat">
      <span className="pg-label truncate">{label}</span>
      <span className="pg-figure pg-figure-lg" style={valueColor ? { color: valueColor } : undefined}>
        {value}
      </span>
      {children}
      {sub ? <span className="pg-stat-sub">{sub}</span> : null}
    </div>
  );
}

/** One cell of the summary deck under the monthly analysis. */
export function Tile({
  label, value, note, valueColor, children
}: {
  label: string;
  value: ReactNode;
  note?: ReactNode;
  valueColor?: string;
  children?: ReactNode;
}) {
  return (
    <div className="pg-tile">
      <span className="pg-label truncate">{label}</span>
      <span className="pg-figure pg-figure-md" style={valueColor ? { color: valueColor } : undefined}>
        {value}
      </span>
      {children}
      {note ? <span className="pg-tile-note">{note}</span> : null}
    </div>
  );
}

/**
 * Collapsible section header. `action` renders inside the fixed-height bar
 * rather than growing it, so a header with a button lines up with one
 * without — they used to differ by the button's own height.
 */
export function SectionHead({
  label, meta, open, onToggle, action
}: {
  label: string;
  meta?: ReactNode;
  open: boolean;
  onToggle: () => void;
  action?: ReactNode;
}) {
  return (
    <div className="pg-section-head">
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        className="pg-section-head-toggle"
      >
        <ChevronDown
          className={`size-4 shrink-0 pg-muted transition-transform duration-150 ${open ? '' : '-rotate-90'}`}
        />
        <span className="pg-section-title">{label}</span>
        {meta ? <span className="pg-section-meta hidden xs:block">{meta}</span> : null}
      </button>
      {action ? <span className="flex shrink-0 items-center">{action}</span> : null}
    </div>
  );
}
