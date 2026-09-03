import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Bell,
  BriefcaseBusiness,
  CalendarClock,
  ChevronLeft,
  ChevronRight,
  LayoutGrid,
  PanelLeft,
  Plus,
  Settings,
  ShieldCheck,
  TrendingUp,
  WalletCards,
  Zap
} from 'lucide-react';
import { BrandMark, Chip } from '../ui';
import type { LucideIcon } from 'lucide-react';
import { useTracker } from '../../state/TrackerProvider';
import { copyFor, SOURCE_CHOICE } from '../../domain/copy';
import { useTheme } from '../../theme';
import { knownYears } from '../../domain/rules';
import { actionItems } from '../../domain/notifications';
import { formatMonth } from '../../domain/months';
import { ActionBanner } from '../ActionBanner';
import { MonthGrid } from '../MonthGrid';

import { PaycheckRadar } from '../PaycheckRadar';
import { SafetyHero } from '../SafetyHero';
import { ToastStack } from '../ToastStack';
import { Sheet } from '../Sheet';
import { StatusPage } from '../StatusPage';
import { StreamsPanel } from '../StreamsPanel';
import { YearTotal } from '../YearTotal';
import { Detail } from './detail';
import type { DetailRequest } from './detail';
import type { StreamType } from '../../domain/types';
import { ReviewTarget } from '../../review/ReviewTarget';

type PageId = 'overview' | 'income' | 'status';

/** The six every shell offers, plus the two only a workspace has. */
type PaneRequest =
  | DetailRequest
  | { kind: 'notifications' }
  | { kind: 'newSource' };

/**
 * The same surfaces again, as a retained workspace rather than a collection
 * of dialogs. The page is step 1, a contextual task is step 2, and a child task
 * (Month -> Source, Quick fix -> Full source, New entry -> Source) is step 3.
 * Every pane stays in normal document flow, so opening one always reflows the
 * available width instead of covering the page underneath it.
 */
