import type { LayoutMode } from '../state/storage';
import { Check } from 'lucide-react';
import { LAYOUTS as REGISTRY } from 'virtual:pg-layouts';

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
 * person choosing between nine of them can act on.
 *
 * This list used to be written here by hand. It went wrong in two ways worth
 * recording, because both will happen again as layouts are added.
 *
 * It drifted. The review console's copy of the menu listed six of the ten
 * layouts — Plan among the missing — and nothing about reading either file
 * said so. A list kept in a file the thing itself does not live in is a list
 * that gets forgotten on the pass that matters.
 *
 * And it grew a heading per layout. Three new layouts arrived and each took
 * a group of its own, so ten options sat under six headings, half of them
 * holding one item. A group of one is not a group; it is a heading with an
 * option under it, and the reader still has to read every line.
 *
 * So the list is derived. Each layout's README declares where it sits:
 *
 *     <!-- registry: order="3" group="The least on screen" -->
 *
 * and vite.layouts-plugin.ts reads the folder, the title and the lead
 * sentence out of the same file. Adding a layout is adding its folder and
 * its README — no central list to keep, here or in the console. Group order
 * is its lowest member's order, so the headings need no list either.
 */
const KNOWN_IDS = new Set<string>([
  'overview', 'ledger', 'payguard', 'workrecord', 'calc20', 'horizon', 'pocket', 'charm', 'plan', 'beautiful'
]);

function isLayoutMode(id: string): id is LayoutMode {
  return KNOWN_IDS.has(id);
}

export const LAYOUT_GROUPS: ReadonlyArray<LayoutGroup> = (() => {
  const groups: LayoutGroup[] = [];
  const byTitle = new Map<string, LayoutOption[]>();
  for (const entry of REGISTRY) {
    if (!isLayoutMode(entry.id)) continue;
    let options = byTitle.get(entry.group);
    if (!options) {
      options = [];
      byTitle.set(entry.group, options);
      groups.push({ title: entry.group, options });
    }
    options.push({ id: entry.id, label: entry.label, description: entry.description });
  }
  return groups;
})();

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
