import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Bell,
  BriefcaseBusiness,
  CalendarClock,
  ChevronLeft,
  ChevronRight,
  CircleHelp,
  LayoutGrid,
  Moon,
  Plus,
  Settings,
  ShieldCheck,
  Sun,
  TrendingUp,
  WalletCards,
  Zap
} from 'lucide-react';
import { BrandMark, Chip } from './ui';
import type { LucideIcon } from 'lucide-react';
import { useTracker } from '../state/TrackerProvider';
import type { LayoutMode } from '../state/storage';
import { resolveTheme, useTheme } from '../theme';
import { knownYears } from '../domain/rules';
import { actionItems } from '../domain/notifications';
import { formatMonth } from '../domain/months';
import { ActionBanner } from './ActionBanner';
import { MonthGrid } from './MonthGrid';
import { MonthSheet } from './MonthSheet';
import { PaycheckRadar } from './PaycheckRadar';
import { QuickPaydaySheet } from './QuickPaydaySheet';
import { SafetyHero } from './SafetyHero';
import { SettingsPanel } from './SettingsPanel';
import { Sheet } from './Sheet';
import { StatusPage } from './StatusPage';
import { StreamSheet } from './StreamSheet';
import { StreamsPanel } from './StreamsPanel';
import { TwpWizard } from './TwpWizard';
import { VerifyCompleteSheet } from './VerifyCompleteSheet';
import { YearTotal } from './YearTotal';
import type { MonthKey, StreamType } from '../domain/types';
import { ReviewTarget } from '../review/ReviewTarget';

type PageId = 'overview' | 'income' | 'status';

type PaneRequest =
  | { kind: 'month'; month: MonthKey }
  | { kind: 'stream'; streamId: string }
  | { kind: 'payday'; streamId: string }
  | { kind: 'quiz' }
  | { kind: 'verify' }
  | { kind: 'settings' }
  | { kind: 'notifications' }
  | { kind: 'newSource' };

/**
 * The third layout is a retained workspace rather than a collection of
 * dialogs. The page is step 1, a contextual task is step 2, and a child task
 * (Month -> Source, Quick fix -> Full source, New entry -> Source) is step 3.
 * Every pane stays in normal document flow, so opening one always reflows the
 * available width instead of covering the page underneath it.
 */
