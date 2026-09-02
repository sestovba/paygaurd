// Progressive headline: find out where the reader stands first, protect the
// trial work months while they remain, then switch the working layout to the
// limit that applies once those months are confirmed spent. Only ever one of
// the two regimes is named on screen.

import { useTracker } from './state';
import { money } from '../../domain/format';
import { formatMonth, longMonthName, monthsOfYear, todayMonth, yearOf } from '../../domain/months';
import { monthStatus, streamsMissingMonth, yearTotal } from '../../domain/earnings';
import {
  activeThreshold, benefitPhase, trialWorkStatus, TRIAL_MONTH_LIMIT
} from '../../domain/trialWork';
import { knownYears } from '../../domain/rules';
import { AccountMenu } from './AccountMenu';
import { BellIcon, CloseIcon, UndoIcon } from './Icons';
import { AnchoredPopover, useAnchoredPopover } from './Popover';
import { TrialMeter } from './TrialMeter';
import { ToastStack } from '../ToastStack';
import { MonthHotbar } from './MonthHotbar';
import { PrecisionLine } from '../PrecisionLine';
import { precisionFor } from '../../domain/precision';
import type { MonthKey } from '../../domain/types';
import type { Session } from '../../auth/session';

export function Header({
  session,
  onSignOut,
  onOpenSettings,
  onOpenMonth
}: {
  session: Session | null;
  onSignOut: () => void;
  onOpenSettings: () => void;
  onOpenMonth: (month: MonthKey) => void;
}) {
  const { data, ui, setUi, canUndo, undo } = useTracker();

  const now = todayMonth();
  const focusMonth = yearOf(now) === ui.year ? now : monthsOfYear(ui.year)[11];
  const status = monthStatus(data, focusMonth);
  const twp = trialWorkStatus(data, focusMonth);
  const phase = benefitPhase(data, focusMonth);
  const threshold = activeThreshold(data, focusMonth);
  const over = threshold ? status.countable > threshold.amount : false;
  const room = threshold ? Math.max(0, threshold.amount - status.countable) : 0;

  /* "Verify 9 recorded months" and "Not confirmed" both describe the state
     of our record. What the reader needs is what they should do, or that we
     do not know yet. */
  const assessmentLabel = phase === 'verifyComplete'
    ? 'Check the 9 months we have'
    : 'Not set yet';

  return (
    <header className="topbar">
      <div className="topbar__row">
        <div className="topbar__title">
          <div className="topbar__eyebrow">SSDI Income Tracker</div>
          <h1>{ui.year} work record</h1>
        </div>

        <div className="topbar__actions">
          <select
            className="year-select"
            aria-label="Year"
            value={ui.year}
            onChange={(e) => setUi({ year: Number(e.target.value) })}
          >
            {knownYears().map((y) => <option key={y} value={y}>{y}</option>)}
          </select>

          <button
            className="icon-button"
            type="button"
            aria-label="Undo last change"
            title="Undo last change"
            disabled={!canUndo}
            onClick={undo}
          >
            <UndoIcon />
          </button>

          <NoticeMenu onOpenMonth={onOpenMonth} />

          <AccountMenu session={session} onSignOut={onSignOut} onOpenSettings={onOpenSettings} />
        </div>
      </div>

      <ToastStack />

      <div className="headline">
        <div className="headline__main">
          <div className="headline__label">{longMonthName(focusMonth)} countable</div>
          <div className={'headline__value' + (over ? ' headline__value--over' : '')}>
            {money(status.countable)}
          </div>
        </div>

        <div className="headline__aside">
          {threshold ? (
            <>
              <div className="headline__of">
                of {money(threshold.amount)}
              </div>
              <div className="headline__room">
                {over
                  ? (threshold.kind === 'trialWork' ? 'one trial work month used' : 'over your limit')
                  : money(room) + ' of room'}
              </div>
            </>
          ) : (
            <button className="tonal-button" type="button" onClick={onOpenSettings}>
              Tell us where you stand
            </button>
          )}
        </div>

        <div className="standings">
          <div className="standing-divider" />
          <div className="standing">
            <div className="standing__label">
              {phase === 'trialWork'
                ? 'Trial work months left'
                : phase === 'sga'
                  ? 'Your limit'
                  : 'Your status'}
            </div>
            <div className="standing__value standing__value--accent">
              {phase === 'trialWork' ? (
                <>{twp.remaining}<span className="standing__unit"> of {TRIAL_MONTH_LIMIT}</span></>
              ) : phase === 'sga' ? money(threshold?.amount ?? 0) : assessmentLabel}
            </div>
          </div>
          <div className="standing-divider" />
          <div className="standing">
            <div className="standing__label">{ui.year} total</div>
            <div className="standing__value">{money(yearTotal(data, ui.year))}</div>
          </div>
        </div>
      </div>

      {phase === 'trialWork' ? (
        <TrialMeter used={twp.used} prior={data.priorTrialMonths.length} />
      ) : phase === 'sga' ? (
        /* Nothing. This row used to say "TWP used up · SGA is the working
           limit now", which names both regimes in one line to a reader who
           is only ever shown one — and reports a resource being gone as
           though it were news. The limit itself is in the standings above. */
        null
      ) : phase === 'verifyComplete' ? (
        /* Only the state the headline cannot say. When the status is simply
           unknown the headline above already asks, as a button — saying it
           again here was the same sentence and a second button. */
        <div className="phase-warning">
          <span>
            Nine trial work months are on record. Check them against your own
            paperwork — after that your limit changes.
          </span>
          <button className="text-button" type="button" onClick={onOpenSettings}>Review status</button>
        </div>
      ) : null}

      <MonthHotbar onOpenMonth={onOpenMonth} />
      {/* The seventh layout gets the same reading as the other six: how far
          the figures can be trusted, and the one thing that would sharpen
          them. See src/domain/precision.ts. */}
      <div className="calc20-precision">
        <PrecisionLine reading={precisionFor(data, focusMonth)} />
      </div>
    </header>
  );
}

