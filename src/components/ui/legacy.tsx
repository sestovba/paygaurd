/*
 * The controls that predate the shared layer.
 *
 * This file was `src/components/ui.tsx` — 217 lines holding Switch, Chip,
 * Segmented, SwatchPicker and no Button, which is why eight layouts each
 * invented their own. It keeps its name in the diff and its call sites, and
 * everything in it is a candidate to move into a real primitive beside
 * Button.tsx. Nothing new goes in here.
 */
import type { ReactNode } from 'react';
import { Check, DollarSign, Plus } from 'lucide-react';
import { SOURCE_CHOICE } from '../../domain/copy';

import { ButtonBase } from './Button';
export function BrandMark({
  onClick, subtitle
}: {
  onClick?: () => void;
  subtitle?: string;
}) {
  const inner = (
    <>
      <span className="grid size-10 shrink-0 place-items-center rounded-lg bg-primary text-primary-foreground shadow-[var(--shadow-lime)]">
        <DollarSign className="size-5" />
      </span>
      <span className="min-w-0 text-left">
        <span className="block truncate text-base font-bold tracking-tight">PayGuard</span>
        {subtitle ? <span className="label-caps mt-0.5 hidden sm:block">{subtitle}</span> : null}
      </span>
    </>
  );

  if (!onClick) {
    return <div className="flex min-w-0 items-center gap-2.5">{inner}</div>;
  }

  return (
    <ButtonBase
      type="button"
      onClick={onClick}
      aria-label="Go to overview"
      className="flex min-w-0 items-center gap-2.5 rounded-lg text-left transition-opacity hover:opacity-80"
    >
      {inner}
    </ButtonBase>
  );
}

export function Switch({
  checked, onChange, label
}: {
  checked: boolean;
  onChange: () => void;
  label: string;
}) {
  return (
    <ButtonBase
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      data-state={checked ? 'checked' : 'unchecked'}
      onClick={onChange}
      className="switch"
    >
      <span
        data-state={checked ? 'checked' : 'unchecked'}
        className="switch-thumb"
      />
    </ButtonBase>
  );
}

export function Chip({
  tone = 'muted', children
}: {
  tone?: 'good' | 'info' | 'warn' | 'muted' | 'danger';
  children: ReactNode;
}) {
  return <span className={'chip chip-' + tone}>{children}</span>;
}

export function Segmented<T extends string>({
  value, onChange, options, columns
}: {
  value: T | undefined;
  onChange: (value: T) => void;
  options: ReadonlyArray<{ id: T; label: string }>;
  columns?: 2 | 3 | 4 | 5;
}) {
  return (
    <div
      className="seg"
      /* How many across it would like to be. Whether it gets that many is
         settled by the labels and the width — see `seg` in index.css. */
      style={{ '--seg-cols': columns ?? 2 } as React.CSSProperties}
    >
      {options.map((option) => (
        <ButtonBase
          key={option.id}
          type="button"
          onClick={() => onChange(option.id)}
          className={'seg-item ' + (value === option.id ? 'seg-item-on' : '')}
        >
          {option.label}
        </ButtonBase>
      ))}
    </div>
  );
}

/**
 * A vertical list of mutually exclusive options, each with room for a
 * sentence of explanation. Use instead of <Segmented> whenever there are
 * more than three choices or the labels need describing — a five-column
 * segmented control leaves no room for either.
 */
export function OptionList<T extends string>({
  value, onChange, options, name
}: {
  value: T;
  onChange: (value: T) => void;
  options: ReadonlyArray<{ id: T; label: string; description?: string }>;
  /** Radio group name; must be unique on the page. */
  name: string;
}) {
  return (
    <div role="radiogroup" aria-label={name} className="option-list">
      {options.map((option) => {
        const selected = value === option.id;
        return (
          <ButtonBase
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
          </ButtonBase>
        );
      })}
    </div>
  );
}

/** A row of colour swatches for picking a layout's sub-theme. */
export function SwatchPicker<T extends string>({
  value, onChange, options, label
}: {
  value: T;
  onChange: (value: T) => void;
  options: ReadonlyArray<{ id: T; label: string; colors: [string, string, string] }>;
  label: string;
}) {
  return (
    <div role="radiogroup" aria-label={label} className="grid grid-cols-2 gap-2 sm:grid-cols-3">
      {options.map((option) => {
        const selected = value === option.id;
        return (
          <ButtonBase
            key={option.id}
            type="button"
            role="radio"
            aria-checked={selected}
            onClick={() => onChange(option.id)}
            className="swatch"
            data-selected={selected}
          >
            <span className="swatch-strip" aria-hidden="true">
              {option.colors.map((color, i) => (
                <span key={i} style={{ background: color }} />
              ))}
            </span>
            <span className="text-sm font-semibold">{option.label}</span>
          </ButtonBase>
        );
      })}
    </div>
  );
}

export function AddJobButton({
  type, onClick
}: {
  type: 'w2' | 'ten99';
  onClick: () => void;
}) {
  /* The reasoning moved to SOURCE_CHOICE in domain/copy.ts, because the
     workspace's Add income sheet was offering the tax-form pair for the very
     same decision. One door, one set of words. */
  const label = SOURCE_CHOICE[type].label;
  return (
    <ButtonBase
      type="button"
      onClick={onClick}
      title={label}
      className={'add-job ' + (type === 'w2' ? 'text-good-text hover:bg-good-soft' : 'text-info-text hover:bg-info-soft')}
    >
      <Plus className="size-5 shrink-0" />
      <span className="btn-label">{label}</span>
    </ButtonBase>
  );
}
