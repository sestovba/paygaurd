/*
 * Charm — Pocket and Happy Charm had a baby.
 *
 * Happy Charm put the trial-month cliff above the fold: will this month cost
 * one, and how much room is left before it would. Pocket put one Add pay on a
 * cheap Android and refused charts. This layout keeps both promises and adds
 * neither parent's extras — no ring gauge, no twelve-month wall, no gilt.
 */

import { useState } from 'react';
import { useTracker } from '../../state/TrackerProvider';
import { useTheme } from '../../theme';
import { money } from '../../domain/format';
import { SOURCE_SHORT, hoursLine } from '../../domain/copy';
import { capacityFor } from '../../domain/capacity';
import { longMonthName, monthsOfYear, shortMonthName, todayMonth, yearOf } from '../../domain/months';
import {
  monthStatus, grossFor, grossFromNet, hoursFor, isActive, isEstimatedMonth
} from '../../domain/earnings';
import { mileageRateFor, TWP_SELF_EMPLOYMENT_HOURS } from '../../domain/rules';
import { TRIAL_MONTH_LIMIT, benefitPhase, trialWorkStatus } from '../../domain/trialWork';
import { attentionFlags } from '../../domain/attention';
import { extraPaycheckMonths } from '../../domain/paySchedule';
import type { MonthKey, Stream } from '../../domain/types';
import type { PayBasis } from '../../state/storage';
import { SettingsPanel } from '../SettingsPanel';
import { ToastStack } from '../ToastStack';
import '../../styles/charm.css';
import { ButtonBase } from '../../design-system';

