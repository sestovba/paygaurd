/*
 * Big Beautiful — the ninth layout.
 *
 * Written from a spec, not refactored out of one of the eight. The spec is a
 * three-round teardown of big-beautiful-design.lovable.app with Sergey, and
 * every decision below is his or is marked as mine. See
 * `task-layout-nine-parity-pass` in review/review-notes.json for the whole
 * argument and `README.md` beside this file for what it takes from where.
 *
 * THE ORDER OF THE SCREEN is the order of the questions:
 *   how much is left · what that is of · what is coming · what I can work ·
 *   the record · the rule
 *
 * That is one change from the reference and it is deliberate: its calculator
 * sits sixth, below the record. CLAUDE.md is explicit that the product is a
 * job-search calculator that later becomes a record keeper, so the hours card
 * comes before the month list, not after it.
 *
 * WHAT IS NOT HERE, on purpose:
 *   No annual chart, no average, no repeated summary strip. The year total is
 *   one tile because Sergey asked for it, and it is the only backward-looking
 *   figure on the screen.
 *   No twelve-month grid. `scopedMonths` runs forward; the months behind are
 *   one press away. Nothing behind you can be acted on.
 */
import { useState } from 'react';
import { Activity, ChevronLeft, ChevronRight, Settings, Sparkles } from 'lucide-react';
import { useTracker } from '../../state/TrackerProvider';
import { useTheme } from '../../theme';
import { Button, IconButton, Input } from '../ui';
import { money } from '../../domain/format';
import {
  longMonthName, shortMonthName, todayMonth, yearOf, scopedMonths, monthsOfYear
} from '../../domain/months';
import { monthTotal, yearTotal } from '../../domain/earnings';
import { activeThreshold } from '../../domain/trialWork';
import { capacityFor, workingRate, SAFE_MONTHLY } from '../../domain/capacity';
import { extraPaycheckMonths } from '../../domain/paySchedule';
import { precisionFor } from '../../domain/precision';
import { PrecisionLine } from '../PrecisionLine';
import { FIRST_YEAR, LAST_YEAR } from '../../domain/rules';
import type { MonthKey } from '../../domain/types';
import { SettingsPanel } from '../SettingsPanel';
import { MonthSheet } from '../MonthSheet';
import { StreamSheet } from '../StreamSheet';
import { ToastStack } from '../ToastStack';
import { BeautifulMonths } from './BeautifulMonths';
import '../../styles/beautiful.css';

/** Weeks in an average month. The one constant the hours answer needs. */
const WEEKS_PER_MONTH = 4.33;

