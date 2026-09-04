// A stream's twelve months.
//
// Reads as figures by default. An always-on grid of inputs makes the whole
// app look like a form you are stuck in, so entry is something you ask for:
// click any month to edit that one.

import { useEffect, useRef } from 'react';
import type { MonthEntry, MonthKey, Stream } from '../../domain/types';
import { useMonthScope, useTracker } from './state';
import { layoutFor, type UiState } from './state';
import { shortMonthName, todayMonth } from '../../domain/months';
import { isActive, countableFor, estimatedGrossFromHours } from '../../domain/earnings';
import { money } from '../../domain/format';
import { gridColumns } from './gridColumns';
import { NumericExprInput } from './NumericExprInput';
import { useViewportBand } from './useIsWide';
import { LockIcon } from './Icons';

import { ButtonBase } from '../../design-system';
type FieldId = 'gross' | 'hours' | 'miles';

interface FieldDef { id: FieldId; label: string; placeholder: string; suffix?: string }

/* The compact tone from domain/copy.ts, typed out here because this grid is
   a fixed table of column definitions rather than a component with `ui` in
   scope. "Gross" is the word the whole audit is about: it does not say which
   number, on the field where getting the number wrong is what costs people
   their benefits. Same for a bare "Miles" — personal miles do not come off. */
const W2_FIELDS: FieldDef[] = [
  { id: 'gross', label: 'Before taxes', placeholder: 'Before taxes' },
  { id: 'hours', label: 'Hours worked', placeholder: 'Hours', suffix: ' hours' }
];

const TEN99_FIELDS: FieldDef[] = [
  { id: 'gross', label: 'Paid to you', placeholder: 'Paid to you' },
  { id: 'miles', label: 'Work miles', placeholder: 'Work miles', suffix: ' miles' },
  { id: 'hours', label: 'Hours worked', placeholder: 'Hours', suffix: ' hours' }
];

export function fieldsFor(stream: Stream): FieldDef[] {
  return stream.type === 'w2' ? W2_FIELDS : TEN99_FIELDS;
}

