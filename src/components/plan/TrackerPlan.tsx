/*
 * Plan — one month, answered in hours.
 *
 * Leads with hours because that is the unit the decision is made in; dollars
 * are the unit the rule is written in. See domain/capacity.ts.
 *
 * Rules: this month only, no calendar, no look-ahead, net is the first field,
 * answers are measured to the $1,000 safety line rather than the real limit.
 */

import { useEffect, useMemo, useState } from 'react';
import type { Dispatch, SetStateAction } from 'react';
import { BadgeCheck, Minus, Plus } from 'lucide-react';
import { useTracker } from '../../state/TrackerProvider';
import { useTheme } from '../../theme';
import { money } from '../../domain/format';
import { SOURCE_SHORT } from '../../domain/copy';
import { longMonthName, todayMonth, yearOf } from '../../domain/months';
import { extraPaycheckMonths } from '../../domain/paySchedule';
import { precisionFor } from '../../domain/precision';
import {
  estimatedGrossFromHours, grossFor, grossFromNet, hoursFor, isActive,
  mileageDeduction
} from '../../domain/earnings';
import { mileageRateFor, TWP_SELF_EMPLOYMENT_HOURS } from '../../domain/rules';
import { benefitPhase, trialWorkStatus, TRIAL_MONTH_LIMIT } from '../../domain/trialWork';
import { capacityFor, outcomeOf, toneOf } from '../../domain/capacity';
import type { Capacity, Tone } from '../../domain/capacity';
import type { MonthKey, Stream } from '../../domain/types';
import { MonthSheet } from '../MonthSheet';
import { SettingsPanel } from '../SettingsPanel';
import { StreamSheet } from '../StreamSheet';
import { ToastStack } from '../ToastStack';
import { TwpWizard } from '../TwpWizard';
import { PrecisionLine } from '../PrecisionLine';
import '../../styles/plan.css';

import { ButtonBase } from '../../design-system';
/** One tap of the hours stepper — about half a shift. */
const HOUR_STEP = 4;

/** Settings, as an arcade stick. A gear is a machine-shop icon that ended up
 *  meaning "options" by convention alone; this screen already speaks in
 *  sprites, so the control that changes how it behaves is drawn as the thing
 *  you would have used to change it. */
function Joystick({ size = 22 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 16 16"
      shapeRendering="crispEdges"
      aria-hidden="true"
      focusable="false"
    >
      <g fill="#16191f">
        <rect x="6" y="0" width="4" height="1" />
        <rect x="5" y="1" width="6" height="1" />
        <rect x="4" y="2" width="8" height="3" />
        <rect x="5" y="5" width="6" height="1" />
        <rect x="6" y="6" width="4" height="5" />
        <rect x="2" y="10" width="12" height="5" />
      </g>
      <g fill="#d8402f">
        <rect x="6" y="1" width="4" height="1" />
        <rect x="5" y="2" width="6" height="3" />
        <rect x="6" y="5" width="4" height="1" />
      </g>
      <rect x="6" y="2" width="1" height="2" fill="#ffb3a7" />
      <rect x="7" y="6" width="2" height="4" fill="#c9c6be" />
      <rect x="3" y="11" width="10" height="3" fill="#5b6470" />
      <rect x="3" y="11" width="10" height="1" fill="#98a2b1" />
    </svg>
  );
}

/**
 * An 8-bit coin. Octagon of rectangles, crisp-edged, gold in both themes.
 *
 * It is only ever used for the shower that plays when a payment is saved.
 * There is deliberately no coin counter and no balance anywhere in this app:
 * a running total of pretend currency sitting beside real dollar figures on a
 * benefits tracker is a genuine hazard, not a bit of fun. A cheer is a cheer;
 * a second currency is a thing somebody could mistake for money.
 */
function Coin({ size = 22 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 10 10"
      shapeRendering="crispEdges"
      aria-hidden="true"
      focusable="false"
    >
      <g fill="#8a5a00">
        <rect x="3" y="0" width="4" height="10" />
        <rect x="2" y="1" width="6" height="8" />
        <rect x="1" y="2" width="8" height="6" />
      </g>
      <g fill="#f2b134">
        <rect x="3" y="1" width="4" height="8" />
        <rect x="2" y="2" width="6" height="6" />
      </g>
      <rect x="3" y="2" width="1" height="4" fill="#ffe9a8" />
      <rect x="4" y="3" width="2" height="4" fill="#d18f18" />
    </svg>
  );
}

/**
 * A job, as a chest.
 *
 * Each source of work is a thing you go to and collect from, so it is drawn
 * as one. `open` when it has paid something into the month you are looking
 * at, shut when it has not — which makes the row answer "have I logged this
 * one yet" before a word of it is read.
 *
 * Rectangles on a 16-wide grid, crisp-edged, no gradients: it renders
 * identically on a five-year-old WebView and costs nothing to paint.
 */
