import { useState } from 'react';
import { ChevronLeft, ChevronRight, Settings } from 'lucide-react';
import { BrandMark } from '../ui';
import { useTracker } from '../../state/TrackerProvider';
import { useTheme } from '../../theme';
import { knownYears } from '../../domain/rules';
import { SafetyHero } from '../SafetyHero';
import { ActionBanner } from '../ActionBanner';
import { PaycheckRadar } from '../PaycheckRadar';
import { MonthGrid } from '../MonthGrid';
import { StatusSheet } from '../StatusSheet';
import { StreamsPanel } from '../StreamsPanel';
import { ToastStack } from '../ToastStack';
import { NotificationsBell } from '../NotificationsBell';
import { YearTotal } from '../YearTotal';
import { Detail } from './detail';
import type { DetailRequest } from './detail';
import { ReviewTarget } from '../../review/ReviewTarget';

import { ButtonBase } from '../../design-system';
/**
 * Overview, as one scroll.
 *
 * No navigation: every surface is on the page in reading order, and a detail
 * opens as a sheet over the top. The shell for someone who would rather
 * scroll than choose where to go — see TrackerOverview.tsx.
 */
export function ScrollShell() {
  const { ui, setUi } = useTracker();
  useTheme(ui.theme, ui.palette);

  /* One request, not seven booleans. Nothing stopped two of those being true
     at once, and a month sheet under a settings panel is not a state anyone
     designed — see the same note in PagesShell, which got here first. */
  const [detail, setDetail] = useState<DetailRequest | null>(null);
  const [statusOpen, setStatusOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);

  const years = knownYears();
  const yearIndex = years.indexOf(ui.year);

  return (
    <div className="pg-overview min-h-screen bg-background" data-chrome-root>
      <header className="app-bar sticky top-0 z-10 border-b">
        <div className="mx-auto grid max-w-7xl grid-cols-[minmax(0,1fr)_auto] items-center gap-3 px-4 py-3 sm:px-6 lg:px-10">
          <BrandMark onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })} />
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1 rounded-full border border-border bg-surface px-1 py-1">
              <ButtonBase
                type="button"
                disabled={yearIndex <= 0}
                onClick={() => setUi({ year: years[yearIndex - 1] })}
                className="grid size-7 place-items-center rounded-full text-muted-foreground transition-colors hover:bg-muted disabled:opacity-30"
              >
                <ChevronLeft className="size-4" />
              </ButtonBase>
              <span className="num px-1 text-sm font-semibold">{ui.year}</span>
              <ButtonBase
                type="button"
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
              onSetPayday={(streamId) => setDetail({ kind: 'payday', streamId })}
              onReviewStream={(streamId) => setDetail({ kind: 'stream', streamId })}
              onOpenMonth={(month) => setDetail({ kind: 'month', month })}
            />
            <ButtonBase
              type="button"
              aria-label="Settings"
              onClick={() => setDetail({ kind: 'settings' })}
              className="icon-btn grid border border-border bg-surface text-muted-foreground hover:bg-muted"
            >
              <Settings className="size-5" />
            </ButtonBase>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-10 lg:py-10">
        <div className="flex flex-col gap-6">
          <div className="grid gap-4 xl:grid-cols-12">
            <ActionBanner
              onSetPayday={(streamId) => setDetail({ kind: 'payday', streamId })}
              onReviewStream={(streamId) => setDetail({ kind: 'stream', streamId })}
              onOpenMonth={(month) => setDetail({ kind: 'month', month })}
            />
            <SafetyHero
              onTakeQuiz={() => setDetail({ kind: 'quiz' })}
              onReviewStatus={() => setDetail({ kind: 'verify' })}
              /* A payday has a sheet of its own; anything else needs the
                 whole source editor. */
              onFixStream={(gap) => setDetail(gap.kind === 'schedule'
                ? { kind: 'payday', streamId: gap.streamId }
                : { kind: 'stream', streamId: gap.streamId })}
            />
            <PaycheckRadar
              onOpenMonth={(month) => setDetail({ kind: 'month', month })}
              onCheckNotifications={() => setNotificationsOpen(true)}
              onSetPayday={(streamId) => setDetail({ kind: 'payday', streamId })}
            />
          </div>
          <ReviewTarget
            id="classic-month-grid"
            label="Full-year month grid"
            reason="This repeats the active TWP or SGA signal across twelve tiles instead of focusing on months with 3 or 5 paychecks."
            layout="classic"
          >
            <MonthGrid onOpenMonth={(month) => setDetail({ kind: 'month', month })} />
          </ReviewTarget>
          <StreamsPanel onOpenStream={(streamId) => setDetail({ kind: 'stream', streamId })} />
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

      {/* One sheet at a time, whatever opened it. */}
      {detail ? (
        <Detail
          request={detail}
          onClose={() => setDetail(null)}
          onChild={setDetail}
          onOpenStatus={() => { setDetail(null); setStatusOpen(true); }}
        />
      ) : null}
      {statusOpen ? <StatusSheet onClose={() => setStatusOpen(false)} /> : null}
      <ToastStack />
    </div>
  );
}