export function TrackerBeautiful() {
  const { data, ui, setUi, resetAll } = useTracker();
  useTheme(ui.theme, ui.palette);

  const [settingsOpen, setSettingsOpen] = useState(false);
  const [sheetMonth, setSheetMonth] = useState<MonthKey | null>(null);
  const [openStream, setOpenStream] = useState<string | null>(null);
  const [showEarlier, setShowEarlier] = useState(false);

  const now = todayMonth();
  const asOf: MonthKey = yearOf(now) === ui.year ? now : `${ui.year}-12`;
  const cap = capacityFor(data, asOf);
  const threshold = activeThreshold(data, asOf);

  /* The rate the hours answer is derived from. Seeded from what they already
     earn so the card is answered on arrival rather than empty; a draft
     overrides it the moment they type. Never printed as a rule — "about ten
     hours" is ten at $21.50 and six at $35, and hard-coding it hands a
     low-paid worker a wrong answer in the direction that costs money. */
  const knownRate = workingRate(data, asOf)?.rate ?? null;
  const [rateDraft, setRateDraft] = useState<string | null>(null);
  const rate = rateDraft != null
    ? (Number(rateDraft) || 0)
    : (knownRate ?? 0);

  /* Ceiling is the active limit (e.g. $1,210). The reference answers against
     that line and warns about extra-paycheck months in the footnote rather
     than baking SAFE_MONTHLY into the division. One decimal, same as the
     reference's "1.2 h" / "5.2 h". */
  const aim = threshold?.amount ?? SAFE_MONTHLY;
  const hoursMonth = rate > 0 ? aim / rate : null;
  const hoursWeek = hoursMonth != null ? hoursMonth / WEEKS_PER_MONTH : null;
  /* Apple-simple: spell the unit. The reference uses "h"; our NEVER list
     bans abbreviated units on screen. */
  const fmtHours = (n: number) => `${n.toFixed(1)} hours`;

  /* The forward list, and the months behind it on request. */
  const ahead = scopedMonths(ui.year, 'ahead');
  const shown = showEarlier ? scopedMonths(ui.year, 'year') : ahead;
  const strip = ahead.slice(0, 6);

  const heavy = extraPaycheckMonths(data.streams, ui.year);
  const overCount = monthsOfYear(ui.year).filter((m) => {
    const limit = activeThreshold(data, m)?.amount;
    return limit != null && monthTotal(data, m) > limit;
  }).length;

  const pct = cap && cap.threshold > 0
    ? Math.round((cap.counted / cap.threshold) * 100)
    : 0;

  /* Meter geometry. The fill is what is recorded; the pale run past it is the
     estimate band on figures worked out from a bank balance, drawn rather
     than hidden. The notch is the safety line. */
  const span = cap?.threshold ?? 0;
  const fillPct = span > 0 ? Math.min(100, (cap!.counted / span) * 100) : 0;
  const bandPct = span > 0
    ? Math.min(100 - fillPct, ((cap!.safeCounted - cap!.counted) / span) * 100)
    : 0;
  const aimPct = span > 0 ? Math.min(100, (cap!.safeTarget / span) * 100) : 0;

  function stepYear(delta: number) {
    const next = ui.year + delta;
    if (next < FIRST_YEAR || next > LAST_YEAR) return;
    setUi({ year: next });
    setShowEarlier(false);
  }

  return (
    <div className="bb">
      <header className="bb-head">
        <div className="bb-head-in">
          <span className="bb-mark" aria-hidden="true"><Activity size={20} /></span>
          <div className="bb-head-t">
            <h1>PayGuard</h1>
            {/* Which limit applies resolves per month, not per year — a trial
                period ending in June means July is judged against the other
                one. Naming it here is the smallest place that can say so. */}
            <p>
              {threshold
                ? `${threshold.kind === 'trialWork' ? 'Trial months' : 'Your limit'} · ${money(threshold.amount)}/mo`
                : 'Add your status to see your limit'}
            </p>
          </div>
          <div className="bb-year">
            <IconButton label="Previous year" size="sm" onClick={() => stepYear(-1)}>
              <ChevronLeft size={18} />
            </IconButton>
            <span className="bb-year-n bb-num">{ui.year}</span>
            <IconButton label="Next year" size="sm" onClick={() => stepYear(1)}>
              <ChevronRight size={18} />
            </IconButton>
          </div>
          <IconButton className="bb-head-set" label="Settings" onClick={() => setSettingsOpen(true)}>
            <Settings size={20} />
          </IconButton>
        </div>
      </header>

      <main className="bb-page">
        {/* ---- the answer, and what it is of ---- */}
        <section className="bb-card">
          <div className="bb-hero">
            <p className="bb-caps">{longMonthName(asOf)} {ui.year}</p>
            {cap ? (
              <>
                <p className="bb-fig bb-num" data-stage={cap.stage}>
                  {cap.stage === 'over' ? money(cap.over) : money(cap.roomToLimit)}
                </p>
                <p className="bb-say">
                  {cap.stage === 'over'
                    ? 'over your limit this month'
                    : 'left this month'}
                </p>
                <div className="bb-meter" aria-hidden="true">
                  <i data-stage={cap.stage} style={{ width: `${fillPct}%` }} />
                  {bandPct > 0 && <i className="bb-band" style={{ width: `${bandPct}%` }} />}
                  {aimPct < 100 && <u style={{ left: `${aimPct}%` }} />}
                </div>
                <div className="bb-aim" aria-hidden="true">
                  <b style={{ left: `${aimPct}%` }}>aim {money(cap.safeTarget)}</b>
                </div>
                <p className="bb-sub">
                  <b className="bb-num">{money(cap.counted)}</b> counted against{' '}
                  <b className="bb-num">{money(cap.threshold)}</b>
                  {cap.guessed && ' · some of this was worked out from your bank'}
                </p>
                <PrecisionLine reading={precisionFor(data, asOf)} />
              </>
            ) : (
              <>
                <p className="bb-say" style={{ marginTop: 0 }}>
                  No limit set yet.
                </p>
                <p className="bb-sub">
                  Say where you are in your trial months and this fills in.
                </p>
                <p className="bb-sub">
                  <Button variant="filled" onClick={() => setSettingsOpen(true)}>
                    Set your status
                  </Button>
                </p>
              </>
            )}
          </div>

          <dl className="bb-tiles">
            <div><dl>
              <dt className="bb-caps">Counted · {longMonthName(asOf)}</dt>
              <dd className="bb-num">{money(cap?.counted ?? monthTotal(data, asOf))}</dd>
            </dl></div>
            <div><dl>
              <dt className="bb-caps">Of limit</dt>
              <dd className="bb-num">{cap ? `${pct}%` : '—'}</dd>
            </dl></div>
            <div><dl>
              <dt className="bb-caps">Months over</dt>
              <dd className="bb-num">{overCount} of 12</dd>
            </dl></div>
            <div><dl>
              <dt className="bb-caps">{ui.year} total</dt>
              <dd className="bb-num">{money(yearTotal(data, ui.year))}</dd>
            </dl></div>
          </dl>
        </section>

        {/* ---- what is coming ---- */}
        <section className="bb-card">
          <div className="bb-block">
            <p className="bb-caps">Coming up</p>
            <p className="bb-lead">
              {ahead.length <= 1
                ? 'Last month of the year.'
                : `${ahead.length - 1} months still ahead.`}
            </p>
            <div className="bb-strip">
              {strip.map((month) => {
                const limit = activeThreshold(data, month)?.amount ?? null;
                const counted = monthTotal(data, month);
                const left = limit ? Math.max(0, limit - counted) : 0;
                const isOver = limit != null && counted > limit;
                const isHeavy = heavy.has(month);
                return (
                  <div
                    key={month}
                    className="bb-mcard"
                    data-now={month === asOf}
                    data-heavy={isHeavy}
                    data-over={isOver}
                  >
                    <div className="bb-mcard-r">
                      <span className="bb-mn" aria-hidden="true">{shortMonthName(month)}</span>
                      <span className="bb-sr">{longMonthName(month)}</span>
                      {month === asOf && <span className="bb-badge">Now</span>}
                      {/* A fortnightly schedule quietly hands some months a
                          third paycheck, and that is the month closest to the
                          line. It belongs on the card it applies to. */}
                      {isHeavy && month !== asOf && (
                        <span className="bb-badge" data-kind="heavy">3 paydays</span>
                      )}
                    </div>
                    <p className="bb-mv bb-num">
                      {!limit ? '—' : isOver ? money(counted - limit) : money(left)}
                    </p>
                    <p className="bb-mu">{isOver ? 'over' : 'left'}</p>
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        {/* ---- what I can work. The front door, so it sits above the record. ---- */}
        <section className="bb-hours">
          <div className="bb-hours-k">
            <Sparkles size={16} aria-hidden="true" />
            <p>Plan my hours</p>
          </div>
          <h2>How many hours could I work this month?</h2>
          <label>
            <span className="bb-hours-lab">Your pay rate</span>
            <span className="bb-rate">
              <span className="bb-cur" aria-hidden="true">$</span>
              <Input
                inputMode="decimal"
                aria-label="Your pay rate, dollars an hour"
                value={rateDraft ?? (knownRate ? String(knownRate) : '')}
                placeholder="0"
                onChange={(e) => setRateDraft(e.target.value)}
              />
              <span className="bb-rate-post">an hour</span>
            </span>
          </label>
          <div className="bb-answer">
            <div className="bb-answer-tile">
              <p>Per week</p>
              <p className="bb-answer-big">
                {hoursWeek != null ? fmtHours(hoursWeek) : '—'}
              </p>
            </div>
            <div className="bb-answer-tile">
              <p>Per month</p>
              <p className="bb-answer-big">
                {hoursMonth != null ? fmtHours(hoursMonth) : '—'}
              </p>
            </div>
          </div>
          <p className="bb-hours-foot">
            {threshold
              ? `Under your ${money(threshold.amount)} limit. Watch months with an extra paycheck.`
              : `Under ${money(aim)} a month. Watch months with an extra paycheck.`}
          </p>
        </section>

        {/* ---- the record ---- */}
        <section className="bb-card">
          <div className="bb-block" style={{ paddingBottom: 0 }}>
            <p className="bb-caps">Your months</p>
            <p className="bb-lead">Tap a month to add pay</p>
          </div>
          <BeautifulMonths
            months={shown}
            onOpenSheet={setSheetMonth}
            onRevealEarlier={() => setShowEarlier(true)}
            canRevealEarlier={!showEarlier && shown.length < 12}
          />
        </section>

        {/* ---- the rule ---- */}
        <section className="bb-card">
          <div className="bb-block">
            <p className="bb-caps">Monthly limit</p>
            <div className="bb-limit">
              <span className="bb-cur" aria-hidden="true">$</span>
              <Input
                readOnly
                aria-label="Your monthly limit"
                value={threshold ? String(threshold.amount) : ''}
                placeholder="—"
              />
            </div>
            <p className="bb-source">
              {threshold
                ? `From Social Security’s ${ui.year} numbers and your trial-month status.`
                : 'Fills in once you set your status.'}
            </p>
            <p className="bb-fine">
              Estimates only. Confirm with Social Security before you decide.
              Your numbers stay on this device.
            </p>
            <p className="bb-sub">
              <Button variant="outlined" onClick={() => setSettingsOpen(true)}>
                Change status
              </Button>
            </p>
          </div>
        </section>
      </main>

      <ToastStack />
      {settingsOpen && (
        <SettingsPanel
          theme={ui.theme}
          onTheme={(theme) => setUi({ theme })}
          onOpenStatus={() => { setUi({ layout: 'overview' }); setSettingsOpen(false); }}
          onReset={resetAll}
          onClose={() => setSettingsOpen(false)}
          layout={ui.layout}
          onLayoutChange={(layout) => setUi({ layout })}
        />
      )}
      {sheetMonth && (
        <MonthSheet
          month={sheetMonth}
          onClose={() => setSheetMonth(null)}
          onOpenStream={(id) => { setSheetMonth(null); setOpenStream(id); }}
        />
      )}
      {openStream && (
        <StreamSheet streamId={openStream} onClose={() => setOpenStream(null)} />
      )}
    </div>
  );
}