export function WorkspaceShell() {
  const { data, ui, setUi, addStream } = useTracker();
  useTheme(ui.theme, ui.palette);

  /* Review note: "great location for settings, but our sidebar hides with no
     way to bring it back out — no show sidebar toggle anywhere. Only if that
     exists can this setting stay here."

     The sidebar was presentation only: it appeared at lg and vanished below
     it, with no control at any width. It is a thing you own now, and — this
     is the part worth getting right — the button means the same thing at
     every width. A toggle whose label is true on a laptop and false on a
     tablet is worse than no toggle. So the state is a plain boolean that only
     *starts* from the viewport (open on a wide screen, closed on a narrow
     one); after that the button decides, and the sidebar floats over the page
     where there is no room for it in the flow. */
  const [sidebarOpen, setSidebarOpen] = useState(
    () => window.matchMedia('(min-width: 1024px)').matches
  );
  const [page, setPage] = useState<PageId>('overview');
  const [panes, setPanes] = useState<PaneRequest[]>([]);
  const activeRegionRef = useRef<HTMLElement | null>(null);
  const years = knownYears();
  const yearIndex = years.indexOf(ui.year);

  /* Named for what it tells you, not for the two rules behind it. */
  const statusLabel = 'Your limit';

  const navItems: { id: PageId; label: string; icon: LucideIcon }[] = useMemo(() => [
    { id: 'overview', label: 'Overview', icon: LayoutGrid },
    { id: 'income', label: 'Income', icon: BriefcaseBusiness },
    { id: 'status', label: statusLabel, icon: ShieldCheck }
  ], []);

  function pageLabel(p: PageId): string {
    return navItems.find((item) => item.id === p)?.label ?? 'Overview';
  }

  const streamNameById = useMemo(
    () => new Map(data.streams.map((stream) => [stream.id, stream.name])),
    [data.streams]
  );

  function paneLabel(pane: PaneRequest): string {
    if (pane.kind === 'month') return formatMonth(pane.month);
    if (pane.kind === 'stream') return streamNameById.get(pane.streamId) ?? 'Income source';
    if (pane.kind === 'payday') return 'Set a payday';
    if (pane.kind === 'quiz') return 'Where you stand';
    if (pane.kind === 'verify') return 'Review status';
    if (pane.kind === 'settings') return 'Settings';
    if (pane.kind === 'notifications') return 'Activity';
    return 'New income source';
  }

  /* The sidebar is in the page flow at lg and above and over the page below
     it. Only the second kind should close itself when you use it. */
  function closeIfFloating() {
    if (!window.matchMedia('(min-width: 1024px)').matches) setSidebarOpen(false);
  }

  function navigate(next: PageId) {
    setPanes([]);
    setPage(next);
  }

  function openPane(next: PaneRequest) {
    setPanes([next]);
  }

  function pushPane(parentIndex: number, next: PaneRequest) {
    setPanes((current) => [...current.slice(0, parentIndex + 1), next].slice(0, 2));
  }

  function closeFrom(index: number) {
    setPanes((current) => current.slice(0, index));
  }

  function replacePane(index: number, next: PaneRequest) {
    setPanes((current) => [...current.slice(0, index), next]);
  }

  function addAndOpen(type: StreamType, parentIndex: number) {
    const streamId = addStream(type);
    pushPane(parentIndex, { kind: 'stream', streamId });
  }

  const selectedStreamId = [...panes]
    .reverse()
    .find((pane): pane is Extract<PaneRequest, { kind: 'stream' | 'payday' }> => (
      pane.kind === 'stream' || pane.kind === 'payday'
    ))?.streamId;

  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      activeRegionRef.current?.focus({ preventScroll: true });
    });
    return () => cancelAnimationFrame(frame);
  }, [page, panes]);

  const deckClass = panes.length === 0
    ? 'grid-cols-1'
    : panes.length === 1
      ? 'grid-cols-1 md:grid-cols-[minmax(17rem,0.78fr)_minmax(24rem,1.22fr)] xl:grid-cols-[minmax(21rem,0.72fr)_minmax(32rem,1.28fr)]'
      : 'grid-cols-1 md:grid-cols-[minmax(17rem,0.72fr)_minmax(24rem,1.28fr)] xl:grid-cols-[minmax(16rem,0.62fr)_minmax(18rem,0.72fr)_minmax(25rem,1.66fr)]';

  return (
    <div className="flex h-dvh overflow-hidden bg-background" data-chrome-root>
      <DesktopSidebar
        page={page}
        navItems={navItems}
        open={sidebarOpen}
        {...{
          /* Picking something closes the sidebar only when it is covering the
             page. On a wide screen it is part of the layout, and having it
             vanish because you used it would be a bug wearing a feature's
             clothes. */
        }}
        onNavigate={(next) => { closeIfFloating(); navigate(next); }}
        onNewEntry={() => { closeIfFloating(); openPane({ kind: 'newSource' }); }}
        onSettings={() => { closeIfFloating(); openPane({ kind: 'settings' }); }}
        onClose={() => setSidebarOpen(false)}
      />

      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <header className="app-bar relative z-10 shrink-0 border-b">
          <div className="flex min-h-16 items-center gap-3 px-3 sm:px-5 lg:px-6">
            <button
              type="button"
              aria-label={sidebarOpen ? 'Hide the sidebar' : 'Show the sidebar'}
              aria-expanded={sidebarOpen}
              onClick={() => setSidebarOpen((v) => !v)}
              className="icon-btn grid shrink-0 border border-border bg-surface text-muted-foreground hover:bg-muted hover:text-foreground"
            >
              <PanelLeft className="size-5" />
            </button>

            <div className="flex min-w-0 flex-1 items-center gap-2.5 lg:hidden">
              <BrandMark onClick={() => navigate('overview')} />
            </div>

            <div className="hidden min-w-0 flex-1 lg:block">
              <ReviewTarget
                id="v3-journey-trail"
                label="Numbered workspace trail"
                reason="The numbered steps explain the interface instead of the user's TWP, SGA, or paycheck risk."
                layout="responsive"
              >
                <JourneyTrail
                  page={page}
                  panes={panes}
                  paneLabel={paneLabel}
                  statusLabel={statusLabel}
                  onStep={(index) => setPanes((current) => current.slice(0, index))}
                />
              </ReviewTarget>
            </div>

            <YearPicker
              year={ui.year}
              years={years}
              yearIndex={yearIndex}
              onYear={(year) => setUi({ year })}
            />

            <button
              type="button"
              aria-label="Notifications and activity"
              onClick={() => {
                setUi({ notificationsViewedAt: new Date().toISOString() });
                openPane({ kind: 'notifications' });
              }}
              className="icon-btn grid relative border border-border bg-surface text-muted-foreground hover:bg-muted hover:text-foreground"
            >
              <Bell className="size-5" />
              <NotificationDot />
            </button>

            {/* Review note: "the theme switcher should be removed but the gear
                icon should stay", and the gear "is there at a wider view but
                disappears at a narrow view". Light/dark is a preference, and
                it already has a home in Settings; a benefits tracker's header
                is not the place to spend a slot on it.

                The gear's own gap was real and narrow: it was `lg:grid`, and
                the bottom bar that carries Settings on a phone is `md:hidden`,
                so between those two widths there was no way into Settings at
                all. It starts at `md` now, which closes that band without
                putting a second Settings button next to the one in the bottom
                bar on a phone. */}
            <button
              type="button"
              aria-label="Settings"
              onClick={() => openPane({ kind: 'settings' })}
              className="icon-btn hidden border border-border bg-surface text-muted-foreground hover:bg-muted hover:text-foreground md:grid"
            >
              <Settings className="size-5" />
            </button>
          </div>

          <div className="border-t border-border/70 px-3 py-2.5 sm:px-5 lg:hidden">
            <ReviewTarget
              id="v3-journey-trail"
              label="Numbered workspace trail"
              reason="The numbered steps explain the interface instead of the user's TWP, SGA, or paycheck risk."
              layout="responsive"
            >
              <JourneyTrail
                page={page}
                panes={panes}
                paneLabel={paneLabel}
                statusLabel={statusLabel}
                onStep={(index) => setPanes((current) => current.slice(0, index))}
                compact
              />
            </ReviewTarget>
          </div>

          <TabletNav page={page} navItems={navItems} onNavigate={navigate} />
        </header>

        <main className={`grid min-h-0 flex-1 overflow-hidden transition-[grid-template-columns] duration-300 motion-reduce:transition-none ${deckClass}`}>
          <RootPane
            page={page}
            statusLabel={statusLabel}
            hasDetail={panes.length > 0}
            hiddenAtTablet={panes.length === 2}
            selectedStreamId={selectedStreamId}
            onOpen={openPane}
            activeRef={panes.length === 0 ? (node) => { activeRegionRef.current = node; } : undefined}
          />

          {panes.map((pane, index) => {
            const parentLabel = index === 0 ? pageLabel(page) : paneLabel(panes[index - 1]);
            const hideBelowLarge = index === 0 && panes.length === 2;
            return (
              <div
                key={`${pane.kind}-${index}-${'month' in pane ? pane.month : 'streamId' in pane ? pane.streamId : ''}`}
                ref={index === panes.length - 1 ? (node) => { activeRegionRef.current = node; } : undefined}
                role="region"
                aria-label={paneLabel(pane)}
                tabIndex={index === panes.length - 1 ? -1 : undefined}
                className={
                  'v3-workspace-pane min-h-0 min-w-0 overflow-hidden border-l border-border bg-surface focus:outline-none motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-right-3 motion-safe:duration-300 '
                  + (hideBelowLarge ? 'hidden md:block ' : '')
                  + (panes.length === 2 && index === 0 ? 'xl:block ' : '')
                }
              >
                <PaneContent
                  pane={pane}
                  index={index}
                  backLabel={parentLabel}
                  onClose={() => closeFrom(index)}
                  onPush={(next) => pushPane(index, next)}
                  onReplace={(next) => replacePane(index, next)}
                  onAddSource={(type) => addAndOpen(type, index)}
                  onNavigate={navigate}
                />
              </div>
            );
          })}
        </main>

        <MobileNav
          page={page}
          navItems={navItems}
          settingsOpen={panes[panes.length - 1]?.kind === 'settings'}
          onNavigate={navigate}
          onSettings={() => openPane({ kind: 'settings' })}
        />
      </div>
      <ToastStack />
    </div>
  );
}

