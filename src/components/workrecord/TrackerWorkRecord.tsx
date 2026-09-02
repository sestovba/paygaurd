import { useEffect, useRef, useState } from 'react';
import {
  ChevronDown,
  ChevronsDown,
  ChevronsUp,
  Plus,
  Settings,
  TriangleAlert,
  Undo2,
  X
} from 'lucide-react';
import { useMonthScope, useTracker } from '../../state/TrackerProvider';
import { copyFor } from '../../domain/copy';
import { attentionFlags } from '../../domain/attention';
import { precisionFor } from '../../domain/precision';
import { PrecisionLine } from '../PrecisionLine';
import { useTheme } from '../../theme';
import { monthStatus, yearTotal } from '../../domain/earnings';
import {
  activeThreshold, benefitPhase, trialWorkStatus, TRIAL_MONTH_LIMIT
} from '../../domain/trialWork';
import { knownYears } from '../../domain/rules';
import {
  formatMonth, longMonthName, monthsOfYear, scopedMonths, shortMonthName, todayMonth, yearOf
} from '../../domain/months';
import { MonthScopePicker } from '../MonthScopePicker';
import { money } from '../../domain/format';
import type { MonthKey } from '../../domain/types';
import { SettingsPanel } from '../SettingsPanel';
import { ToastStack } from '../ToastStack';
import { NotificationsBell } from '../NotificationsBell';
import { MonthSheet } from '../MonthSheet';
import { StatusSheet } from '../StatusSheet';
import { PayGuardJobEditor } from '../payguard/PayGuardJobEditor';
import { importTrackerFile } from '../payguard/payguardData';
import { WorkRecordMonths } from './WorkRecordMonths';
import { WorkRecordStatus } from './WorkRecordStatus';

/**
 * Work Record — the sga_calc20 layout, rebuilt on this app's core.
 *
 * Its shape is a progressive headline over three collapsible slabs. The
 * headline answers "what does this month mean" before anything is opened;
 * below it, Active / Months / Status each carry a glance summary while closed,
 * so the page can be read at any level of expansion. That is the difference
 * from the PayGuard layout, which shows every section at once and navigates
 * between them on a phone.
 *
 * It borrows PayGuard's design system wholesale — the root element carries
 * both classes, so every token, button, card and the job editor come from
 * payguard.css and all five palettes work here unchanged. workrecord.css only
 * carries what this structure does differently.
 */
