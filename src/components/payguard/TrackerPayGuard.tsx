import { useEffect, useRef, useState } from 'react';
import {
  ArrowRight,
  Briefcase,
  ChevronLeft,
  ChevronRight,
  PieChart,
  Plus,
  Settings,
  Shield,
  ShieldCheck,
  TriangleAlert,
  Undo2,
  X
} from 'lucide-react';
import { useMonthScope, useTracker } from '../../state/TrackerProvider';
import { copyFor } from '../../domain/copy';
import { countableFor, streamYearGross } from '../../domain/earnings';
import { benefitPhase } from '../../domain/trialWork';
import { attentionFlags } from '../../domain/attention';
import { precisionFor } from '../../domain/precision';
import { PrecisionLine } from '../PrecisionLine';
import { rulesFor, knownYears } from '../../domain/rules';
import {
  formatMonth, longMonthName, scopedMonths, shortMonthName, todayMonth
} from '../../domain/months';
import { MonthScopePicker } from '../MonthScopePicker';
import { money } from '../../domain/format';
import type { MonthKey } from '../../domain/types';
import { SettingsPanel } from '../SettingsPanel';
import { ToastStack } from '../ToastStack';
import { NotificationsBell } from '../NotificationsBell';
import { PayGuardChart } from './PayGuardChart';
import { PayGuardJobEditor } from './PayGuardJobEditor';
import { PayGuardAnalysis } from './PayGuardAnalysis';
import { importTrackerFile } from './payguardData';
import { useTheme } from '../../theme';
import { ReviewTarget } from '../../review/ReviewTarget';

type MobileTab = 'jobs' | 'overview' | 'analysis';

const MOBILE_TABS: { id: MobileTab; label: string; Icon: typeof Briefcase }[] = [
  { id: 'analysis', label: 'Months', Icon: ShieldCheck },
  { id: 'overview', label: 'Your limit', Icon: PieChart },
  { id: 'jobs', label: 'Jobs', Icon: Briefcase }
];