function RootPane({
  page,
  statusLabel,
  hasDetail,
  hiddenAtTablet,
  selectedStreamId,
  onOpen,
  activeRef
}: {
  page: PageId;
  statusLabel: string;
  hasDetail: boolean;
  hiddenAtTablet: boolean;
  selectedStreamId?: string;
  onOpen: (pane: PaneRequest) => void;
  activeRef?: (node: HTMLElement | null) => void;
}) {
  const rootVisibility = hiddenAtTablet
    ? 'hidden xl:flex'
    : hasDetail ? 'hidden md:flex' : 'flex';

  if (page === 'income') {
    return (
      <section
        ref={activeRef}
        role="region"
        aria-label={copyFor('overview').income}
        tabIndex={activeRef ? -1 : undefined}
        className={`${rootVisibility} min-h-0 min-w-0 flex-col bg-background focus:outline-none ${hasDetail ? 'overflow-hidden' : 'overflow-y-auto'}`}
      >
        <div className={hasDetail ? 'p-4 sm:p-5' : 'p-4 sm:p-6 xl:p-8'}>
          <RootHeading
            eyebrow="Jobs"
            title="Income"
            description={hasDetail ? 'Pick another job.' : 'Everything that pays you, and what you have earned from each.'}
            compact={hasDetail}
          />
        </div>
        <div className={hasDetail ? 'min-h-0 flex-1 border-t border-border bg-surface' : 'border-t border-border bg-surface'}>
          <StreamsPanel
            onOpenStream={(streamId) => onOpen({ kind: 'stream', streamId })}
            selectedId={selectedStreamId}
            compact
            fill={hasDetail}
          />
        </div>
      </section>
    );
  }

  return (
    <section
      ref={activeRef}
      role="region"
      aria-label={page === 'overview' ? 'Overview' : statusLabel}
      tabIndex={activeRef ? -1 : undefined}
      className={`${rootVisibility} v3-root-pane min-h-0 min-w-0 flex-col overflow-y-auto bg-background focus:outline-none`}
    >
      <div className={hasDetail ? 'p-4 sm:p-5' : 'p-4 sm:p-6 xl:p-8'}>
        <RootHeading
          eyebrow={page === 'overview' ? 'Home' : undefined}
          title={page === 'overview' ? 'Overview' : statusLabel}
          /* "what is left" left out what it was left of, on the sentence
             that introduces the whole screen. */
          description={page === 'overview'
            ? 'What you have earned this month, how much more you can earn, and the months that pay you extra.'
            : 'What you can earn this month, and what you have earned so far.'}
          compact={hasDetail}
        />

        {page === 'overview' ? (
          <div className={`${hasDetail ? 'v3-context-grid mt-5 grid gap-4' : 'mt-6 grid gap-4 lg:gap-6 xl:grid-cols-12'}`}>
            <ActionBanner
              onSetPayday={(streamId) => onOpen({ kind: 'payday', streamId })}
              onReviewStream={(streamId) => onOpen({ kind: 'stream', streamId })}
              onOpenMonth={(month) => onOpen({ kind: 'month', month })}
            />
            <SafetyHero
              onTakeQuiz={() => onOpen({ kind: 'quiz' })}
              onReviewStatus={() => onOpen({ kind: 'verify' })}
              onFixStream={(gap) => onOpen(gap.kind === 'schedule'
                ? { kind: 'payday', streamId: gap.streamId }
                : { kind: 'stream', streamId: gap.streamId })}
            />
            <PaycheckRadar
              onOpenMonth={(month) => onOpen({ kind: 'month', month })}
              onCheckNotifications={() => onOpen({ kind: 'notifications' })}
              onSetPayday={(streamId) => onOpen({ kind: 'payday', streamId })}
            />
            <ReviewTarget
              id="v3-overview-month-grid"
              label="Full-year month grid"
              reason="This repeats the active monthly limit across twelve tiles instead of focusing on 3-/5-paycheck and risk months."
              layout="responsive"
              className="xl:col-span-12"
            >
              <MonthGrid onOpenMonth={(month) => onOpen({ kind: 'month', month })} />
            </ReviewTarget>
            <ReviewTarget
              id="v3-overview-year-total"
              label="Annual total"
              reason="Annualizing a monthly SSA threshold can hide a risky month and adds no 3-/5-paycheck guidance."
              layout="responsive"
              className="xl:col-span-12"
            >
              <YearTotal />
            </ReviewTarget>
          </div>
        ) : (
          <div className={`mt-5 ${hasDetail ? 'v3-status-context' : ''}`}>
            <StatusPage />
          </div>
        )}
      </div>
    </section>
  );
}