export function TrackerWorkRecord() {
  const {
    data, ui, setUi, addStream, removeStream, resetAll, replaceAll, undoCount, undo
  } = useTracker();
  useTheme(ui.theme);

  const { scope, setScope } = useMonthScope('many');
  const theme = ui.workRecordTheme ?? 'calc20';
  const year = ui.year;
  const years = knownYears();

  const [openMonth, setOpenMonth] = useState<MonthKey | null>(null);
  const [statusOpen, setStatusOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [addingOpen, setAddingOpen] = useState(false);
  const [hovered, setHovered] = useState<MonthKey | null>(null);
  const [collapsedIds, setCollapsedIds] = useState<Set<string>>(new Set());
  const fileInputRef = useRef<HTMLInputElement>(null);

  const streams = data.streams;
  const now = todayMonth();
  // A past year has no "current" month; its December is the honest as-of.
  const focusMonth = yearOf(now) === year ? now : monthsOfYear(year)[11];
  const status = monthStatus(data, focusMonth);
  const phase = benefitPhase(data, focusMonth);
  const twp = trialWorkStatus(data, focusMonth);
  const threshold = activeThreshold(data, focusMonth);
  const over = threshold ? status.countable > threshold.amount : false;
  const room = threshold ? Math.max(0, threshold.amount - status.countable) : 0;

  // Drop stale ids so a removed stream can't hold a collapsed slot forever.
  useEffect(() => {
    setCollapsedIds((current) => {
      const live = new Set(streams.map((s) => s.id));
      const next = new Set([...current].filter((id) => live.has(id)));
      return next.size === current.size ? current : next;
    });
  }, [streams]);

  const allCollapsed = streams.length > 0 && streams.every((s) => collapsedIds.has(s.id));

  function toggleCollapseAll() {
    setCollapsedIds(allCollapsed ? new Set() : new Set(streams.map((s) => s.id)));
  }

  function toggleOne(id: string) {
    setCollapsedIds((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  function addAndOpen(type: 'w2' | 'ten99') {
    const id = addStream(type);
    setAddingOpen(false);
    setUi({ wrStreamsOpen: true });
    setCollapsedIds((current) => {
      const next = new Set(current);
      next.delete(id);
      return next;
    });
    requestAnimationFrame(() => {
      document.getElementById(`pg-job-${id}`)?.scrollIntoView({ block: 'start' });
    });
  }

  function revealStream(id: string) {
    setUi({ wrStreamsOpen: true });
    setCollapsedIds((current) => {
      const next = new Set(current);
      next.delete(id);
      return next;
    });
    requestAnimationFrame(() => {
      document.getElementById(`pg-job-${id}`)?.scrollIntoView({ block: 'start' });
    });
  }

  // Glance summaries — shown only while a slab is closed.
  const streamsAside = streams.length
    ? `${streams.length} ${streams.length === 1 ? 'job' : 'jobs'}`
    : 'None yet';
  /* This one summarises the list inside the slab, so it follows the month
     dropdown rather than focus mode: naming a single month above nine rows
     of them was the old behaviour telling the truth about the wrong thing. */
  const monthsAside = scope === 'month'
    ? longMonthName(focusMonth)
    : `${money(yearTotal(data, year))} this year`;
  /* This one counts across a whole year, so focus mode replaces it with the
     one month on screen. The trial-months figure stays either way: nine
     months over a rolling five years is not a year statistic, it is the
     reason this month's limit is what it is. */
  const statusAside = phase === 'trialWork'
    ? `${twp.remaining} trial months left`
    : phase === 'sga'
      ? (ui.focusMode
        ? (monthStatus(data, focusMonth).overSga ? 'Over your limit' : 'Under your limit')
        : `${monthsOfYear(year).filter((m) => monthStatus(data, m).overSga).length} over your limit`)
      : 'Not set yet';

  return (
    <div className="pg-payguard pg-workrecord min-h-dvh" data-chrome-root data-payguard-theme={theme}>
      <a href="#wr-main" className="pg-skip-link">Skip to main content</a>
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
        <div className="mx-auto flex h-14 max-w-[74rem] items-center gap-2 px-3 sm:gap-3 sm:px-5">
          {/* The year lives in the stepper an inch away, so on a phone the
              title drops it rather than truncating itself out of existence. */}
          <div className="flex min-w-0 flex-col leading-tight">
            <span className="hidden text-[0.625rem] font-semibold uppercase tracking-wider pg-dim xs:block">
              SSDI income tracker
            </span>
            <h1 className="truncate text-sm font-bold tracking-tight pg-fg">
              <span className="hidden xs:inline">{year} </span>work record
            </h1>
          </div>

          {/*
            A select rather than PayGuard's stepper, as in the layout this was
            ported from. The stepper's two touch targets are 160px wide on a
            phone, which left the title nothing to truncate into.
          */}
          <select
            className="pg-select pg-mono ml-1 shrink-0 sm:ml-2"
            aria-label="Year"
            value={year}
            onChange={(e) => setUi({ year: Number(e.currentTarget.value) })}
          >
            {years.map((y) => <option key={y} value={y}>{y}</option>)}
          </select>

          <div className="flex-1" />

          <div className="flex shrink-0 items-center gap-1.5">
            <NotificationsBell
              open={notificationsOpen}
              onOpenChange={setNotificationsOpen}
              onSetPayday={revealStream}
              onReviewStream={revealStream}
              onOpenMonth={setOpenMonth}
              variant="summary"
            />

            <button
              type="button"
              className="pg-icon-btn pg-icon-btn-bordered"
              disabled={undoCount === 0}
              onClick={undo}
              aria-label={`Undo last change (${undoCount} available)`}
              title={undoCount ? `Undo last change (${undoCount})` : 'Nothing to undo'}
            >
              <Undo2 className="size-3.5" />
            </button>

            <button
              type="button"
              className="pg-icon-btn pg-icon-btn-bordered group"
              onClick={() => setSettingsOpen(true)}
              aria-label="Settings"
              title="Settings"
            >
              <Settings className="size-4 transition-transform duration-300 group-hover:rotate-45" />
            </button>
          </div>
        </div>
      </header>

      <main id="wr-main" className="wr-shell px-0 py-0 sm:px-5 sm:py-6">
        <div className="wr-sheet">
          {/* ---------------- Progressive headline ---------------- */}
          <div className="wr-headline">
            <div className="min-w-0">
              <span className="pg-label">{longMonthName(focusMonth)} countable</span>
              <div className="wr-headline-figure mt-1.5" data-over={over}>
                {money(status.countable)}
              </div>
              {threshold ? (
                <div className="wr-headline-of mt-1.5">
                  of {money(threshold.amount)}
                  {' · '}
                  {over
                    ? (threshold.kind === 'trialWork' ? 'one trial work month used' : 'over your limit')
                    : `${money(room)} of room`}
                </div>
              ) : (
                <button
                  type="button"
                  className="pg-btn mt-2.5"
                  onClick={() => setStatusOpen(true)}
                >
                  Tell us where you stand
                </button>
              )}
            </div>

            <div className="wr-standings">
              <div className="wr-standing">
                <span className="pg-label">
                  {phase === 'trialWork' ? 'Trial work months left'
                    : phase === 'sga' ? 'Your limit' : 'Your status'}
                </span>
                <span className="pg-figure pg-figure-md pg-accent">
                  {phase === 'trialWork' ? (
                    <>{twp.remaining}<span className="ml-1 text-xs font-semibold pg-dim">of {TRIAL_MONTH_LIMIT}</span></>
                  ) : phase === 'sga' ? money(threshold?.amount ?? 0)
                    : phase === 'verifyComplete' ? 'Check 9 months' : 'Not set yet'}
                </span>
              </div>
            </div>
          </div>

          {/* How far the headline figure can be trusted, and the one thing
              that would sharpen it. Same reading as every other layout. */}
          <div className="wr-precision">
            <PrecisionLine reading={precisionFor(data, yearOf(now) === year ? now : `${year}-12`)} />
          </div>

          {/* Review note: "We are repeating ourselves multiple times this is
              bad design, which one is it". When the status is simply unknown
              the headline above already carries the ask, as a button, in the
              highest-value spot on the screen — so this band said the same
              sentence a second time with a second button beside it. It is
              kept only for the one state the headline cannot say, which is
              that nine months are on record and want checking. */}
          {phase === 'verifyComplete' ? (
            <div className="wr-phase-warning">
              <span className="min-w-[16rem] flex-1">
                Nine trial work months are on record. Check them against your own
                paperwork — after that your limit changes.
              </span>
              <button type="button" className="pg-btn pg-btn-sm" onClick={() => setStatusOpen(true)}>
                Review status
              </button>
            </div>
          ) : null}

          <MonthHotbar onOpenMonth={setOpenMonth} />

          {/* ---------------- Slabs ---------------- */}
          <Slab
            title={copyFor('workrecord').income}
            bleed
            open={ui.wrStreamsOpen}
            onToggle={() => setUi({ wrStreamsOpen: !ui.wrStreamsOpen })}
            aside={streamsAside}
            action={ui.wrStreamsOpen && streams.length ? (
              <button
                type="button"
                className="pg-icon-btn pg-icon-btn-bordered"
                onClick={toggleCollapseAll}
                aria-label={allCollapsed ? 'Expand all jobs' : 'Collapse all jobs'}
                title={allCollapsed ? 'Expand all' : 'Collapse all'}
              >
                {allCollapsed ? <ChevronsDown className="size-3.5" /> : <ChevronsUp className="size-3.5" />}
              </button>
            ) : null}
          >
            <div className="flex flex-col gap-3">
              {streams.map((stream) => (
                <PayGuardJobEditor
                  key={stream.id}
                  stream={stream}
                  year={year}
                  open={!collapsedIds.has(stream.id)}
                  onToggleOpen={() => toggleOne(stream.id)}
                  onRemove={stream.locked ? undefined : () => {
                    if (!confirm(`Remove "${stream.name}"?`)) return;
                    removeStream(stream.id);
                  }}
                />
              ))}

              {addingOpen ? (
                <div className="pg-card flex flex-wrap items-center gap-2 p-3">
                  <span className="pg-label">Add</span>
                  <button type="button" className="pg-btn pg-text-w2" onClick={() => addAndOpen('w2')}>
                    <Plus className="size-3.5" /> W-2 job
                  </button>
                  <button type="button" className="pg-btn pg-text-se" onClick={() => addAndOpen('ten99')}>
                    <Plus className="size-3.5" /> 1099 work
                  </button>
                  <button
                    type="button"
                    className="pg-icon-btn"
                    onClick={() => setAddingOpen(false)}
                    aria-label="Cancel"
                  >
                    <X className="size-3.5" />
                  </button>
                </div>
              ) : streams.length ? (
                <button
                  type="button"
                  className="pg-btn w-full justify-center"
                  onClick={() => setAddingOpen(true)}
                >
                  {/* Review note: "That is a long button". It is the word
                      from the shared vocabulary now, so the next time you
                      want it changed it changes in one file. */}
                  <Plus className="size-3.5" /> {copyFor('workrecord').incomeAdd}
                </button>
              ) : (
                <div className="pg-card flex flex-col items-center gap-3 p-6 text-center">
                  <span className="pg-empty-title">Nothing here yet</span>
                  <span className="pg-empty-body max-w-md">
                    Add what pays you and we can start counting it against your limit.
                  </span>
                  <div className="mt-1 flex flex-wrap justify-center gap-2">
                    <button type="button" className="pg-btn pg-btn-lg pg-btn-solid" onClick={() => addAndOpen('w2')}>
                      <Plus className="size-3.5" /> Add W-2 job
                    </button>
                    <button type="button" className="pg-btn pg-btn-lg" onClick={() => addAndOpen('ten99')}>
                      <Plus className="size-3.5" /> Add 1099 work
                    </button>
                  </div>
                </div>
              )}
            </div>
          </Slab>

          <Slab
            title="Monthly history"
            bleed
            open={ui.wrMonthsOpen}
            onToggle={() => setUi({ wrMonthsOpen: !ui.wrMonthsOpen })}
            aside={monthsAside}
            action={ui.wrMonthsOpen ? (
              /* "Show future" was two of the four things a reader wants to
                 say about this list. It is the whole set now, and it moves
                 every month list on the layout rather than this one. */
              <MonthScopePicker
                scope={scope}
                onChange={setScope}
                className="pg-field pg-field-sm"
              />
            ) : null}
          >
            <WorkRecordMonths hovered={hovered} onHover={setHovered} onOpenMonth={setOpenMonth} />
          </Slab>

          <Slab
            title="Where you stand"
            bleed
            open={ui.wrStatusOpen}
            onToggle={() => setUi({ wrStatusOpen: !ui.wrStatusOpen })}
            aside={statusAside}
          >
            <WorkRecordStatus onReviewStatus={() => setStatusOpen(true)} />
          </Slab>
        </div>
      </main>

      {openMonth ? (
        <MonthSheet month={openMonth} onClose={() => setOpenMonth(null)} onOpenStream={revealStream} />
      ) : null}
      {statusOpen ? <StatusSheet onClose={() => setStatusOpen(false)} /> : null}
      <ToastStack />

      {settingsOpen ? (
        <SettingsPanel
          theme={ui.theme}
          onTheme={(nextTheme) => setUi({ theme: nextTheme })}
          onOpenStatus={() => { setSettingsOpen(false); setStatusOpen(true); }}
          onReset={() => { resetAll(); setSettingsOpen(false); }}
          onClose={() => setSettingsOpen(false)}
          layout={ui.layout}
          onLayoutChange={(layout) => setUi({ layout })}
          subTheme={theme}
          onSubThemeChange={(workRecordTheme) => setUi({ workRecordTheme })}
        />
      ) : null}
    </div>
  );
}

/**
 * One disclosure section. Closed, it shows its glance summary; open, it shows
 * its content and whatever action belongs to it. The action lives outside the
 * toggle button rather than inside it — a button inside a button is invalid,
 * and it must not swallow the click that opens the slab.
 */
function Slab({
  title, open, onToggle, aside, action, bleed, children
}: {
  title: string;
  open: boolean;
  onToggle: () => void;
  aside: string;
  action?: React.ReactNode;
  /** Review note: "This should full bleed edge to edge". The job cards carry
   *  their own edges, so the slab's side padding was a second frame drawn
   *  inside the first one. */
  bleed?: boolean;
  children: React.ReactNode;
}) {
  return (
    <section className="wr-slab">
      <div className="wr-slab-head">
        <button type="button" className="wr-slab-head-toggle" aria-expanded={open} onClick={onToggle}>
          <ChevronDown className="wr-slab-chevron size-4" data-open={open} aria-hidden="true" />
          <span className="wr-slab-title">{title}</span>
          {!open ? <span className="wr-slab-aside">{aside}</span> : null}
        </button>
        {action}
      </div>
      {open ? <div className="wr-slab-body" data-bleed={bleed || undefined}>{children}</div> : null}
    </section>
  );
}

/**
 * Months that need attention, above everything collapsible — the point is to
 * be seen without opening anything. A clean year renders nothing at all.
 */
function MonthHotbar({ onOpenMonth }: { onOpenMonth: (month: MonthKey) => void }) {
  const { data, ui } = useTracker();
  const { scope } = useMonthScope('many');
  /* This strip is about months that have not happened yet, so it looks
     forward whatever else is on screen — the one exception is "This month",
     where the reader has asked for one month and nothing else. */
  const months = scopedMonths(ui.year, scope === 'month' ? 'month' : 'ahead');
  // The rule for what needs attention is shared with the ledger, payguard and
  // calc20 — see src/domain/attention.ts. Only the clothes are local.
  const flags = attentionFlags(data, months);

  if (!flags.length) return null;

  return (
    <div className="wr-hotbar" role="region" aria-label="Months that need attention">
      <TriangleAlert className="size-4 shrink-0 pg-muted" aria-hidden="true" />
      <div className="wr-hotbar-rail">
        {flags.map((flag) => (
          <button
            key={flag.month + flag.kind + flag.text}
            type="button"
            className="wr-hotbar-chip"
            data-kind={flag.kind}
            title={`${formatMonth(flag.month)}: ${flag.text}`}
            onClick={() => onOpenMonth(flag.month)}
          >
            <span className="wr-hotbar-chip-month">{shortMonthName(flag.month).toUpperCase()}</span>
            <span>{flag.text}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
