import { useEffect, useState } from 'react';
import {
  ChevronLeft, ChevronRight, ChevronsDown, ChevronsUp, Plus, Rows, Settings, Undo2, X
} from 'lucide-react';
import { useMonthScope, useTracker } from '../../state/TrackerProvider';
import { countableFor, streamYearGross } from '../../domain/earnings';
import { activeThreshold, benefitPhase, trialWorkStatus } from '../../domain/trialWork';
import { attentionFlags } from '../../domain/attention';
import { SOURCE_CHOICE } from '../../domain/copy';
import { precisionFor } from '../../domain/precision';
import { PrecisionLine } from '../PrecisionLine';
import type { MonthKey } from '../../domain/types';
import { rulesFor, knownYears } from '../../domain/rules';
import {
  formatMonth, monthsOfYear, scopedMonths, shortMonthName, todayMonth, yearOf
} from '../../domain/months';
import { MonthScopePicker } from '../MonthScopePicker';
import { SettingsPanel } from '../SettingsPanel';
import { ToastStack } from '../ToastStack';
import { NotificationsBell } from '../NotificationsBell';
import { LedgerChart } from './LedgerChart';
import { JOB_SECTIONS, jobSectionKey, LedgerJobEditor } from './LedgerJobEditor';
import { LedgerAnalysis } from './LedgerAnalysis';
import { money0 } from './ledgerFormat';
import { ReviewTarget } from '../../review/ReviewTarget';