/**
 * What goes in a pane.
 *
 * Six of the eight are the six every shell offers, and they come from the
 * shared renderer in ./detail.tsx. The two that do not are the two only a
 * workspace has: an activity log you can keep open beside the page, and the
 * picker for a source you are adding. Those stay here.
 *
 * The workspace's own rule about children lives in `onChild`: a detail
 * opened from the FIRST pane pushes a second one beside it, and one opened
 * from the second replaces it — two panes is as deep as the deck goes.
 */
function PaneContent({
  pane,
  index,
  backLabel,
  onClose,
  onPush,
  onReplace,
  onAddSource,
  onNavigate
}: {
  pane: PaneRequest;
  index: number;
  backLabel: string;
  onClose: () => void;
  onPush: (pane: PaneRequest) => void;
  onReplace: (pane: PaneRequest) => void;
  onAddSource: (type: StreamType) => void;
  onNavigate: (page: PageId) => void;
}) {
  if (pane.kind === 'notifications') {
    return (
      <ActivityPane
        backLabel={backLabel}
        onClose={onClose}
        onOpen={(next) => index < 1 ? onPush(next) : undefined}
      />
    );
  }

  if (pane.kind === 'newSource') {
    return <NewSourcePane backLabel={backLabel} onClose={onClose} onChoose={onAddSource} />;
  }

  return (
    <Detail
      request={pane}
      variant="inline"
      backLabel={backLabel}
      onClose={onClose}
      onChild={(next) => (index < 1 ? onPush(next) : onReplace(next))}
      onOpenStatus={() => onNavigate('status')}
      /* A retained pane keeps the quick payday fix as the parent of the full
         editor, rather than closing it on the way. */
      closeBeforeEdit={false}
    />
  );
}