export function MonthGrid({
  stream,
  activeFields,
  hovered,
  onHover,
  editing,
  focusMonth,
  onEditMonth,
  pivot,
  columns,
  columnAdjustment,
  density: densityOverride,
  monthColumnsAuto,
  handset = false,
  locked = false
}: {
  stream: Stream;
  activeFields: FieldId[];
  hovered: MonthKey | null;
  onHover: (month: MonthKey | null) => void;
  /** Whole-row entry. */
  editing: boolean;
  /** Single cell opened by clicking it in read mode. */
  focusMonth: MonthKey | null;
  onEditMonth: (month: MonthKey | null) => void;
  /** Optional layout overrides for a specific grid owner. */
  pivot?: boolean;
  columns?: 'auto' | number;
  /** Keeps Auto responsive while nudging it toward more or fewer columns. */
  columnAdjustment?: number;
  density?: UiState['density'];
  monthColumnsAuto?: boolean;
  handset?: boolean;
  /** Prevents accidental edits until the stream is explicitly unlocked. */
  locked?: boolean;
}) {
  const { ui, setMonthEntry } = useTracker();
  const now = todayMonth();
  const band = useViewportBand();
  const prefs = layoutFor(ui, band);
  const isPivot = pivot ?? prefs.pivot;
  const density = densityOverride ?? prefs.density;
  const fields = fieldsFor(stream).filter((f) => activeFields.includes(f.id));
  const firstInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (focusMonth && firstInputRef.current) firstInputRef.current.focus();
  }, [focusMonth]);

  const { months } = useMonthScope('many');

  return (
    <div
      className={'month-grid' + (density === 'comfortable' ? ' month-grid--comfortable' : '')}
      style={{
        gridTemplateColumns: gridColumns(
          { ...ui, density, monthColumnsAuto: monthColumnsAuto ?? prefs.monthColumnsAuto }, isPivot, columns, columnAdjustment, handset
        )
      }}
    >
      {months.map((month) => {
        const entry: MonthEntry = stream.months[month] ?? {};
        const inactive = !isActive(stream, month);
        // Once a paycheck is logged for this month, earnings.ts uses that
        // instead of the Gross/Hours override — editing them here would
        // silently do nothing, so the fields step aside instead.
        const checkDriven = stream.checks.some((c) => c.month === month && !c.projected);
        const hasData = checkDriven || fields.some((f) => Number(entry[f.id] ?? 0) !== 0);
        const open = editing || focusMonth === month;

        let cls = 'month-cell';
        if (isPivot) cls += ' month-cell--pivot';
        if (density === 'comfortable') cls += ' month-cell--comfortable';
        if (hovered === month) cls += ' month-cell--hover';
        if (!open) cls += ' month-cell--read';
        if (locked && !inactive) cls += ' month-cell--locked';
        if (inactive) cls += ' month-cell--inactive';

        const head = (
          <div className="month-cell__head">
            <span className={'month-cell__label' + (month === now ? ' month-cell__label--now' : '')}>
              {shortMonthName(month)}
            </span>
            {locked && !inactive ? (
              <LockIcon className="month-cell__lock" size={11} />
            ) : (
              <span className={'month-cell__dot' + (hasData ? ' month-cell__dot--filled' : '')} />
            )}
          </div>
        );

        if (!open) {
          const amount = countableFor(stream, month);
          const secondary = fields
            .filter((f) => f.id !== 'gross' && Number(entry[f.id] ?? 0) !== 0)
            .map((f) => Math.round(Number(entry[f.id])) + (f.suffix ?? ''))
            .join(' · ');

          return (
            <ButtonBase
              className={cls}
              key={month}
              type="button"
              disabled={inactive}
              aria-label={
                inactive
                  ? `${stream.name} ${shortMonthName(month)}`
                  : locked
                    ? `${stream.name} ${shortMonthName(month)} ${amount ? money(amount) : 'empty'} — locked, unlock to edit`
                    : `${stream.name} ${shortMonthName(month)} ${amount ? money(amount) : 'empty'} — click to edit`
              }
              onMouseEnter={() => onHover(month)}
              onMouseLeave={() => onHover(null)}
              onClick={() => { if (!locked) onEditMonth(month); }}
            >
              {head}
              <div className="month-cell__read-value">
                {amount ? money(amount) : <span className="month-cell__blank">—</span>}
              </div>
              {secondary ? <div className="month-cell__read-meta">{secondary}</div> : null}
            </ButtonBase>
          );
        }

        return (
          <div
            className={cls}
            key={month}
            onMouseEnter={() => onHover(month)}
            onMouseLeave={() => onHover(null)}
          >
            {head}
            <div className="month-cell__fields">
              {fields.map((field, i) => (
                <NumericExprInput
                  key={field.id}
                  ref={focusMonth === month && i === 0 ? firstInputRef : undefined}
                  className={'cell-input' + (density === 'comfortable' ? ' cell-input--comfortable' : '')}
                  disabled={inactive || locked || checkDriven}
                  value={entry[field.id]}
                  placeholder={field.placeholder}
                  aria-label={`${stream.name} ${field.label} ${shortMonthName(month)}`}
                  onCommit={(next) => {
                    const patch: Partial<MonthEntry> = { [field.id]: next };
                    // A starting point, not an override — only fills Gross
                    // when it is still empty, so a real paystub always wins.
                    if (field.id === 'hours' && next && entry.gross == null) {
                      const estimate = estimatedGrossFromHours(stream, next);
                      if (estimate !== undefined) patch.gross = estimate;
                    }
                    setMonthEntry(stream.id, month, patch);
                  }}
                  onKeyDown={(e) => {
                    if (!editing && (e.key === 'Enter' || e.key === 'Escape')) {
                      onEditMonth(null);
                    }
                  }}
                />
              ))}
            </div>
            {checkDriven ? (
              <div className="month-cell__note">Set by the paycheck ledger</div>
            ) : null}
            {!editing ? (
              <ButtonBase className="month-cell__done" type="button" onClick={() => onEditMonth(null)}>
                Done
              </ButtonBase>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}
