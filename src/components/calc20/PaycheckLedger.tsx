// A dated record of individual paychecks. Once any exist for a month, they
// replace that month's single Gross/Hours figure entirely — earnings.ts
// already prefers checks over the month override, so this is the more
// exact way to enter income, one payday at a time as it actually lands.

import { useState } from 'react';
import type { Stream } from '../../domain/types';
import { useTracker } from './state';
import { money } from '../../domain/format';
import { formatMonth, monthOfDate, todayMonth } from '../../domain/months';
import { estimatedGrossFromHours } from '../../domain/earnings';
import { extraPaycheckLabel, extraPaycheckMonths } from '../../domain/paySchedule';
import { ChevronRightIcon, PlusIcon, TrashIcon } from './Icons';
import { NumericExprInput } from './NumericExprInput';

import { ButtonBase } from '../../design-system';
function formatDate(key: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(key);
  if (!m) return key;
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

export function PaycheckLedger({ stream }: { stream: Stream }) {
  const { addPaycheck, removePaycheck } = useTracker();
  const [open, setOpen] = useState(false);
  const [date, setDate] = useState('');
  const [gross, setGross] = useState<number | undefined>(undefined);
  const [hours, setHours] = useState<number | undefined>(undefined);

  const checks = stream.checks
    .filter((c) => !c.projected)
    .slice()
    .sort((a, b) => b.date.localeCompare(a.date));

  const canAdd = Boolean(date) && gross !== undefined && gross > 0;

  // A 3- or 5-paycheck month is the whole reason this ledger exists — flag
  // it right on the toggle, not just buried in stream settings, so it is
  // visible while you are actually filling the month in.
  const currentMonth = todayMonth();
  const extra = stream.type === 'w2'
    ? extraPaycheckMonths([stream], Number(currentMonth.slice(0, 4))).get(currentMonth)
    : undefined;
  const extraText = extra ? extraPaycheckLabel(extra.counts) : null;

  const submit = () => {
    if (!canAdd) return;
    addPaycheck(stream.id, { date, month: monthOfDate(date) || todayMonth(), gross: gross as number, hours });
    setDate('');
    setGross(undefined);
    setHours(undefined);
  };

  return (
    <div className={'ledger' + (open ? ' ledger--open' : '')}>
      <ButtonBase
        className="ledger__toggle"
        type="button"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        <span className="ledger__title">Paycheck ledger</span>
        {extraText ? (
          <span className="ledger__extra-badge" title={`${formatMonth(currentMonth)}: ${extraText}`}>
            {extraText}
          </span>
        ) : null}
        {checks.length ? <span className="ledger__count">{checks.length}</span> : null}
        <ChevronRightIcon
          className={'ledger__chevron' + (open ? ' ledger__chevron--open' : '')}
          size={16}
        />
      </ButtonBase>

      {open ? (
      <div className="ledger__body">
        {checks.length ? (
          <div className="ledger__rows">
            {checks.map((check) => (
              <div className="ledger__row" key={check.id}>
                <span className="ledger__date">{formatDate(check.date)}</span>
                <span className="ledger__gross">{money(check.gross)}</span>
                <span className="ledger__hours">{check.hours ? check.hours + ' h' : ''}</span>
                <ButtonBase
                  className="ledger__remove"
                  type="button"
                  aria-label={`Remove paycheck from ${formatDate(check.date)}`}
                  onClick={() => removePaycheck(stream.id, check.id)}
                >
                  <TrashIcon size={15} />
                </ButtonBase>
              </div>
            ))}
          </div>
        ) : (
          <p className="ledger__empty">
            No paychecks yet. Once you add one for a month, it replaces whatever
            you typed for that month above.
          </p>
        )}

        <div className="ledger__add">
          <input
            className="ledger__date-input"
            type="date"
            aria-label="Paycheck date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
          />
          <label className="ledger__field">
            <span className="ledger__prefix" aria-hidden="true">$</span>
            <NumericExprInput
              className="ledger__num-input"
              aria-label="Paycheck amount before taxes"
              placeholder="Before taxes"
              value={gross}
              onCommit={setGross}
            />
          </label>
          <NumericExprInput
            className="ledger__num-input"
            aria-label="Paycheck hours"
            placeholder="Hours"
            value={hours}
            onCommit={(next) => {
              setHours(next);
              // A starting point, not an override — only when Gross is
              // still empty, so anything already typed always wins.
              if (next && gross === undefined) {
                const estimate = estimatedGrossFromHours(stream, next);
                if (estimate !== undefined) setGross(estimate);
              }
            }}
          />
          <ButtonBase
            className="ledger__add-button"
            type="button"
            disabled={!canAdd}
            onClick={submit}
          >
            <PlusIcon size={14} /> Add
          </ButtonBase>
        </div>
        {stream.hourlyRate ? (
          <p className="help-note">
            Type your hours and we will work the pay out at ${stream.hourlyRate} an hour.
            Change it if your paystub says something different. You can also type sums
            like 8×5.
          </p>
        ) : null}
      </div>
      ) : null}
    </div>
  );
}
