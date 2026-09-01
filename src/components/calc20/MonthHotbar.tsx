// Quick-glance risk bar. Above Active, not inside a collapsible section —
// the whole point is to be seen without opening anything. It only ever
// shows months that need attention: over a limit, close enough to one that
// coasting isn't safe, or carrying an extra paycheck. A clean year renders
// nothing here at all.

import type { MonthKey } from '../../domain/types';
import { useTracker } from './state';
import { money } from '../../domain/format';
import { displayMonths, formatMonth, shortMonthName } from '../../domain/months';
import { monthStatus, nearLimit } from '../../domain/earnings';
import { extraPaycheckLabel, extraPaycheckMonths } from '../../domain/paySchedule';
import { benefitPhase } from '../../domain/trialWork';
import { WarningIcon } from './Icons';

interface Flag {
  month: MonthKey;
  text: string;
  kind: 'over' | 'near' | 'pay';
}

export function MonthHotbar({ onOpenMonth }: { onOpenMonth: (month: MonthKey) => void }) {
  const { data, ui } = useTracker();
  const phase = benefitPhase(data, `${ui.year}-12`);
  const extraPay = extraPaycheckMonths(data.streams, ui.year);

  const flags: Flag[] = [];
  for (const month of displayMonths(ui.year, ui.hideFuture)) {
    const status = monthStatus(data, month);
    const extra = extraPay.get(month);

    if (phase === 'sga' && status.overSga) {
      flags.push({ month, text: 'over SGA', kind: 'over' });
    } else if (phase === 'trialWork' && status.isServiceMonth) {
      flags.push({ month, text: 'TWP used', kind: 'over' });
    } else {
      const near = nearLimit(status, phase);
      if (near) {
        flags.push({
          month,
          text: money(near.room) + (near.kind === 'trial' ? ' to TWP' : ' to SGA'),
          kind: 'near'
        });
        continue;
      }
    }
    if (extra) flags.push({ month, text: extraPaycheckLabel(extra.counts), kind: 'pay' });
  }

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
