import { Check } from 'lucide-react';
import type { TraySettings as TraySettingsValue, TraySort } from './types';

const COLORS = ['#38bdf8', '#f87171', '#fbbf24', '#4ade80', '#a78bfa', '#94a3b8'];

const SORTS: { id: TraySort; label: string }[] = [
  { id: 'newest', label: 'Newest' },
  { id: 'oldest', label: 'Oldest' },
  { id: 'label', label: 'A–Z' },
  { id: 'flagged', label: 'Flagged first' }
];

/** The little settings sheet behind a stash's gear. */
export function TraySettingsPanel({
  edge,
  value,
  onChange,
  onClose
}: {
  edge: string;
  value: TraySettingsValue;
  onChange: (patch: TraySettingsValue) => void;
  onClose: () => void;
}) {
  return (
    <div className="review-tray-settings" data-review-ui>
      <label>
        <span>Name</span>
        <input
          autoFocus
          value={value.name ?? ''}
          placeholder={`${edge} stash`}
          onChange={(event) => onChange({ name: event.currentTarget.value })}
        />
      </label>

      <div className="review-tray-swatches">
        {COLORS.map((color) => (
          <button
            key={color}
            type="button"
            style={{ background: color }}
            data-on={(value.color ?? COLORS[0]) === color || undefined}
            aria-label={`Colour ${color}`}
            onClick={() => onChange({ color })}
          />
        ))}
      </div>

      <div className="review-tray-sorts">
        {SORTS.map((sort) => (
          <button
            key={sort.id}
            type="button"
            data-on={(value.sort ?? 'newest') === sort.id || undefined}
            onClick={() => onChange({ sort: sort.id })}
          >
            {sort.label}
          </button>
        ))}
      </div>

      <button type="button" className="review-tray-done" onClick={onClose}>
        <Check className="size-3.5" /> Done
      </button>
    </div>
  );
}

export function sortLabel(sort: TraySort | undefined): string {
  return SORTS.find((item) => item.id === (sort ?? 'newest'))?.label ?? 'Newest';
}

export const TRAY_COLORS = COLORS;
