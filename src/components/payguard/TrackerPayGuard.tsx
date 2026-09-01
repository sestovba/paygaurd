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
  Undo2,
  X
} from 'lucide-react';
import { useTracker } from '../../state/TrackerProvider';
import { countableFor, streamYearGross } from '../../domain/earnings';
import { benefitPhase } from '../../domain/trialWork';
import { rulesFor, knownYears } from '../../domain/rules';
import { longMonthName, todayMonth } from '../../domain/months';
import { money } from '../../domain/format';
import { SettingsPanel } from '../SettingsPanel';
import { NotificationsBell } from '../NotificationsBell';
import { PayGuardChart } from './PayGuardChart';
import { PayGuardJobEditor } from './PayGuardJobEditor';
import { PayGuardAnalysis } from './PayGuardAnalysis';
import { importTrackerFile } from './payguardData';
import { useTheme } from '../../theme';
import { ReviewTarget } from '../../review/ReviewTarget';

type MobileTab = 'jobs' | 'overview' | 'analysis';

const MOBILE_TABS: { id: MobileTab; label: string; Icon: typeof Briefcase }[] = [
  { id: 'jobs', label: 'Jobs', Icon: Briefcase },
  { id: 'overview', label: 'TWP / SGA', Icon: PieChart },
  { id: 'analysis', label: 'Months', Icon: ShieldCheck }
];

export function TrackerPayGuard() {
  const {
    data, ui, setUi, addStream, removeStream, resetAll, replaceAll, undoCount, undo
  } = useTracker();
  const canUndo = undoCount > 0;
  const year = ui.year;
  const years = knownYears();
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [tabsMode, setTabsMode] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(data.streams[0]?.id ?? null);
  const [collapsedIds, setCollapsedIds] = useState<Set<string>>(new Set());
  const [addingMenuOpen, setAddingMenuOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [mobileTab, setMobileTab] = useState<MobileTab>('jobs');
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

  const phaseNeedsReview = phase === 'unknown' || phase === 'verifyComplete';
  const thresholdName = phase === 'trialWork' ? 'TWP' : 'SGA';
  const activeThreshold = phaseNeedsReview ? null : phase === 'trialWork' ? rules.trialWork : rules.sga;
  const currentCountable = combinedFor(asOf);
  const thresholdGap = activeThreshold == null ? null : activeThreshold - currentCountable;
  const statusTone = phaseNeedsReview ? 'info' : (thresholdGap ?? 0) < 0 ? 'over' : phase === 'trialWork' ? 'twp' : 'safe';
  const statusText = phaseNeedsReview
    ? 'Benefit phase needs review'
    : (thresholdGap ?? 0) < 0
      ? `${money(Math.abs(thresholdGap!))} above ${thresholdName}`
      : `${money(thresholdGap ?? 0)} below ${thresholdName}`;
  const thresholdProgress = activeThreshold
    ? Math.min(100, (currentCountable / activeThreshold) * 100)
    : 0;
  const statusMeterColor = statusTone === 'over' ? 'var(--pg-over)'
    : statusTone === 'twp' ? 'var(--pg-twp)'
      : statusTone === 'safe' ? 'var(--pg-safe)' : 'var(--pg-info)';

  return (
    <div className="pg-payguard pg-page-pad min-h-dvh" data-payguard-theme={currentTheme}>
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
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="pg-label">{longMonthName(asOf)} countable earnings</span>
              <span className={`pg-badge pg-badge-${statusTone}`} aria-live="polite">
                <span className="size-1.5 rounded-full" style={{ background: statusMeterColor }} />
                {statusText}
              </span>
            </div>

            <div className="mt-3 flex flex-wrap items-end justify-between gap-x-5 gap-y-2">
              <div className="min-w-0">
                <h1 id="pg-current-status-title" className="pg-status-title">Current countable income</h1>
                <div className="mt-1 flex flex-wrap items-baseline gap-x-2 gap-y-1">
                  <span className="pg-status-amount">{money(currentCountable)}</span>
                  <span className="text-xs font-semibold pg-muted">this month</span>
                </div>
              </div>
            </div>

            <div className="pg-status-track mt-3" aria-hidden="true">
              <span style={{ width: `${thresholdProgress}%`, background: statusMeterColor }} />
            </div>
          </div>

          <div className="pg-status-hero-side">
            <div>
              <span className="pg-label">{phaseNeedsReview ? 'Benefit phase' : `${thresholdName} monthly threshold`}</span>
              <div className="mt-1 pg-figure pg-figure-md">
                {activeThreshold == null ? 'Review needed' : money(activeThreshold)}
              </div>
            </div>
            <p className="text-xs leading-relaxed pg-muted">
              {phaseNeedsReview
                ? 'Confirm your Trial Work Period status before relying on threshold warnings.'
                : `Based on your selected benefit phase. This is a planning estimate, not an SSA decision.`}
            </p>
            <button type="button" className="pg-status-link" onClick={openAnalysis}>
              Review monthly analysis <ArrowRight className="size-3.5" />
            </button>
          </div>
        </section>

        {/* ---------------- Overview: chart ---------------- */}
        <div id="pg-overview" className={`flex-col gap-3 sm:gap-4 ${sectionVisibility('overview')}`}>
          <ReviewTarget
            id="payguard-year-chart"
            label="Annual income chart"
            reason="The chart duplicates monthly history and presents TWP and SGA as simultaneous targets."
            layout="payguard"
          >
            <PayGuardChart streams={streams} year={year} />
          </ReviewTarget>
        </div>

        {/* ---------------- Jobs ---------------- */}
        <div id="pg-jobs" className={`flex-col gap-3 ${sectionVisibility('jobs')}`}>
          <div
            className={tabsMode && streams.length > 0 ? 'pg-tabgroup' : undefined}
            data-type={tabsMode && selected ? selected.type : undefined}
          >
          <div className="pg-tabbar">
            <div className="pg-tabs flex-1" role="group" aria-label="Income sources">
              {tabsMode && streams.length > 0 ? streams.map((s) => {
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
                    <span className={`pg-badge ${s.type === 'w2' ? 'pg-badge-w2' : 'pg-badge-se'}`}>
                      {s.type === 'w2' ? 'W-2' : '1099'}
                    </span>
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

        {/* ---------------- Analysis ---------------- */}
        <div id="pg-analysis" className={`flex-col scroll-mt-20 ${sectionVisibility('analysis')}`}>
          <ReviewTarget
            id="payguard-monthly-analysis"
            label="Full monthly analysis"
            reason="Cards, table modes, summary totals, and the simulator repeat the same TWP / SGA facts; this should become a short risk-month list."
            layout="payguard"
          >
            <PayGuardAnalysis data={data} year={year} />
          </ReviewTarget>
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
