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
 * Grouped by what you want out of the screen, which is the only thing a
 * person choosing between ten of them can act on.
 *
 * They were grouped by where they came from — two groups both titled
 * "Variants", then "Calc20 (derivative)" and "Calc20 (as built)", with a
 * sibling repository named in a description. That is the project's own
 * history, and it is a heading only the person who wrote it can read.
 *
 * The second failure was subtler and worth naming, because it will happen
 * again as layouts are added: three new ones arrived and each took a heading
 * of its own, so the list grew six groups for ten options and half of them
 * held one item. A group of one is not a group — it is a heading with an
 * option under it, and the reader still has to read every line.
 *
 * So: four headings, none of them fewer than two, and every one of them a
 * sentence about what you are trying to do rather than about how the screen
 * is built. A new layout joins the group whose job it does.
 */
export const LAYOUT_GROUPS: ReadonlyArray<LayoutGroup> = [
  {
    title: 'Deciding what to do next',
    options: [
      {
        id: 'plan',
        label: 'Plan',
        description: 'How many more hours you can work, what a shift would cost you, and which months pay you extra.'
      },
      {
        id: 'horizon',
        label: 'Horizon',
        description: 'The months you have left, what lands in them, and what to do about it.'
      }
    ]
  },
  {
    title: 'The least on screen',
    options: [
      {
        id: 'pocket',
        label: 'Pocket',
        description: 'Big text, one action, no chart. Built for a cheap phone on slow data.'
      },
      { id: 'workrecord', label: 'Work Record', description: 'The year as a grid, with the months that need you on top.' },
      { id: 'calc20', label: 'Calc20', description: 'Twelve squares and a running total.' }
    ]
  },
  {
    title: 'Typing income in',
    options: [
      { id: 'ledger', label: 'Ledger', description: 'Every month as a row. Fastest for entering amounts.' },
      { id: 'payguard', label: 'PayGuard', description: 'Cards you edit in place, with a bar to switch sections.' }
    ]
  },
  {
    title: 'The whole picture',
    options: [
      {
        id: 'overview',
        label: 'Overview',
        /* One entry, not three. Classic, Sidebar and Workspace were the same
           surfaces in three shells; which shell is a setting now, and it sits
           under this row in Settings. */
        description: 'The month, the year and your jobs. Choose one scroll, separate pages, or a job open beside them.'
      }
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