export function TrackerV3() {
  const { data, ui, setUi, addStream, resetAll } = useTracker();
  useTheme(ui.theme);

  const isDark = resolveTheme(
    ui.theme,
    window.matchMedia('(prefers-color-scheme: dark)').matches
  ) === 'dark';

  const [page, setPage] = useState<PageId>('overview');
  const [panes, setPanes] = useState<PaneRequest[]>([]);
  const activeRegionRef = useRef<HTMLElement | null>(null);
  const years = knownYears();
  const yearIndex = years.indexOf(ui.year);

  const statusLabel = 'TWP / SGA';

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
    if (pane.kind === 'quiz') return 'TWP check-in';
    if (pane.kind === 'verify') return 'Review status';
    if (pane.kind === 'settings') return 'Settings';
    if (pane.kind === 'notifications') return 'Activity';
    return 'New income source';
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
    <div className="flex h-dvh overflow-hidden bg-background">
      <DesktopSidebar
        page={page}
        step={panes.length + 1}
        navItems={navItems}
        onNavigate={navigate}
        onNewEntry={() => openPane({ kind: 'newSource' })}
        onSettings={() => openPane({ kind: 'settings' })}
      />

      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <header className="relative z-10 shrink-0 border-b border-border bg-background/95 backdrop-blur">
          <div className="flex min-h-16 items-center gap-3 px-3 sm:px-5 lg:px-6">
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

            <button
              type="button"
              aria-label={isDark ? 'Switch to light theme' : 'Switch to dark theme'}
              onClick={() => setUi({ theme: isDark ? 'light' : 'dark' })}
              className="icon-btn hidden border border-border bg-surface text-muted-foreground hover:bg-muted hover:text-foreground sm:grid"
            >
              {isDark ? <Sun className="size-5" /> : <Moon className="size-5" />}
            </button>

            <button
              type="button"
              aria-label="Settings"
              onClick={() => openPane({ kind: 'settings' })}
              className="icon-btn hidden border border-border bg-surface text-muted-foreground hover:bg-muted hover:text-foreground lg:grid"
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
                  onTheme={(theme) => setUi({ theme })}
                  onReset={resetAll}
                  layout={ui.layout}
                  onLayoutChange={(layout) => setUi({ layout })}
                  theme={ui.theme}
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
        aria-label="Income sources"
        tabIndex={activeRef ? -1 : undefined}
        className={`${rootVisibility} min-h-0 min-w-0 flex-col bg-background focus:outline-none ${hasDetail ? 'overflow-hidden' : 'overflow-y-auto'}`}
      >
        <div className={hasDetail ? 'p-4 sm:p-5' : 'p-4 sm:p-6 xl:p-8'}>
          <RootHeading
            eyebrow="Jobs"
            title="Income"
            description={hasDetail ? 'Pick another source.' : 'Add or edit W-2 and 1099 income.'}
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
          eyebrow={page === 'overview' ? 'Home' : 'Limits'}
          title={page === 'overview' ? 'Overview' : statusLabel}
          description={page === 'overview'
            ? 'TWP, SGA, and 3-/5-paycheck months.'
            : 'Confirm TWP status and review the active monthly limit.'}
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
            />
            <ReviewTarget
              id="v3-overview-month-grid"
              label="Full-year month grid"
              reason="This repeats the active monthly limit across twelve tiles instead of focusing on 3-/5-paycheck and risk months."
              layout="responsive"
              className="xl:col-span-6"
            >
              <MonthGrid onOpenMonth={(month) => onOpen({ kind: 'month', month })} />
            </ReviewTarget>
            <ReviewTarget
              id="v3-overview-income-sources"
              label="Duplicate income sources"
              reason="Income source management already has its own page."
              layout="responsive"
              className="xl:col-span-6"
            >
              <StreamsPanel onOpenStream={(streamId) => onOpen({ kind: 'stream', streamId })} />
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

function PaneContent({
  pane,
  index,
  backLabel,
  onClose,
  onPush,
  onReplace,
  onAddSource,
  onNavigate,
  theme,
  onTheme,
  onReset,
  layout,
  onLayoutChange
}: {
  pane: PaneRequest;
  index: number;
  backLabel: string;
  onClose: () => void;
  onPush: (pane: PaneRequest) => void;
  onReplace: (pane: PaneRequest) => void;
  onAddSource: (type: StreamType) => void;
  onNavigate: (page: PageId) => void;
  theme: 'system' | 'light' | 'dark';
  onTheme: (theme: 'system' | 'light' | 'dark') => void;
  onReset: () => void;
  layout: LayoutMode;
  onLayoutChange: (layout: LayoutMode) => void;
}) {
  if (pane.kind === 'stream') {
    return <StreamSheet streamId={pane.streamId} onClose={onClose} variant="inline" backLabel={backLabel} />;
  }

  if (pane.kind === 'month') {
    return (
      <MonthSheet
        month={pane.month}
        onClose={onClose}
        onOpenStream={(streamId) => {
          const next: PaneRequest = { kind: 'stream', streamId };
          if (index < 1) onPush(next);
          else onReplace(next);
        }}
        variant="inline"
        backLabel={backLabel}
      />
    );
  }

  if (pane.kind === 'payday') {
    return (
      <QuickPaydaySheet
        streamId={pane.streamId}
        onClose={onClose}
        onEditFull={(streamId) => {
          const next: PaneRequest = { kind: 'stream', streamId };
          if (index < 1) onPush(next);
          else onReplace(next);
        }}
        variant="inline"
        backLabel={backLabel}
        closeBeforeEdit={false}
      />
    );
  }

  if (pane.kind === 'quiz') {
    return <TwpWizard onClose={onClose} variant="inline" backLabel={backLabel} />;
  }

  if (pane.kind === 'verify') {
    return <VerifyCompleteSheet onClose={onClose} variant="inline" backLabel={backLabel} />;
  }

  if (pane.kind === 'settings') {
    return (
      <SettingsPanel
        theme={theme}
        onTheme={onTheme}
        onOpenStatus={() => onNavigate('status')}
        onReset={onReset}
        onClose={onClose}
        variant="inline"
        backLabel={backLabel}
        layout={layout}
        onLayoutChange={onLayoutChange}
      />
    );
  }

  if (pane.kind === 'notifications') {
    return (
      <ActivityPane
        backLabel={backLabel}
        onClose={onClose}
        onOpen={(next) => index < 1 ? onPush(next) : undefined}
      />
    );
  }

  return <NewSourcePane backLabel={backLabel} onClose={onClose} onChoose={onAddSource} />;
}

function DesktopSidebar({
  page,
  step,
  navItems,
  onNavigate,
  onNewEntry,
  onSettings
}: {
  page: PageId;
  step: number;
  navItems: { id: PageId; label: string; icon: LucideIcon }[];
  onNavigate: (page: PageId) => void;
  onNewEntry: () => void;
  onSettings: () => void;
}) {
  return (
    <aside className="hidden h-dvh w-60 shrink-0 flex-col border-r border-border bg-surface lg:flex 2xl:w-64">
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
        {navItems.map(({ id, label, icon: Icon }) => {
          const active = page === id;
          return (
            <button
              key={id}
              type="button"
              aria-current={active ? 'page' : undefined}
              onClick={() => onNavigate(id)}
              className={
                'flex items-center gap-3 rounded-lg px-3 py-3 text-left text-base font-semibold transition-colors '
                + (active
                  ? 'bg-accent text-accent-foreground'
                  : 'text-muted-foreground hover:bg-muted hover:text-foreground')
              }
            >
              <Icon className="size-[18px] shrink-0" />
              {label}
            </button>
          );
        })}
      </nav>

      <div className="mt-auto border-t border-border p-4">
        <ReviewTarget
          id="v3-workspace-progress"
          label="Workspace progress"
          reason="The 01/03 meter is decorative workflow chrome, not benefit-safety information."
          layout="responsive"
          className="mb-4"
        >
          <div className="rounded-xl bg-surface-2 p-3">
            <div className="flex items-center justify-between">
              <span className="label-caps">Workspace</span>
              <span className="num text-xs font-semibold">0{step} / 03</span>
            </div>
            <div className="mt-3 grid grid-cols-3 gap-1">
              {[1, 2, 3].map((item) => (
                <span key={item} className={`h-1 rounded-full ${item <= step ? 'bg-primary' : 'bg-border'}`} />
              ))}
            </div>
          </div>
        </ReviewTarget>

        <button
          type="button"
          onClick={onSettings}
          className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        >
          <Settings className="size-[18px]" /> Settings
        </button>
        <ReviewTarget
          id="v3-context-help"
          label="Interface helper"
          reason="This explains the workspace implementation instead of helping with TWP, SGA, or paychecks."
          layout="responsive"
        >
          <div className="mt-1 flex items-center gap-3 px-3 py-2 text-xs text-muted-foreground">
            <CircleHelp className="size-4" /> Your open item stays beside the list
          </div>
        </ReviewTarget>
      </div>
    </aside>
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
    <nav className="hidden items-center gap-1 border-t border-border/70 px-4 py-2 md:flex lg:hidden" aria-label="Primary">
      {navItems.map(({ id, label, icon: Icon }) => {
        const active = id === page;
        return (
          <button
            key={id}
            type="button"
            aria-current={active ? 'page' : undefined}
            onClick={() => onNavigate(id)}
            className={
              'flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold transition-colors '
              + (active ? 'bg-accent text-accent-foreground' : 'text-muted-foreground hover:bg-muted hover:text-foreground')
            }
          >
            <Icon className="size-4" /> {label}
          </button>
        );
      })}
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
      className="grid shrink-0 grid-cols-4 border-t border-border bg-background/98 pb-safe md:hidden"
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
            className={
              'flex min-w-0 flex-col items-center gap-1 px-1 py-2.5 text-sm font-semibold transition-colors '
              + (active ? 'text-accent-foreground' : 'text-muted-foreground')
            }
          >
            <span className={`grid size-8 place-items-center rounded-xl ${active ? 'bg-accent' : ''}`}>
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
        className={
          'flex min-w-0 flex-col items-center gap-1 px-1 py-2.5 text-sm font-semibold transition-colors '
          + (settingsOpen ? 'text-accent-foreground' : 'text-muted-foreground')
        }
      >
        <span className={`grid size-8 place-items-center rounded-xl ${settingsOpen ? 'bg-accent' : ''}`}>
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
  statusLabel = 'TWP & SGA',
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
    <div className="flex min-w-0 items-center gap-1.5" aria-label="Workspace trail">
      {labels.map((label, index) => (
        <div key={`${label}-${index}`} className="flex min-w-0 items-center gap-1.5">
          {index > 0 ? <ChevronRight className="size-4 shrink-0 text-muted-foreground/60" /> : null}
          <button
            type="button"
            aria-label={`${index + 1}. ${label}`}
            aria-current={index === labels.length - 1 ? 'step' : undefined}
            onClick={() => onStep(index)}
            className={
              'flex min-w-0 items-center gap-2 rounded-lg py-1.5 text-left transition-colors hover:text-foreground '
              + (compact ? 'px-1' : 'px-2')
              + (index === labels.length - 1 ? ' font-semibold text-foreground' : ' text-muted-foreground')
            }
          >
            <span className={
              'num grid size-6 shrink-0 place-items-center rounded-md text-xs font-bold '
              + (index === labels.length - 1 ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground')
            }>
              {index + 1}
            </span>
            <span className={`truncate text-sm font-medium ${compact && index < labels.length - 1 ? 'hidden sm:inline' : ''}`}>
              {label}
            </span>
          </button>
        </div>
      ))}
      {Array.from({ length: Math.max(0, 3 - labels.length) }, (_, index) => (
        <div key={`empty-${index}`} className="hidden items-center gap-1.5 sm:flex" aria-hidden="true">
          <ChevronRight className="size-4 text-muted-foreground/30" />
          <span className="num grid size-6 place-items-center rounded-md border border-dashed border-border text-xs text-muted-foreground/50">
            {labels.length + index + 1}
          </span>
        </div>
      ))}
    </div>
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
  eyebrow: string;
  title: string;
  description: string;
  compact: boolean;
}) {
  return (
    <div className={compact ? '' : 'max-w-2xl'}>
      <p className="label-caps text-accent-foreground">{eyebrow}</p>
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
    <Sheet
      title="Add income"
      eyebrow="Choose a source"
      variant="inline"
      backLabel={backLabel}
      onClose={onClose}
    >
      <p className="type-muted">Choose W-2 or 1099 income.</p>
      <div className="v3-source-choices grid gap-3">
        <SourceChoice
          icon={WalletCards}
          label="W-2 employee"
          description="Regular paychecks from an employer."
          tone="good"
          onClick={() => onChoose('w2')}
        />
        <SourceChoice
          icon={BriefcaseBusiness}
          label="1099 contract"
          description="Freelance, gig, or client income."
          tone="info"
          onClick={() => onChoose('ten99')}
        />
      </div>
      <ReviewTarget
        id="v3-new-source-tutorial"
        label="Three-step tutorial"
        reason="The choices already make the flow clear; this repeats interface instructions."
        layout="responsive"
      >
        <div className="rounded-xl border border-border bg-surface-2 p-4">
          <p className="label-caps">What happens next</p>
          <ol className="type-muted mt-3 space-y-2">
            <li className="flex gap-2"><span className="num font-bold text-foreground">01</span> Choose the source type.</li>
            <li className="flex gap-2"><span className="num font-bold text-foreground">02</span> Add schedule and earnings details.</li>
            <li className="flex gap-2"><span className="num font-bold text-foreground">03</span> Return to the overview.</li>
          </ol>
        </div>
      </ReviewTarget>
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
      <span className={`grid size-10 place-items-center rounded-xl ${tone === 'good' ? 'bg-good-soft text-good' : 'bg-info-soft text-info'}`}>
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
  const items = actionItems(data, ui.year);
  const activity = [...data.activity].reverse();

  function resolve(item: ReturnType<typeof actionItems>[number]) {
    if (item.action.kind === 'setPayday') onOpen({ kind: 'payday', streamId: item.action.streamId });
    else if (item.action.kind === 'reviewStream') onOpen({ kind: 'stream', streamId: item.action.streamId });
    else onOpen({ kind: 'month', month: item.action.month });
  }

  return (
    <Sheet
      title="Alerts"
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

      <ReviewTarget
        id="v3-recent-activity"
        label="Recent activity log"
        reason="The audit trail repeats completed actions and does not change the current TWP, SGA, or paycheck decision."
        layout="responsive"
      >
        <section className="border-t border-border pt-4">
          <h2 className="text-base font-semibold">Recent activity</h2>
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
        </section>
      </ReviewTarget>
    </Sheet>
  );
}

function NotificationDot() {
  const { data, ui } = useTracker();
  const items = actionItems(data, ui.year);
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
