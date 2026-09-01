import type { LayoutMode } from '../state/storage';
import { Check } from 'lucide-react';

export interface LayoutOption {
  id: LayoutMode;
  label: string;
  description: string;
}

export interface LayoutGroup {
  title: string;
  options: ReadonlyArray<LayoutOption>;
}

/**
 * Grouped by the thing a person choosing actually cares about: how much of
 * the year is in front of you at once.
 *
 * They used to be grouped by where they came from — two groups both titled
 * "Variants", then "Calc20 (derivative)" and "Calc20 (as built)", with a
 * sibling repository named in the description. That is the project's own
 * history, and it is a heading only the person who wrote it can read.
 */
export const LAYOUT_GROUPS: ReadonlyArray<LayoutGroup> = [
  {
    title: 'All on one page',
    options: [
      { id: 'classic', label: 'Classic', description: 'The month, the year and your jobs, in one scroll.' },
      { id: 'ledger', label: 'Ledger', description: 'Every month as a row. Fastest for typing amounts in.' }
    ]
  },
  {
    title: 'One section at a time',
    options: [
      { id: 'payguard', label: 'PayGuard', description: 'Cards you edit in place, with a bar to switch sections.' },
      { id: 'v2', label: 'Sidebar', description: 'Overview, income and trial-work status as separate pages.' },
      { id: 'responsive', label: 'Workspace', description: 'Open a job beside the overview instead of on top of it.' }
    ]
  },
  {
    title: 'Compact',
    options: [
      { id: 'workrecord', label: 'Work Record', description: 'The year as a grid, with the months that need you on top.' },
      { id: 'calc20', label: 'Calc20', description: 'Twelve squares and a running total. The least on screen.' }
    ]
  }
];

export const LAYOUTS: ReadonlyArray<LayoutOption> = LAYOUT_GROUPS.flatMap((g) => g.options);

export function LayoutSwitcher({
  value, onChange, variant = 'list'
}: {
  value: LayoutMode;
  onChange: (layout: LayoutMode) => void;
  variant?: 'list' | 'select';
}) {
  if (variant === 'select') {
    return (
      <div>
        <label className="block">
          <span className="field-label">Dashboard layout</span>
          <select
            value={value}
            onChange={(event) => onChange(event.currentTarget.value as LayoutMode)}
            className="field-input mt-2 w-full"
          >
            {LAYOUT_GROUPS.map((group, gIdx) => (
              <optgroup key={gIdx} label={group.title}>
                {group.options.map((layout) => (
                  <option key={layout.id} value={layout.id}>{layout.label}</option>
                ))}
              </optgroup>
            ))}
          </select>
        </label>
        <p className="type-muted mt-1.5 text-xs">
          Saved on this device and used after sign-in.
        </p>
      </div>
    );
  }

  return (
    <div role="radiogroup" aria-label="Layout" className="flex flex-col gap-4">
      {LAYOUT_GROUPS.map((group, gIdx) => (
        <div key={gIdx} className="flex flex-col gap-1.5">
          <span className="label-caps px-1 text-xs font-bold text-muted-foreground">{group.title}</span>
          <div className="option-list">
            {group.options.map((option) => {
              const selected = value === option.id;
              return (
                <button
                  key={option.id}
                  type="button"
                  role="radio"
                  aria-checked={selected}
                  onClick={() => onChange(option.id)}
                  className="option-row"
                  data-selected={selected}
                >
                  <span className="option-mark" aria-hidden="true">
                    {selected ? <Check className="size-3.5" /> : null}
                  </span>
                  <span className="min-w-0 flex-1 text-left">
                    <span className="block text-base font-semibold leading-snug">{option.label}</span>
                    {option.description ? (
                      <span className="type-muted mt-0.5 block text-sm leading-snug">{option.description}</span>
                    ) : null}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