function Chest({ size = 26, open = false }: { size?: number; open?: boolean }) {
  return (
    <svg
      width={size}
      height={(size * 13) / 16}
      viewBox="0 0 16 13"
      shapeRendering="crispEdges"
      aria-hidden="true"
      focusable="false"
    >
      <g fill="#241505">
        <rect x="3" y={open ? 0 : 1} width="10" height="1" />
        <rect x="1" y={open ? 1 : 2} width="14" height="2" />
        <rect x="0" y="3" width="16" height="10" />
      </g>
      <g fill="#8a5a2b">
        <rect x="4" y={open ? 1 : 2} width="8" height="1" />
        <rect x="2" y={open ? 2 : 3} width="12" height="1" />
        <rect x="1" y="4" width="14" height="8" />
      </g>
      <rect x="2" y="4" width="12" height="1" fill="#b3773a" />
      {/* The bands and the lock. Gold, because a chest without gold on it is
          a box. */}
      <rect x="1" y={open ? 5 : 6} width="14" height="2" fill="#f2b134" />
      <rect x="6" y="4" width="4" height="8" fill="#f2b134" />
      <rect x="6" y={open ? 5 : 6} width="4" height="3" fill="#ffe9a8" />
      <rect x="7" y={open ? 6 : 7} width="2" height="1" fill="#241505" />
      {open ? <rect x="1" y="4" width="14" height="1" fill="#ffe9a8" /> : null}
    </svg>
  );
}

/** A section title, on a plate rather than as grey caps. It reads as a label
 *  stamped onto the screen instead of a heading floating above it, which is
 *  what makes a run of sections feel like parts of one machine. */
function Plate({ children }: { children: string }) {
  return <h2 className="pl-plate">{children}</h2>;
}

/** Hourly rates need cents; money() rounds to whole dollars. */
function hourly(n: number): string {
  return Number.isInteger(n) ? money(n) : `$${n.toFixed(2)}`;
}

export function TrackerPlan() {
  const { data, ui, setUi, resetAll } = useTracker();
  useTheme(ui.theme, ui.palette);

  const [openMonth, setOpenMonth] = useState<MonthKey | null>(null);
  const [openStream, setOpenStream] = useState<string | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [statusOpen, setStatusOpen] = useState(false);

  const asOf: MonthKey = todayMonth();

  // Held here, not in the stepper: the gauge it moves lives in the answer.
  const [tryHours, setTryHours] = useState(0);
  useEffect(() => setTryHours(0), [asOf]);

  const capacity = capacityFor(data, asOf);
  const tone = toneOf(capacity);

  /* The cheer. One number in state, cleared on a timer — no library, no
     canvas, nothing kept. */
  const [rain, setRain] = useState(0);
  function cheer() {
    setRain(Date.now());
    setTimeout(() => setRain(0), 1500);
  }

  return (
    <div className="pl" data-chrome-root data-tone={tone}>
      <header className="pl-top">
        <b className="pl-top-month">{longMonthName(asOf)}</b>
        <ButtonBase
          type="button"
          className="pl-icon"
          aria-label="Settings"
          onClick={() => setSettingsOpen(true)}
        >
          <Joystick size={22} />
        </ButtonBase>
      </header>

      <main className="pl-frame">
        <Answer
          capacity={capacity}
          tone={tone}
          month={asOf}
          tryHours={tryHours}
          onAnswerStatus={() => setStatusOpen(true)}
          onOpenStream={setOpenStream}
        />

        {capacity && capacity.rate && capacity.over === 0 ? (
          <TryIt capacity={capacity} hours={tryHours} onHours={setTryHours} />
        ) : null}

        <LogPay month={asOf} onOpenStream={setOpenStream} onSaved={cheer} />
        <TrialMonths month={asOf} />
        <EntryLog month={asOf} onOpenMonth={setOpenMonth} />
        <Sources month={asOf} onOpenStream={setOpenStream} />
      </main>

      {/* The one legally material sentence on the screen. It gets the
          costume, but the operative clause stays completely plain — a
          disclaimer nobody can parse is not a disclaimer. */}
      <p className="pl-footnote">
        This be a map, not a verdict. Social Security has the final say.
      </p>

      {rain ? (
        <div className="pl-rain" key={rain} aria-hidden="true">
          {Array.from({ length: 14 }, (_, i) => (
            <span
              key={i}
              className="pl-rain-coin"
              style={{ left: `${3 + i * 7}%`, animationDelay: `${(i % 6) * 90}ms` }}
            >
              <Coin size={i % 3 === 0 ? 26 : 20} />
            </span>
          ))}
        </div>
      ) : null}

      <ToastStack />

      {openMonth ? (
        <MonthSheet
          month={openMonth}
          onClose={() => setOpenMonth(null)}
          onOpenStream={(id) => { setOpenMonth(null); setOpenStream(id); }}
        />
      ) : null}
      {openStream ? (
        <StreamSheet streamId={openStream} onClose={() => setOpenStream(null)} />
      ) : null}
      {statusOpen ? <TwpWizard onClose={() => setStatusOpen(false)} /> : null}
      {settingsOpen ? (
        <SettingsPanel
          theme={ui.theme}
          onTheme={(theme) => setUi({ theme })}
          onOpenStatus={() => { setSettingsOpen(false); setStatusOpen(true); }}
          onReset={resetAll}
          onClose={() => setSettingsOpen(false)}
          layout={ui.layout}
          onLayoutChange={(layout) => setUi({ layout })}
        />
      ) : null}
    </div>
  );
}

