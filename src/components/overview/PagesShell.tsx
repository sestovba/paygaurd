import { useState } from 'react';
import { ChevronLeft, ChevronRight, DollarSign, Menu, Plus, Settings } from 'lucide-react';
import { useMonthScope, useTracker } from '../../state/TrackerProvider';
import { copyFor } from '../../domain/copy';
import { useTheme } from '../../theme';
import { knownYears } from '../../domain/rules';
import { SafetyHero } from '../SafetyHero';
import { ActionBanner } from '../ActionBanner';
import { PaycheckRadar } from '../PaycheckRadar';
import { MonthGrid } from '../MonthGrid';
import { StreamSheet } from '../StreamSheet';
import { StreamsPanel } from '../StreamsPanel';
import { StatusPage } from '../StatusPage';
import { ToastStack } from '../ToastStack';
import { NotificationsBell } from '../NotificationsBell';
import { YearTotal } from '../YearTotal';
import { Sidebar, TabBar } from '../PageNav';
import type { PageId } from '../PageNav';
import { longMonthName, todayMonth, yearOf } from '../../domain/months';
import { Detail } from './detail';
import type { DetailRequest } from './detail';
import { ReviewTarget } from '../../review/ReviewTarget';

import { ButtonBase } from '../../design-system';
function pageLabel(page: PageId): string {
  return page === 'overview' ? 'Overview' : page === 'income' ? 'Income' : 'Your limit';
}

/**
 * Three lines that say where you are, in three registers.
 *
 * This page opened on a tracked caps label and went straight into a card, so
 * it never said what it was — there was no <h1> anywhere on Overview. That is
 * why the serif had nothing to be the voice of: a display face needs
 * something to display.
 *
 * Eyebrow names the window, title names the page, and the sentence says what
 * the page is for. The sentence is the one that earns its place — it is the
 * only text on the screen aimed at somebody who has just arrived and does not
 * yet know what any of the figures mean.
 */
function PageHead({ eyebrow, title, lede }: { eyebrow: string; title: string; lede: string }) {
  return (
    <header className="ov-head">
      <p className="ov-eyebrow text-accent-foreground">{eyebrow}</p>
      <h1>{title}</h1>
      <p className="ov-lede">{lede}</p>
    </header>
  );
}

/** The sidebar-on-desktop / tabs-on-mobile shell — the same surfaces the
 *  scroll shell draws, split across three pages. Every
 *  detail view (a month, a job, the TWP quiz, settings) renders inline in
 *  the main content area with a breadcrumb back — never as a popup.
 *  `detail` holds at most one request at a time, so opening a new one
 *  (e.g. Settings) always supersedes whatever was open before, instead of
 *  several independent booleans silently piling up. */