function DesktopSidebar({
  page,
  navItems,
  open,
  onNavigate,
  onNewEntry,
  onSettings,
  onClose
}: {
  page: PageId;
  navItems: { id: PageId; label: string; icon: LucideIcon }[];
  /** Opened by the header's toggle. Below lg it floats over the page; at lg
   *  and above the sidebar is shown by default and this hides it. */
  open: boolean;
  onNavigate: (page: PageId) => void;
  onNewEntry: () => void;
  onSettings: () => void;
  onClose: () => void;
}) {
  return (
    <>
      {open ? (
        <button
          type="button"
          aria-label="Close the sidebar"
          onClick={onClose}
          className="fixed inset-0 z-20 bg-black/30 lg:hidden"
        />
      ) : null}
      <aside
        className={
          'h-dvh w-60 shrink-0 flex-col border-r border-border bg-surface 2xl:w-64 '
          + (open
            ? 'fixed inset-y-0 left-0 z-30 flex lg:static lg:z-auto '
            : 'hidden ')
        }
      >
      <div className="flex h-20 items-center border-b border-border px-5">
        <BrandMark onClick={() => onNavigate('overview')} subtitle="Stay under the limit" />
      </div>

      <div className="p-4">
        <button
          type="button"
          onClick={onNewEntry}
          className="btn-primary flex w-full items-center justify-center gap-2 shadow-[var(--shadow-lime)]"
        >
          <Plus className="size-5" /> Add income
        </button>
      </div>

      <nav className="flex flex-col gap-1 px-3" aria-label="Primary">
        {navItems.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            type="button"
            aria-current={page === id ? 'page' : undefined}
            onClick={() => onNavigate(id)}
            className="nav-item"
          >
            <Icon className="size-[18px] shrink-0" />
            {label}
          </button>
        ))}
      </nav>

      <div className="mt-auto border-t border-border p-4">
        <button
          type="button"
          onClick={onSettings}
          className="nav-item w-full"
        >
          <Settings className="size-[18px] shrink-0" /> Settings
        </button>
      </div>
      </aside>
    </>
  );
}