import { useRef } from 'react';
import { useDialogFocus } from '../ui/useDialogFocus';
export function TrackerCharm() {
  const {
    data, ui, setUi, resetAll, updateMonthEntry, pushToast,
    addStream, updateStream, removeStream
  } = useTracker();
  useTheme(ui.theme, ui.palette);

  const [settingsOpen, setSettingsOpen] = useState(false);
  const [sourcesOpen, setSourcesOpen] = useState(false);
  const [addingJob, setAddingJob] = useState(false);
  const [newJobName, setNewJobName] = useState('');
  const [addReturn, setAddReturn] = useState<'manage' | 'logging' | 'home'>('home');
  const [openMonth, setOpenMonth] = useState<MonthKey | null>(null);
  const [whyOpen, setWhyOpen] = useState(false);
  const [logging, setLogging] = useState(false);
  const [basis, setBasis] = useState<PayBasis>(ui.payBasis ?? 'bank');
  const [payValue, setPayValue] = useState('');
  const [fromNowOn, setFromNowOn] = useState(true);
  const [targetId, setTargetId] = useState<string | null>(null);
  const [milesValue, setMilesValue] = useState('');

  const sourceDialogRef = useRef<HTMLDivElement>(null);

  const closeSourceDialog = () => {
    if (addingJob) {
      setAddingJob(false);

      if (addReturn !== 'manage') {
        setSourcesOpen(false);
      }

      return;
    }

    setSourcesOpen(false);
  };

  useDialogFocus(sourceDialogRef, closeSourceDialog, {
    enabled: sourcesOpen || addingJob,
    // The management view may begin with destructive row actions.
    // Announce the dialog itself first. The add view focuses its field.
    focusContainer: !addingJob
  });

  const num = Number(payValue);
  const valid = Number.isFinite(num) && num > 0;
  const estimate = basis === 'bank' && valid ? (grossFromNet(num) ?? 0) : 0;

  const now = todayMonth();
  const asOf: MonthKey = yearOf(now) === ui.year ? now : `${ui.year}-12`;
  const monthName = longMonthName(asOf);
  const monthUpper = monthName.toUpperCase();

  const phase = benefitPhase(data, asOf);
  const trial = phase === 'trialWork';
  const twp = trialWorkStatus(data, asOf);
  const capacity = capacityFor(data, asOf);
  const status = monthStatus(data, asOf);
  const guessed = isEstimatedMonth(data, asOf);
  const counted = capacity?.safeCounted ?? status.countable;
  const threshold = capacity?.threshold ?? null;
  const usesMonth = trial && capacity
    ? capacity.over > 0 || capacity.maybeOver || status.isServiceMonth
    : false;
  const roomBeforeCliff = capacity ? capacity.roomToLimit : null;

  const heavy = extraPaycheckMonths(data.streams, ui.year);
  const flagged = attentionFlags(data, monthsOfYear(ui.year).filter((m) => m >= asOf));
  const shown: MonthKey[] = ui.focusMode
    ? [asOf]
    : Array.from(new Set<MonthKey>([asOf, ...flagged.map((f) => f.month)])).sort();
  const flagFor = (month: MonthKey) => flagged.find((f) => f.month === month);

  const primary = data.streams.find((s) => s.lifecycle === 'active') ?? data.streams[0];
  const loggable = data.streams.filter((st) => st.lifecycle === 'active' && isActive(st, asOf));
  const candidates = loggable.length ? loggable : data.streams;
  const target = candidates.find((st) => st.id === targetId)
    ?? (candidates.length === 1 ? candidates[0] : null);

  /* Above-the-fold story — Happy Charm's trial-month cliff, spoken. */
  const headline = !capacity
    ? 'We do not know your limit yet.'
    : trial
      ? (usesMonth
        ? `${monthName} will use a trial month`
        : `${monthName} will not use a trial month`)
      : capacity.over > 0
        ? `${monthName} is over your limit`
        : `${monthName} is under your limit`;

  const subline = !capacity
    ? 'Answer a few questions in Settings and we can tell you where you stand.'
    : trial
      ? (usesMonth
        ? (capacity.maybeOver && capacity.over === 0
          ? `We guessed your pay — it could already be over ${money(capacity.threshold)}.`
          : `${money(capacity.over || Math.max(0, counted - capacity.threshold))} over the ${money(capacity.threshold)} limit.`)
        : `${money(roomBeforeCliff ?? 0)} more before it would, out of ${money(capacity.threshold)}.`)
      : capacity.over > 0
        ? `${money(capacity.over)} over ${money(capacity.threshold)}. Talk to Social Security.`
        : `${money(capacity.roomToLimit)} left before your limit of ${money(capacity.threshold)}.`;

  const hoursNote = capacity?.hours != null && capacity.stage !== 'over'
    ? hoursLine(capacity.hours)
    : null;

  const tone = !capacity ? 'unknown'
    : (usesMonth || capacity.over > 0) ? 'over'
      : capacity.maybeOver || capacity.stage === 'careful' ? 'near'
        : 'clear';

  function logPay(
    amount: number,
    entryBasis: 'entered' | 'fromNet' = 'entered',
    netAmount?: number,
    addMiles?: number | null
  ) {
    if (!target || !Number.isFinite(amount) || amount <= 0) return;
    const current = grossFor(target, asOf);
    updateMonthEntry(target.id, asOf, {
      gross: current + amount,
      basis: entryBasis,
      ...(netAmount !== undefined ? { net: (target.months[asOf]?.net ?? 0) + netAmount } : {}),
      ...(addMiles ? { miles: (target.months[asOf]?.miles ?? 0) + addMiles } : {})
    });
    pushToast(
      candidates.length > 1
        ? `${money(amount)} added to ${target.name}, ${monthName}`
        : `${money(amount)} added to ${monthName}`,
      true
    );
    setLogging(false);
    setPayValue('');
    setMilesValue('');
  }

  function startLogging() {
    setBasis(ui.payBasis ?? 'bank');
    setPayValue('');
    setMilesValue('');
    setFromNowOn(true);
    setTargetId(null);
    setWhyOpen(false);
    setLogging(true);
  }

  function openManageSources() {
    setAddingJob(false);
    setNewJobName('');
    setSourcesOpen(true);
  }

  function openAddSource(returnTo: 'manage' | 'logging' | 'home') {
    setAddReturn(returnTo);
    setNewJobName('');
    setAddingJob(true);
    if (returnTo === 'manage') setSourcesOpen(true);
    else setSourcesOpen(false);
  }

  function handleAddSource() {
    const name = newJobName.trim();
    if (!name) return;
    const id = addStream('w2');
    updateStream(id, { name });
    setNewJobName('');
    setAddingJob(false);
    if (addReturn === 'logging') {
      setTargetId(id);
      setLogging(true);
      setSourcesOpen(false);
      return;
    }
    if (addReturn === 'manage') {
      setSourcesOpen(true);
      return;
    }
    setSourcesOpen(false);
  }

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!valid) return;
    const miles = Number(milesValue);
    const addMiles = target?.type === 'ten99' && Number.isFinite(miles) && miles > 0
      ? miles
      : null;
    if (basis === 'bank') {
      const est = grossFromNet(num);
      if (!est) return;
      logPay(est, 'fromNet', num, addMiles);
    } else {
      if (fromNowOn) setUi({ payBasis: 'paystub' });
      logPay(num, 'entered', undefined, addMiles);
    }
  }

  const milesNum = Number(milesValue);
  const milesOff = Number.isFinite(milesNum) && milesNum > 0
    ? Math.round(milesNum * mileageRateFor(asOf) * 100) / 100
    : 0;

  const milesField = target?.type === 'ten99' ? (
    <>
      <label className="ch-edit-name" htmlFor="ch-miles" style={{ marginTop: 14 }}>
        How many miles did you drive for this pay?
      </label>
      <p className="ch-edit-note">
        Driving costs come off before this counts. Leave it empty if you did not drive.
      </p>
      <input
        id="ch-miles"
        name="miles"
        inputMode="numeric"
        type="text"
        placeholder="Numbers only"
        className="ch-btn ch-edit-field"
        style={{ marginTop: 6 }}
        value={milesValue}
        onChange={(event) => setMilesValue(event.currentTarget.value)}
      />
      {milesOff > 0 ? (
        <p className="ch-edit-note" data-good>
          That takes {money(milesOff)} off what counts.
        </p>
      ) : null}
    </>
  ) : null;

  return (
    <div className="ch" data-chrome-root>
      <header className="ch-top">
        <div className="ch-top-when">
          <b>{monthUpper} {ui.year}</b>
          <ButtonBase type="button" className="ch-top-sources" onClick={openManageSources}>
            {data.streams.length === 1 ? primary?.name : `${data.streams.length} sources`}
          </ButtonBase>
        </div>
        <ButtonBase type="button" className="ch-btn" onClick={() => setSettingsOpen(true)}>
          Settings
        </ButtonBase>
      </header>

      <main className="ch-main">
        {/* 1 — the trial-month story (Happy Charm DNA, text only). */}
        <section className="ch-story" data-tone={tone}>
          {threshold != null && trial ? (
            <p className="ch-limit">
              <span className="ch-limit-amt">{money(threshold)}</span>
              <span className="ch-limit-sep"> · </span>
              <span className="ch-limit-label">uses a month</span>
            </p>
          ) : threshold != null ? (
            <p className="ch-limit">
              <span className="ch-limit-amt">{money(threshold)}</span>
              <span className="ch-limit-sep"> · </span>
              <span className="ch-limit-label">your monthly limit</span>
            </p>
          ) : null}

          <p className="ch-counts-label">Counts this month</p>
          <p className="ch-counts">{money(counted)}</p>

          <ButtonBase
            type="button"
            className="ch-why"
            aria-expanded={whyOpen}
            onClick={() => setWhyOpen((v) => !v)}
          >
            Not your gross pay?
          </ButtonBase>
          {whyOpen ? (
            <div className="ch-why-body">
              <p>
                Social Security counts what you earned before taxes, after
                driving costs for gig work. Bank deposits are smaller, so we
                work backwards when you only know what hit your account.
              </p>
              {guessed ? (
                <p>
                  This month still has a guess in it. Tap Add pay and choose
                  Paystub when you have the amount before taxes.
                </p>
              ) : null}
            </div>
          ) : null}

          <h1 className="ch-headline">{headline}</h1>
          <p className="ch-sub">{subline}</p>

          {hoursNote ? <p className="ch-quiet">{hoursNote}</p> : null}
          {heavy.has(asOf) ? (
            <p className="ch-quiet">
              Extra paycheck this month — leave a little more room.
            </p>
          ) : null}
        </section>

        {/* 2 — one Add pay (Pocket DNA). */}
        {primary ? (
          logging && !target ? (
            <section className="ch-answer">
              <p className="ch-edit-name">Which job paid you?</p>
              <div className="ch-months">
                {candidates.map((st) => (
                  <ButtonBase
                    key={st.id}
                    type="button"
                    className="ch-month"
                    onClick={() => setTargetId(st.id)}
                  >
                    <span className="ch-month-mid">
                      <span className="ch-month-amount">{st.name}</span>
                      <span className="ch-month-note">
                        {SOURCE_SHORT[st.type]}
                        {grossFor(st, asOf) > 0
                          ? ` · ${money(grossFor(st, asOf))} logged this month`
                          : ' · nothing logged this month'}
                      </span>
                    </span>
                  </ButtonBase>
                ))}
              </div>
              <ButtonBase type="button" className="ch-plain" onClick={() => openAddSource('logging')}>
                Add a job
              </ButtonBase>
            </section>
          ) : logging && target ? (
            <form className="ch-answer" onSubmit={handleSubmit}>
              <div className="ch-switch" role="radiogroup" aria-label="How you enter pay">
                <ButtonBase
                  type="button"
                  role="radio"
                  aria-checked={basis === 'bank'}
                  className="ch-switch-btn"
                  data-active={basis === 'bank' ? '' : undefined}
                  onClick={() => {
                    setBasis('bank');
                    setPayValue('');
                    setUi({ payBasis: 'bank' });
                  }}
                >
                  Paid
                </ButtonBase>
                <ButtonBase
                  type="button"
                  role="radio"
                  aria-checked={basis === 'paystub'}
                  className="ch-switch-btn"
                  data-active={basis === 'paystub' ? '' : undefined}
                  onClick={() => {
                    setBasis('paystub');
                    setPayValue('');
                  }}
                >
                  Paystub
                </ButtonBase>
              </div>

              {basis === 'bank' ? (
                <>
                  <label className="ch-edit-name" htmlFor="ch-amount">
                    How much did you get paid from {target.name}?
                  </label>
                  <p className="ch-edit-note">
                    Type what went into your bank account. We will work out what
                    counts before taxes.
                  </p>
                  <input
                    id="ch-amount"
                    name="amount"
                    inputMode="decimal"
                    type="text"
                    autoFocus
                    placeholder="Numbers only"
                    className="ch-btn ch-edit-field"
                    style={{ marginTop: 6 }}
                    value={payValue}
                    onChange={(event) => setPayValue(event.currentTarget.value)}
                  />
                  {estimate ? (
                    <p className="ch-edit-note" data-warn>
                      Before taxes, that is about {money(estimate)}. This is a
                      guess, so we will leave extra room to be safe.
                    </p>
                  ) : null}
                  {milesField}
                  <ButtonBase type="submit" className="ch-log" style={{ marginTop: 10 }} disabled={!valid}>
                    Log pay
                  </ButtonBase>
                  <ButtonBase
                    type="button"
                    className="ch-plain"
                    onClick={() => { setLogging(false); setPayValue(''); setMilesValue(''); }}
                  >
                    Cancel
                  </ButtonBase>
                  <ButtonBase
                    type="button"
                    className="ch-plain"
                    onClick={() => { setBasis('paystub'); setPayValue(''); }}
                  >
                    Enter my paystub amount instead
                  </ButtonBase>
                </>
              ) : (
                <>
                  <label className="ch-edit-name" htmlFor="ch-amount">
                    What did your paystub say from {target.name}?
                  </label>
                  <p className="ch-edit-note">
                    Type the amount before taxes are taken out. It is on the paper
                    or email your job sends you when they pay you.
                  </p>
                  <input
                    id="ch-amount"
                    name="amount"
                    inputMode="decimal"
                    type="text"
                    autoFocus
                    placeholder="Numbers only"
                    className="ch-btn ch-edit-field"
                    style={{ marginTop: 6 }}
                    value={payValue}
                    onChange={(event) => setPayValue(event.currentTarget.value)}
                  />
                  {ui.payBasis !== 'paystub' ? (
                    <div className="ch-prompt">
                      <p className="ch-prompt-title">Do you want to enter paystubs from now on?</p>
                      <div className="ch-prompt-choices">
                        <ButtonBase
                          type="button"
                          className="ch-prompt-btn"
                          data-selected={fromNowOn ? '' : undefined}
                          onClick={() => setFromNowOn(true)}
                        >
                          Yes, from now on
                        </ButtonBase>
                        <ButtonBase
                          type="button"
                          className="ch-prompt-btn"
                          data-selected={!fromNowOn ? '' : undefined}
                          onClick={() => setFromNowOn(false)}
                        >
                          Just this time
                        </ButtonBase>
                      </div>
                    </div>
                  ) : null}
                  {milesField}
                  <ButtonBase type="submit" className="ch-log" style={{ marginTop: 10 }} disabled={!valid}>
                    Log pay
                  </ButtonBase>
                  <ButtonBase
                    type="button"
                    className="ch-plain"
                    onClick={() => { setLogging(false); setPayValue(''); setMilesValue(''); }}
                  >
                    Cancel
                  </ButtonBase>
                  <ButtonBase
                    type="button"
                    className="ch-plain"
                    onClick={() => {
                      setBasis('bank');
                      setPayValue('');
                      setUi({ payBasis: 'bank' });
                    }}
                  >
                    Enter Direct deposit instead
                  </ButtonBase>
                </>
              )}
            </form>
          ) : (
            <ButtonBase type="button" className="ch-log" onClick={startLogging}>
              Log pay
            </ButtonBase>
          )
        ) : (
          <div className="ch-empty">
            <p>First, tell us where this pay came from.</p>
            <ButtonBase
              type="button"
              className="ch-log"
              style={{ marginTop: 12 }}
              onClick={() => openAddSource('home')}
            >
              Add income source
            </ButtonBase>
          </div>
        )}

        {/* 3 — trial strip (Happy Charm DNA, no dots chart — plain meter). */}
        {trial ? (
          <section className="ch-trial">
            <div className="ch-trial-row">
              <span className="ch-trial-label">Trial months used</span>
              <span className="ch-trial-count">{twp.used}/{TRIAL_MONTH_LIMIT}</span>
            </div>
            <div className="ch-trial-bar" role="img" aria-label={`${twp.used} of ${TRIAL_MONTH_LIMIT} trial months used`}>
              {Array.from({ length: TRIAL_MONTH_LIMIT }, (_, i) => (
                <span key={i} className="ch-trial-pip" data-on={i < twp.used ? '' : undefined} />
              ))}
            </div>
            <p className="ch-trial-note">
              {twp.remaining === 1 ? '1 month' : `${twp.remaining} months`} left.
              Each used month drops out of the count five years after it was spent.
            </p>
          </section>
        ) : null}

        {/* 4 — only months that need you. */}
        <section>
          <h2 className="ch-section-title">Needs a look</h2>
          <div className="ch-months">
            {shown.map((month) => {
              const s = monthStatus(data, month);
              const flag = flagFor(month);
              const cap = capacityFor(data, month);
              const isOpen = openMonth === month;
              const monthTrial = benefitPhase(data, month) === 'trialWork';
              return (
                <div key={month}>
                  <ButtonBase
                    type="button"
                    className="ch-month"
                    aria-expanded={isOpen}
                    onClick={() => setOpenMonth(isOpen ? null : month)}
                  >
                    <span className="ch-month-name">{shortMonthName(month).toUpperCase()}</span>
                    <span className="ch-month-mid">
                      <span className="ch-month-amount">
                        {!cap ? 'No limit yet'
                          : monthTrial && (cap.over > 0 || s.isServiceMonth)
                            ? 'Uses a trial month'
                            : cap.over > 0 ? `${money(cap.over)} over`
                              : cap.stage === 'careful' ? `${money(cap.roomToLimit)} left`
                                : `${money(cap.room)} left`}
                      </span>
                      <span className="ch-month-note">
                        {s.countable === 0 ? 'Nothing logged yet' : `${money(s.countable)} counted`}
                      </span>
                    </span>
                    {heavy.has(month) ? (
                      <span className="ch-tag">{flag?.kind === 'pay' ? flag.text : 'Extra pay'}</span>
                    ) : null}
                  </ButtonBase>

                  {isOpen ? (
                    <div className="ch-detail">
                      {data.streams.filter((st) => isActive(st, month)).map((st) => (
                        <MonthAmount key={st.id} stream={st} month={month} />
                      ))}
                      <dl style={{ marginTop: 10 }}>
                        <dt>What Social Security counts</dt>
                        <dd>{money(s.countable)}</dd>
                        <dt>Your limit this month</dt>
                        <dd>{cap ? money(cap.threshold) : 'Not known yet'}</dd>
                        {seHours(data, month) > 0 ? (
                          <>
                            <dt>Hours you worked</dt>
                            <dd>{seHours(data, month)}</dd>
                          </>
                        ) : null}
                        {s.isServiceMonth && monthTrial ? (
                          <>
                            <dt>Why a trial month</dt>
                            <dd>
                              {seHours(data, month) > TWP_SELF_EMPLOYMENT_HOURS && cap
                                && s.countable <= cap.threshold
                                ? 'Your hours'
                                : 'Counted pay over the limit'}
                            </dd>
                          </>
                        ) : null}
                      </dl>
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>
        </section>
      </main>

      <ToastStack />

      {(sourcesOpen || addingJob) ? (
        <div className="ch-sheet">
          <div
            ref={sourceDialogRef}
            tabIndex={-1}
            className="ch-sheet-card"
            role="dialog"
            aria-modal="true"
            aria-label={addingJob ? 'Add income source' : 'Income sources'}
          >
            {addingJob ? (
              <>
                <div className="ch-sheet-head">
                  <h2>Add income source</h2>
                  <ButtonBase
                    type="button"
                    className="ch-plain"
                    style={{ marginTop: 0, width: 'auto' }}
                    onClick={closeSourceDialog}
                  >
                    Close
                  </ButtonBase>
                </div>
                <label className="ch-edit-name" htmlFor="ch-new-job">What should we call it?</label>
                <input
                  id="ch-new-job"
                  className="ch-btn ch-edit-field"
                  type="text"
                  autoFocus
                  value={newJobName}
                  onChange={(e) => setNewJobName(e.currentTarget.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleAddSource(); } }}
                />
                <ButtonBase type="button" className="ch-log" style={{ marginTop: 12 }} disabled={!newJobName.trim()} onClick={handleAddSource}>
                  Save job
                </ButtonBase>
              </>
            ) : (
              <>
                <div className="ch-sheet-head">
                  <h2>Your jobs</h2>
                  <ButtonBase type="button" className="ch-plain" style={{ marginTop: 0, width: 'auto' }} onClick={() => setSourcesOpen(false)}>
                    Close
                  </ButtonBase>
                </div>
                <ul className="ch-job-list">
                  {data.streams.map((st) => (
                    <li key={st.id} className="ch-job-row">
                      <span>
                        <b>{st.name}</b>
                        <small>{SOURCE_SHORT[st.type]}</small>
                      </span>
                      {st.locked ? null : (
                        <ButtonBase
                          type="button"
                          className="ch-plain"
                          style={{ marginTop: 0, width: 'auto' }}
                          onClick={() => {
                            if (!confirm(`Remove "${st.name}"?`)) return;
                            removeStream(st.id);
                          }}
                        >
                          Remove
                        </ButtonBase>
                      )}
                    </li>
                  ))}
                </ul>
                <ButtonBase type="button" className="ch-log" style={{ marginTop: 12 }} onClick={() => openAddSource('manage')}>
                  Add a job
                </ButtonBase>
              </>
            )}
          </div>
        </div>
      ) : null}

      {settingsOpen ? (
        <SettingsPanel
          theme={ui.theme}
          onTheme={(theme) => setUi({ theme })}
          onOpenStatus={() => { setUi({ layout: 'overview' }); setSettingsOpen(false); }}
          onReset={resetAll}
          onClose={() => setSettingsOpen(false)}
          layout={ui.layout}
          onLayoutChange={(layout) => setUi({ layout })}
        />
      ) : null}
    </div>
  );
}

function MonthAmount({ stream, month }: { stream: Stream; month: MonthKey }) {
  const { data, commit, pushToast } = useTracker();
  const checks = stream.type === 'w2'
    ? stream.checks.filter((c) => c.month === month && !c.projected)
    : [];
  const gross = grossFor(stream, month);
  const hours = hoursFor(stream, month);
  const selfEmployed = stream.type === 'ten99';
  const trial = benefitPhase(data, month) === 'trialWork';

  const [amountDraft, setAmountDraft] = useState<string | null>(null);
  const [hoursDraft, setHoursDraft] = useState<string | null>(null);

  function write(patch: { gross?: number; hours?: number }, said: string) {
    commit((data) => ({
      ...data,
      streams: data.streams.map((st) => (st.id !== stream.id ? st : {
        ...st,
        checks: patch.gross == null
          ? st.checks
          : st.checks.filter((c) => !(c.month === month && !c.projected)),
        months: { ...st.months, [month]: { ...st.months[month], ...patch } }
      }))
    }));
    pushToast(said, true);
  }

  function saveAmount() {
    if (amountDraft == null) return;
    const next = amountDraft.trim() === '' ? 0 : Number(amountDraft);
    setAmountDraft(null);
    if (!Number.isFinite(next) || next < 0 || next === gross) return;
    write({ gross: next }, `${stream.name} set to ${money(next)} for ${longMonthName(month)}`);
  }

  function saveHours() {
    if (hoursDraft == null) return;
    const next = hoursDraft.trim() === '' ? 0 : Number(hoursDraft);
    setHoursDraft(null);
    if (!Number.isFinite(next) || next < 0 || next === hours) return;
    write({ hours: next }, `${stream.name} set to ${next} hours for ${longMonthName(month)}`);
  }

  return (
    <div className="ch-edit">
      <label className="ch-edit-name" htmlFor={`ch-${stream.id}-${month}`}>
        {stream.name} <span>{SOURCE_SHORT[stream.type]}</span>
      </label>
      <input
        id={`ch-${stream.id}-${month}`}
        className="ch-btn ch-edit-field"
        inputMode="decimal"
        type="text"
        value={amountDraft ?? String(gross)}
        onChange={(event) => setAmountDraft(event.currentTarget.value)}
        onBlur={saveAmount}
        onKeyDown={(event) => { if (event.key === 'Enter') event.currentTarget.blur(); }}
      />
      {selfEmployed ? (
        <>
          <label className="ch-edit-name" htmlFor={`ch-${stream.id}-${month}-h`}>
            Hours worked
          </label>
          <input
            id={`ch-${stream.id}-${month}-h`}
            className="ch-btn ch-edit-field"
            inputMode="numeric"
            type="text"
            value={hoursDraft ?? String(hours)}
            onChange={(event) => setHoursDraft(event.currentTarget.value)}
            onBlur={saveHours}
            onKeyDown={(event) => { if (event.key === 'Enter') event.currentTarget.blur(); }}
          />
          {trial ? (
            <p className="ch-edit-note" data-warn={hours > TWP_SELF_EMPLOYMENT_HOURS || undefined}>
              {hours > TWP_SELF_EMPLOYMENT_HOURS
                ? `More than ${TWP_SELF_EMPLOYMENT_HOURS} hours uses a trial month, even when pay is small.`
                : `Over ${TWP_SELF_EMPLOYMENT_HOURS} hours in a month uses a trial month on its own.`}
            </p>
          ) : null}
        </>
      ) : null}
      {checks.length ? (
        <p className="ch-edit-note">
          This month adds up {checks.length} separate payment{checks.length === 1 ? '' : 's'}.
          Typing one total here deletes those {checks.length}.
        </p>
      ) : null}
    </div>
  );
}

function seHours(data: { streams: Stream[] }, month: MonthKey): number {
  return data.streams
    .filter((stream) => stream.type === 'ten99')
    .reduce((sum, stream) => sum + hoursFor(stream, month), 0);
}