export function PagesShell() {
  const { ui, setUi, addStream } = useTracker();
  /* Same fallback MonthGrid uses, or the two disagree: the grid drew the
     single-month card while this file still believed the scope was 'ahead'
     and printed a "History" heading over it. One source of truth for what
     focus mode means on this page. */
  const { scope } = useMonthScope('many', 'month');
  useTheme(ui.theme, ui.palette);

  const [page, setPage] = useState<PageId>('overview');
  const [incomeSelectedId, setIncomeSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<DetailRequest | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);

  const years = knownYears();
  const yearIndex = years.indexOf(ui.year);
  const now = todayMonth();
  const thisMonth = yearOf(now) === ui.year ? now : `${ui.year}-12` as const;
  const backLabel = pageLabel(page);

  function navigate(next: PageId) {
    setDetail(null);
    setPage(next);
  }

  /* Six detail views, rendered by one component shared with the other two
     shells — see ./detail.tsx. Here a detail REPLACES the page, so a child
     request (a month opening a source) replaces it too. */
  const detailNode = detail ? (
    <Detail
      request={detail}
      variant="inline"
      backLabel={backLabel}
      onClose={() => setDetail(null)}
      onChild={setDetail}
      onOpenStatus={() => { setDetail(null); setPage('status'); }}
    />
  ) : null;

  return (
    /* Sidebar first and full height, then the bar above the content — not a
       full-width bar with the nav slung underneath it. That arrangement is
       what let the brand appear twice at desktop width: a mark in the bar and
       a wordmark in the sidebar, six inches apart, naming the same product.
       The rule the sidebar draws down its right edge meets the bar's bottom
       border at the same point, so the two rules read as one continuous edge
       even though the two surfaces sit on different planes — the sidebar on
       --pg-surface, the bar on the page ground, as the reference does. */
    <div className="pg-overview flex min-h-screen bg-background" data-chrome-root>
      <Sidebar
        page={page}
        onNavigate={navigate}
        open={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        brand={(
          <ButtonBase
            type="button"
            onClick={() => navigate('overview')}
            className="-mx-1 flex w-full items-center gap-3 rounded-xl px-1 py-1.5 text-left hover:bg-surface-2"
          >
            {/* 36px, the size the reference draws it and the size BrandMark
                uses everywhere else in the app. At 28 it was the smallest
                thing in a 64px row and read as an icon rather than a mark. */}
            <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-primary text-primary-foreground">
              <DollarSign className="size-5" strokeWidth={2.75} />
            </span>
            <span className="min-w-0">
              <span className="block truncate text-sm font-semibold leading-tight">PayGuard</span>
              {/* What the product is for, in four words, where somebody who
                  opens it once a month can re-read it without asking. */}
              <span className="ov-eyebrow block leading-tight">Stay under the limit</span>
            </span>
          </ButtonBase>
        )}
        action={(
          <ButtonBase
            type="button"
            onClick={() => setDetail({ kind: 'stream', streamId: addStream('w2') })}
            className="btn-primary flex w-full items-center justify-center gap-2"
          >
            {/* The plus, which every other add control in the app carries and
                this one did not — see AddJobButton. Without it the primary
                action read as a third nav item that happened to be green. */}
            <Plus className="size-[18px] shrink-0" />
            Add income
          </ButtonBase>
        )}
        footer={(
          <ButtonBase
            type="button"
            onClick={() => setDetail({ kind: 'settings' })}
            className="nav-item"
          >
            {/* Settings, not Cog. The note that used to sit here said the
                opposite — "Cog, not lucide's Settings, that one is a heavily
                toothed outline… fewer strokes" — and it had the two icons the
                wrong way round. Counted in lucide 1.35: `Settings` is two
                nodes, one smooth eight-lobed path and a circle; `Cog` is
                fourteen, twelve of which are 1–2px ticks at this size. Cog is
                the one that turns to mush on a cheap panel, and it is also
                what the reference does not use. */}
            <Settings className="size-[18px] shrink-0" />
            Settings
          </ButtonBase>
        )}
      />

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="app-bar sticky top-0 z-10 border-b">
          <div className="flex h-16 items-center gap-3 px-4 sm:px-6 lg:px-10">
            <ButtonBase
              type="button"
              aria-label="Open menu"
              onClick={() => setSidebarOpen(true)}
              className="icon-btn grid border border-border bg-surface text-muted-foreground hover:bg-muted lg:hidden"
            >
              <Menu className="size-5" />
            </ButtonBase>
            {/* The brand appears here ONLY where the sidebar does not.
                Above lg both were on screen at once, six inches apart, naming
                the same product twice — so it went. But removing it outright
                left the bar carrying the page name at every width, and at
                375px that name has 60px to live in: "Overview" arrived as
                "Ove…", which names nothing. Below lg there is no sidebar to
                duplicate and the tab bar already says which page you are on,
                so the bar's job there is to say which app this is. The
                reference splits it at exactly this line. */}
            <div className="flex min-w-0 flex-1 items-center gap-2 lg:hidden">
              <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-primary text-primary-foreground">
                <DollarSign className="size-[18px]" strokeWidth={2.75} />
              </span>
              {/* The word only where it fits whole. At 375px the row is a
                  44px hamburger, the mark, a year stepper and a 44px bell —
                  the touch floor this audience needs costs the width the
                  reference spends on the wordmark, and "PayGuard" came out as
                  a single "|". The mark alone still names the app; a clipped
                  word names nothing. xs is 26rem, set in index.css. */}
              <span className="hidden truncate text-base font-semibold xs:inline">PayGuard</span>
            </div>
            <p className="hidden min-w-0 flex-1 truncate text-base font-semibold lg:block">{pageLabel(page)}</p>
            <div className="flex shrink-0 items-center gap-2">
              <div className="flex items-center gap-1 rounded-full border border-border bg-surface px-1 py-1">
                <ButtonBase
                  type="button"
                  aria-label="Previous year"
                  disabled={yearIndex <= 0}
                  onClick={() => setUi({ year: years[yearIndex - 1] })}
                  className="grid size-7 place-items-center rounded-full text-muted-foreground transition-colors hover:bg-muted disabled:opacity-30"
                >
                  <ChevronLeft className="size-4" />
                </ButtonBase>
                <span className="num px-1 text-sm font-semibold">{ui.year}</span>
                <ButtonBase
                  type="button"
                  aria-label="Next year"
                  disabled={yearIndex >= years.length - 1}
                  onClick={() => setUi({ year: years[yearIndex + 1] })}
                  className="grid size-7 place-items-center rounded-full text-muted-foreground transition-colors hover:bg-muted disabled:opacity-30"
                >
                  <ChevronRight className="size-4" />
                </ButtonBase>
              </div>
              <NotificationsBell
                open={notificationsOpen}
                onOpenChange={setNotificationsOpen}
                onSetPayday={(id) => setDetail({ kind: 'payday', streamId: id })}
                onReviewStream={(id) => setDetail({ kind: 'stream', streamId: id })}
                onOpenMonth={(m) => setDetail({ kind: 'month', month: m })}
              />
            </div>
          </div>
        </header>

        {/* A measure, so the page stops widening for ever. Uncapped, the lede
            and the two-column grid kept stretching on a wide monitor and the
            cards drifted apart until they stopped reading as a pair. 80rem is
            what Ledger already uses; the reference's own 48rem would be too
            tight here, because it is drawn as one column and this is not. */}
        <main className="mx-auto w-full min-w-0 max-w-[80rem] flex-1 px-4 py-6 pb-24 sm:px-6 sm:pb-6 lg:px-10 lg:py-10">
          {detailNode ? (
            <div className="flex h-[calc(100vh-8.5rem)] flex-col overflow-hidden rounded-2xl border border-border sm:h-[calc(100vh-7rem)]">
              {detailNode}
            </div>
          ) : page === 'overview' ? (
            <div className="flex flex-col gap-6">
              <div className="flex flex-col gap-5">
                {/* Review note: "I cant follow that title, its jargon and
                    abbreviations." It was three of them in a row over the one
                    screen someone opens when they are worried. Now a proper
                    page head — the label alone never said what the page was.
                    The sentence states what is LEFT first, per
                    DESIGN-SYSTEM.md § 1.5; the reference's own version opens
                    on what you have earned, which is the wrong end. */}
                <PageHead
                  eyebrow={`${longMonthName(thisMonth)} ${ui.year}`}
                  title="Overview"
                  lede="What’s left this month, how many hours that is, and which months pay extra."
                />
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
                  {/* The month sits beside the answer, not in a section
                      below it. It is the same question at a different range —
                      "am I safe" and "what actually lands this month" — and
                      the reference is right that they belong in one glance.
                      Underneath, it was separated from the hero by a heading
                      that called this month "History". */}
                  <div className="flex flex-col gap-4 xl:col-span-6">
                    <PaycheckRadar
                      onOpenMonth={(m) => setDetail({ kind: 'month', month: m })}
                      onCheckNotifications={() => setNotificationsOpen(true)}
                      onSetPayday={(streamId) => setDetail({ kind: 'payday', streamId })}
                    />
                    <ReviewTarget
                      id="v2-year-history"
                      label="Full-year history"
                      reason="The full month grid and annual total repeat the monthly risk signals and distract from TWP, SGA, and 3-/5-paycheck months."
                      layout="v2"
                    >
                      <div className="flex flex-col gap-3">
                        {/* Only a heading when there is genuinely a range to
                            name. Over one month it read "History" above the
                            month you are standing in. */}
                        {scope === 'month' ? null : (
                          <p className="ov-eyebrow text-accent-foreground">History</p>
                        )}
                        <MonthGrid onOpenMonth={(m) => setDetail({ kind: 'month', month: m })} />
                        {scope === 'month' ? null : <YearTotal />}
                      </div>
                    </ReviewTarget>
                  </div>
                </div>
              </div>
              {/* Income sources belong on the overview, not only behind a tab.
                  A reader checking whether they are safe this month is one
                  question away from "and which job was that?", and making them
                  navigate to find out is how a source ends up unedited for
                  months. StreamsPanel already ends with the two add buttons,
                  so they are not repeated here — a second identical pair was
                  the first thing the parity check caught. */}
              <div className="flex flex-col gap-3">
                <p className="ov-eyebrow text-accent-foreground">Income sources</p>
                <div className="overflow-hidden rounded-xl border border-border bg-surface">
                  <StreamsPanel onOpenStream={(id) => setDetail({ kind: 'stream', streamId: id })} compact />
                </div>
              </div>
            </div>
          ) : page === 'income' ? (
            <div className="flex flex-col gap-5">
              <PageHead
                eyebrow="All income"
                title="Income"
                lede="Your jobs and gig work this year."
              />
              <div className="flex flex-col gap-4 lg:flex-row lg:items-start">
                {/* w-96, not w-80. At 320px the source list gave a job name
                    111px and "Riverside Market" needs 125, so every row in
                    the product's own list of jobs was clipped — "Riverside
                    Mar…", "Delivery drivi…" — while 700px of empty detail
                    pane sat beside it. 64px more costs the pane nothing it
                    was using. */}
                <div className={(incomeSelectedId ? 'hidden sm:block ' : '') + 'w-full lg:w-96 lg:shrink-0'}>
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
            <div className="flex flex-col gap-5">
              <PageHead
                eyebrow="Your situation"
                title="Your limit"
                lede="Which limit applies right now, and why."
              />
              <StatusPage />
            </div>
          )}
        </main>
      </div>

      <TabBar page={page} onNavigate={navigate} />
      <ToastStack />
    </div>
  );
}
