/*
 * Pocket — the layout for the phone the user actually has.
 *
 * Everyone using this app is, by definition, on a low income, and a large
 * share are carrying a Lifeline handset: cheap Android, 1–2GB of RAM, a
 * 320–360px screen, an un-updated WebView, metered data. None of the other
 * eight layouts were written with that in mind, and it shows — 265 uses of
 * color-mix() across the stylesheets, which an older WebView drops outright,
 * and 129 backdrop-filters, which cost a compositor pass per frame.
 *
 * The rules this file follows:
 *
 *   Every fact is text.       No chart, no canvas, no SVG plot. The most
 *                             expensive thing on the other layouts is a
 *                             twelve-bar chart nobody can read at 320px.
 *   Nothing opens on top.     Month detail expands in place. A modal means a
 *                             second tree, a transition and a scroll lock.
 *   One obvious action.       "Log a paycheck" is why the app is open. It is
 *                             a 52px full-width button, not an icon.
 *   Short lists, not scrolls. Only the months that need something, plus this
 *                             one. Twelve rows on a small screen is a wall.
 *   No horizontal scroll.     Anywhere, ever.
 *
 * It is also the only layout that is code-split — see App.tsx. Loading eight
 * layouts to render one is the single biggest thing this app asks of a slow
 * connection, and the phone this layout is for is the phone least able to
 * afford it.
 */

import { useState } from 'react';
import { useTracker } from '../../state/TrackerProvider';
import { useTheme } from '../../theme';
import { money } from '../../domain/format';
import {
  SOURCE_SHORT, hoursLine, pastSafeLine, roomToTargetLine, trialPermissionLine
} from '../../domain/copy';
import { capacityFor } from '../../domain/capacity';
import { longMonthName, monthsOfYear, shortMonthName, todayMonth, yearOf } from '../../domain/months';
import {
  monthStatus, grossFor, grossFromNet, hoursFor, isActive,
  cautiousCountable, isEstimatedMonth
} from '../../domain/earnings';
import { TWP_SELF_EMPLOYMENT_HOURS, mileageRateFor } from '../../domain/rules';
import { TRIAL_MONTH_LIMIT, benefitPhase, trialWorkStatus } from '../../domain/trialWork';
import { attentionFlags } from '../../domain/attention';
import { extraPaycheckMonths } from '../../domain/paySchedule';
import { precisionFor } from '../../domain/precision';
import type { MonthKey, Stream, TrackerData } from '../../domain/types';
import type { PayBasis } from '../../state/storage';
import { SettingsPanel } from '../SettingsPanel';
import { ToastStack } from '../ToastStack';
import { PocketSourcesModals, type SourcesView } from './PocketSources';
import '../../styles/pocket.css';

