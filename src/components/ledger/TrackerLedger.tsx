import { useEffect, useRef, useState } from 'react';
import {
  ChevronLeft, ChevronRight, ChevronsDown, ChevronsUp, Download, Plus, Rows, Settings, Undo2, Upload, X
} from 'lucide-react';
import { useTracker } from '../../state/TrackerProvider';
import { countableFor, streamYearGross } from '../../domain/earnings';
import { trialWorkStatus } from '../../domain/trialWork';
import { rulesFor, knownYears } from '../../domain/rules';
import { monthsOfYear } from '../../domain/months';
import { SettingsPanel } from '../SettingsPanel';
import { NotificationsBell } from '../NotificationsBell';
import { LedgerChart } from './LedgerChart';
import { JOB_SECTIONS, jobSectionKey, LedgerJobEditor } from './LedgerJobEditor';
import { LedgerAnalysis } from './LedgerAnalysis';
import { money0 } from './ledgerFormat';
import { ReviewTarget } from '../../review/ReviewTarget';

function StatTile({ label, value, sub, last }: { label: string; value: string; sub?: React.ReactNode; last?: boolean }) {
  return (
    <div
      className={`flex flex-1 flex-col gap-1.5 p-3 sm:p-4 border-t sm:border-t-0 lg-stat-tile${last ? '' : ' lg-border-r'}`}
    >
      <span className="lg-label">{label}</span>
      <span className="text-2xl font-semibold leading-none tracking-tight sm:text-[1.75rem]">{value}</span>
      {sub ? <span className="text-[0.8125rem] leading-snug lg-text-muted">{sub}</span> : null}
    </div>
  );
}