/* ------------------------------------------------------------------ answer */

function Answer({
  capacity, tone, month, tryHours, onAnswerStatus, onOpenStream
}: {
  capacity: Capacity | null;
  tone: Tone;
  month: MonthKey;
  tryHours: number;
  onAnswerStatus: () => void;
  onOpenStream: (id: string) => void;
}) {
  const { data } = useTracker();

  /* Review note: "'Limit unknown' is a dead end sitting at the top of the
     screen. It names a gap and stops... the trade is 'answer a few questions
     and these numbers become yours'." Same wording the classic hero landed
     on, because it is the same gauge: the cost first, then the offer, and
     the dashed mark that means Estimated everywhere else in the app. */
  if (!capacity) {
    return (
      <section className="pl-answer" data-tone="unknown">
        <p className="pl-answer-lead">
          <span className="pl-estimated-mark" aria-hidden="true" />
          Every number here is an average
        </p>
        <p className="pl-answer-sub">
          Not yours — we do not know your limit yet. A few questions and these become your own.
        </p>
        <ButtonBase type="button" className="pl-do" onClick={onAnswerStatus}>Answer a few questions</ButtonBase>
      </section>
    );
  }

  const {
    over, hours, rate, room, roomToLimit, threshold, safeTarget, counted, stage
  } = capacity;

  const heavy = extraPaycheckMonths(data.streams, yearOf(month));
  const isHeavy = heavy.has(month);

  const shownRoom = stage === 'safe' ? room : roomToLimit;
  const big = over > 0
    ? money(over)
    : hours !== null
      ? `${hours} ${hours === 1 ? 'hour' : 'hours'}`
      : money(shownRoom);
  /* "Safely" is the word doing the work: the figure is measured to the
     safety line, not the legal limit, and saying so is what stops it reading
     as permission to go right up to the cliff. */
  const lead = over > 0
    ? 'over your limit'
    : hours !== null
      ? 'you can still work'
      : 'you can still earn';

  // Missing fields as one-word chips. Each opens what fills it.
  const live = data.streams.filter((st) => st.lifecycle === 'active' && isActive(st, month));
  const needsRate = live.find((st) => !st.hourlyRate);
  const needsPayday = live.find((st) => st.type === 'w2' && !st.anchorDate
    && (st.payFrequency === 'weekly' || st.payFrequency === 'biweekly'));
  const gaps: Array<{ label: string; onPress: () => void }> = [];
  if (needsRate) gaps.push({ label: 'Hourly pay', onPress: () => onOpenStream(needsRate.id) });
  if (needsPayday) gaps.push({ label: 'Pay day', onPress: () => onOpenStream(needsPayday.id) });

  return (
    <section className="pl-answer" data-tone={tone}>
      <p className="pl-answer-big">{big}</p>
      <p className="pl-answer-lead">{lead}</p>

      <Gauge
        low={counted}
        high={capacity.safeCounted}
        threshold={threshold}
        safeTarget={safeTarget}
        tryExtra={tryHours * (rate?.rate ?? 0)}
        exact={!capacity.guessed && counted > 0}
      />

      <p className="pl-answer-meter-note">
        {capacity.guessed && counted > 0
          ? `${money(counted)}–${money(capacity.safeCounted)}`
          : money(counted)}
        {rate ? ` · ${rate.basis === 'observed' ? 'about ' : ''}${hourly(rate.rate)} an hour` : ''}
      </p>
      <PrecisionLine reading={precisionFor(data, month)} />
      {isHeavy ? (
        <p className="pl-answer-sub">
          This month has an extra paycheck. Watch what is left.
        </p>
      ) : null}
      {/* Each badge wears the mark it names, in the colour it is drawn in on
          the bar above.
          Deliberately the same words in both phases. Which line is in force —
          the trial work one or the substantial work one — is the app's problem
          to work out, not the reader's to learn; from where they stand both
          are simply the place you must not get to, and giving them two names
          asks somebody to hold two regimes in their head to read one bar. */}
      <p className="pl-lines">
        <span className="pl-line-key" data-mark="safe">
          <i aria-hidden="true" />Target amount<b>{money(safeTarget)}</b>
        </span>
        <span className="pl-line-key" data-mark="limit">
          <i aria-hidden="true" />Do not cross<b>{money(threshold)}</b>
        </span>
      </p>

      <GaugeKey
        band={capacity.guessed && counted > 0}
        trying={tryHours > 0}
        exact={!capacity.guessed && counted > 0}
      />

      {gaps.length ? (
        <div className="pl-chips">
          {gaps.slice(0, 2).map((gap) => (
            <ButtonBase
              key={gap.label}
              type="button"
              className="pl-quest"
              onClick={gap.onPress}
            >
              <span className="pl-quest-plus" aria-hidden="true">+</span>
              <span className="pl-quest-label">{gap.label}</span>
            </ButtonBase>
          ))}
        </div>
      ) : null}
    </section>
  );
}