export function TrackerLedger() {
  const {
    data, ui, setUi, addStream, updateStream, removeStream, resetAll, undoCount, undo
  } = useTracker();
  const canUndo = undoCount > 0;
  const year = ui.year;
  const { scope, setScope } = useMonthScope('many');
  const years = knownYears();
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [tabsMode, setTabsMode] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(data.streams[0]?.id ?? null);
  const [editingTabId, setEditingTabId] = useState<string | null>(null);
  const [collapsedIds, setCollapsedIds] = useState<Set<string>>(new Set());
  const [addingType, setAddingType] = useState(false);

  const streams = data.streams;
  const selected = streams.find((s) => s.id === selectedId) ?? streams[0] ?? null;

  const rules = rulesFor(year);
  const now = todayMonth();
  const gradedMonth: MonthKey = yearOf(now) === year ? now : `${year}-12`;
  const overSgaCount = monthsOfYear(year).filter((m) =>
    data.streams.reduce((s2, s) => s2 + countableFor(s, m), 0) > rules.sga).length;
  const twp = trialWorkStatus(data);
  const phase = benefitPhase(data, gradedMonth);
  const priorInWindow = twp.inWindow.filter((m) => data.priorTrialMonths.includes(m)).length;

  /*
   * This used to strip `.dark` off <html> on mount, because the ledger
   * palette replaced the app-wide light/dark toggle rather than answering
   * it. That is gone: one palette, one light/dark switch, and both are
   * settled in styles/palette.css. `carbon` is still dark in both modes —
   * it says so there, in one block, instead of here in JavaScript.
   *
   * The theme-colour meta still needs setting, because the browser chrome
   * cannot read a CSS variable.
   */
  useEffect(() => {
    const meta = document.querySelector('meta[name="theme-color"]');
    if (!meta) return;
    const bg = getComputedStyle(document.documentElement).getPropertyValue('--t-bg').trim();
    if (bg) meta.setAttribute('content', bg);
  }, [ui.palette, ui.theme]);

  /* Import and export used to be a second header bar of their own. The
     settings sheet has offered both all along, so the buttons here were a
     duplicate rather than a home — see the note on the header below. */

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
    <div className="pg-ledger min-h-dvh" data-chrome-root>

      <div className="lg-app-card mx-auto flex w-full max-w-[80rem] flex-col pb-6">
      {/* Review note: "after making those changes we need to refactor the
          headers into one header", and "Import and export in the settings,
          collapse all is legit". Both are here. The second bar existed to
          hold Import and Export, which the settings sheet has offered all
          along — so they were not moved, they were deleted, and the year
          stepper and Collapse All came up into the one bar that is left. */}
      <header className="sticky top-0 z-20 lg-border-b">
        <div className="lg-header-bar">
          <div className="flex min-w-0 items-center gap-2">
            <span className="lg-header-title truncate">SSDI Income Tracker</span>
            <span className="hidden sm:inline-block h-5 w-px lg-divider-v" />
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
          </div>

          <div className="lg-header-actions flex flex-wrap items-center gap-1.5">
            {/* How much of the year everything below shows. A ledger drawn
                around twelve rows reads as broken with one in it, so this
                layout gets to say how much it wants rather than being
                collapsed by a switch in Settings you cannot see from here. */}
            <MonthScopePicker scope={scope} onChange={setScope} className="lg-scope" />
            <button type="button" className="lg-btn" onClick={toggleCollapseAll}>
              {allCollapsed ? <ChevronsDown className="size-4" /> : <ChevronsUp className="size-4" />}
              {allCollapsed ? 'Expand all' : 'Collapse all'}
            </button>
            <NotificationsBell
              open={notificationsOpen}
              onOpenChange={setNotificationsOpen}
              onSetPayday={focusStream}
              onReviewStream={focusStream}
              onOpenMonth={() => {
                document.querySelector('.lg-analysis')?.scrollIntoView({ behavior: 'smooth' });
              }}
            />
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
      </header>

      {/* Review note: "PaycheckRadar is the surface that names the months to
          be on high alert… the ledger only has paycheckContextForMonth inside
          the monthly analysis table — a column in a table you scroll to. The
          hazard the product exists to catch should not be a cell." So it
          leads, above the stat strip. Same rule as every other layout; see
          src/domain/attention.ts. */}
      <MonthAttention />

      {/* Review notes: "I like this honestly but its taking up too much
          space for what it is", and the one-limit rule this layout was
          supposed to have already. It was two tall tiles side by side —
          "TWP Months Used" and "Months ≥ SGA" — which is both regimes named
          at once, in abbreviations, in the two largest figures on the page.
          One line now, and it says whichever one is actually yours: the
          trial months while they are being spent, the count over your limit
          once they are not, and neither until you have told us where you
          stand. */}
      {phase === 'trialWork' ? (
        <div className="lg-standing lg-border-b">
          <span className="lg-label">Trial work months left</span>
          <span className="lg-standing-figure">
            {twp.remaining}<span className="lg-standing-of">of 9</span>
          </span>
          <div className="lg-standing-meter" role="img" aria-label={`${twp.used} of 9 trial work months used`}>
            {Array.from({ length: 9 }, (_, i) => (
              <span
                key={i}
                style={{ background: i < priorInWindow ? 'var(--lg-muted)' : i < twp.used ? 'var(--lg-twp)' : 'var(--lg-border)' }}
                title={i < priorInWindow ? 'Recorded before this tracker' : i < twp.used ? 'Used' : undefined}
              />
            ))}
          </div>
        </div>
      ) : phase === 'sga' ? (
        <div className="lg-standing lg-border-b">
          <span className="lg-label">Months over your limit</span>
          <span className={`lg-standing-figure${overSgaCount ? ' lg-text-over' : ''}`}>{overSgaCount}</span>
          <span className="lg-standing-sub">Your limit is {money0(rules.sga)} a month</span>
        </div>
      ) : null}

      {/* Same reading as every other layout: how far the figures above can be
          trusted, and the single thing that would sharpen them. Graded on the
          month you are actually in when the ledger is showing this year, and
          on December when it is showing a past one — grading a finished year
          against a month that has not happened in it says nothing. */}
      <div className="lg-precision lg-border-b">
        <PrecisionLine reading={precisionFor(data, gradedMonth)} />
      </div>

      <ReviewTarget
        id="ledger-year-chart"
        label="Annual income chart"
        reason="Twelve bars against two threshold lines; the monthly analysis below states the same thing in words."
        layout="ledger"
        className="lg-border-b"
      >
        {scope === 'month' ? null : <LedgerChart streams={streams} year={year} limit={activeThreshold(data, gradedMonth)} />}
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
            {/* The empty state named four things the reader has not been
                taught — W-2, 1099, countable, TWP and SGA — in the two
                sentences that are supposed to get them started. The buttons
                offered the tax-form pair that SOURCE_CHOICE exists to
                prevent: a driver does not know they are the second one. */}
            <p className="lg-sans text-base font-semibold">Nothing here yet</p>
            <p className="max-w-sm text-sm lg-text-muted">Add where your money comes from, and we will keep track of what counts toward your monthly limit.</p>
            <div className="flex gap-2">
              <button type="button" className="lg-btn lg-btn-solid" onClick={() => addAndSelect('w2')}>{SOURCE_CHOICE.w2.label}</button>
              <button type="button" className="lg-btn" onClick={() => addAndSelect('ten99')}>{SOURCE_CHOICE.ten99.label}</button>
            </div>
          </div>
        )}
      </div>

      <LedgerAnalysis data={data} year={year} scope={scope} />
      </div>

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
 * The months that need attention, in the ledger's own hand. The rule is
 * shared with payguard, workrecord and calc20 — only the markup is local.
 */
function MonthAttention() {
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
    <section className="lg-attention lg-border-b" aria-label="Months that need attention">
      <span className="lg-label lg-attention-title">Needs attention</span>
      <div className="lg-attention-rail">
        {flags.map((flag) => (
          <button
            key={flag.month + flag.kind + flag.text}
            type="button"
            className="lg-attention-chip"
            data-kind={flag.kind}
            title={`${formatMonth(flag.month)}: ${flag.text}`}
            onClick={() => document.querySelector('.lg-analysis')?.scrollIntoView({ behavior: 'smooth' })}
          >
            <span className="lg-attention-month">{shortMonthName(flag.month).toUpperCase()}</span>
            <span>{flag.text}</span>
          </button>
        ))}
      </div>
    </section>
  );
}
