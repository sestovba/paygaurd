import { useState } from 'react';
import { ChevronLeft, ChevronRight, Menu, Settings } from 'lucide-react';
import { BrandMark } from './ui';
import { useMonthScope, useTracker } from '../state/TrackerProvider';
import { copyFor } from '../domain/copy';
import { useTheme } from '../theme';
import { knownYears } from '../domain/rules';
import { SafetyHero } from './SafetyHero';
import { ActionBanner } from './ActionBanner';
import { PaycheckRadar } from './PaycheckRadar';
import { MonthGrid } from './MonthGrid';
import { MonthSheet } from './MonthSheet';
import { StreamSheet } from './StreamSheet';
import { QuickPaydaySheet } from './QuickPaydaySheet';
import { TwpWizard } from './TwpWizard';
import { VerifyCompleteSheet } from './VerifyCompleteSheet';
import { StreamsPanel } from './StreamsPanel';
import { StatusPage } from './StatusPage';
import { SettingsPanel } from './SettingsPanel';
import { ToastStack } from './ToastStack';
import { NotificationsBell } from './NotificationsBell';
import { YearTotal } from './YearTotal';
import { Sidebar, TabBar } from './PageNav';
import type { PageId } from './PageNav';
import type { MonthKey } from '../domain/types';
import { ReviewTarget } from '../review/ReviewTarget';

function pageLabel(page: PageId): string {
  return page === 'overview' ? 'Overview' : page === 'income' ? 'Income' : 'Your limit';
}

type DetailRequest =
  | { kind: 'month'; month: MonthKey }
  | { kind: 'stream'; streamId: string }
  | { kind: 'payday'; streamId: string }
  | { kind: 'quiz' }
  | { kind: 'verify' }
  | { kind: 'settings' };

/** The sidebar-on-desktop / tabs-on-mobile shell — a navigational restyle
 *  on top of the same domain logic and sheets TrackerClassic uses. Every
 *  detail view (a month, a job, the TWP quiz, settings) renders inline in
 *  the main content area with a breadcrumb back — never as a popup.
 *  `detail` holds at most one request at a time, so opening a new one
 *  (e.g. Settings) always supersedes whatever was open before, instead of
 *  several independent booleans silently piling up. */
