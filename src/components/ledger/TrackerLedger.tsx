import { ButtonBase } from '../../design-system';
import { useEffect, useState } from 'react';
import {
  ChevronLeft, ChevronRight, ChevronsDown, ChevronsUp, Plus, Settings, Undo2, X
} from 'lucide-react';
import { useMonthScope, useTracker } from '../../state/TrackerProvider';
import { countableFor, streamYearGross } from '../../domain/earnings';
import { activeThreshold, benefitPhase, trialWorkStatus } from '../../domain/trialWork';
import { attentionFlags } from '../../domain/attention';
import { SOURCE_CHOICE, SOURCE_SHORT, hoursLine } from '../../domain/copy';
import { capacityFor } from '../../domain/capacity';
import { precisionFor } from '../../domain/precision';
import { PrecisionLine } from '../PrecisionLine';
import type { MonthKey, Stream } from '../../domain/types';
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
  const [selectedId, setSelectedId] = useState<string | null>(data.streams[0]?.id ?? null);
  const [editingTabId, setEditingTabId] = useState<string | null>(null);
  const [collapsedIds, setCollapsedIds] = useState<Set<string>>(new Set());
  const [addingType, setAddingType] = useState(false);

  const streams = data.streams;
  /* Tabs are ongoing jobs only — paused/ended live under Not ongoing, like
     calc20's archive, with Put back to return them to the tab strip. */
  const ongoing = streams.filter((s) => s.lifecycle === 'active');
  const archived = streams.filter((s) => s.lifecycle !== 'active');
  const selected = ongoing.find((s) => s.id === selectedId) ?? ongoing[0] ?? null;

  const rules = rulesFor(year);
  const now = todayMonth();
  const gradedMonth: MonthKey = yearOf(now) === year ? now : `${year}-12`;
  const overSgaCount = monthsOfYear(year).filter((m) =>
    data.streams.reduce((s2, s) => s2 + countableFor(s, m), 0) > rules.sga).length;
  const twp = trialWorkStatus(data);
  const phase = benefitPhase(data, gradedMonth);
  const priorInWindow = twp.inWindow.filter((m) => data.priorTrialMonths.includes(m)).length;
  const cap = capacityFor(data, gradedMonth);

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
    if (!selectedId) return;
    const current = data.streams.find((s) => s.id === selectedId);
    if (current && current.lifecycle === 'active') return;
    setSelectedId(data.streams.find((s) => s.lifecycle === 'active')?.id ?? null);
  }, [selectedId, data.streams]);

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
  }

  const allCollapsed = ongoing.length > 0 && ongoing.every((s) => collapsedIds.has(s.id));

  function toggleCollapseAll() {
    // Cascades: every job card plus every section nested inside it.
    setCollapsedIds(allCollapsed
      ? new Set()
      : new Set(ongoing.flatMap((s) => [s.id, ...JOB_SECTIONS.map((sec) => jobSectionKey(s.id, sec))])));
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
  }

  return (
    <div className="pg-ledger flex min-h-dvh flex-col" data-chrome-root>

      <div className="lg-app-card flex min-h-0 w-full flex-1 flex-col">
      {/* Review note: "after making those changes we need to refactor the
          headers into one header", and "Import and export in the settings,
          collapse all is legit". Both are here. The second bar existed to
          hold Import and Export, which the settings sheet has offered all
          along — so they were not moved, they were deleted, and the year
          stepper and Collapse All came up into the one bar that is left. */}
      <header className="sticky top-0 z-20">
        <div className="lg-header-bar">
          {/* Title cluster: name + which months + which year — one identity row.
              Scope lives next to the title (not in the action pile) so desktop
              stays a single line: identity left, tools right. */}
          <div className="lg-header-identity">
            <span className="lg-header-title truncate">SSDI Tracker</span>
            <MonthScopePicker scope={scope} onChange={setScope} className="lg-scope lg-scope-inline" />
            <div className="lg-year-stepper">
              <ButtonBase
                type="button"
                disabled={years.indexOf(year) <= 0}
                onClick={() => setUi({ year: years[years.indexOf(year) - 1] })}
                aria-label="Previous year"
              >
                <ChevronLeft className="size-4" />
              </ButtonBase>
              <span className="min-w-10 lg-pad-micro-x text-center lg-type-body font-bold">{year}</span>
              <ButtonBase
                type="button"
                disabled={years.indexOf(year) >= years.length - 1}
                onClick={() => setUi({ year: years[years.indexOf(year) + 1] })}
                aria-label="Next year"
              >
                <ChevronRight className="size-4" />
              </ButtonBase>
            </div>
          </div>

          <div className="lg-header-actions">
            <ButtonBase type="button" className="lg-btn" onClick={toggleCollapseAll} aria-label={allCollapsed ? 'Expand all' : 'Collapse all'} title={allCollapsed ? 'Expand all' : 'Collapse all'}>
              {allCollapsed ? <ChevronsDown className="size-4" /> : <ChevronsUp className="size-4" />}
              <span className="lg-btn-label">{allCollapsed ? 'Expand all' : 'Collapse all'}</span>
            </ButtonBase>
            <NotificationsBell
              open={notificationsOpen}
              onOpenChange={setNotificationsOpen}
              onSetPayday={focusStream}
              onReviewStream={focusStream}
              onOpenMonth={() => {
                document.querySelector('.lg-analysis')?.scrollIntoView({ behavior: 'smooth' });
              }}
            />
            <ButtonBase
              type="button"
              className="lg-btn disabled:opacity-40 disabled:pointer-events-none"
              disabled={!canUndo}
              onClick={undo}
              aria-label={canUndo ? `Undo last change (${undoCount})` : 'Undo'}
              title="Undo last change"
            >
              <Undo2 className="size-4" />
              <span className="lg-btn-label">{canUndo ? `Undo (${undoCount})` : 'Undo'}</span>
            </ButtonBase>
            <ButtonBase
              type="button"
              className="lg-btn lg-btn-icon"
              onClick={() => setSettingsOpen(true)}
              aria-label="Settings"
              title="Settings"
            >
              <Settings className="size-4" />
            </ButtonBase>
          </div>
        </div>
      </header>

      {/* Review note: "PaycheckRadar is the surface that names the months to
          be on high alert… the ledger only has paycheckContextForMonth inside
          the monthly analysis table — a column in a table you scroll to. The
          hazard the product exists to catch should not be a cell." So it
          leads, above the stat strip. Same rule as every other layout; see
          src/domain/attention.ts. */}
      {/* One status section: attention + standing + precision share a well.
          Hierarchy comes from background fill, not a stack of hairlines. */}
      <section className="lg-status-band" aria-label="Where you stand">
        <MonthAttention />

        {/* One-limit rule: trial months while they are being spent, count over
            the limit once they are not. */}
        <div className="lg-status-row">
          {phase === 'trialWork' ? (
            <div className="lg-standing">
              <span className="lg-label">Trial months left</span>
              <span className="lg-standing-figure">
                {twp.remaining}
                <span className="lg-standing-of"> of 9</span>
              </span>
              <div className="lg-standing-meter" role="img" aria-label={`${twp.used} of 9 trial work months used`}>
                {Array.from({ length: 9 }, (_, i) => (
                  <span
                    key={i}
                    style={{ background: i < priorInWindow ? 'var(--lg-muted)' : i < twp.used ? 'var(--lg-fg)' : 'var(--lg-border)' }}
                    title={i < priorInWindow ? 'Recorded before this tracker' : i < twp.used ? 'Used' : undefined}
                  />
                ))}
              </div>
            </div>
          ) : phase === 'sga' ? (
            <div className="lg-standing">
              <span className="lg-label">Months over</span>
              <span className={`lg-standing-figure${overSgaCount ? ' lg-text-over' : ''}`}>{overSgaCount}</span>
              <span className="lg-standing-sub">{money0(rules.sga)} / mo</span>
            </div>
          ) : null}

          <div className="lg-precision">
            {cap && cap.hours !== null ? (
              <p className="lg-standing-sub lg-hours">{hoursLine(cap.hours).replace(/\.$/, '')}</p>
            ) : null}
            <PrecisionLine reading={precisionFor(data, gradedMonth)} />
          </div>
        </div>
      </section>

      <div className="lg-jobs">
        {streams.length ? (
          <>
            {/* Tabs are the entry model — the Scrolling/Tabs switch was a
                second way to browse the same jobs. One way now. */}
            <div className="lg-tabbar flex items-center">
              <div className="lg-tabbar-scroller" role="group" aria-label="Jobs">
                {ongoing.map((s) => (
                  <div
                    key={s.id}
                    data-active={selected?.id === s.id}
                    data-type={s.type}
                    className="lg-tab"
                    title="Double-click to rename"
                    role={editingTabId === s.id ? undefined : 'button'}
                    tabIndex={editingTabId === s.id ? -1 : 0}
                    aria-pressed={editingTabId === s.id ? undefined : selected?.id === s.id}
                    onClick={() => setSelectedId(s.id)}
                    onKeyDown={(event) => {
                      if (editingTabId === s.id) return;

                      if (event.key === 'Enter' || event.key === ' ') {
                        event.preventDefault();
                        setSelectedId(s.id);
                      }

                      if (event.key === 'F2') {
                        event.preventDefault();
                        setSelectedId(s.id);
                        setEditingTabId(s.id);
                      }
                    }}
                  >
                    <span className="lg-type-badge" data-type={s.type}>
                      {SOURCE_SHORT[s.type]}
                    </span>
                    {editingTabId === s.id ? (
                      <input
                        aria-label="Job name"
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
                    {!s.locked ? (
                      <ButtonBase
                        type="button"
                        aria-label={`Remove ${s.name}`}
                        className="lg-tab-close lg-text-muted"
                        onClick={(e) => {
                          e.stopPropagation();
                          if (selectedId === s.id) setSelectedId(null);
                          removeStream(s.id);
                        }}
                      >
                        <X className="size-5" />
                      </ButtonBase>
                    ) : null}
                  </div>
                ))}

                {addingType ? (
                  <div className="lg-tab lg-tab-static lg-tab-add">
                    <div className="lg-add-split" role="group" aria-label="Add a job">
                      <ButtonBase
                        type="button"
                        className="lg-add-split__job"
                        onClick={() => { addAndSelect('w2'); setAddingType(false); }}
                      >
                        {SOURCE_SHORT.w2}
                      </ButtonBase>
                      <ButtonBase
                        type="button"
                        className="lg-add-split__gig"
                        onClick={() => { addAndSelect('ten99'); setAddingType(false); }}
                      >
                        {SOURCE_SHORT.ten99}
                      </ButtonBase>
                    </div>
                    <ButtonBase type="button" aria-label="Cancel" onClick={() => setAddingType(false)} className="lg-tab-close lg-text-muted" style={{ opacity: 1 }}>
                      <X className="size-5" strokeWidth={2.25} />
                    </ButtonBase>
                  </div>
                ) : (
                  <ButtonBase type="button" className="lg-tab lg-tab-add-trigger min-w-[3.25rem] justify-center" aria-label="Add a job" onClick={() => setAddingType(true)}>
                    <Plus className="size-5" strokeWidth={2.5} />
                  </ButtonBase>
                )}
              </div>
            </div>

            {selected ? (
              <LedgerJobEditor
                key={selected.id}
                stream={selected}
                year={year}
                open={!collapsedIds.has(selected.id)}
                onToggleOpen={() => toggleOne(selected.id)}
                sectionOpen={(sec) => !collapsedIds.has(jobSectionKey(selected.id, sec))}
                onToggleSection={(sec) => toggleOne(jobSectionKey(selected.id, sec))}
                afterIncome={archived.length ? (
              <div className="lg-archived" aria-label="Jobs not ongoing">
                <span className="lg-archived-title">Not ongoing</span>
                <div className="lg-archived-chips">
                  {archived.map((s) => (
                    <LedgerArchivedChip
                      key={s.id}
                      stream={s}
                      year={year}
                      onReturn={() => {
                        updateStream(s.id, { lifecycle: 'active', activeTo: null });
                        setSelectedId(s.id);
                      }}
                      onRemove={() => {
                        if (selectedId === s.id) setSelectedId(null);
                        removeStream(s.id);
                      }}
                    />
                  ))}
                </div>
              </div>
                ) : null}
              />
            ) : archived.length ? (
              /* No ongoing job open — still show paused/ended under the tabs. */
              <div className="lg-archived" aria-label="Jobs not ongoing">
                <span className="lg-archived-title">Not ongoing</span>
                <div className="lg-archived-chips">
                  {archived.map((s) => (
                    <LedgerArchivedChip
                      key={s.id}
                      stream={s}
                      year={year}
                      onReturn={() => {
                        updateStream(s.id, { lifecycle: 'active', activeTo: null });
                        setSelectedId(s.id);
                      }}
                      onRemove={() => {
                        if (selectedId === s.id) setSelectedId(null);
                        removeStream(s.id);
                      }}
                    />
                  ))}
                </div>
              </div>
            ) : null}
          </>
        ) : (
          <div className="lg-border flex flex-col items-center gap-3 lg-empty-shell text-center">
            {/* The empty state named four things the reader has not been
                taught — W-2, 1099, countable, TWP and SGA — in the two
                sentences that are supposed to get them started. The buttons
                offered the tax-form pair that SOURCE_CHOICE exists to
                prevent: a driver does not know they are the second one. */}
            <p className="lg-type-ui">Nothing here yet</p>
            <p className="max-w-sm lg-type-body lg-text-muted">Add where your money comes from, and we will keep track of what counts toward your monthly limit.</p>
            <div className="flex gap-2">
              <ButtonBase type="button" className="lg-btn lg-btn-solid" onClick={() => addAndSelect('w2')}>{SOURCE_CHOICE.w2.label}</ButtonBase>
              <ButtonBase type="button" className="lg-btn" onClick={() => addAndSelect('ten99')}>{SOURCE_CHOICE.ten99.label}</ButtonBase>
            </div>
          </div>
        )}
      </div>

      <ReviewTarget
        id="ledger-year-chart"
        label="Annual income chart"
        reason="Twelve bars against the limit; the monthly analysis below states the same thing in words."
        layout="ledger"
        className="lg-chart-band"
      >
        {scope === 'month' ? null : <LedgerChart streams={streams} year={year} limit={activeThreshold(data, gradedMonth)} />}
      </ReviewTarget>

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

/** calc20's archived chip, in the ledger's hand: name · Paused|Ended · total,
 *  tap for Return to ongoing (and Remove). */
function LedgerArchivedChip({
  stream, year, onReturn, onRemove
}: {
  stream: Stream;
  year: number;
  onReturn: () => void;
  onRemove: () => void;
}) {
  const [open, setOpen] = useState(false);
  const paused = stream.lifecycle === 'inactive';
  return (
    <div className="lg-archived-wrap">
      <ButtonBase
        type="button"
        className="lg-archived-chip"
        data-open={open || undefined}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={`Actions for ${stream.name}`}
        onClick={() => setOpen((v) => !v)}
      >
        <span className="lg-archived-name">{stream.name}</span>
        <span className="lg-archived-tag" data-kind={paused ? 'paused' : 'ended'}>
          {paused ? 'Paused' : 'Ended'}
        </span>
        <span className="lg-archived-total">{money0(streamYearGross(stream, year))}</span>
      </ButtonBase>
      {open ? (
        <div className="lg-archived-menu" role="menu">
          <ButtonBase
            type="button"
            role="menuitem"
            onClick={() => { setOpen(false); onReturn(); }}
          >
            Return to ongoing
          </ButtonBase>
          <ButtonBase
            type="button"
            role="menuitem"
            className="lg-archived-menu-danger"
            disabled={stream.locked}
            title={stream.locked ? 'Unlock to remove' : undefined}
            onClick={() => { setOpen(false); onRemove(); }}
          >
            Remove
          </ButtonBase>
        </div>
      ) : null}
    </div>
  );
}

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
    <section className="lg-attention" aria-label="Months that need attention">
      <span className="lg-label lg-attention-title">Watch</span>
      <div className="lg-attention-rail">
        {flags.map((flag) => (
          <ButtonBase
            key={flag.month + flag.kind + flag.text}
            type="button"
            className="lg-attention-chip"
            data-kind={flag.kind}
            title={`${formatMonth(flag.month)}: ${flag.text}`}
            onClick={() => document.querySelector('.lg-analysis')?.scrollIntoView({ behavior: 'smooth' })}
          >
            <span className="lg-attention-month">{shortMonthName(flag.month).toUpperCase()}</span>
            <span>{flag.text}</span>
          </ButtonBase>
        ))}
      </div>
    </section>
  );
}