function NoticeMenu({ onOpenMonth }: { onOpenMonth: (month: MonthKey) => void }) {
  const { data, ui, setUi } = useTracker();
  const anchor = useAnchoredPopover();
  const notices = ui.dismissedMissingMonths
    .map((month) => ({
      month,
      names: streamsMissingMonth(data.streams, month).map((stream) => stream.name)
    }))
    .filter((notice) => notice.names.length);

  if (!notices.length) return null;

  return (
    <div className="notice-menu">
      <button
        ref={anchor.triggerRef}
        className="icon-button"
        type="button"
        aria-label={`${notices.length} saved update ${notices.length === 1 ? 'reminder' : 'reminders'}`}
        aria-haspopup="menu"
        aria-expanded={anchor.open}
        onClick={anchor.toggle}
      >
        <BellIcon />
        <span className="notice-menu__count">{notices.length}</span>
      </button>
      <AnchoredPopover
        anchor={anchor}
        width={280}
        className="notice-menu__surface"
        label="Saved update reminders"
        title="Reminders"
        role="menu"
      >
        {notices.map((notice) => (
          <div className="notice-row" key={notice.month}>
            <button
              className="notice-row__main"
              type="button"
              role="menuitem"
              onClick={() => {
                onOpenMonth(notice.month);
                anchor.close();
              }}
            >
              <span className="view-option__text">
                <span className="view-option__label">Update {formatMonth(notice.month)}</span>
                <span className="view-option__hint">{notice.names.join(', ')}</span>
              </span>
            </button>
            <button
              className="notice-row__dismiss"
              type="button"
              aria-label={`Dismiss reminder for ${formatMonth(notice.month)}`}
              onClick={() => setUi({
                dismissedMissingMonths: ui.dismissedMissingMonths.filter((m) => m !== notice.month)
              })}
            >
              <CloseIcon size={14} />
            </button>
          </div>
        ))}
      </AnchoredPopover>
    </div>
  );
}