export function TrackerV2() {
  const { ui, setUi, resetAll } = useTracker();
  const { scope } = useMonthScope('many');
  useTheme(ui.theme);

  const [page, setPage] = useState<PageId>('overview');
  const [incomeSelectedId, setIncomeSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<DetailRequest | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);

  const years = knownYears();
  const yearIndex = years.indexOf(ui.year);
  const backLabel = pageLabel(page);

  function navigate(next: PageId) {
    setDetail(null);
    setPage(next);
  }

  const detailNode =
    detail?.kind === 'stream' ? (
      <StreamSheet streamId={detail.streamId} onClose={() => setDetail(null)} variant="inline" backLabel={backLabel} />
    ) : detail?.kind === 'month' ? (
      <MonthSheet
        month={detail.month}
        onClose={() => setDetail(null)}
        onOpenStream={(id) => setDetail({ kind: 'stream', streamId: id })}
        variant="inline"
        backLabel={backLabel}
      />
    ) : detail?.kind === 'payday' ? (
      <QuickPaydaySheet
        streamId={detail.streamId}
        onClose={() => setDetail(null)}
        onEditFull={(id) => setDetail({ kind: 'stream', streamId: id })}
        variant="inline"
        backLabel={backLabel}
      />
    ) : detail?.kind === 'quiz' ? (
      <TwpWizard onClose={() => setDetail(null)} variant="inline" backLabel={backLabel} />
    ) : detail?.kind === 'verify' ? (
      <VerifyCompleteSheet onClose={() => setDetail(null)} variant="inline" backLabel={backLabel} />
    ) : detail?.kind === 'settings' ? (
      <SettingsPanel
        theme={ui.theme}
        onTheme={(theme) => setUi({ theme })}
        onOpenStatus={() => { setDetail(null); setPage('status'); }}
        onReset={() => { resetAll(); setDetail(null); }}
        onClose={() => setDetail(null)}
        variant="inline"
        backLabel={backLabel}
        layout={ui.layout}
        onLayoutChange={(layout) => setUi({ layout })}
      />
    ) : null;

  return (
    <div className="min-h-screen bg-background" data-chrome-root>
      <header className="sticky top-0 z-10 border-b border-border/70 bg-background/85 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center gap-3 px-4 py-3 sm:px-6 lg:px-10">
          <div className="flex min-w-0 flex-1 items-center gap-2.5">
            <button
              type="button"
              aria-label="Open menu"
              onClick={() => setSidebarOpen(true)}
              className="icon-btn hidden border border-border bg-surface text-muted-foreground hover:bg-muted sm:grid lg:hidden"
            >
              <Menu className="size-5" />
            </button>
            <BrandMark onClick={() => navigate('overview')} />
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <div className="flex items-center gap-1 rounded-full border border-border bg-surface px-1 py-1">
              <button
                type="button"
                disabled={yearIndex <= 0}
                onClick={() => setUi({ year: years[yearIndex - 1] })}
                className="grid size-7 place-items-center rounded-full text-muted-foreground transition-colors hover:bg-muted disabled:opacity-30"
              >
                <ChevronLeft className="size-4" />
              </button>
              <span className="num px-1 text-sm font-semibold">{ui.year}</span>
              <button
                type="button"
                disabled={yearIndex >= years.length - 1}
                onClick={() => setUi({ year: years[yearIndex + 1] })}
                className="grid size-7 place-items-center rounded-full text-muted-foreground transition-colors hover:bg-muted disabled:opacity-30"
              >
                <ChevronRight className="size-4" />
              </button>
            </div>
            <NotificationsBell
              open={notificationsOpen}
              onOpenChange={setNotificationsOpen}
              onSetPayday={(id) => setDetail({ kind: 'payday', streamId: id })}
              onReviewStream={(id) => setDetail({ kind: 'stream', streamId: id })}
              onOpenMonth={(m) => setDetail({ kind: 'month', month: m })}
            />
            <button
              type="button"
              aria-label="Settings"
              onClick={() => setDetail({ kind: 'settings' })}
              className="icon-btn grid border border-border bg-surface text-muted-foreground hover:bg-muted"
            >
              <Settings className="size-5" />
            </button>
          </div>
        </div>
      </header>

      <div className="mx-auto flex max-w-7xl">
        <Sidebar page={page} onNavigate={navigate} open={sidebarOpen} onClose={() => setSidebarOpen(false)} />
        <main className="min-w-0 flex-1 px-4 py-6 pb-24 sm:px-6 sm:pb-6 lg:px-10 lg:py-10">
          {detailNode ? (
            <div className="flex h-[calc(100vh-8.5rem)] flex-col overflow-hidden rounded-2xl border border-border sm:h-[calc(100vh-7rem)]">
              {detailNode}
            </div>
          ) : page === 'overview' ? (
            <div className="flex flex-col gap-6">
              <div className="flex flex-col gap-3">
                {/* Review note: "I cant follow that title, its jargon and
                    abbreviations." It was three of them in a row over the one
                    screen someone opens when they are worried. */}
                <p className="label-caps text-accent-foreground">Where you stand this month</p>
                <ActionBanner
                  onSetPayday={(id) => setDetail({ kind: 'payday', streamId: id })}
                  onReviewStream={(id) => setDetail({ kind: 'stream', streamId: id })}
                  onOpenMonth={(m) => setDetail({ kind: 'month', month: m })}
                />
                <div className="grid gap-4 xl:grid-cols-12">
                  <SafetyHero
                    onTakeQuiz={() => setDetail({ kind: 'quiz' })}
                    onReviewStatus={() => setDetail({ kind: 'verify' })}
                    onFixStream={(gap) => setDetail(gap.kind === 'schedule'
                      ? { kind: 'payday', streamId: gap.streamId }
                      : { kind: 'stream', streamId: gap.streamId })}
                  />
                  <PaycheckRadar
                    onOpenMonth={(m) => setDetail({ kind: 'month', month: m })}
                    onCheckNotifications={() => setNotificationsOpen(true)}
                    onSetPayday={(streamId) => setDetail({ kind: 'payday', streamId })}
                  />
                </div>
              </div>
              <ReviewTarget
                id="v2-year-history"
                label="Full-year history"
                reason="The full month grid and annual total repeat the monthly risk signals and distract from TWP, SGA, and 3-/5-paycheck months."
                layout="v2"
              >
                <div className="flex flex-col gap-3">
                  {/* "Full-year history" over a single tile is a lie, and so
                      is it over the nine months of "so far this year".
                      MonthGrid names the month itself when the scope leaves
                      one, so the caption steps aside then; otherwise it says
                      the one thing true of every wider scope. */}
                  {scope === 'month' ? null : (
                    <p className="label-caps text-accent-foreground">History</p>
                  )}
                  <MonthGrid onOpenMonth={(m) => setDetail({ kind: 'month', month: m })} />
                  <YearTotal />
                </div>
              </ReviewTarget>
            </div>
          ) : page === 'income' ? (
            <div className="flex flex-col gap-4">
              <div>
                <h1 className="display-figure mt-1 text-3xl sm:text-4xl">Income</h1>
              </div>
              <div className="flex flex-col gap-4 lg:flex-row lg:items-start">
                <div className={(incomeSelectedId ? 'hidden sm:block ' : '') + 'w-full lg:w-80 lg:shrink-0'}>
                  <div className="overflow-hidden rounded-xl border border-border bg-surface">
                    <StreamsPanel onOpenStream={setIncomeSelectedId} selectedId={incomeSelectedId ?? undefined} compact />
                  </div>
                </div>
                <div className={(incomeSelectedId ? '' : 'hidden ') + 'min-w-0 flex-1 overflow-hidden rounded-xl border border-border bg-surface sm:block'}>
                  {incomeSelectedId ? (
                    <StreamSheet streamId={incomeSelectedId} onClose={() => setIncomeSelectedId(null)} variant="inline" backLabel={copyFor(ui.layout).income} />
                  ) : (
                    <div className="flex flex-col items-center justify-center gap-1 p-8 text-center">
                      <p className="text-base font-medium">Select or add an income source.</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          ) : (
            <StatusPage />
          )}
        </main>
      </div>

      <TabBar page={page} onNavigate={navigate} />
      <ToastStack />
    </div>
  );
}