/* ------------------------------------------------------------------- gauge */

const SEGMENTS = 12;
const OVER_SEGMENTS = 4;

type ChunkState = 'full' | 'band' | 'try' | 'empty';
type Zone = 'safe' | 'careful' | 'over';

/**
 * Solid = counted. Striped = margin of error. Outlined = hours being tried.
 * Green rule = the $1,000 safety line; black rule = the real limit.
 * Three patterns, so none of it depends on colour.
 */
function Gauge({ low, high, threshold, safeTarget, tryExtra, exact }: {
  low: number;
  high: number;
  threshold: number;
  safeTarget: number;
  tryExtra: number;
  exact: boolean;
}) {
  const unit = threshold / SEGMENTS || 1;
  const cap = SEGMENTS + OVER_SEGMENTS;
  const seg = (value: number) => Math.min(cap, Math.round(value / unit));

  const nLow = seg(low);
  const nHigh = Math.max(nLow, seg(high));
  const nTry = Math.max(nHigh, seg(high + tryExtra));
  const total = Math.max(SEGMENTS, nTry);
  const nSafe = Math.max(1, Math.min(SEGMENTS, Math.round(safeTarget / unit)));

  const stateOf = (i: number): ChunkState =>
    i < nLow ? 'full' : i < nHigh ? 'band' : i < nTry ? 'try' : 'empty';
  // Colour comes from where a chunk sits, so an empty gauge already shows
  // where the green stops.
  const zoneOf = (i: number): Zone =>
    i >= SEGMENTS ? 'over' : i < nSafe ? 'safe' : 'careful';

  return (
    <div
      className="pl-gauge"
      data-exact={exact ? '' : undefined}
      role="img"
      aria-label={
        (high > low ? `${money(low)} to ${money(high)} counted` : `${money(low)} counted`)
        + (tryExtra > 0 ? `, plus ${money(tryExtra)} being tried` : '')
        + `. Safe ${money(safeTarget)}, limit ${money(threshold)}.`
      }
    >
      {Array.from({ length: total }, (_, i) => (
        <span
          key={i}
          className="pl-chunk"
          data-state={stateOf(i)}
          data-zone={zoneOf(i)}
          data-safety-line={i === nSafe ? '' : undefined}
          data-first-over={i === SEGMENTS ? '' : undefined}
        >
          {/* Review note: "the gauge reads well but the safety line needs a
              label." It was a green rule with nothing on it, named only in a
              legend below that you had to match up by colour. The line says
              what it is, where it is. */}
          {/* The tag over the safety rule. "Play it safe" was an idiom and
              never said what the number under it was; "Target amount" is
              Sergey's wording, and it names the figure. */}
          {i === nSafe ? <b className="pl-line-tag" aria-hidden="true">Target amount</b> : null}
        </span>
      ))}
    </div>
  );
}

function GaugeKey({ band, trying, exact }: {
  band: boolean; trying: boolean; exact: boolean;
}) {
  if (exact) {
    return (
      <p className="pl-exact">
        <BadgeCheck className="size-4" aria-hidden="true" />
        Exact
      </p>
    );
  }
  if (!band && !trying) return null;
  return (
    <p className="pl-key">
      {band ? (
        <span className="pl-key-item">
          <span className="pl-chunk" data-state="band" data-zone="safe" aria-hidden="true" />
          we guessed this part
        </span>
      ) : null}
      {trying ? (
        <span className="pl-key-item">
          <span className="pl-chunk" data-state="try" data-zone="safe" aria-hidden="true" />
          what you are trying
        </span>
      ) : null}
    </p>
  );
}

/* ------------------------------------------------------------------ try it */

/** Two big buttons, not a slider: a slider needs a steady drag on a small
 *  target, which is the wrong control for this product's users. */
