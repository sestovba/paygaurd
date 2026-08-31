import { useState } from 'react';
import { ChevronLeft, ChevronRight, Moon, Settings, Sun } from 'lucide-react';
import { BrandMark } from './ui';
import { useTracker } from '../state/TrackerProvider';
import { resolveTheme, useTheme } from '../theme';
import { knownYears } from '../domain/rules';
import { SafetyHero } from './SafetyHero';
import { ActionBanner } from './ActionBanner';
import { PaycheckRadar } from './PaycheckRadar';
import { MonthGrid } from './MonthGrid';
import { MonthSheet } from './MonthSheet';
import { StatusSheet } from './StatusSheet';
import { StreamSheet } from './StreamSheet';
import { QuickPaydaySheet } from './QuickPaydaySheet';
import { TwpWizard } from './TwpWizard';
import { VerifyCompleteSheet } from './VerifyCompleteSheet';
import { StreamsPanel } from './StreamsPanel';
import { SettingsPanel } from './SettingsPanel';
import { NotificationsBell } from './NotificationsBell';
import { YearTotal } from './YearTotal';
import type { MonthKey } from '../domain/types';
import { ReviewTarget } from '../review/ReviewTarget';

/** The original single-scroll dashboard — kept alongside TrackerV2 so the
 *  two layouts can be compared side by side until one is confirmed and the
 *  other gets removed. */
export function TrackerClassic() {
  const { ui, setUi, resetAll } = useTracker();
  useTheme(ui.theme);
  const isDark = resolveTheme(ui.theme, window.matchMedia('(prefers-color-scheme: dark)').matches) === 'dark';

  const [openMonth, setOpenMonth] = useState<MonthKey | null>(null);
  const [openStreamId, setOpenStreamId] = useState<string | null>(null);
  const [paydayStreamId, setPaydayStreamId] = useState<string | null>(null);
  const [statusOpen, setStatusOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [quizOpen, setQuizOpen] = useState(false);
  const [verifyOpen, setVerifyOpen] = useState(false);

  const years = knownYears();
  const yearIndex = years.indexOf(ui.year);

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-10 border-b border-border/70 bg-background/85 backdrop-blur">
        <div className="mx-auto grid max-w-7xl grid-cols-[minmax(0,1fr)_auto] items-center gap-3 px-4 py-3 sm:px-6 lg:px-10">
          <BrandMark onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })} />
          <div className="flex items-center gap-2">
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
              onSetPayday={setPaydayStreamId}
              onReviewStream={setOpenStreamId}
              onOpenMonth={setOpenMonth}
            />
            <ReviewTarget
              id="classic-theme-toggle"
              label="Theme toggle"
              reason="Light/dark already lives in Settings; in the header it takes space from the year and the alerts."
              layout="classic"
            >
              <button
                type="button"
                aria-label={isDark ? 'Switch to light theme' : 'Switch to dark theme'}
                onClick={() => setUi({ theme: isDark ? 'light' : 'dark' })}
                className="icon-btn grid border border-border bg-surface text-muted-foreground hover:bg-muted"
              >
                {isDark ? <Sun className="size-5" /> : <Moon className="size-5" />}
              </button>
            </ReviewTarget>
            <button
              type="button"
              aria-label="Settings"
              onClick={() => setSettingsOpen(true)}
              className="icon-btn grid border border-border bg-surface text-muted-foreground hover:bg-muted"
            >
              <Settings className="size-5" />
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-10 lg:py-10">
        <div className="flex flex-col gap-6">
          <div className="grid gap-4 xl:grid-cols-12">
            <ActionBanner onSetPayday={setPaydayStreamId} onReviewStream={setOpenStreamId} onOpenMonth={setOpenMonth} />
            <SafetyHero onTakeQuiz={() => setQuizOpen(true)} onReviewStatus={() => setVerifyOpen(true)} />
            <PaycheckRadar onOpenMonth={setOpenMonth} onCheckNotifications={() => setNotificationsOpen(true)} />
          </div>
          <ReviewTarget
            id="classic-month-grid"
            label="Full-year month grid"
            reason="This repeats the active TWP or SGA signal across twelve tiles instead of focusing on months with 3 or 5 paychecks."
            layout="classic"
          >
            <MonthGrid onOpenMonth={setOpenMonth} />
          </ReviewTarget>
          <StreamsPanel onOpenStream={setOpenStreamId} />
          <ReviewTarget
            id="classic-year-total"
            label="Annual total"
            reason="An annualized total does not answer the monthly TWP, SGA, or extra-paycheck question."
            layout="classic"
          >
            <YearTotal />
          </ReviewTarget>
        </div>
      </main>

      {openMonth ? <MonthSheet month={openMonth} onClose={() => setOpenMonth(null)} onOpenStream={setOpenStreamId} /> : null}
      {openStreamId ? <StreamSheet streamId={openStreamId} onClose={() => setOpenStreamId(null)} /> : null}
      {paydayStreamId ? (
        <QuickPaydaySheet
          streamId={paydayStreamId}
          onClose={() => setPaydayStreamId(null)}
          onEditFull={setOpenStreamId}
        />
      ) : null}
      {statusOpen ? <StatusSheet onClose={() => setStatusOpen(false)} /> : null}
      {quizOpen ? <TwpWizard onClose={() => setQuizOpen(false)} /> : null}
      {verifyOpen ? <VerifyCompleteSheet onClose={() => setVerifyOpen(false)} /> : null}
      {settingsOpen ? (
        <SettingsPanel
          theme={ui.theme}
          onTheme={(theme) => setUi({ theme })}
          onOpenStatus={() => { setSettingsOpen(false); setStatusOpen(true); }}
          onReset={() => { resetAll(); setSettingsOpen(false); }}
          onClose={() => setSettingsOpen(false)}
          layout={ui.layout}
          onLayoutChange={(layout) => setUi({ layout })}
        />
      ) : null}
    </div>
  );
}