export function TrackerPocket() {
  const {
    data, ui, setUi, resetAll, updateMonthEntry, pushToast,
    addStream, updateStream, removeStream
  } = useTracker();
  useTheme(ui.theme, ui.palette);

  const [settingsOpen, setSettingsOpen] = useState(false);
  const [sourcesView, setSourcesView] = useState<SourcesView | null>(null);
  const [openMonth, setOpenMonth] = useState<MonthKey | null>(null);
  const [logging, setLogging] = useState(false);
  const [basis, setBasis] = useState<PayBasis>(ui.payBasis ?? 'bank');
  const [payValue, setPayValue] = useState('');
  const [fromNowOn, setFromNowOn] = useState(true);
  const [targetId, setTargetId] = useState<string | null>(null);
  const [milesValue, setMilesValue] = useState('');

  const num = Number(payValue);
  const valid = Number.isFinite(num) && num > 0;
  const estimate = basis === 'bank' && valid ? (grossFromNet(num) ?? 0) : 0;

  const now = todayMonth();
  const asOf: MonthKey = yearOf(now) === ui.year ? now : `${ui.year}-12`;

  const phase = benefitPhase(data, asOf);
  const guessed = isEstimatedMonth(data, asOf);

  /* One call, and it replaces every figure this screen used to work out for
   * itself.
   *
   * Pocket computed its own room as `threshold - cautious` and called the
   * result `room` — which in capacity.ts is the name for room to the *safe
   * target*, not to the limit. So the headline read "you can earn $1,203
   * more" on a $1,210 limit: technically true, and an invitation into exactly
   * the $210 margin that CLAUDE.md says an extra paycheck month will clear
   * without warning. Going through capacityFor also brings the three stages
   * and the hours, neither of which this screen could express. */
  const capacity = capacityFor(data, asOf);
  const cautious = capacity?.safeCounted ?? cautiousCountable(data, asOf);
  const certainlyOver = capacity ? capacity.over > 0 : false;
  const maybeOver = capacity ? capacity.maybeOver : false;
  const trial = phase === 'trialWork';
  const twp = trialWorkStatus(data, asOf);

  /* Plain language, on purpose — see the copy note at the foot of this file.
   * Two short sentences beat one long one both for comprehension and for a
   * 320px screen, so the number is the headline and the consequence is its
   * own line underneath.
   *
   * The headline is hours wherever a rate exists. Dollars are the unit the
   * rule is written in and hours are the unit "can I take this shift" is
   * decided in, and this is the screen where that decision happens. Without a
   * rate there is nothing to convert, so it falls back to the money. */
  const answer = !capacity
    ? 'We do not know your limit yet.'
    : certainlyOver
      ? `${longMonthName(asOf)} is ${money(capacity.over)} over your limit.`
      : maybeOver
        ? 'You might already be over your limit.'
        : capacity.stage === 'careful'
          ? pastSafeLine(capacity.safeTarget)
          : capacity.hours !== null
            ? hoursLine(capacity.hours)
            : `You can earn ${money(capacity.room)} more this month.`;

  const consequence = !capacity
    ? 'Answer a few questions in Settings and we can tell you how much you can earn.'
    : maybeOver
      ? `We guessed your pay, so it could be as high as ${money(cautious)}. Your limit is ${money(capacity.threshold)}. Type the amount before taxes to find out for sure.`
      : certainlyOver
        ? (trial
          ? 'This month uses one of your trial work months.'
          : 'Earning this much can stop your monthly payments. Talk to Social Security.')
        : capacity.stage === 'careful'
          ? (capacity.hours !== null
            ? `${money(capacity.roomToLimit)} left before your limit — about ${capacity.hours} ${capacity.hours === 1 ? 'hour' : 'hours'}.`
            : `${money(capacity.roomToLimit)} before your limit.`)
          : roomToTargetLine(capacity.room, capacity.safeTarget, capacity.threshold);

  /* Timely, not constant. Trial work months are the reassurance somebody
   * needs when they are close to the line, and noise on a month sitting at
   * $7 — where mentioning a limit they are nowhere near is the only thing on
   * screen that could frighten them. */
  const trialNote = trial && capacity && capacity.stage !== 'safe'
    ? trialPermissionLine(twp.remaining, TRIAL_MONTH_LIMIT)
    : null;

  /* A gap worth mentioning is one the reader can close from this screen.
   *
   * precisionFor reports a `checks` gap whenever no real paystub backs the
   * month — and pocket's only logging path writes a month total, never a
   * Paycheck. So that gap fires permanently here, and the line it drove
   * ("This number is our best guess") sat on figures the reader had typed
   * exactly, asking for something pocket cannot do. A message nobody can
   * action is worse than no message on a 320px screen.
   *
   * The genuinely estimated case is handled above by `guessed`, which says so
   * in its own words. What is left is the schedule and hours gaps, which are
   * real, actionable, and already written as a trade rather than a scolding —
   * so they are said in the domain's words rather than in a sentence this
   * file invented. */
  const gap = precisionFor(data, asOf).gaps.find((g) => g.kind !== 'checks') ?? null;

  const tone = !capacity ? 'unknown'
    : certainlyOver ? 'over'
      : maybeOver ? 'near'
        : capacity.stage === 'careful' ? 'near' : 'clear';

  /* Only what needs saying. A twelve-row list on a 320px screen is a wall
   * you scroll past; the months that are fine do not need a row each. This
   * month is always shown because it is the one you are working in. */
  const heavy = extraPaycheckMonths(data.streams, ui.year);
  const flagged = attentionFlags(data, monthsOfYear(ui.year).filter((m) => m >= asOf));
  /* Focus mode drops the later months that need something and leaves the one
     you are in. Pocket was already close to this; the switch makes it exact. */
  const shown: MonthKey[] = ui.focusMode
    ? [asOf]
    : Array.from(new Set<MonthKey>([asOf, ...flagged.map((f) => f.month)])).sort();
  const flagFor = (month: MonthKey) => flagged.find((f) => f.month === month);

  /* The most common edit in the app, as one field. The full editor is a
   * screenful of settings; adding this week's pay should not require it. */
  const primary = data.streams.find((s) => s.lifecycle === 'active') ?? data.streams[0];

  /* Which job the money came from, asked rather than assumed.
   *
   * This screen took the first active stream and logged everything to it,
   * while its own header said "2 sources" three lines above. With two jobs the
   * form asked "How much did you get paid from Part time?" and put the answer
   * on Part time whichever job had actually paid — silently, with no way to
   * notice and no way to correct it from here. Somebody juggling a shift job
   * and a delivery app is exactly the reader this app is for, so the common
   * case was the broken one.
   *
   * One job and nothing is asked; the question only exists when there is
   * genuinely a choice to make. */
  const loggable = data.streams.filter((st) => st.lifecycle === 'active' && isActive(st, asOf));
  const candidates = loggable.length ? loggable : data.streams;
  const target = candidates.find((st) => st.id === targetId)
    ?? (candidates.length === 1 ? candidates[0] : null);

  function logPay(
    amount: number,
    entryBasis: 'entered' | 'fromNet' = 'entered',
    netAmount?: number,
    addMiles?: number | null
  ) {
    if (!target || !Number.isFinite(amount) || amount <= 0) return;
    const current = grossFor(target, asOf);
    // The provenance rides with the figure: a month built from a guess has to
    // keep saying so, or the precision gauge reports a confidence nobody
    // earned. See MonthEntry.basis.
    updateMonthEntry(target.id, asOf, {
      gross: current + amount,
      basis: entryBasis,
      ...(netAmount !== undefined ? { net: (target.months[asOf]?.net ?? 0) + netAmount } : {}),
      ...(addMiles ? { miles: (target.months[asOf]?.miles ?? 0) + addMiles } : {})
    });
    /* Names the job as well as the month. With more than one source, "added to
       September" does not say enough to spot a mistake — and the mistake this
       replaces was silent. */
    pushToast(
      candidates.length > 1
        ? `${money(amount)} added to ${target.name}, ${longMonthName(asOf)}`
        : `${money(amount)} added to ${longMonthName(asOf)}`,
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
    setLogging(true);
  }

  /* Sources stay in Pocket. Settings cannot create a stream, and opening the
     full job editor here would be a second product on a screen that exists to
     log one paycheck. Name it, list it, delete it — that is enough. */
  function openManageSources() {
    setSourcesView({ kind: 'manage' });
  }

  function openAddSource(returnTo: 'manage' | 'logging' | 'home') {
    setSourcesView({ kind: 'add', returnTo });
  }

  function handleAddSource(name: string, returnTo: 'manage' | 'logging' | 'home') {
    const id = addStream('w2');
    updateStream(id, { name });
    if (returnTo === 'logging') {
      setTargetId(id);
      setLogging(true);
      setSourcesView(null);
      return;
    }
    if (returnTo === 'manage') {
      setSourcesView({ kind: 'manage' });
      return;
    }
    setSourcesView(null);
  }

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!valid) return;

    /* Miles ride along with the pay for gig work, because afterwards is too
       late. See the field itself for why this is asked here. */
    const miles = Number(milesValue);
    const addMiles = target?.type === 'ten99' && Number.isFinite(miles) && miles > 0
      ? miles
      : null;

    if (basis === 'bank') {
      const est = grossFromNet(num);
      if (!est) return;
      logPay(est, 'fromNet', num, addMiles);
    } else {
      if (fromNowOn) {
        setUi({ payBasis: 'paystub' });
      }
      logPay(num, 'entered', undefined, addMiles);
    }
  }

  /* Miles, asked while the pay is being logged — for gig work only.
   *
   * "We must ask miles with gig jobs. Part time jobs easy peasy." A W-2 month
   * is one number and nothing else; a 1099 month has a second one that
   * changes the answer more than the first does, because Social Security
   * counts self-employment *after* driving costs come off.
   *
   * Asking here rather than reporting it missing afterwards is the whole
   * point. The precision gap is a safety net for months already logged; this
   * is the fix, because a driver who is not asked at the moment they log will
   * not come back later to add miles they have by then forgotten.
   *
   * The deduction appears as it is typed, which is CLAUDE.md's own
   * instruction — watching $0.70 a mile come off what counts teaches the rule
   * in a way no paragraph about it can, and this is the single biggest lever
   * a gig worker has for earning more without going over. */
  const milesNum = Number(milesValue);
  const milesOff = Number.isFinite(milesNum) && milesNum > 0
    ? Math.round(milesNum * mileageRateFor(asOf) * 100) / 100
    : 0;

  const milesField = target?.type === 'ten99' ? (
    <>
      <label className="pk-edit-name" htmlFor="pk-miles" style={{ marginTop: 14 }}>
        How many miles did you drive for this pay?
      </label>
      <p className="pk-edit-note">
        Driving costs come off before this counts. Leave it empty if you did
        not drive.
      </p>
      <input
        id="pk-miles"
        name="miles"
        inputMode="numeric"
        type="text"
        placeholder="Numbers only"
        className="pk-btn pk-edit-field"
        style={{ marginTop: 6 }}
        value={milesValue}
        onChange={(event) => setMilesValue(event.currentTarget.value)}
      />
      {milesOff > 0 ? (
        /* Not data-warn. That styling is amber and reads as caution, which is
           what the net-to-before-taxes estimate above it correctly uses — but
           a mileage deduction is the opposite kind of news. It is the reader
           discovering they can earn more than they thought, and dressing it
           as a warning argues against the one lever this audience most often
           does not know they have. */
        <p className="pk-edit-note" data-good>
          That takes {money(milesOff)} off what counts.
        </p>
      ) : null}
    </>
  ) : null;

  return (
    <div className="pk" data-chrome-root>
      <header className="pk-top">
        <div className="pk-top-when">
          <b>{longMonthName(asOf)} {ui.year}</b>
          <button
            type="button"
            className="pk-top-sources"
            onClick={openManageSources}
          >
            {data.streams.length === 1 ? primary?.name : `${data.streams.length} sources`}
          </button>
        </div>
        <button type="button" className="pk-btn" onClick={() => setSettingsOpen(true)}>
          Settings
        </button>
      </header>

      <main className="pk-main">
        {/* 1 — the answer. */}
        <section className="pk-hero" data-tone={tone}>
          <p className="pk-hero-line">{answer}</p>
          <p className="pk-hero-sub">{consequence}</p>
          {trialNote ? <p className="pk-hero-sub">{trialNote}</p> : null}
          {heavy.has(asOf) ? (
            <p className="pk-hero-sub">
              This month has an extra paycheck, so leave a little more room.
            </p>
          ) : null}
          {guessed ? (
            <p className="pk-hero-sub">
              We worked this out from what went into your bank, so we left room
              in case it is higher. Type the amount before taxes to get the
              exact number.
            </p>
          ) : gap ? (
            <p className="pk-hero-sub">
              Add {gap.missing}. Without that, {gap.cost}.
            </p>
          ) : null}
        </section>

        {/* 2 — the thing you came to do. */}
        {primary ? (
          logging && !target ? (
            /* One question, before the number. Built from classes this file
               already has, so it costs no new stylesheet. */
            <section className="pk-answer">
              <p className="pk-edit-name">Which job paid you?</p>
              <div className="pk-months">
                {candidates.map((st) => (
                  <button
                    key={st.id}
                    type="button"
                    className="pk-month"
                    onClick={() => setTargetId(st.id)}
                  >
                    <span className="pk-month-mid">
                      <span className="pk-month-amount">{st.name}</span>
                      <span className="pk-month-note">
                        {SOURCE_SHORT[st.type]}
                        {grossFor(st, asOf) > 0
                          ? ` · ${money(grossFor(st, asOf))} logged this month`
                          : ' · nothing logged this month'}
                      </span>
                    </span>
                  </button>
                ))}
              </div>
              <button
                type="button"
                className="pk-plain"
                onClick={() => openAddSource('logging')}
              >
                Add a job
              </button>
            </section>
          ) : logging && target ? (
            <form className="pk-answer" onSubmit={handleSubmit}>
              {/* The switch between net pay and paystub lives right here and defaults to net pay ("Paid"). */}
              <div className="pk-switch" role="radiogroup" aria-label="How you enter pay">
                <button
                  type="button"
                  role="radio"
                  aria-checked={basis === 'bank'}
                  className="pk-switch-btn"
                  data-active={basis === 'bank' ? '' : undefined}
                  onClick={() => {
                    setBasis('bank');
                    setPayValue('');
                    setUi({ payBasis: 'bank' });
                  }}
                >
                  Paid
                </button>
                <button
                  type="button"
                  role="radio"
                  aria-checked={basis === 'paystub'}
                  className="pk-switch-btn"
                  data-active={basis === 'paystub' ? '' : undefined}
                  onClick={() => {
                    setBasis('paystub');
                    setPayValue('');
                  }}
                >
                  Paystub
                </button>
              </div>

              {basis === 'bank' ? (
                <>
                  <label className="pk-edit-name" htmlFor="pk-amount">
                    How much did you get paid from {target.name}?
                  </label>
                  <p className="pk-edit-note">
                    Type what went into your bank account. We will work out what
                    counts before taxes.
                  </p>
                  <input
                    id="pk-amount"
                    name="amount"
                    inputMode="decimal"
                    type="text"
                    autoFocus
                    placeholder="Numbers only"
                    className="pk-btn pk-edit-field"
                    style={{ marginTop: 6 }}
                    value={payValue}
                    onChange={(event) => setPayValue(event.currentTarget.value)}
                  />
                  {estimate ? (
                    <p className="pk-edit-note" data-warn>
                      Before taxes, that is about {money(estimate)}. This is a
                      guess, so we will leave extra room to be safe.
                    </p>
                  ) : null}
                  {milesField}
                  {/* One primary, then a way out — stacked, not a row.
                      .pk-log is display:block/width:100%, so as a flex item it
                      claimed the whole line and wrapped Cancel underneath it
                      anyway, unstyled and looking like a second choice of
                      equal weight. Cancel is not a second choice: this file's
                      own .pk-plain exists for exactly that ("a plain text
                      button, not a second big green one — there is one primary
                      action") and was going unused three lines below. */}
                  <button
                    type="submit"
                    className="pk-log"
                    style={{ marginTop: 10 }}
                    disabled={!valid}
                  >
                    Add pay
                  </button>
                  <button
                    type="button"
                    className="pk-plain"
                    onClick={() => {
                      setLogging(false);
                      setPayValue('');
                      setMilesValue('');
                    }}
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    className="pk-plain"
                    onClick={() => {
                      setBasis('paystub');
                      setPayValue('');
                    }}
                  >
                    Enter my paystub amount instead
                  </button>
                </>
              ) : (
                <>
                  <label className="pk-edit-name" htmlFor="pk-amount">
                    What did your paystub say from {target.name}?
                  </label>
                  <p className="pk-edit-note">
                    Type the amount before taxes are taken out. It is on the paper
                    or email your job sends you when they pay you.
                  </p>
                  <input
                    id="pk-amount"
                    name="amount"
                    inputMode="decimal"
                    type="text"
                    autoFocus
                    placeholder="Numbers only"
                    className="pk-btn pk-edit-field"
                    style={{ marginTop: 6 }}
                    value={payValue}
                    onChange={(event) => setPayValue(event.currentTarget.value)}
                  />
                  {ui.payBasis !== 'paystub' ? (
                    <div className="pk-prompt">
                      <p className="pk-prompt-title">Do you want to enter paystubs from now on?</p>
                      <div className="pk-prompt-choices">
                        <button
                          type="button"
                          className="pk-prompt-btn"
                          data-selected={fromNowOn ? '' : undefined}
                          onClick={() => setFromNowOn(true)}
                        >
                          Yes, from now on
                        </button>
                        <button
                          type="button"
                          className="pk-prompt-btn"
                          data-selected={!fromNowOn ? '' : undefined}
                          onClick={() => setFromNowOn(false)}
                        >
                          Just this time
                        </button>
                      </div>
                    </div>
                  ) : null}
                  {milesField}
                  {/* One primary, then a way out — stacked, not a row.
                      .pk-log is display:block/width:100%, so as a flex item it
                      claimed the whole line and wrapped Cancel underneath it
                      anyway, unstyled and looking like a second choice of
                      equal weight. Cancel is not a second choice: this file's
                      own .pk-plain exists for exactly that ("a plain text
                      button, not a second big green one — there is one primary
                      action") and was going unused three lines below. */}
                  <button
                    type="submit"
                    className="pk-log"
                    style={{ marginTop: 10 }}
                    disabled={!valid}
                  >
                    Add pay
                  </button>
                  <button
                    type="button"
                    className="pk-plain"
                    onClick={() => {
                      setLogging(false);
                      setPayValue('');
                      setMilesValue('');
                    }}
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    className="pk-plain"
                    onClick={() => {
                      setBasis('bank');
                      setPayValue('');
                      setUi({ payBasis: 'bank' });
                    }}
                  >
                    Enter Direct deposit instead
                  </button>
                </>
              )}
            </form>
          ) : (
            <button type="button" className="pk-log" onClick={startLogging}>
              Log Pay
            </button>
          )
        ) : (
          <div className="pk-empty">
            <p>First, tell us about your job.</p>
            <button
              type="button"
              className="pk-log"
              style={{ marginTop: 12 }}
              onClick={() => openAddSource('home')}
            >
              Add income source
            </button>
          </div>
        )}

        {/* 3 — the months worth a row. */}
        <section>
          <h2 className="pk-section-title">Months to check</h2>
          <div className="pk-months">
            {shown.map((month) => {
              const s = monthStatus(data, month);
              const flag = flagFor(month);
              /* Big number is the room, not the takings.
                 This row used to lead with what had been logged — $7 set
                 large and "$1,203 left to earn" set small underneath. The
                 takings are what already happened and cannot be acted on;
                 the room is the only figure on the row anybody makes a
                 decision from, so the two have swapped places. */
              const cap = capacityFor(data, month);
              const isOpen = openMonth === month;

              return (
                <div key={month}>
                  <button
                    type="button"
                    className="pk-month"
                    aria-expanded={isOpen}
                    onClick={() => setOpenMonth(isOpen ? null : month)}
                  >
                    <span className="pk-month-name">{shortMonthName(month).toUpperCase()}</span>
                    <span className="pk-month-mid">
                      <span className="pk-month-amount">
                        {!cap ? 'No limit yet'
                          : cap.over > 0 ? `${money(cap.over)} over`
                            : cap.stage === 'careful' ? `${money(cap.roomToLimit)} left`
                              : `${money(cap.room)} left`}
                      </span>
                      <span className="pk-month-note">
                        {s.countable === 0 ? 'Nothing logged yet'
                          : cap && cap.stage === 'careful'
                            ? `${money(s.countable)} logged, past ${money(cap.safeTarget)}`
                            : `${money(s.countable)} logged`}
                      </span>
                    </span>
                    {/* Only the extra-paycheck flag now.
                        Once the row leads with the room, a "near" flag reads
                        "$130 left before your limit" beside an amount that
                        already says "$130 left", and an "over" flag repeats
                        "$100 over" — the same fact three times on one row of a
                        320px screen. The paycheck count is the only flag the
                        amount cannot express, so it is the only one kept.
                        State stays a word rather than only a colour, which is
                        this file's rule; the word just moved into the
                        figure. */}
                    {heavy.has(month)
                      ? <span className="pk-tag" data-kind="pay">{flag?.kind === 'pay' ? flag.text : '3 paydays'}</span>
                      : null}
                  </button>

                  {isOpen ? (
                    <div className="pk-detail">
                      {/* Correcting a wrong total is the other half of
                          logging one, and it was missing: the fast path only
                          ever added. Each source gets its own field, because
                          "the month total" is not a thing you can edit when
                          two jobs feed it. */}
                      {data.streams.filter((st) => isActive(st, month)).map((st) => (
                        <MonthAmount key={st.id} stream={st} month={month} />
                      ))}

                      <dl style={{ marginTop: 10 }}>
                        <dt>What Social Security counts</dt>
                        <dd>{money(s.countable)}</dd>
                        {/* Both lines, in the drawer rather than on the row.
                            The safe figure is the one the app answers to and
                            the limit is the one Social Security applies, and a
                            reader shown only the first will assume it is the
                            second. This is the layer where that gets said —
                            the row above stays one number. */}
                        <dt>What we aim at</dt>
                        <dd>{cap ? money(cap.safeTarget) : 'Not known yet'}</dd>
                        <dt>Your limit this month</dt>
                        <dd>{cap ? money(cap.threshold) : 'Not known yet'}</dd>
                        {seHours(data, month) > 0 ? (
                          <>
                            <dt>Hours you worked</dt>
                            <dd>{seHours(data, month)}</dd>
                          </>
                        ) : null}
                        {/* Only while the trial months are the thing being
                            spent. After they are gone this row would be the
                            app naming a rule that no longer applies to you,
                            which is the one thing it has decided not to do. */}
                        {s.isServiceMonth && benefitPhase(data, month) === 'trialWork' ? (
                          <>
                            <dt>Trial work months used</dt>
                            {/* Why it counted, not just that it did — the
                                hours route is the one nobody expects. */}
                            <dd>
                              {seHours(data, month) > TWP_SELF_EMPLOYMENT_HOURS && cap
                                && s.countable <= cap.threshold
                                ? '1 — because of your hours'
                                : '1'}
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

      <PocketSourcesModals
        view={sourcesView}
        streams={data.streams}
        year={ui.year}
        onClose={() => setSourcesView(null)}
        onOpenAdd={() => openAddSource('manage')}
        onBackToManage={() => setSourcesView({ kind: 'manage' })}
        onAdd={handleAddSource}
        onRemove={removeStream}
      />

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

/**
 * One source's total for one month, editable in place.
 *
 * Two things make this less trivial than a number field:
 *
 * 1. For a W-2 stream, `grossFor` prefers individually entered paychecks and
 *    ignores the month's `gross` override entirely. So on a month backed by
 *    checks, writing the override changes nothing visible — the edit appears
 *    to be accepted and silently does not happen. Saving a total here clears
 *    those checks in the same undo step, and the field says so before you do
 *    it rather than after.
 * 2. It commits on blur and on Enter, not on every keystroke. Each commit is
 *    an undo step, and one per character makes Undo useless.
 */
function MonthAmount({ stream, month }: { stream: Stream; month: MonthKey }) {
  const { data, commit, pushToast } = useTracker();
  const checks = stream.type === 'w2'
    ? stream.checks.filter((c) => c.month === month && !c.projected)
    : [];
  const gross = grossFor(stream, month);
  const hours = hoursFor(stream, month);
  const selfEmployed = stream.type === 'ten99';
  /* The hours rule is a trial-work rule. Once those months are spent, hours
     no longer decide anything, and a note about them would be this layout
     explaining a limit that is not yours any more. */
  const trial = benefitPhase(data, month) === 'trialWork';

  const [amountDraft, setAmountDraft] = useState<string | null>(null);
  const [hoursDraft, setHoursDraft] = useState<string | null>(null);

  function write(patch: { gross?: number; hours?: number }, said: string) {
    commit((data) => ({
      ...data,
      streams: data.streams.map((st) => (st.id !== stream.id ? st : {
        ...st,
        // Replacing a check-backed month with one figure means the checks
        // are gone; leaving them would make the number on screen a lie.
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
    <div className="pk-edit">
      <label className="pk-edit-name" htmlFor={`pk-${stream.id}-${month}`}>
        {/* The two tax-form names, on the smallest screen in the product,
            beside the name of the job they describe. */}
        {stream.name} <span>{SOURCE_SHORT[stream.type]}</span>
      </label>
      <input
        id={`pk-${stream.id}-${month}`}
        className="pk-btn pk-edit-field"
        inputMode="decimal"
        type="text"
        value={amountDraft ?? String(gross)}
        onChange={(event) => setAmountDraft(event.currentTarget.value)}
        onBlur={saveAmount}
        onKeyDown={(event) => { if (event.key === 'Enter') event.currentTarget.blur(); }}
      />

      {/* Self-employment burns a trial work month on EITHER money or time:
          more than 80 hours does it on its own, whatever the earnings. A
          1099 source with no way to record hours is a source that can use up
          the nine months silently, so the field is not optional here. */}
      {selfEmployed ? (
        <>
          <label className="pk-edit-name" htmlFor={`pk-${stream.id}-${month}-h`}>
            How many hours did you work?
          </label>
          <input
            id={`pk-${stream.id}-${month}-h`}
            className="pk-btn pk-edit-field"
            inputMode="numeric"
            type="text"
            value={hoursDraft ?? String(hours)}
            onChange={(event) => setHoursDraft(event.currentTarget.value)}
            onBlur={saveHours}
            onKeyDown={(event) => { if (event.key === 'Enter') event.currentTarget.blur(); }}
          />
          {trial ? (
            <p className="pk-edit-note" data-warn={hours > TWP_SELF_EMPLOYMENT_HOURS || undefined}>
              {hours > TWP_SELF_EMPLOYMENT_HOURS
                ? `You worked more than ${TWP_SELF_EMPLOYMENT_HOURS} hours. That uses 1 of your 9 trial work months, even though you did not earn much.`
                : `If you work more than ${TWP_SELF_EMPLOYMENT_HOURS} hours in a month, it uses 1 of your 9 trial work months. This happens even if you did not earn much.`}
            </p>
          ) : null}
        </>
      ) : null}

      {checks.length ? (
        <p className="pk-edit-note">
          {/* Says what will happen, before it happens. */}
          This month adds up {checks.length} separate payment{checks.length === 1 ? '' : 's'}.
          If you type one total here, those {checks.length} will be deleted.
        </p>
      ) : null}
    </div>
  );
}

/** Self-employment hours across every 1099 source in a month — the figure
 *  `monthStatus` tests against the 80-hour rule, exposed so the month can say
 *  which of the two routes made it a trial work month. */
function seHours(data: TrackerData, month: MonthKey): number {
  return data.streams
    .filter((stream) => stream.type === 'ten99')
    .reduce((sum, stream) => sum + hoursFor(stream, month), 0);
}

/*
 * A NOTE ON THE WORDS IN THIS FILE
 *
 * The person reading this screen is, by definition, disabled — that is what
 * the benefit is. Some will be autistic, some will have a cognitive or
 * learning disability, and many will be doing this while worried about
 * money. That is why this file asks questions instead of naming fields, and
 * why it says "the paper or email your job sends you when they pay you"
 * rather than "paystub".
 *
 * The rules themselves used to be written out here, at length. They are not
 * any more, because they are not this file's rules — they are the product's,
 * and three other places had their own copy of them. They live in
 * docs/DESIGN-SYSTEM.md (the master vocabulary, the four questions every
 * label answers, the anti-vocabulary, and the tone variants), and in
 * src/domain/copy.ts, which is the executable half of that document.
 *
 * This layout reads in the `spoken` tone. What that means, and what it is
 * allowed to change, is Part 2 of the design system.
 */