function TryIt({ capacity, hours: extra, onHours: setExtra }: {
  capacity: Capacity;
  hours: number;
  /* The setter, not a callback: two taps in one frame both read the same
     stale figure through a callback and one is lost. */
  onHours: Dispatch<SetStateAction<number>>;
}) {
  const rate = capacity.rate;
  if (!rate) return null;

  const outcome = outcomeOf(capacity, extra);
  const ceiling = Math.max(HOUR_STEP * 10, (capacity.hours ?? 0) + 20);

  return (
    <section className="pl-try" data-tone={extra > 0 ? outcome.tone : 'idle'}>
      <div className="pl-stepper">
        <ButtonBase
          type="button"
          className="pl-step"
          aria-label={`${HOUR_STEP} fewer hours`}
          disabled={extra <= 0}
          onClick={() => setExtra((n) => Math.max(0, n - HOUR_STEP))}
        >
          <Minus className="size-5" aria-hidden="true" />
        </ButtonBase>
        <span className="pl-stepper-value" aria-live="polite">
          <b>{extra}</b>
          <span>more hours</span>
        </span>
        <ButtonBase
          type="button"
          className="pl-step"
          aria-label={`${HOUR_STEP} more hours`}
          disabled={extra >= ceiling}
          onClick={() => setExtra((n) => Math.min(ceiling, n + HOUR_STEP))}
        >
          <Plus className="size-5" aria-hidden="true" />
        </ButtonBase>
      </div>

      {extra > 0 ? (
        <p className="pl-try-verdict">
          {money(outcome.total)}
          {/* Four verdicts, three of them distances with the destination
              left off — "$210 to limit", "$150 to safe". "to safe" is not
              a phrase; safe is not a place with a name. */}
          {outcome.breaksHoursRule
            ? ` · past ${TWP_SELF_EMPLOYMENT_HOURS} hours, uses a trial work month`
            : outcome.over > 0
              ? ` · ${money(outcome.over)} over your limit`
              : outcome.pastSafe
                ? ` · ${money(capacity.threshold - outcome.total)} left before your limit`
                : ` · ${money(outcome.room)} left before what we aim for`}
        </p>
      ) : null}
    </section>
  );
}

/* ----------------------------------------------------------------- log pay */

type Route = 'net' | 'hours' | 'gross';

/* Where the number came from.
 *
 * "Bank" was one word and meant nothing — it names a building, not a figure.
 * These name the thing the person is holding: the money they were Paid, the
 * Hours they worked, or the Paystub itself. */
const ROUTE_LABEL: Record<Route, string> = {
  net: 'Paid',
  hours: 'Hours',
  gross: 'Paystub'
};

/** Net is the first field because it is the number people have. The converted
 *  figure is recorded as an estimate, never as an entered one. */