function TabletNav({
  page,
  navItems,
  onNavigate
}: {
  page: PageId;
  navItems: { id: PageId; label: string; icon: LucideIcon }[];
  onNavigate: (page: PageId) => void;
}) {
  return (
    <nav className="hidden items-center gap-1 border-t border-border-soft px-4 py-2 md:flex lg:hidden" aria-label="Primary">
      {navItems.map(({ id, label, icon: Icon }) => (
        <button
          key={id}
          type="button"
          aria-current={id === page ? 'page' : undefined}
          onClick={() => onNavigate(id)}
          className="nav-item"
        >
          <Icon className="size-[18px] shrink-0" /> {label}
        </button>
      ))}
    </nav>
  );
}

function MobileNav({
  page,
  navItems,
  settingsOpen,
  onNavigate,
  onSettings
}: {
  page: PageId;
  navItems: { id: PageId; label: string; icon: LucideIcon }[];
  settingsOpen: boolean;
  onNavigate: (page: PageId) => void;
  onSettings: () => void;
}) {
  return (
    <nav
      className="app-bar grid shrink-0 grid-cols-4 border-t pb-safe md:hidden"
      aria-label="Primary"
    >
      {navItems.map(({ id, label, icon: Icon }) => {
        const active = id === page && !settingsOpen;
        return (
          <button
            key={id}
            type="button"
            aria-current={active ? 'page' : undefined}
            onClick={() => onNavigate(id)}
            className="nav-tab"
          >
            <span className="nav-tab-mark">
              <Icon className="size-[18px]" />
            </span>
            <span className="truncate">{label}</span>
          </button>
        );
      })}
      <button
        type="button"
        aria-current={settingsOpen ? 'page' : undefined}
        onClick={onSettings}
        className="nav-tab"
      >
        <span className="nav-tab-mark">
          <Settings className="size-[18px]" />
        </span>
        <span>Settings</span>
      </button>
    </nav>
  );
}

function JourneyTrail({
  page,
  panes,
  paneLabel,
  onStep,
  statusLabel = 'Your limit',
  compact = false
}: {
  page: PageId;
  panes: PaneRequest[];
  paneLabel: (pane: PaneRequest) => string;
  onStep: (index: number) => void;
  statusLabel?: string;
  compact?: boolean;
}) {
  const rootLabel = page === 'overview' ? 'Overview' : page === 'income' ? 'Income' : statusLabel;
  const labels = [rootLabel, ...panes.map(paneLabel)];
  return (
    <nav className="flex min-w-0 items-center gap-1 text-sm font-medium" aria-label="Workspace breadcrumb">
      {labels.map((label, index) => {
        const isCurrent = index === labels.length - 1;
        return (
          <div key={`${label}-${index}`} className="flex min-w-0 items-center gap-1">
            {index > 0 ? (
              <ChevronRight className="size-4 shrink-0 text-muted-foreground/50" aria-hidden="true" />
            ) : null}
            <button
              type="button"
              aria-current={isCurrent ? 'page' : undefined}
              onClick={() => onStep(index)}
              className={
                'truncate rounded-md px-2 py-1 transition-colors '
                + (compact && index < labels.length - 1 ? 'hidden sm:inline-block ' : '')
                + (isCurrent
                  ? 'font-semibold text-foreground'
                  : 'text-muted-foreground hover:bg-muted hover:text-foreground')
              }
            >
              {label}
            </button>
          </div>
        );
      })}
    </nav>
  );
}

