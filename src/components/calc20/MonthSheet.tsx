// A month, opened — and the way data gets entered on a phone.
//
// A twelve-column grid does not fit 390px, so mobile entry happens here
// instead: tap a month, type into each stream, watch the total and its status
// change as you go.

import type { MonthEntry, MonthKey } from '../../domain/types';
import { useTracker } from './state';
import { money } from '../../domain/format';
import { formatMonth, yearOf } from '../../domain/months';
import {
  countableFor, estimatedGrossFromHours, grossFor, irweFor, isActive, mileageDeduction, monthStatus
} from '../../domain/earnings';
import { payPlan } from '../../domain/paySchedule';
import { rulesFor } from '../../domain/rules';
import { benefitPhase } from '../../domain/trialWork';
import { fieldsFor } from './MonthGrid';
import { NumericExprInput } from './NumericExprInput';
import { SheetSurface } from './SheetSurface';
import { LockIcon } from './Icons';

export function MonthSheet({ month, onClose }: { month: MonthKey; onClose: () => void }) {
  const { data, setMonthEntry, setIrwe } = useTracker();
  const status = monthStatus(data, month);
  const rules = rulesFor(yearOf(month));
  const phase = benefitPhase(data, month);
  const overActiveLine = phase === 'sga' ? status.overSga
    : phase === 'trialWork' ? status.isServiceMonth : false;

  const active = data.streams.filter((s) => s.lifecycle === 'active' && isActive(s, month));
  const irwe = irweFor(data, month);
  const streamsTotal = active.reduce((sum, s) => sum + countableFor(s, month), 0);

  return (
    <SheetSurface
      label={`Enter income for ${formatMonth(month)}`}
      eyebrow="Enter one month"
      title={formatMonth(month)}
      onClose={onClose}
    >
          <div className="sheet-hero">
            <div className="grow">
              <div className="hero-figure">{money(status.countable)}</div>
              <div className="eyebrow">counted toward your limit</div>
            </div>
            <span
              className={
                'num status-pill'
                + (phase === 'sga' && status.overSga
                  ? ' status-pill--over'
                  : phase === 'trialWork' && status.isServiceMonth
                    ? ' status-pill--spent'
                    : phase === 'unknown' || phase === 'verifyComplete'
                      ? ' status-pill--unknown'
                      : ' status-pill--keep')
              }
            >
              {phase === 'sga'
                ? (status.overSga
                    ? money(status.countable - rules.sga) + ' over your limit'
                    : money(status.roomToSga ?? 0) + ' under your limit')
                : phase === 'trialWork'
                  ? (status.isServiceMonth
                      ? 'one trial work month used'
                      : money(status.roomToTrialWork ?? 0) + ' to your limit')
                  : 'no limit yet'}
            </span>
          </div>

          {active.length === 0 ? (
            <p className="help-note">
              No stream was active in {formatMonth(month)}. Check the active dates in
              a stream's settings.
            </p>
          ) : active.map((stream) => {
            const entry: MonthEntry = stream.months[month] ?? {};
            const amount = countableFor(stream, month);
            const gross = grossFor(stream, month);
            const deduction = mileageDeduction(stream, month);
            const checkDriven = stream.checks.some((c) => c.month === month && !c.projected);

            // A W-2 stream with a schedule can say why this month differs.
            let note = '';
            if (stream.type === 'w2' && stream.payFrequency && stream.anchorDate) {
              const plan = payPlan(yearOf(month), stream.payFrequency, stream.anchorDate);
              const count = plan.countByMonth[Number(month.slice(5, 7)) - 1] ?? 0;
              const heavy = plan.heavyMonths.includes(Number(month.slice(5, 7)));
              note = 'Payday forecast: ' + count + (count === 1 ? ' scheduled check' : ' scheduled checks');
              if (heavy) note += ' — one more than usual';
              note += '. Type what you were paid before taxes for this month.';
            } else if (stream.type === 'ten99') {
              note = 'This counts in this month only. The year total on the card '
                + 'spreads one figure evenly across every month instead.';
            }

            return (
              <div className="field" key={stream.id}>
                <div className="sheet-hero sheet-hero--row">
                  <span className="eyebrow grow sheet-hero__name">
                    {stream.name}
                    {stream.locked ? <LockIcon className="month-cell__lock" size={12} /> : null}
                  </span>
                  <span className="num sheet-hero__aside">{money(amount)}</span>
                </div>

                <div className="entry-row">
                  {fieldsFor(stream).map((field) => (
                    <label className="entry-field" key={field.id}>
                      <span className="entry-field__label">{field.label}</span>
                      <NumericExprInput
                        className="num-input"
                        disabled={stream.locked || checkDriven}
                        value={entry[field.id]}
                        placeholder="0 or 2+2"
                        aria-label={`${stream.name} ${field.label} ${formatMonth(month)}`}
                        onCommit={(next) => {
                          const patch: Partial<MonthEntry> = { [field.id]: next };
                          if (field.id === 'hours' && next && entry.gross == null) {
                            const estimate = estimatedGrossFromHours(stream, next);
                            if (estimate !== undefined) patch.gross = estimate;
                          }
                          setMonthEntry(stream.id, month, patch);
                        }}
                      />
                    </label>
                  ))}
                </div>

                {deduction > 0 ? (
                  <div className="help-note num">
                    {money(gross)} gross − {money(deduction)} mileage = {money(amount)}
                  </div>
                ) : null}
                {note ? <div className="help-note">{note}</div> : null}
                {stream.type === 'w2' && stream.hourlyRate && !entry.gross ? (
                  <div className="help-note">
                    Type your hours and we will work the pay out at ${stream.hourlyRate} an
                    hour. Change it if your paystub says something different.
                  </div>
                ) : null}
                {checkDriven ? (
                  <div className="help-note">Set by the paycheck ledger.</div>
                ) : stream.locked ? (
                  <div className="help-note">Locked — unlock this stream to edit.</div>
                ) : null}
              </div>
            );
          })}

          {active.length ? (
            <div className="field">
              {/* "Impairment-related work expenses" is SSA's name for it and
                   "IRWE" is SSA's abbreviation for that. The reader knows it
                   as money they have to spend in order to be able to work. */}
              <span className="eyebrow">Things you pay for so you can work</span>
              <NumericExprInput
                className="num-input"
                value={irwe || undefined}
                placeholder="0"
                aria-label={`Things you pay for so you can work, ${formatMonth(month)}`}
                onCommit={(next) => setIrwe(month, next)}
              />
              <div className="help-note">
                Costs your disability makes you pay in order to work — special transport,
                someone to help you, equipment you need. These come off your total, not
                off one job.
                {irwe > 0 ? ` ${money(streamsTotal)} minus ${money(irwe)} leaves ${money(status.countable)}.` : ''}
              </div>
            </div>
          ) : null}

          {overActiveLine ? (
            <div className="warning">
              <div className="warning__bar" />
              <div className="warning__body">
                <div className="warning__title">
                  {phase === 'trialWork' ? 'This month uses one trial work month' : 'This month is over your limit'}
                </div>
                <div className="warning__text">
                  {phase === 'trialWork'
                    ? `You went over ${money(rules.trialWork)}. Earning more this same month does not use another one.`
                    : `You are ${money(status.countable - rules.sga)} over your limit of ${money(rules.sga)}.`}
                </div>
              </div>
            </div>
          ) : null}
    </SheetSurface>
  );
}
