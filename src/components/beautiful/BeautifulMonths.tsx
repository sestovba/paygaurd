/*
 * The month list, and the edit click style.
 *
 * THE EDIT ROW IS NOT A PANEL. Tapping a month on the reference does not open
 * a sheet or unfold an editor — the row itself becomes the field. The month
 * name drops to the caps label, a currency mark and one input appear under
 * it, and a round check sits at the end. Tapping away is the cancel, which is
 * why there is no second button. The check is the only save.
 *
 * Big Beautiful logs one number a month. If there is no job yet, the first
 * save creates one. If there are several jobs, the figure still writes to the
 * one that already holds this month (or the first job) — the shared MonthSheet
 * is still available from other layouts when a month needs per-job editing.
 */
import { useState } from 'react';
import { Pencil, Check, Minus } from 'lucide-react';
import { Button, IconButton, Input } from '../ui';
import { useTracker } from '../../state/TrackerProvider';
import { money } from '../../domain/format';
import { longMonthName, todayMonth } from '../../domain/months';
import { monthTotal } from '../../domain/earnings';
import { activeThreshold } from '../../domain/trialWork';
import type { MonthKey } from '../../domain/types';

/** Where a month stands, for the dot and the figure's colour. */
function stageOf(counted: number, limit: number | null): 'none' | 'safe' | 'careful' | 'over' {
  if (counted === 0) return 'none';
  if (!limit) return 'safe';
  if (counted > limit) return 'over';
  return counted > limit * 0.82 ? 'careful' : 'safe';
}

export function BeautifulMonths({
  months, onRevealEarlier, canRevealEarlier
}: {
  months: MonthKey[];
  onOpenSheet?: (month: MonthKey) => void;
  onRevealEarlier: () => void;
  canRevealEarlier: boolean;
}) {
  const { data, updateMonthEntry, addStream } = useTracker();
  const [editing, setEditing] = useState<MonthKey | null>(null);
  const [draft, setDraft] = useState('');
  const now = todayMonth();

  function targetStreamId(month: MonthKey): string | null {
    if (data.streams.length === 0) return null;
    if (data.streams.length === 1) return data.streams[0].id;
    const holders = data.streams.filter((s) => (s.months[month]?.gross ?? 0) !== 0);
    return (holders[0] ?? data.streams[0]).id;
  }

  function open(month: MonthKey) {
    setEditing(month);
    setDraft(String(monthTotal(data, month) || ''));
  }

  function cancel() {
    setEditing(null);
    setDraft('');
  }

  function save(month: MonthKey) {
    const next = draft.trim() === '' ? 0 : Number(draft);
    if (!Number.isFinite(next) || next < 0) {
      cancel();
      return;
    }
    const id = targetStreamId(month) ?? addStream('w2');
    updateMonthEntry(id, month, { gross: next });
    cancel();
  }

  function clear(month: MonthKey) {
    const id = targetStreamId(month);
    if (!id) return;
    updateMonthEntry(id, month, { gross: 0 });
    if (editing === month) cancel();
  }

  return (
    <ul className="bb-rows">
      {months.map((month) => {
        const counted = monthTotal(data, month);
        const limit = activeThreshold(data, month)?.amount ?? null;
        const stage = stageOf(counted, limit);
        const over = limit && counted > limit ? counted - limit : 0;

        if (editing === month) {
          return (
            <li key={month} className="bb-edit">
              <label>
                <span className="bb-caps">{longMonthName(month)}</span>
                <span className="bb-field">
                  <span className="bb-cur" aria-hidden="true">$</span>
                  <Input
                    autoFocus
                    type="number"
                    inputMode="decimal"
                    min={0}
                    step={1}
                    value={draft}
                    aria-label={`Money counted in ${longMonthName(month)}`}
                    onChange={(e) => setDraft(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') save(month);
                      if (e.key === 'Escape') cancel();
                    }}
                    onBlur={cancel}
                  />
                </span>
              </label>
              <IconButton
                className="bb-save"
                label={`Save ${longMonthName(month)}`}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => save(month)}
              >
                <Check size={20} strokeWidth={2.5} />
              </IconButton>
            </li>
          );
        }

        return (
          <li key={month} className="bb-row">
            <Button variant="ghost" className="bb-row-main" onClick={() => open(month)}>
              <span className="bb-dot" data-stage={stage} aria-hidden="true" />
              <span className="bb-nm">
                {longMonthName(month)}
                {month === now && <span className="bb-now">This month</span>}
              </span>
              <span className="bb-val">
                <span className="bb-vl" data-none={counted === 0} data-over={over > 0}>
                  {counted === 0 ? '—' : money(counted)}
                </span>
                {over > 0 && <span className="bb-ov">{money(over)} over</span>}
              </span>
            </Button>
            <span className="bb-row-actions">
              {counted > 0 && (
                <IconButton
                  className="bb-clear"
                  label={`Clear ${longMonthName(month)}`}
                  onClick={() => clear(month)}
                >
                  <Minus size={16} />
                </IconButton>
              )}
              <IconButton
                className="bb-pencil"
                label={`Edit ${longMonthName(month)}`}
                onClick={() => open(month)}
              >
                <Pencil size={16} />
              </IconButton>
            </span>
          </li>
        );
      })}

      {canRevealEarlier && (
        <li>
          <Button variant="ghost" className="bb-more" onClick={onRevealEarlier}>
            Show the earlier months
          </Button>
        </li>
      )}
    </ul>
  );
}