export function TrackerPayGuard() {
  const {
    data, ui, setUi, addStream, removeStream, resetAll, replaceAll, undoCount, undo
  } = useTracker();
  const canUndo = undoCount > 0;
  const year = ui.year;
  const years = knownYears();
  const { scope, setScope } = useMonthScope('many');
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [tabsMode, setTabsMode] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(data.streams[0]?.id ?? null);
  const [collapsedIds, setCollapsedIds] = useState<Set<string>>(new Set());
  const [addingMenuOpen, setAddingMenuOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  /* Same note, on a phone: the tab you land on is the months, not the job
     editor — unless there are no jobs yet, in which case adding one is the
     only thing the months could tell you. */
  const [mobileTab, setMobileTab] = useState<MobileTab>(
    () => data.streams.length > 0 ? 'analysis' : 'jobs'
  );
  const fileInputRef = useRef<HTMLInputElement>(null);

  useTheme(ui.theme);

  const currentTheme = ui.payguardTheme ?? 'paper';
  const streams = data.streams;
  const selected = streams.find((s) => s.id === selectedId) ?? streams[0] ?? null;

  const rules = rulesFor(year);
  const now = todayMonth();
  const asOf = year < Number(now.slice(0, 4)) ? `${year}-12` : now;
  const phase = benefitPhase(data, asOf);

  const combinedFor = (month: string, type?: 'w2' | 'ten99') => streams
    .filter((s) => !type || s.type === type)
    .reduce((sum, s) => sum + countableFor(s, month), 0);

  // Keep the selected tab pointing at a stream that still exists.
  useEffect(() => {
    if (streams.length > 0 && (!selectedId || !streams.some((s) => s.id === selectedId))) {
      setSelectedId(streams[0].id);
    }
  }, [streams, selectedId]);

  function addAndSelect(type: 'w2' | 'ten99') {
    const id = addStream(type);
    setSelectedId(id);
    setTabsMode(true);
    setAddingMenuOpen(false);
    setMobileTab('jobs');
  }

  function toggleOne(id: string) {
    setCollapsedIds((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  function goToMobileTab(tab: MobileTab) {
    setMobileTab(tab);
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    window.scrollTo({ top: 0, behavior: reduceMotion ? 'auto' : 'smooth' });
  }

  function focusStream(id: string) {
    setSelectedId(id);
    setTabsMode(true);
    setMobileTab('jobs');
    requestAnimationFrame(() => {
      document.getElementById(`pg-job-${id}`)?.scrollIntoView({ block: 'start' });
    });
  }

  function openAnalysis() {
    setMobileTab('analysis');
    requestAnimationFrame(() => {
      document.getElementById('pg-analysis')?.scrollIntoView({ block: 'start' });
    });
  }

  // Each mobile tab owns one section; on sm+ every section is always visible.
  const sectionVisibility = (owner: MobileTab) => mobileTab === owner ? 'flex' : 'hidden sm:flex';

  /* Review note: "This whole hero says three things where one would do —
     show the month, the limit, and the room left."
     It did say three: a badge reading "$310 above TWP", a headline figure
     reading "$1,520 this month", and a panel down the right-hand side
     repeating the limit as a second big number with a paragraph under it.
     Three readings of one fact, and none of them was the answer.
     The hero now makes one statement: the month it is about, the room left
     as the figure, and the limit and the running total as the single line
     that shows the working. */
  const phaseNeedsReview = phase === 'unknown' || phase === 'verifyComplete';
  const activeThreshold = phaseNeedsReview ? null : phase === 'trialWork' ? rules.trialWork : rules.sga;
  const currentCountable = combinedFor(asOf);
  const thresholdGap = activeThreshold == null ? null : activeThreshold - currentCountable;
  const isOver = (thresholdGap ?? 0) < 0;
  const statusTone = phaseNeedsReview ? 'info' : isOver ? 'over' : phase === 'trialWork' ? 'twp' : 'safe';
  /* The figure is the room left, not the running total: "how much more can I
     work" is the question the month is actually asked. The total that got you
     there is the line underneath. */
  const heroFigure = phaseNeedsReview ? money(currentCountable) : money(Math.abs(thresholdGap ?? 0));
  /* The limit is never named after the rule it came from. `thresholdName`
     resolved to "TWP" or "SGA" and was dropped into all three of these
     lines, which is the whole one-limit rule failing in the loudest place on
     the layout: the reader was told which of Social Security's two rules
     they were being measured by, in initials, on the hero. */
  const heroPhrase = phaseNeedsReview
    ? 'counted so far — no limit is being applied yet'
    : isOver
      ? 'over your monthly limit'
      : 'left before you reach your monthly limit';
  const heroWorking = phaseNeedsReview
    ? 'Tell us where you stand and this becomes a limit you can work to.'
    : `${money(currentCountable)} counted, against a limit of ${money(activeThreshold!)}.`;
  const thresholdProgress = activeThreshold
    ? Math.min(100, (currentCountable / activeThreshold) * 100)
    : 0;
  const statusMeterColor = statusTone === 'over' ? 'var(--pg-over)'
    : statusTone === 'twp' ? 'var(--pg-twp)'
      : statusTone === 'safe' ? 'var(--pg-safe)' : 'var(--pg-info)';

  return (
    <div className="pg-payguard pg-page-pad min-h-dvh" data-chrome-root data-payguard-theme={currentTheme}>
      <a href="#pg-main" className="pg-skip-link">Skip to main content</a>
      <input
        ref={fileInputRef}
        type="file"
        accept="application/json,.json"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) importTrackerFile(file, replaceAll);
          e.target.value = '';
        }}
      />

      {/* ---------------- Header ---------------- */}
      <header className="pg-topbar sticky top-0 z-30">
        <div className="mx-auto flex h-14 max-w-[86rem] items-center gap-2 px-3 sm:gap-3 sm:px-5">
          {/* Brand */}
          <div className="pg-brand flex min-w-0 items-center gap-2.5">
            <span className="grid size-8 shrink-0 place-items-center rounded-[var(--pg-radius-md)] pg-mark shadow-[var(--pg-shadow-sm)]">
              <Shield className="size-4" />
            </span>
            <span className="hidden min-w-0 flex-col leading-tight xs:flex">
              <span className="truncate text-sm font-bold tracking-tight pg-fg">PayGuard</span>
              <span className="hidden truncate text-[0.625rem] font-semibold uppercase tracking-wider pg-dim lg:block">
                Benefits income planner
              </span>
            </span>
          </div>

          {/* Year — compact filter stepper */}
          <div className="pg-field ml-1 gap-0.5 rounded-full px-1 py-0.5 sm:ml-2">
            <button
              type="button"
              disabled={years.indexOf(year) <= 0}
              onClick={() => setUi({ year: years[years.indexOf(year) - 1] })}
              className="pg-icon-btn pg-touch-target size-6 rounded-full"
              aria-label="Previous year"
            >
              <ChevronLeft className="size-3.5" />
            </button>
            <span className="pg-mono min-w-8 text-center text-xs font-bold pg-fg sm:min-w-10">{year}</span>
            <button
              type="button"
              disabled={years.indexOf(year) >= years.length - 1}
              onClick={() => setUi({ year: years[years.indexOf(year) + 1] })}
              className="pg-icon-btn pg-touch-target size-6 rounded-full"
              aria-label="Next year"
            >
              <ChevronRight className="size-3.5" />
            </button>
          </div>

          {/* How much of the year the month lists below show. Beside the
              year stepper because it answers the same question one size
              down: which months am I looking at. */}
          <MonthScopePicker scope={scope} onChange={setScope} className="pg-field pg-field-sm ml-1" />

          <div className="flex-1" />

          {/* Actions */}
          <div className="flex items-center gap-1.5">
            <NotificationsBell
              open={notificationsOpen}
              onOpenChange={setNotificationsOpen}
              onSetPayday={focusStream}
              onReviewStream={focusStream}
              onOpenMonth={openAnalysis}
              variant="summary"
            />

            <button
              type="button"
              className="pg-icon-btn pg-icon-btn-bordered"
              disabled={!canUndo}
              onClick={undo}
              aria-label={`Undo last change (${undoCount} available)`}
              title={canUndo ? `Undo last change (${undoCount})` : 'Nothing to undo'}
            >
              <Undo2 className="size-3.5" />
            </button>

            <button
              type="button"
              className="pg-icon-btn pg-icon-btn-bordered group relative"
              onClick={() => setSettingsOpen(true)}
              aria-label="Settings"
              title="Settings"
            >
              <Settings className="size-4 transition-transform duration-300 group-hover:rotate-45" />
            </button>
          </div>
        </div>
      </header>

      <main id="pg-main" className="mx-auto flex w-full max-w-[86rem] flex-col gap-3 p-3 sm:gap-4 sm:p-5 lg:p-6">
        {/* ---------------- Current safety snapshot ---------------- */}
        <section className="pg-status-hero" aria-labelledby="pg-current-status-title">
          <div className="pg-status-hero-main">
            <h1 id="pg-current-status-title" className="pg-label">
              {longMonthName(asOf)}
            </h1>

            <p className="mt-2 flex flex-wrap items-baseline gap-x-2.5 gap-y-1" aria-live="polite">
              <span className="pg-status-amount" style={{ color: statusMeterColor }}>{heroFigure}</span>
              <span className="pg-status-phrase">{heroPhrase}</span>
            </p>

            <div className="pg-status-track mt-3" aria-hidden="true">
              <span style={{ width: `${thresholdProgress}%`, background: statusMeterColor }} />
            </div>

            <p className="mt-2 text-xs font-semibold pg-muted">{heroWorking}</p>

            {/* How much the figure above can be trusted, and the one thing
                that would improve it. A line under the number, not a panel:
                precision qualifies a specific claim at the moment someone
                reads it, and a "data quality" card would be one more section
                competing with the month. Same reading as every other layout —
                see src/domain/precision.ts. */}
            <PrecisionLine
              reading={precisionFor(data, asOf)}
              onFix={(gap) => focusStream(gap.streamId)}
            />

            <button type="button" className="pg-status-link mt-3" onClick={openAnalysis}>
              {phaseNeedsReview ? 'Confirm your status' : 'See every month'} <ArrowRight className="size-3.5" />
            </button>
          </div>
        </section>

        {/* The months that need you, named as alerts.
            Review note: "the extra-paycheck month is a column in the monthly
            analysis rather than an alert. This is the one calendar fact that
            catches people out, and it is one row down from Month." It sits
            directly under the status hero now — the first thing after "am I
            safe this month" is "which months are not". Same rule as the
            workrecord strip; see src/domain/attention.ts. */}
        <MonthAttention onOpenMonth={openAnalysis} />

        {/* ---------------- Analysis ---------------- */}
        {/* Review note: "This is the most useful thing on the layout — it has
            the month, the countable figure, the status and the by-hours
            column. It sits below a chart and two duplicate stat rows. It
            should be what you land on."
            So it does. On a wide screen it is the first thing under the
            status hero and the attention strip; the chart and the job editors
            follow it rather than gate it. */}
        <div id="pg-analysis" className={`flex-col scroll-mt-20 ${sectionVisibility('analysis')}`}>
          <ReviewTarget
            id="payguard-monthly-analysis"
            label="Full monthly analysis"
            reason="Cards, table modes, summary totals, and the simulator repeat the same TWP / SGA facts; this should become a short risk-month list."
            layout="payguard"
          >
            <PayGuardAnalysis data={data} year={year} scope={scope} />
          </ReviewTarget>
        </div>

        {/* ---------------- Overview: chart ---------------- */}
        <div id="pg-overview" className={`flex-col gap-3 sm:gap-4 ${sectionVisibility('overview')}`}>
          <ReviewTarget
            id="payguard-year-chart"
            label="Annual income chart"
            reason="The chart duplicates monthly history and presents TWP and SGA as simultaneous targets."
            layout="payguard"
          >
            {scope === 'month' ? null : <PayGuardChart streams={streams} year={year} limit={activeThreshold == null ? null : { kind: phase === 'trialWork' ? 'trialWork' : 'sga', amount: activeThreshold }} />}
          </ReviewTarget>
        </div>

        {/* ---------------- Jobs ---------------- */}
        <div id="pg-jobs" className={`flex-col gap-3 ${sectionVisibility('jobs')}`}>
          <div
            className={tabsMode && streams.length > 0 ? 'pg-tabgroup' : undefined}
            data-type={tabsMode && selected ? selected.type : undefined}
          >
          {/* Review note cut this bar. With no jobs yet it was a lone "Add Job"
              tab sitting an inch above an empty-state card offering the same
              two buttons in words — the switcher for a set of one thing, which
              is nothing. It appears when there is something to switch between;
              until then the empty state below is the only way in, and it is
              the better one. */}
          {streams.length > 0 ? (
          <div className="pg-tabbar">
            <div className="pg-tabs flex-1" role="group" aria-label={copyFor('payguard').income}>
              {tabsMode ? streams.map((s) => {
                const isSelected = selected?.id === s.id;
                return (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => setSelectedId(s.id)}
                    className="pg-tab"
                    data-active={isSelected}
                    data-type={s.type}
                    aria-pressed={isSelected}
                  >
                    <span className="pg-tab-join" aria-hidden="true" />
                    {/* The type badge does a browser favicon's job: it tells
                        the tabs apart at a glance. On the *active* tab it has
                        nothing left to say — the editor directly below opens
                        with the same W-2 / 1099 badge beside the job name, so
                        the label was printed twice within an inch of itself.
                        The active tab is already named by its shape and its
                        accent colour, which is how a browser does it too. */}
                    {isSelected ? null : (
                      <span className={`pg-badge ${s.type === 'w2' ? 'pg-badge-w2' : 'pg-badge-se'}`}>
                        {s.type === 'w2' ? 'W-2' : '1099'}
                      </span>
                    )}
                    <span className="max-w-[8.5rem] truncate font-semibold" title={s.name}>{s.name}</span>
                    <span className="pg-tab-amount">{money(streamYearGross(s, year))}</span>
                  </button>
                );
              }) : null}

              {addingMenuOpen ? (
                <span className="pg-tab-add">
                  <span className="pg-label">Add</span>
                  <button type="button" onClick={() => addAndSelect('w2')} className="pg-btn pg-btn-sm pg-text-w2">
                    W-2 Job
                  </button>
                  <button type="button" onClick={() => addAndSelect('ten99')} className="pg-btn pg-btn-sm pg-text-se">
                    1099 Work
                  </button>
                  <button
                    type="button"
                    onClick={() => setAddingMenuOpen(false)}
                    aria-label="Cancel"
                    className="pg-icon-btn pg-touch-target size-6"
                  >
                    <X className="size-3.5" />
                  </button>
                </span>
              ) : (
                <button
                  type="button"
                  onClick={() => setAddingMenuOpen(true)}
                  className="pg-tab pg-tab-action shrink-0"
                  title="Add a job or self-employment source"
                >
                  <Plus className="size-4" />
                  <span>Add Job</span>
                </button>
              )}
            </div>
          </div>
          ) : null}

          {streams.length ? (
            <div className={tabsMode ? undefined : 'flex flex-col gap-3'}>
              {(tabsMode ? (selected ? [selected] : []) : streams).map((s) => (
                <PayGuardJobEditor
                  key={s.id}
                  stream={s}
                  year={year}
                  open={!collapsedIds.has(s.id)}
                  onToggleOpen={() => toggleOne(s.id)}
                  onRemove={s.locked ? undefined : () => {
                    if (!confirm(`Remove "${s.name}"?`)) return;
                    if (selectedId === s.id) setSelectedId(null);
                    removeStream(s.id);
                  }}
                />
              ))}
            </div>
          ) : (
            <div className="pg-card flex flex-col items-center gap-3 p-6 text-center sm:p-12">
              <span className="text-base font-bold pg-fg sm:text-lg">No income sources added yet</span>
              <p className="max-w-md text-xs pg-muted sm:text-sm">
                Add your W-2 job paychecks or 1099 self-employment earnings to track countable income
                against SSA thresholds.
              </p>
              <div className="mt-1 flex flex-wrap justify-center gap-2">
                <button type="button" className="pg-btn pg-btn-lg pg-btn-solid" onClick={() => addAndSelect('w2')}>
                  <Plus className="size-3.5" /> Add W-2 Job
                </button>
                <button type="button" className="pg-btn pg-btn-lg" onClick={() => addAndSelect('ten99')}>
                  <Plus className="size-3.5" /> Add 1099 Work
                </button>
              </div>
            </div>
          )}
          </div>
        </div>

      </main>

      {/* ---------------- Mobile navigation ---------------- */}
      <nav className="pg-bottom-nav" aria-label="Sections">
        {MOBILE_TABS.map(({ id, label, Icon }) => (
          <button
            key={id}
            type="button"
            data-active={mobileTab === id}
            aria-current={mobileTab === id ? 'page' : undefined}
            onClick={() => goToMobileTab(id)}
            className="pg-bottom-nav-item"
          >
            <span className="pg-bottom-nav-icon">
              <Icon className="size-5" />
            </span>
            <span>{label}</span>
          </button>
        ))}
      </nav>

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
          subTheme={currentTheme}
          onSubThemeChange={(payguardTheme) => setUi({ payguardTheme })}
        />
      ) : null}
    </div>
  );
}


