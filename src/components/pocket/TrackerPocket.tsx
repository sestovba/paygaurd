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
import { SOURCE_SHORT } from '../../domain/copy';
import { longMonthName, monthsOfYear, shortMonthName, todayMonth, yearOf } from '../../domain/months';
import {
  monthStatus, grossFor, grossFromNet, hoursFor, isActive,
  cautiousCountable, isEstimatedMonth
} from '../../domain/earnings';
import { TWP_SELF_EMPLOYMENT_HOURS } from '../../domain/rules';
import { activeThreshold, benefitPhase } from '../../domain/trialWork';
import { attentionFlags } from '../../domain/attention';
import { precisionFor } from '../../domain/precision';
import type { MonthKey, Stream, TrackerData } from '../../domain/types';
import type { PayBasis } from '../../state/storage';
import { SettingsPanel } from '../SettingsPanel';
import { ToastStack } from '../ToastStack';
import '../../styles/pocket.css';

export function TrackerPocket() {
  const { data, ui, setUi, resetAll, updateMonthEntry, pushToast } = useTracker();
  useTheme(ui.theme, ui.palette);

  const [settingsOpen, setSettingsOpen] = useState(false);
  const [openMonth, setOpenMonth] = useState<MonthKey | null>(null);
  const [logging, setLogging] = useState(false);
  const [basis, setBasis] = useState<PayBasis>(ui.payBasis ?? 'bank');
  const [payValue, setPayValue] = useState('');
  const [fromNowOn, setFromNowOn] = useState(true);

  const num = Number(payValue);
  const valid = Number.isFinite(num) && num > 0;
  const estimate = basis === 'bank' && valid ? (grossFromNet(num) ?? 0) : 0;

  const now = todayMonth();
  const asOf: MonthKey = yearOf(now) === ui.year ? now : `${ui.year}-12`;

  const status = monthStatus(data, asOf);
  const phase = benefitPhase(data, asOf);
  const threshold = activeThreshold(data, asOf);
  /* The room figure uses the cautious count, so a guessed month reports the
     room left after assuming the guess was 20% low. See cautiousCountable. */
  const guessed = isEstimatedMonth(data, asOf);
  const cautious = cautiousCountable(data, asOf);
  /* Three states, not two. A guessed month can be under the limit on the
     figure recorded and over it at the top of its uncertainty band, and that
     is its own answer — "you might already be over" — not a rounding of
     either neighbour. Collapsing it into "over" printed a negative number. */
  const certainlyOver = threshold ? status.countable > threshold.amount : false;
  const maybeOver = threshold ? !certainlyOver && cautious > threshold.amount : false;
  const room = threshold ? Math.max(0, threshold.amount - cautious) : 0;

  /* Plain language, on purpose — see the copy note at the foot of this file.
   * Two short sentences beat one long one both for comprehension and for a
   * 320px screen, so the number is the headline and the consequence is its
   * own line underneath. */
  const trial = phase === 'trialWork';
  const answer = !threshold
    ? 'We do not know your limit yet.'
    : certainlyOver
      ? `${longMonthName(asOf)} is ${money(status.countable - threshold.amount)} over your limit.`
      : maybeOver
        ? 'You might already be over your limit.'
        : `You can earn ${money(room)} more this month.`;

  const consequence = !threshold
    ? 'Answer a few questions in Settings and we can tell you how much you can earn.'
    : maybeOver
      ? `We guessed your pay, so it could be as high as ${money(cautious)}. Your limit is ${money(threshold.amount)}. Type the amount before taxes to find out for sure.`
      : trial
        ? (certainlyOver
          ? 'This month uses 1 of your 9 trial work months.'
          : `If you earn more than ${money(threshold.amount)} this month, it uses 1 of your 9 trial work months.`)
        : (certainlyOver
          ? 'Earning this much can stop your monthly payments. Talk to Social Security.'
          : `Earning more than ${money(threshold.amount)} in a month can stop your payments.`);

  const tone = !threshold ? 'unknown'
    : certainlyOver ? 'over'
      : maybeOver ? 'near'
        : room <= 200 ? 'near' : 'clear';

  /* Only what needs saying. A twelve-row list on a 320px screen is a wall
   * you scroll past; the months that are fine do not need a row each. This
   * month is always shown because it is the one you are working in. */
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

  function logPay(amount: number, entryBasis: 'entered' | 'fromNet' = 'entered', netAmount?: number) {
    if (!primary || !Number.isFinite(amount) || amount <= 0) return;
    const current = grossFor(primary, asOf);
    // The provenance rides with the figure: a month built from a guess has to
    // keep saying so, or the precision gauge reports a confidence nobody
    // earned. See MonthEntry.basis.
    updateMonthEntry(primary.id, asOf, {
      gross: current + amount,
      basis: entryBasis,
      ...(netAmount !== undefined ? { net: (primary.months[asOf]?.net ?? 0) + netAmount } : {})
    });
    pushToast(`${money(amount)} added to ${longMonthName(asOf)}`, true);
    setLogging(false);
    setPayValue('');
  }

  function startLogging() {
    setBasis(ui.payBasis ?? 'bank');
    setPayValue('');
    setFromNowOn(true);
    setLogging(true);
  }

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!valid) return;

    if (basis === 'bank') {
      const est = grossFromNet(num);
      if (!est) return;
      logPay(est, 'fromNet', num);
    } else {
      if (fromNowOn) {
        setUi({ payBasis: 'paystub' });
      }
      logPay(num, 'entered');
    }
  }

  return (
    <div className="pk" data-chrome-root>
      <header className="pk-top">
        <div className="pk-top-when">
          <b>{longMonthName(asOf)} {ui.year}</b>
          <span>{data.streams.length === 1 ? primary?.name : `${data.streams.length} sources`}</span>
        </div>
        <button type="button" className="pk-btn" onClick={() => setSettingsOpen(true)}>
          Settings
        </button>
      </header>

      <main className="pk-main">
        {/* 1 — the answer. */}
        <section className="pk-answer" data-tone={tone}>
          <p className="pk-answer-line">{answer}</p>
          <p className="pk-answer-sub">{consequence}</p>
          {guessed ? (
            <p className="pk-answer-sub">
              We worked this out from what went into your bank, so we left room
              in case it is higher. Type the amount before taxes to get the
              exact number.
            </p>
          ) : precisionFor(data, asOf).gaps.length ? (
            <p className="pk-answer-sub">
              This number is our best guess. Add what you were really paid to make it exact.
            </p>
          ) : null}
        </section>

        {/* 2 — the thing you came to do. */}
        {primary ? (
          logging ? (
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
                    How much did you get paid from {primary.name}?
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
                  <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
                    <button
                      type="submit"
                      className="pk-log"
                      style={{ flex: '1 1 auto' }}
                      disabled={!valid}
                    >
                      Save this pay
                    </button>
                    <button
                      type="button"
                      className="pk-btn"
                      onClick={() => {
                        setLogging(false);
                        setPayValue('');
                      }}
                    >
                      Cancel
                    </button>
                  </div>
                  <button
                    type="button"
                    className="pk-plain"
                    onClick={() => {
                      setBasis('paystub');
                      setPayValue('');
                    }}
                  >
                    I know my paystub pay amount
                  </button>
                </>
              ) : (
                <>
                  <label className="pk-edit-name" htmlFor="pk-amount">
                    What did your paystub say from {primary.name}?
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
                  <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
                    <button
                      type="submit"
                      className="pk-log"
                      style={{ flex: '1 1 auto' }}
                      disabled={!valid}
                    >
                      Save this pay
                    </button>
                    <button
                      type="button"
                      className="pk-btn"
                      onClick={() => {
                        setLogging(false);
                        setPayValue('');
                      }}
                    >
                      Cancel
                    </button>
                  </div>
                  <button
                    type="button"
                    className="pk-plain"
                    onClick={() => {
                      setBasis('bank');
                      setPayValue('');
                      setUi({ payBasis: 'bank' });
                    }}
                  >
                    I only know what reached my bank
                  </button>
                </>
              )}
            </form>
          ) : (
            <button type="button" className="pk-log" onClick={startLogging}>
              I got paid
            </button>
          )
        ) : (
          <p className="pk-empty">
            First, tell us about your job. Open Settings and add it.
          </p>
        )}

        {/* 3 — the months worth a row. */}
        <section>
          <h2 className="pk-section-title">Months to check</h2>
          <div className="pk-months">
            {shown.map((month) => {
              const s = monthStatus(data, month);
              const flag = flagFor(month);
              const limit = activeThreshold(data, month);
              const left = limit ? limit.amount - s.countable : null;
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
                        {s.countable === 0 ? 'No pay yet' : money(s.countable)}
                      </span>
                      <span className="pk-month-note">
                        {left == null ? 'We do not know your limit yet'
                          : left >= 0 ? `${money(left)} left to earn` : `${money(-left)} over your limit`}
                      </span>
                    </span>
                    {flag ? <span className="pk-tag" data-kind={flag.kind}>{flag.text}</span> : null}
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
                        <dt>Your limit this month</dt>
                        <dd>{limit ? money(limit.amount) : 'Not known yet'}</dd>
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
                              {seHours(data, month) > TWP_SELF_EMPLOYMENT_HOURS && limit
                                && s.countable <= limit.amount
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