function LogPay({ month, onOpenStream, onSaved }: {
  month: MonthKey;
  onOpenStream: (id: string) => void;
  onSaved: () => void;
}) {
  const { data, updateMonthEntry, addPaycheck, pushToast } = useTracker();
  const active = data.streams.filter((s) => s.lifecycle === 'active' && isActive(s, month));
  const [streamId, setStreamId] = useState<string>('');
  const [route, setRoute] = useState<Route>('net');
  const [value, setValue] = useState('');
  const [gigHours, setGigHours] = useState('');
  const [gigMiles, setGigMiles] = useState('');

  const stream = active.find((s) => s.id === streamId) ?? active[0];
  const selfEmployed = stream?.type === 'ten99';

  // The work type decides whether miles are ever mentioned, so it is asked
  // as what the work is rather than as a tax category.
  if (!active.length) {
    return (
      <section className="pl-log">
        <Plate>Work</Plate>
        <WorkChoices onAdded={onOpenStream} />
      </section>
    );
  }

  const n = Number(value);
  const valid = Number.isFinite(n) && n > 0;
  const rate = stream?.hourlyRate;
  const estimate = !valid ? undefined
    : route === 'gross' ? n
      : route === 'net' ? grossFromNet(n)
        : stream ? estimatedGrossFromHours(stream, n) ?? (rate ? n * rate : undefined)
          : undefined;

  /* What this pay actually costs you against the limit, which is the gross
     less whatever the miles take off. Worked out here rather than at the
     chip, because the button needs the same number — see the note on it. */
  const typedMilesNow = Number(gigMiles);
  const milesOff = selfEmployed && Number.isFinite(typedMilesNow) && typedMilesNow > 0
    ? typedMilesNow * mileageRateFor(month)
    : 0;
  const counted = estimate == null ? undefined : Math.max(0, estimate - milesOff);

  function save() {
    if (!stream || !estimate) return;
    const basis = route === 'gross' ? 'entered' : route === 'net' ? 'fromNet' : 'fromHours';
    const typedHours = Number(gigHours);
    const typedMiles = Number(gigMiles);
    const addedHours = route === 'hours'
      ? n
      : (selfEmployed && Number.isFinite(typedHours) && typedHours > 0 ? typedHours : 0);
    const addedMiles = selfEmployed && Number.isFinite(typedMiles) && typedMiles > 0
      ? typedMiles
      : 0;

    /* A W-2 month backed by real paychecks ignores the month override (see
       grossFor), so writing one there would look accepted and do nothing.
       Those months — and empty W-2 months — take a paycheck instead. */
    const entered = stream.checks.filter((c) => c.month === month && !c.projected);
    const override = stream.months[month]?.gross;
    const asCheck = stream.type === 'w2' && (entered.length > 0 || override === undefined);

    if (asCheck) {
      const today = new Date().toISOString().slice(0, 10);
      addPaycheck(stream.id, {
        month,
        date: today.startsWith(month) ? today : `${month}-15`,
        gross: estimate,
        hours: addedHours || undefined
      });
    } else {
      updateMonthEntry(stream.id, month, {
        gross: grossFor(stream, month) + estimate,
        hours: addedHours ? hoursFor(stream, month) + addedHours : undefined,
        miles: addedMiles ? (stream.months[month]?.miles ?? 0) + addedMiles : undefined,
        basis
      });
    }

    pushToast(
      addedMiles > 0
        ? `${money(estimate)} · ${addedMiles} mi added to ${longMonthName(month)}`
        : `${money(estimate)} added to ${longMonthName(month)}`,
      true
    );
    onSaved();
    setValue('');
    setGigHours('');
    setGigMiles('');
    setRoute('net');
  }

  /* Always open. Adding pay is the one thing this app is for, so putting it
     behind a button was a tap charged for nothing — and the framed panel it
     lives in already marks it as the place you put something in. */
  return (
    <section className="pl-log">
      <Plate>Log Pay</Plate>

      {active.length > 1 ? (
        <label className="pl-field">
          <span className="pl-label">Which job</span>
          <select
            className="pl-input"
            value={stream?.id ?? ''}
            onChange={(e) => setStreamId(e.currentTarget.value)}
          >
            {active.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </label>
      ) : null}

      <div className="pl-seg" role="radiogroup" aria-label="Where the number came from">
        {(['net', 'hours', 'gross'] as Route[]).map((r) => (
          <ButtonBase
            key={r}
            type="button"
            role="radio"
            aria-checked={route === r}
            className="pl-seg-btn"
            data-on={route === r ? '' : undefined}
            onClick={() => { setRoute(r); setValue(''); }}
          >
            {ROUTE_LABEL[r]}
          </ButtonBase>
        ))}
      </div>

      <label className="pl-field">
        {/* "Amount" is the label that answers none of the four questions —
            which number, over what period, of what, so what. Each route now
            names the figure the person is holding. */}
        <span className="pl-label">
          {route === 'hours' ? 'Hours worked'
            : route === 'net' ? 'Direct deposit'
              : 'Pay before taxes'}
        </span>
        <span className="pl-money" data-unit={route === 'hours' ? 'hours' : '$'}>
          <input
            className="pl-input"
            /* `decimal`, not `numeric`: Android gives a keypad with a decimal
               point rather than digits alone. */
            inputMode="decimal"
            type="text"
            placeholder="0"
            value={value}
            onChange={(e) => setValue(e.currentTarget.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') save(); }}
          />
        </span>
        {/* Review note: "The number went UP from the one I typed and nothing
            here says why. I entered what actually hit my bank; this shows me
            more than I got." It said "≈ $1,364 counted" and left the reader
            to work out that the difference was tax. This is the one place
            the app asks somebody to believe a bigger number than they were
            paid, so it names both ends of the conversion. */}
        {route === 'net' && estimate ? (
          <span className="pl-help">{money(n)} in your bank counts as {money(estimate)}</span>
        ) : null}
        {route === 'hours' && estimate ? (
          <span className="pl-help">{n} hours counts as {money(estimate)}</span>
        ) : null}
        {route === 'hours' && valid && !estimate ? (
          <span className="pl-help" data-warn="">No rate on file</span>
        ) : null}
      </label>

      {selfEmployed ? (
        <>
          <label className="pl-field">
            <span className="pl-label">Miles driven</span>
            <span className="pl-money" data-unit="miles">
              <input
                className="pl-input"
                inputMode="decimal"
                type="text"
                placeholder="0"
                value={gigMiles}
                onChange={(e) => setGigMiles(e.currentTarget.value)}
              />
            </span>
            {/* Typing miles and watching the deduction appear teaches the
                rule better than a sentence about it would. */}
            <span className="pl-help" data-good={Number(gigMiles) > 0 ? '' : undefined}>
              {Number(gigMiles) > 0
                ? `− ${money(Number(gigMiles) * mileageRateFor(month))} counted`
                : `${(mileageRateFor(month) * 100).toFixed(0)}¢ per mile`}
            </span>
          </label>

          {route !== 'hours' ? (
            <label className="pl-field">
              <span className="pl-label">Hours worked</span>
              <span className="pl-money" data-unit="hours">
                <input
                  className="pl-input"
                  inputMode="decimal"
                  type="text"
                  placeholder="0"
                  value={gigHours}
                  onChange={(e) => setGigHours(e.currentTarget.value)}
                />
              </span>
            </label>
          ) : null}
        </>
      ) : null}

      {/* Review note: "This button is showing me the one number on the screen
          that is not mine... the mileage lever looks like it does nothing."
          It carried the gross, so a driver could type 400 miles, watch $228
          come off in the chip above, and see the button not move. The figure
          on it is the one that counts against the limit — miles already off —
          so the lever visibly does something and the number on the button is
          the number the decision is made on. */}
      <div className="pl-row">
        <ButtonBase type="button" className="pl-do pl-do-primary" disabled={!estimate} onClick={save}>
          {counted != null ? `Add ${money(counted)}` : 'Add'}
        </ButtonBase>
      </div>
    </section>
  );
}

/* ----------------------------------------------------- nine trial months */

function TrialMonths({ month }: { month: MonthKey }) {
  const { data } = useTracker();
  if (benefitPhase(data, month) === 'unknown') return null;

  const status = trialWorkStatus(data, month);
  const used = Math.min(TRIAL_MONTH_LIMIT, status.used);

  return (
    <section className="pl-vault">
      <Plate>Trial work months</Plate>
      {/* The one thing on this screen that cannot be undone or earned back,
          so it says what it is for. Two sentences is the whole explanation
          the app gives anywhere. */}
      <p className="pl-vault-why">
        Earn any amount, keep your payment. You get 9, and they do not come back.
      </p>
      <div
        className="pl-tokens"
        role="img"
        aria-label={`${used} of ${TRIAL_MONTH_LIMIT} used`}
      >
        {Array.from({ length: TRIAL_MONTH_LIMIT }, (_, i) => (
          <span key={i} className="pl-token" data-used={i < used ? '' : undefined} />
        ))}
      </div>
      <p className="pl-tokens-line">
        <b><span>{used}</span> used</b>
        <span>{TRIAL_MONTH_LIMIT - used} left</span>
      </p>
    </section>
  );
}

/* -------------------------------------------------------------------- log */

interface LogRow {
  key: string;
  /** Sorts newest first. A month total has no day, so it sorts as mid-month. */
  at: string;
  amount: number;
  hours: number;
  miles: number;
  job: string;
  month: MonthKey;
  kind: 'payment' | 'total';
}

const LOG_PAGE = 6;

/** A list of what was added, newest first — not a calendar. */
function EntryLog({ month, onOpenMonth }: {
  month: MonthKey;
  onOpenMonth: (m: MonthKey) => void;
}) {
  const { data, ui } = useTracker();
  const [all, setAll] = useState(false);

  const rows = useMemo<LogRow[]>(() => {
    const out: LogRow[] = [];
    for (const stream of data.streams) {
      for (const check of stream.checks) {
        if (check.projected || !check.gross) continue;
        out.push({
          key: `c-${check.id}`,
          at: check.date,
          amount: check.gross,
          hours: check.hours ?? 0,
          miles: 0,
          job: stream.name,
          month: check.month,
          kind: 'payment'
        });
      }
      // Skipped when real payments back the month — grossFor counts those,
      // so listing both would show the money twice.
      for (const [month, entry] of Object.entries(stream.months)) {
        const backed = stream.checks.some((c) => c.month === month && !c.projected);
        if (backed || !entry.gross) continue;
        out.push({
          key: `m-${stream.id}-${month}`,
          at: `${month}-15`,
          amount: entry.gross,
          hours: entry.hours ?? 0,
          miles: entry.miles ?? 0,
          job: stream.name,
          month,
          kind: 'total'
        });
      }
    }
    return out.sort((a, b) => b.at.localeCompare(a.at));
  }, [data.streams]);

  /* Focus mode shows this month's entries. The rest are still one press away
     — pressing "All" is a deliberate act, which is the difference between
     offering the past and putting it on the screen unasked. */
  const scoped = ui.focusMode && !all ? rows.filter((r) => r.month === month) : rows;
  if (!scoped.length && !rows.length) return null;
  const shown = all ? scoped : scoped.slice(0, LOG_PAGE);

  return (
    <section className="pl-section">
      <Plate>Entries</Plate>
      {/* The month leads each row. It used to be a grey clause at the end of
          a sentence, which is the one thing this list is scanned for. */}
      <div className="pl-log-list">
        {shown.map((row) => (
          <ButtonBase
            type="button"
            key={row.key}
            className="pl-log-row"
            onClick={() => onOpenMonth(row.month)}
          >
            <span className="pl-log-chest"><Chest size={26} open /></span>
            <span className="pl-log-what">
              <span className="pl-log-top">
                <span className="pl-log-amount">{money(row.amount)}</span>
                {/* The month spelled out. An abbreviation is a word you have
                    to expand before you can use it. */}
                <span className="pl-log-date">
                  {longMonthName(row.month)}
                  {row.kind === 'payment' ? ` ${Number(row.at.slice(8, 10))}` : ''}
                </span>
              </span>
              <span className="pl-log-when">
                {row.job}
                {row.hours > 0 ? ` · ${row.hours} hours` : ''}
                {row.miles > 0 ? ` · ${row.miles} work miles` : ''}
              </span>
            </span>
          </ButtonBase>
        ))}
      </div>
      {rows.length > shown.length || all ? (
        <ButtonBase type="button" className="pl-plain" onClick={() => setAll(!all)}>
          {all ? 'Fewer' : `All ${rows.length}`}
        </ButtonBase>
      ) : null}
    </section>
  );
}

/* ---------------------------------------------------------------- sources */

function Sources({ month, onOpenStream }: {
  month: MonthKey;
  onOpenStream: (id: string) => void;
}) {
  const { data } = useTracker();
  const active = data.streams.filter((s) => s.lifecycle === 'active');
  if (!active.length) return null;

  return (
    <section className="pl-section">
      <Plate>Work</Plate>
      <div className="pl-sources">
        {active.map((s) => (
          <ButtonBase
            type="button"
            key={s.id}
            className="pl-source"
            onClick={() => onOpenStream(s.id)}
          >
            <span className="pl-source-chest">
              <Chest size={30} open={grossFor(s, month) > 0} />
            </span>
            <span className="pl-source-body">
              <span className="pl-source-name">{s.name}</span>
              <span className="pl-source-note">{describe(s, month)}</span>
            </span>
            <span className="pl-source-take">{money(grossFor(s, month))}</span>
          </ButtonBase>
        ))}
      </div>
      <AddWork onAdded={onOpenStream} />
    </section>
  );
}

function describe(stream: Stream, month: MonthKey): string {
  const bits: string[] = [SOURCE_SHORT[stream.type]];
  if (stream.hourlyRate) bits.push(`${hourly(stream.hourlyRate)} an hour`);
  if (stream.type === 'ten99') {
    const miles = stream.months[month]?.miles ?? 0;
    if (miles > 0) bits.push(`${miles} work miles take off ${money(mileageDeduction(stream, month))}`);
  }
  return bits.join(' · ');
}

/* The button is deliberately not another chest. A gilt-framed parchment row
   is what a source of money looks like here, so an action wearing the same
   clothes reads as one more of them — this one is inverted and carries a
   plus, which is what a control looks like. */
function AddWork({ onAdded }: { onAdded: (id: string) => void }) {
  const [open, setOpen] = useState(false);
  if (!open) {
    return (
      <ButtonBase type="button" className="pl-add" onClick={() => setOpen(true)}>
        <svg width="14" height="14" viewBox="0 0 14 14" shapeRendering="crispEdges" aria-hidden="true">
          <rect x="5" y="0" width="4" height="14" fill="currentColor" />
          <rect x="0" y="5" width="14" height="4" fill="currentColor" />
        </svg>
        Add work
      </ButtonBase>
    );
  }
  return <WorkChoices onAdded={onAdded} onCancel={() => setOpen(false)} />;
}

/** Named the way somebody would describe their own week. "1099 work" is a
 *  category on a tax form; a DoorDash driver will not pick it, and picking
 *  the other one costs them the mileage deduction. */
function WorkChoices({ onAdded, onCancel }: {
  onAdded: (id: string) => void;
  onCancel?: () => void;
}) {
  const { addStream, updateStream } = useTracker();

  function add(type: 'w2' | 'ten99', name: string) {
    const id = addStream(type);
    updateStream(id, { name });
    onCancel?.();
    onAdded(id);
  }

  return (
    <div className="pl-choices">
      <ButtonBase type="button" className="pl-choice" onClick={() => add('w2', 'My job')}>
        <Chest size={26} />
        <span>A job that pays me</span>
      </ButtonBase>
      <ButtonBase
        type="button"
        className="pl-choice"
        onClick={() => add('ten99', 'Delivery driving')}
      >
        <Chest size={26} />
        <span>
          Driving or delivery
          <i>Uber Eats, DoorDash, Amazon Flex, Instacart, Lyft</i>
        </span>
      </ButtonBase>
      <ButtonBase type="button" className="pl-choice" onClick={() => add('ten99', 'My own work')}>
        <Chest size={26} />
        <span>Work I do for myself</span>
      </ButtonBase>
      {onCancel ? (
        <ButtonBase type="button" className="pl-plain" onClick={onCancel}>Cancel</ButtonBase>
      ) : null}
    </div>
  );
}