/**
 * The strip of months that need attention. The rule is shared with the
 * ledger, workrecord and calc20; only the markup is payguard's.
 */
function MonthAttention({ onOpenMonth }: { onOpenMonth: (month: MonthKey) => void }) {
  const { data, ui } = useTracker();
  const { scope } = useMonthScope('many');
  /* This strip is about months that have not happened yet, so it looks
     forward whatever else is on screen — the one exception is "This month",
     where the reader has asked for one month and nothing else. It renders
     nothing when those months are fine, as it always did. */
  const months = scopedMonths(ui.year, scope === 'month' ? 'month' : 'ahead');
  const flags = attentionFlags(data, months);
  if (!flags.length) return null;

  return (
    <section className="pg-attention" aria-label="Months that need attention">
      <TriangleAlert className="size-4 shrink-0" aria-hidden="true" />
      <div className="pg-attention-rail">
        {flags.map((flag) => (
          <button
            key={flag.month + flag.kind + flag.text}
            type="button"
            className="pg-attention-chip"
            data-kind={flag.kind}
            title={`${formatMonth(flag.month)}: ${flag.text}`}
            onClick={() => onOpenMonth(flag.month)}
          >
            <span className="pg-attention-month">{shortMonthName(flag.month).toUpperCase()}</span>
            <span>{flag.text}</span>
          </button>
        ))}
      </div>
    </section>
  );
}
