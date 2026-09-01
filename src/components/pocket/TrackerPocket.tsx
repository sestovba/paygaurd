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
import { SettingsPanel } from '../SettingsPanel';
import { ToastStack } from '../ToastStack';
import '../../styles/pocket.css';

export function TrackerPocket() {
  const { data, ui, setUi, resetAll, updateMonthEntry, pushToast } = useTracker();
  useTheme(ui.theme);

  const [settingsOpen, setSettingsOpen] = useState(false);
  const [openMonth, setOpenMonth] = useState<MonthKey | null>(null);
  const [logging, setLogging] = useState(false);
  const [fromBank, setFromBank] = useState(false);
  const [net, setNet] = useState('');
  const estimate = grossFromNet(Number(net));

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
  const shown: MonthKey[] = Array.from(new Set<MonthKey>([asOf, ...flagged.map((f) => f.month)])).sort();
  const flagFor = (month: MonthKey) => flagged.find((f) => f.month === month);

  /* The most common edit in the app, as one field. The full editor is a
   * screenful of settings; adding this week's pay should not require it. */
  const primary = data.streams.find((s) => s.lifecycle === 'active') ?? data.streams[0];

  function logPay(amount: number, basis: 'entered' | 'fromNet' = 'entered') {
    if (!primary || !Number.isFinite(amount) || amount <= 0) return;
    const current = grossFor(primary, asOf);
    // The provenance rides with the figure: a month built from a guess has to
    // keep saying so, or the precision gauge reports a confidence nobody
    // earned. See MonthEntry.basis.
    updateMonthEntry(primary.id, asOf, { gross: current + amount, basis });
    pushToast(`${money(amount)} added to ${longMonthName(asOf)}`, true);
    setLogging(false);
  }

  return (
    <div className="pk">
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
            <form
              className="pk-answer"
              onSubmit={(event) => {
                event.preventDefault();
                const field = event.currentTarget.elements.namedItem('amount') as HTMLInputElement;
                logPay(Number(field.value));
              }}
            >
              <label className="pk-edit-name" htmlFor="pk-amount">
                How much did you get paid from {primary.name}?
              </label>
              {/* Where the number is, described rather than named. "Paystub"
                  is a word plenty of people have never been taught, and the
                  gross/net distinction is the single most common way this
                  kind of form gets filled in wrong. */}
              <p className="pk-edit-note">
                Type the amount before taxes are taken out. It is on the paper
                or email your job sends you when they pay you.
              </p>
              <input
                id="pk-amount"
                name="amount"
                /* `decimal`, not `numeric`: it puts a full keypad with a
                   decimal point on Android instead of digits alone. */
                inputMode="decimal"
                type="text"
                autoFocus
                placeholder="Numbers only"
                className="pk-btn"
                style={{ width: '100%', justifyContent: 'flex-start', marginTop: 6 }}
              />
              <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
                <button type="submit" className="pk-log" style={{ flex: '1 1 auto' }}>Save this pay</button>
                <button type="button" className="pk-btn" onClick={() => setLogging(false)}>Cancel</button>
              </div>

              {/* The way out for someone who cannot find the before-tax
                  number, which is a lot of people. The number they do have is
                  in their banking app. */}
              {fromBank ? (
                <div className="pk-guess">
                  <label className="pk-edit-name" htmlFor="pk-net">
                    How much money went into your bank?
                  </label>
                  <p className="pk-edit-note">
                    This is the amount you actually received. We will work out
                    the rest.
                  </p>
                  <input
                    id="pk-net"
                    className="pk-btn pk-edit-field"
                    inputMode="decimal"
                    type="text"
                    placeholder="Numbers only"
                    value={net}
                    onChange={(event) => setNet(event.currentTarget.value)}
                  />
                  {estimate ? (
                    <p className="pk-edit-note" data-warn>
                      Before taxes, that is about {money(estimate)}. This is a
                      guess, so we will leave extra room to be safe.
                    </p>
                  ) : null}
                  <button
                    type="button"
                    className="pk-log"
                    style={{ marginTop: 10 }}
                    disabled={!estimate}
                    onClick={() => { if (estimate) logPay(estimate, 'fromNet'); setFromBank(false); setNet(''); }}
                  >
                    Use about {estimate ? money(estimate) : '—'}
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  className="pk-plain"
                  onClick={() => setFromBank(true)}
                >
                  I cannot find that number
                </button>
              )}
            </form>
          ) : (
            <button type="button" className="pk-log" onClick={() => setLogging(true)}>
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
                        {s.isServiceMonth ? (
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
          onOpenStatus={() => { setUi({ layout: 'responsive' }); setSettingsOpen(false); }}
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
  const { commit, pushToast } = useTracker();
  const checks = stream.type === 'w2'
    ? stream.checks.filter((c) => c.month === month && !c.projected)
    : [];
  const gross = grossFor(stream, month);
  const hours = hoursFor(stream, month);
  const selfEmployed = stream.type === 'ten99';

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
        {stream.name} <span>{selfEmployed ? '1099' : 'W-2'}</span>
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
          <p className="pk-edit-note" data-warn={hours > TWP_SELF_EMPLOYMENT_HOURS || undefined}>
            {hours > TWP_SELF_EMPLOYMENT_HOURS
              ? `You worked more than ${TWP_SELF_EMPLOYMENT_HOURS} hours. That uses 1 of your 9 trial work months, even though you did not earn much.`
              : `If you work more than ${TWP_SELF_EMPLOYMENT_HOURS} hours in a month, it uses 1 of your 9 trial work months. This happens even if you did not earn much.`}
          </p>
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
 * money. The copy here follows a few rules because of that. They are cheap
 * to keep and easy to break by accident.
 *
 *   Ask a question. Do not name a field.
 *     "How much did you get paid from Cafe shift?" — not "Gross earnings".
 *     A label names a database column; a question tells you what to do.
 *
 *   Describe the thing, do not assume the word.
 *     "the paper or email your job sends you when they pay you" — not
 *     "paystub". Plenty of people have never been taught that word, and
 *     someone who does not know it cannot ask, because the form does not
 *     know it is confusing.
 *
 *   Say which number.
 *     "the amount before taxes are taken out". Gross versus net is the
 *     single most common way a form like this gets filled in wrong, and
 *     getting it wrong here means a wrong answer about their benefits.
 *
 *   Say what will happen, before it happens.
 *     "If you type one total here, those 4 will be deleted." Surprise is
 *     the expensive thing, not the deletion.
 *
 *   One idea per sentence, and short ones.
 *     "September is $100 over your limit." then "This month uses 1 of your
 *     9 trial work months." Not one sentence carrying both.
 *
 *   No idioms, no metaphors, no figurative language.
 *     Nothing is "on track", nothing "burns" a month, there is no "runway".
 *     Say the literal thing.
 *
 *   Expand the jargon or drop it.
 *     "1 of your 9 trial work months" — never "TWP" alone. "What Social
 *     Security counts" — not "countable". The acronyms are SSA's, and the
 *     reader did not agree to learn them to use this app.
 *
 *   Name the real stake, plainly and without drama.
 *     "Earning this much can stop your monthly payments." That is what is
 *     actually at risk. Softening it is not kindness.
 *
 *   Numbers only, and say so.
 *     The placeholder reads "Numbers only", and inputMode is `decimal` so
 *     Android offers a keypad with a decimal point rather than a full
 *     keyboard the user has to fight.
 */
