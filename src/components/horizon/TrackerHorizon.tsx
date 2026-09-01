/*
 * Horizon — an eighth layout, assembled from what the review found.
 *
 * Seven layouts and fifty notes produced a fairly clear verdict, and this is
 * an attempt to act on all of it at once rather than one note at a time.
 *
 * WHAT THE REVIEW SAID TO KEEP, and where it is here:
 *
 *   "The best idea in any of the seven layouts: a strip of exactly the months
 *    that need you."                                       → the runway
 *   "[the month grid] would be the strongest surface in the product if each
 *    cell said which of the three states it is in, and marked the 3- and
 *    5-paycheck months before they happen."                → the runway
 *   "[the monthly analysis] is the most useful thing on the layout … it
 *    should be what you land on."                          → the table, high
 *   Picked from an A/B: one sentence, not an amount and a percent.
 *                                                          → the answer line
 *   "nothing on any screen says how accurate it is being."  → precision line
 *
 * WHAT IT SAID TO LEAVE OUT, and which is therefore absent here:
 *
 *   No annual total, anywhere. The note "no limit is annual" appears six
 *   times across six layouts; both SSA limits are monthly, so a year figure
 *   cannot be over or under either of them.
 *   No average. "An average is safe-looking by construction: it averages away
 *   the 3- and 5-paycheck months that cause the problem."
 *   No repeated summary strip. Four of the seven state YTD, TWP and SGA twice
 *   on one screen; one of them counted as the answer and the other as noise.
 *   No theme or palette switcher in the header, and no import/export there —
 *   both are housekeeping, and Settings is two icons away.
 *   No interface tutorial, numbered trail or running explainer. "If the
 *   layout needs a running explainer to be used, the layout is the thing to
 *   fix."
 *   No three views of one table.
 *
 * MY OWN ARGUMENT, which is what makes it a design rather than a shopping
 * list: every one of the seven is arranged around totals, and the product's
 * question is not "how much have I earned" but "what is about to happen". So
 * this reads forward. The order is the order of the questions: am I safe now,
 * how far can I trust that, what is coming, what should I do, then the
 * record. Nothing above the fold is about the past.
 */

import { useState } from 'react';
import { Settings } from 'lucide-react';
import { useTracker } from '../../state/TrackerProvider';
import { useTheme } from '../../theme';
import { money } from '../../domain/format';
import { longMonthName, todayMonth, yearOf } from '../../domain/months';
import { monthStatus } from '../../domain/earnings';
import { activeThreshold, benefitPhase } from '../../domain/trialWork';
import { precisionFor } from '../../domain/precision';
import { actionItems } from '../../domain/notifications';
import type { MonthKey } from '../../domain/types';
import { PrecisionLine } from '../PrecisionLine';
import { ToastStack } from '../ToastStack';
import { SettingsPanel } from '../SettingsPanel';
import { StreamsPanel } from '../StreamsPanel';
import { MonthSheet } from '../MonthSheet';
import { HorizonRunway } from './HorizonRunway';
import '../../styles/horizon.css';

export function TrackerHorizon() {
  const { data, ui, setUi, resetAll } = useTracker();
  useTheme(ui.theme);

  const [settingsOpen, setSettingsOpen] = useState(false);
  const [openMonth, setOpenMonth] = useState<MonthKey | null>(null);
  const [openStream, setOpenStream] = useState<string | null>(null);

  const now = todayMonth();
  const asOf: MonthKey = yearOf(now) === ui.year ? now : `${ui.year}-12`;

  const status = monthStatus(data, asOf);
  const phase = benefitPhase(data, asOf);
  const threshold = activeThreshold(data, asOf);
  const over = threshold ? status.countable > threshold.amount : false;
  const room = threshold ? Math.max(0, threshold.amount - status.countable) : 0;
  const limitName = phase === 'trialWork' ? 'TWP' : 'SGA';

  const items = actionItems(data, ui.year);

  /* One sentence, which is the variant that won the A/B on this exact row.
   * An amount with a percent beside it makes the reader do the comparison
   * the app already did. */
  const answer = !threshold
    ? 'Confirm your Trial Work Period status before this can mean anything.'
    : over
      ? `${money(status.countable - threshold.amount)} over the ${limitName} limit this month`
      : `${money(room)} left before the ${limitName} limit this month`;

  const tone = !threshold ? 'unknown' : over ? 'over' : room <= 200 ? 'near' : 'clear';

  return (
    <div className="hz">
      {/* The header carries the year and where you stand. Nothing else: the
          notes caught palette switchers, theme toggles and import/export all
          sitting in the highest-value strip on their layouts. */}
      <header className="hz-top">
        <div className="hz-top-id">
          <h1>Horizon</h1>
          <p>{longMonthName(asOf)} {ui.year}</p>
        </div>
        <div className="hz-top-year" role="group" aria-label="Year">
          <button type="button" onClick={() => setUi({ year: ui.year - 1 })} aria-label="Previous year">‹</button>
          <span>{ui.year}</span>
          <button type="button" onClick={() => setUi({ year: ui.year + 1 })} aria-label="Next year">›</button>
        </div>
        <button
          type="button"
          className="hz-icon-btn"
          onClick={() => setSettingsOpen(true)}
          aria-label="Settings"
        >
          <Settings className="size-4" />
        </button>
      </header>

      <main className="hz-main">
        {/* 1 — the answer, in one sentence, with how far to trust it. */}
        <section className="hz-answer" data-tone={tone} aria-live="polite">
          <p className="hz-answer-line">{answer}</p>
          <PrecisionLine reading={precisionFor(data, asOf)} />
        </section>

        {/* 2 — what is coming. The one surface that is new here. */}
        <HorizonRunway onOpenMonth={setOpenMonth} />

        {/* 3 — what to do, and only when there is something. An empty
            "0 alerts" panel is a row you read and skip every time. */}
        {items.length ? (
          <section className="hz-todo" aria-label="What to do">
            <h2 className="hz-label">What to do</h2>
            <ul>
              {items.map((item, i) => (
                <li key={i} data-severity={item.severity}>{item.message}</li>
              ))}
            </ul>
          </section>
        ) : null}

        {/* 4 — the record. Called "the most useful thing on the layout" in
            the review, where it sat under a chart and two duplicate stat
            rows. Here nothing is above it but the answer and the forecast. */}
        <section className="hz-sources" aria-label="Income sources">
          <h2 className="hz-label">Your income</h2>
          <StreamsPanel onOpenStream={setOpenStream} selectedId={openStream ?? undefined} />
        </section>
      </main>

      {openMonth ? (
        <MonthSheet
          month={openMonth}
          onClose={() => setOpenMonth(null)}
          onOpenStream={(id) => { setOpenMonth(null); setOpenStream(id); }}
        />
      ) : null}

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