function YearPicker({
  year,
  years,
  yearIndex,
  onYear
}: {
  year: number;
  years: number[];
  yearIndex: number;
  onYear: (year: number) => void;
}) {
  return (
    <div className="flex shrink-0 items-center rounded-xl border border-border bg-surface p-1">
      <button
        type="button"
        aria-label="Previous year"
        disabled={yearIndex <= 0}
        onClick={() => onYear(years[yearIndex - 1])}
        className="grid size-7 place-items-center rounded-lg text-muted-foreground transition-colors hover:bg-muted disabled:opacity-30"
      >
        <ChevronLeft className="size-3.5" />
      </button>
      <span className="num min-w-11 px-1 text-center text-xs font-bold">{year}</span>
      <button
        type="button"
        aria-label="Next year"
        disabled={yearIndex >= years.length - 1}
        onClick={() => onYear(years[yearIndex + 1])}
        className="grid size-7 place-items-center rounded-lg text-muted-foreground transition-colors hover:bg-muted disabled:opacity-30"
      >
        <ChevronRight className="size-3.5" />
      </button>
    </div>
  );
}

function RootHeading({
  eyebrow,
  title,
  description,
  compact
}: {
  eyebrow?: string;
  title: string;
  description: string;
  compact: boolean;
}) {
  return (
    <div className={compact ? '' : 'max-w-2xl'}>
      {eyebrow ? <p className="label-caps text-accent-foreground">{eyebrow}</p> : null}
      <h1 className={`display-figure mt-1 ${compact ? 'text-3xl' : 'text-4xl sm:text-5xl'}`}>{title}</h1>
      <p className="type-muted mt-2">{description}</p>
    </div>
  );
}

function NewSourcePane({
  backLabel,
  onClose,
  onChoose
}: {
  backLabel: string;
  onClose: () => void;
  onChoose: (type: StreamType) => void;
}) {
  return (
    /* v3-new-source-tutorial, and the reviewer could not find it: "I cant see
       it, I am not sure what is being talked about." It is the Add income
       sheet, and it carried four layers of narration over two buttons — an
       eyebrow naming the genre, a title, a subtitle restating the two buttons
       below it, and a numbered list whose step 01 was the thing you were
       being asked to do at that moment and whose step 03 was not an action at
       all. The eyebrow, the subtitle and the list are gone.

       The labels mattered more than any of that. They read "W-2 employee" and
       "1099 contract" — the pair SOURCE_CHOICE exists to prevent, because a
       driver does not know which one they are, picks the first, and loses the
       mileage deduction only the second one has. */
    <Sheet
      title="Add income"
      variant="inline"
      backLabel={backLabel}
      onClose={onClose}
    >
      <div className="v3-source-choices grid gap-3">
        <SourceChoice
          icon={WalletCards}
          label={SOURCE_CHOICE.w2.label}
          description={SOURCE_CHOICE.w2.description}
          tone="good"
          onClick={() => onChoose('w2')}
        />
        <SourceChoice
          icon={BriefcaseBusiness}
          label={SOURCE_CHOICE.ten99.label}
          description={SOURCE_CHOICE.ten99.description}
          tone="info"
          onClick={() => onChoose('ten99')}
        />
      </div>
    </Sheet>
  );
}

function SourceChoice({
  icon: Icon,
  label,
  description,
  tone,
  onClick
}: {
  icon: LucideIcon;
  label: string;
  description: string;
  tone: 'good' | 'info';
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="group flex min-h-36 flex-col items-start justify-between rounded-2xl border border-border bg-surface-2 p-4 text-left transition-all hover:-translate-y-0.5 hover:border-primary hover:shadow-card"
    >
      <span className={`grid size-10 place-items-center rounded-xl ${tone === 'good' ? 'bg-good-soft text-good-text' : 'bg-info-soft text-info-text'}`}>
        <Icon className="size-5" />
      </span>
      <span>
        <span className="flex items-center gap-1.5 text-base font-semibold">
          {label} <ChevronRight className="size-4 transition-transform group-hover:translate-x-1" />
        </span>
        <span className="mt-1 block text-sm text-muted-foreground">{description}</span>
      </span>
    </button>
  );
}

