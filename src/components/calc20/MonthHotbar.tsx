// Quick-glance risk bar. Above Active, not inside a collapsible section —
// the whole point is to be seen without opening anything. It only ever
// shows months that need attention: over a limit, close enough to one that
// coasting isn't safe, or carrying an extra paycheck. A clean year renders
// nothing here at all.

import type { MonthKey } from '../../domain/types';
import { useTracker } from './state';
import { displayMonths, formatMonth, shortMonthName } from '../../domain/months';
import { attentionFlags } from '../../domain/attention';
import { WarningIcon } from './Icons';

export function MonthHotbar({ onOpenMonth }: { onOpenMonth: (month: MonthKey) => void }) {
  const { data, ui } = useTracker();
  // The rule is shared with the ledger, payguard and workrecord — see
  // src/domain/attention.ts. This file used to carry its own copy, which
  // resolved the benefit phase once at year end; a TWP completing in June
  // made every month after it judged against the wrong limit.
  const flags = attentionFlags(data, displayMonths(ui.year, ui.hideFuture));

  if (!flags.length) return null;

  return (
    <div className="hotbar" role="region" aria-label="Months that need attention">
      <WarningIcon className="hotbar__icon" size={15} />
      <div className="hotbar__rail">
        {flags.map((flag) => (
          <button
            className={'hotbar__chip hotbar__chip--' + flag.kind}
            key={flag.month + flag.kind + flag.text}
            type="button"
            title={formatMonth(flag.month) + ': ' + flag.text}
            onClick={() => onOpenMonth(flag.month)}
          >
            <span className="hotbar__chip-month">{shortMonthName(flag.month).toUpperCase()}</span>
            <span className="hotbar__chip-text">{flag.text}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