export function TrackerLedger() {
  const {
    data, ui, setUi, addStream, updateStream, removeStream, resetAll, replaceAll, undoCount, undo
  } = useTracker();
  const canUndo = undoCount > 0;
  const year = ui.year;
  const years = knownYears();
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [tabsMode, setTabsMode] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(data.streams[0]?.id ?? null);
  const [editingTabId, setEditingTabId] = useState<string | null>(null);
  const [collapsedIds, setCollapsedIds] = useState<Set<string>>(new Set());
  const [addingType, setAddingType] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const streams = data.streams;
  const selected = streams.find((s) => s.id === selectedId) ?? streams[0] ?? null;

  const rules = rulesFor(year);
  const months = monthsOfYear(year);

  const overSgaCount = months.filter((m) =>
    data.streams.reduce((s2, s) => s2 + countableFor(s, m), 0) > rules.sga).length;
  const twp = trialWorkStatus(data);
  const priorInWindow = twp.inWindow.filter((m) => data.priorTrialMonths.includes(m)).length;

  // Ledger sub-themes replace the app-wide light/dark toggle. Strip .dark on
  // mount so production (which bootstraps theme from localStorage in
  // index.html) matches dev, where HMR often leaves html without .dark.
  useEffect(() => {
    const root = document.documentElement;
    root.classList.remove('dark');
    root.style.colorScheme = ui.ledgerTheme === 'carbon' ? 'dark' : 'light';
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute('content', ui.ledgerTheme === 'carbon' ? '#0a0a0c' : '#f9f9f7');
  }, [ui.ledgerTheme]);

  function exportJson() {
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `paycheck-guard-${year}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  function importJson(file: File) {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = JSON.parse(String(reader.result));
        if (!parsed || typeof parsed !== 'object' || !Array.isArray(parsed.streams)) {
          alert('That file does not look like a PayGuard export.');
          return;
        }
        if (confirm('Import this file? It replaces every job and month currently on this device.')) {
          replaceAll(parsed);
        }
      } catch {
        alert('Could not read that file as JSON.');
      }
    };
    reader.readAsText(file);
  }

  function addAndSelect(type: 'w2' | 'ten99') {
    const id = addStream(type);
    setSelectedId(id);
    setTabsMode(true);
  }

  const allCollapsed = streams.length > 0 && streams.every((s) => collapsedIds.has(s.id));

  function toggleCollapseAll() {
    // Cascades: every job card plus every section nested inside it.
    setCollapsedIds(allCollapsed
      ? new Set()
      : new Set(streams.flatMap((s) => [s.id, ...JOB_SECTIONS.map((sec) => jobSectionKey(s.id, sec))])));
  }

  function toggleOne(id: string) {
    setCollapsedIds((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  function focusStream(id: string) {
    setSelectedId(id);
    setTabsMode(true);
  }

  return (
    <div className="pg-ledger min-h-dvh" data-ledger-theme={ui.ledgerTheme}>
      <input
        ref={fileInputRef}
        type="file"
        accept="application/json,.json"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) importJson(file);
          e.target.value = '';
        }}
      />

      <div className="lg-app-card mx-auto flex w-full max-w-[80rem] flex-col pb-6">
      <header className="sticky top-0 z-20 lg-border-b">
        <div className="lg-header-bar">
          <div className="flex min-w-0 flex-col gap-0.5">
            <span className="lg-header-title truncate">SSDI Income Tracker</span>
          </div>
          <div className="lg-header-actions flex items-center gap-2">
            <NotificationsBell
              open={notificationsOpen}
              onOpenChange={setNotificationsOpen}
              onSetPayday={focusStream}
              onReviewStream={focusStream}
              onOpenMonth={() => {
                document.querySelector('.lg-analysis')?.scrollIntoView({ behavior: 'smooth' });
              }}
            />
            <div className="flex items-center gap-1">
              <button
                type="button"
                className="lg-btn disabled:opacity-40 disabled:pointer-events-none"
                disabled={!canUndo}
                onClick={undo}
                title="Undo last change"
              >
                <Undo2 className="size-4" /> Undo ({undoCount})
              </button>
              <ReviewTarget
                id="ledger-scroll-top"
                label="Scroll-to-top button"
                reason="Duplicates what the scrollbar and Home key already do."
                layout="ledger"
              >
                <button
                  type="button"
                  className="lg-btn"
                  onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
                  title="Scroll to top"
                >
                  <ChevronsUp className="size-4" /> Top
                </button>
              </ReviewTarget>
              <button
                type="button"
                className="lg-btn"
                onClick={() => setSettingsOpen(true)}
                aria-label="Settings"
                title="Settings"
              >
                <Settings className="size-4" />
              </button>
            </div>
          </div>
        </div>
        <div className="lg-header-tools">
          <div className="lg-header-tools-inner flex flex-wrap items-center justify-between gap-2.5">
            {/* Cluster 1: Navigation & View Controls */}
            <div className="flex items-center gap-2">
              <div className="lg-year-stepper">
                <button
                  type="button"
                  disabled={years.indexOf(year) <= 0}
                  onClick={() => setUi({ year: years[years.indexOf(year) - 1] })}
                  aria-label="Previous year"
                >
                  <ChevronLeft className="size-4" />
                </button>
                <span className="min-w-10 px-1 text-center text-sm font-bold">{year}</span>
                <button
                  type="button"
                  disabled={years.indexOf(year) >= years.length - 1}
                  onClick={() => setUi({ year: years[years.indexOf(year) + 1] })}
                  aria-label="Next year"
                >
                  <ChevronRight className="size-4" />
                </button>
              </div>

              <span className="hidden sm:inline-block h-5 w-px lg-divider-v" />

              <button type="button" className="lg-btn" onClick={toggleCollapseAll}>
                {allCollapsed ? <ChevronsDown className="size-4" /> : <ChevronsUp className="size-4" />}
                {allCollapsed ? 'Expand All' : 'Collapse All' }
              </button>
            </div>

            {/* Cluster 2: Data Import / Export */}
            <div className="flex items-center gap-1.5">
              <button type="button" className="lg-btn" onClick={() => fileInputRef.current?.click()} title="Import JSON">
                <Upload className="size-4" /> Import
              </button>
              <button type="button" className="lg-btn lg-btn-solid" onClick={exportJson} title="Export JSON">
                <Download className="size-4" /> Export JSON
              </button>
            </div>
          </div>
        </div>
      </header>

      <div className="flex flex-wrap lg-border-b">
        <div className="flex flex-1 flex-col gap-1.5 p-3 sm:p-4 border-t sm:border-t-0 lg-stat-tile lg-border-r">
          <span className="lg-label">TWP Months Used</span>
          <span className={`text-2xl font-semibold leading-none sm:text-[1.75rem] ${twp.used >= 9 ? 'lg-text-over' : 'lg-text-safe'}`}>
            {twp.used}<span className="text-sm font-normal lg-text-muted">/9</span>
          </span>
          <div className="flex h-1.5 gap-1" role="img" aria-label={`${twp.used} of 9 trial work months used`}>
            {Array.from({ length: 9 }, (_, i) => (
              <span
                key={i}
                className="flex-1 rounded-full"
                style={{ background: i < priorInWindow ? 'var(--lg-muted)' : i < twp.used ? 'var(--lg-twp)' : 'var(--lg-border)' }}
                title={i < priorInWindow ? 'Recorded before this tracker' : i < twp.used ? 'Used' : undefined}
              />
            ))}
          </div>
        </div>
        <StatTile
          label="Months ≥ SGA"
          value={String(overSgaCount)}
          sub={`SGA ${money0(rules.sga)} / month`}
          last
        />
      </div>

      <ReviewTarget
        id="ledger-year-chart"
        label="Annual income chart"
        reason="Twelve bars against two threshold lines; the monthly analysis below states the same thing in words."
        layout="ledger"
        className="lg-border-b"
      >
        <LedgerChart streams={streams} year={year} />
      </ReviewTarget>

      <div className="lg-border-b">
        {streams.length ? (
          <>
            <div className="lg-tabbar flex items-center">
            <div className="flex min-w-0 flex-1 items-center overflow-x-auto">
              {tabsMode ? streams.map((s) => (
                <div
                  key={s.id}
                  data-active={selected?.id === s.id}
                  data-type={s.type}
                  className="lg-tab"
                  title="Double-click to rename"
                  onClick={() => setSelectedId(s.id)}
                >
                  <span className="lg-type-badge" data-type={s.type}>
                    {s.type === 'w2' ? 'W-2' : '1099'}
                  </span>
                  {editingTabId === s.id ? (
                    <input
                      aria-label="Stream name"
                      autoFocus
                      value={s.name}
                      onClick={(e) => e.stopPropagation()}
                      onChange={(e) => updateStream(s.id, { name: e.target.value })}
                      onBlur={() => setEditingTabId(null)}
                      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === 'Escape') setEditingTabId(null); }}
                      className="lg-name-input"
                      style={{ width: Math.max(4, s.name.length) + 'ch' }}
                    />
                  ) : (
                    <span
                      onDoubleClick={(e) => { e.stopPropagation(); if (!s.locked) setEditingTabId(s.id); }}
                    >
                      {s.name}
                    </span>
                  )}
                  <span className="lg-text-muted">{money0(streamYearGross(s, year))}</span>
                  {!s.locked ? (
                    <button
                      type="button"
                      aria-label={`Remove ${s.name}`}
                      onClick={(e) => {
                        e.stopPropagation();
                        if (selectedId === s.id) setSelectedId(null);
                        removeStream(s.id);
                      }}
                      className="lg-text-muted"
                    >
                      <X className="size-5" />
                    </button>
                  ) : null}
                </div>
              )) : (
                <div className="px-3 py-2 text-[0.75rem] lg-text-muted">All jobs, stacked below</div>
              )}

              {addingType ? (
                <div className="lg-tab lg-tab-static">
                  <span className="lg-text-muted">New source</span>
                  <button
                    type="button"
                    className="lg-btn lg-btn-w2"
                    onClick={() => { addAndSelect('w2'); setAddingType(false); }}
                  >
                    W-2 Job
                  </button>
                  <button
                    type="button"
                    className="lg-btn lg-btn-se"
                    onClick={() => { addAndSelect('ten99'); setAddingType(false); }}
                  >
                    1099 Work
                  </button>
                  <button type="button" aria-label="Cancel" onClick={() => setAddingType(false)} className="lg-text-muted">
                    <X className="size-5" />
                  </button>
                </div>
              ) : (
                <button type="button" className="lg-tab min-w-[3.25rem] justify-center" aria-label="Add source" onClick={() => setAddingType(true)}>
                  <Plus className="size-5" />
                </button>
              )}

            </div>
              <button type="button" className="lg-tab shrink-0" onClick={() => setTabsMode((v) => !v)}>
                <Rows className="size-3.5" /> {tabsMode ? 'Continuous' : 'Tabs'}
              </button>
            </div>

            {tabsMode
              ? (selected ? (
                  <LedgerJobEditor
                    key={selected.id}
                    stream={selected}
                    year={year}
                    open={!collapsedIds.has(selected.id)}
                    onToggleOpen={() => toggleOne(selected.id)}
                    sectionOpen={(sec) => !collapsedIds.has(jobSectionKey(selected.id, sec))}
                    onToggleSection={(sec) => toggleOne(jobSectionKey(selected.id, sec))}
                  />
                ) : null)
              : streams.map((s) => (
                  <LedgerJobEditor
                    key={s.id}
                    stream={s}
                    year={year}
                    open={!collapsedIds.has(s.id)}
                    onToggleOpen={() => toggleOne(s.id)}
                    sectionOpen={(sec) => !collapsedIds.has(jobSectionKey(s.id, sec))}
                    onToggleSection={(sec) => toggleOne(jobSectionKey(s.id, sec))}
                  />
                ))}
          </>
        ) : (
          <div className="lg-border flex flex-col items-center gap-3 p-10 text-center">
            <p className="lg-sans text-base font-semibold">No income sources yet</p>
            <p className="max-w-sm text-sm lg-text-muted">Add a W-2 job or 1099 work to start tracking countable income against TWP and SGA.</p>
            <div className="flex gap-2">
              <button type="button" className="lg-btn lg-btn-solid" onClick={() => addAndSelect('w2')}>+ W-2 job</button>
              <button type="button" className="lg-btn" onClick={() => addAndSelect('ten99')}>+ 1099 work</button>
            </div>
          </div>
        )}
      </div>

      <LedgerAnalysis data={data} year={year} />
      </div>

      {settingsOpen ? (
        <SettingsPanel
          theme={ui.theme}
          onTheme={(theme) => setUi({ theme })}
          onOpenStatus={() => { setUi({ layout: 'responsive' }); setSettingsOpen(false); }}
          onReset={resetAll}
          onClose={() => setSettingsOpen(false)}
          layout={ui.layout}
          onLayoutChange={(layout) => setUi({ layout })}
          subTheme={ui.ledgerTheme}
          onSubThemeChange={(ledgerTheme) => setUi({ ledgerTheme })}
        />
      ) : null}
    </div>
  );
}