function ActivityPane({
  backLabel,
  onClose,
  onOpen
}: {
  backLabel: string;
  onClose: () => void;
  onOpen: (pane: PaneRequest) => void;
}) {
  const { data, ui } = useTracker();
  const items = actionItems(data, ui.year, ui.focusMode);
  const activity = [...data.activity].reverse();

  function resolve(item: ReturnType<typeof actionItems>[number]) {
    if (item.action.kind === 'setPayday') onOpen({ kind: 'payday', streamId: item.action.streamId });
    else if (item.action.kind === 'reviewStream') onOpen({ kind: 'stream', streamId: item.action.streamId });
    else onOpen({ kind: 'month', month: item.action.month });
  }

  return (
    <Sheet
      title="What needs you"
      variant="inline"
      backLabel={backLabel}
      onClose={onClose}
    >
      <section>
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-base font-semibold">Needs attention</h2>
          <Chip tone="warn">{items.length}</Chip>
        </div>
        {items.length ? (
          <ul className="mt-3 space-y-2">
            {items.map((item) => {
              const Icon = item.action.kind === 'setPayday'
                ? CalendarClock
                : item.action.kind === 'reviewStream' ? TrendingUp : Zap;
              return (
                <li key={item.id}>
                  <button
                    type="button"
                    onClick={() => resolve(item)}
                    className="flex w-full items-start gap-3 rounded-xl border border-border bg-surface-2 p-3 text-left transition-colors hover:border-primary hover:bg-muted"
                  >
                    <Icon className={'mt-0.5 size-4 shrink-0 ' + (item.severity === 'warn' ? 'text-warn-foreground' : 'text-info')} />
                    <span className="min-w-0 flex-1 text-base leading-relaxed">{item.message}</span>
                    <ChevronRight className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                  </button>
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="type-muted mt-3 rounded-lg border border-dashed border-border p-4">
            Nothing needs attention right now.
          </p>
        )}
      </section>

      {/* Review note: "What you changed is not what you owe. Useful for
          trusting the record — which matters — but it is a subpage, not a
          section on the screen where you check whether you are over."
          It was already off the overview and in here, but it was still a
          second open section competing with the alerts above it for the first
          screenful. It is kept, and it is folded: the record is there for
          anyone who wants to check it, and it asks for nothing until then. */}
      <ReviewTarget
        id="v3-recent-activity"
        label="Recent activity log"
        reason="The audit trail repeats completed actions and does not change the current TWP, SGA, or paycheck decision."
        layout="responsive"
      >
        <details className="mt-4 border-t border-border pt-4">
          <summary className="cursor-pointer list-none text-base font-semibold">
            Recent activity
            <span className="type-muted ml-2 font-normal">
              {activity.length ? `${activity.length} entries` : 'nothing yet'}
            </span>
          </summary>
          {activity.length ? (
            <ul className="mt-3 space-y-2">
              {activity.slice(0, 10).map((entry) => (
                <li key={entry.id} className="type-muted text-base">
                  {entry.message}
                </li>
              ))}
            </ul>
          ) : (
            <p className="type-muted mt-3">Nothing yet.</p>
          )}
        </details>
      </ReviewTarget>
    </Sheet>
  );
}

function NotificationDot() {
  const { data, ui } = useTracker();
  const items = actionItems(data, ui.year, ui.focusMode);
  const latestAt = data.activity.length ? data.activity[data.activity.length - 1].at : null;
  const hasUnseenActivity = Boolean(latestAt) && (!ui.notificationsViewedAt || latestAt! > ui.notificationsViewedAt);
  const showDot = items.length > 0 || hasUnseenActivity;

  if (!showDot) return null;

  return (
    <span className="absolute top-1.5 right-1.5 flex size-2">
      <span className="absolute inline-flex h-full w-full motion-safe:animate-ping rounded-full bg-destructive opacity-75" />
      <span className="relative inline-flex size-2 rounded-full bg-destructive" />
    </span>
  );
}
