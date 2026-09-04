import { lazy, Suspense } from 'react';
import '../../styles/overview.css';
import { useTracker } from '../../state/TrackerProvider';

/**
 * Overview — one layout, three shells.
 *
 * This was three layouts: classic, v2 and responsive. They were never three
 * layouts. Every content surface they draw — the action banner, the safety
 * hero, the paycheck radar, the month grid, the streams panel, the year
 * total, and all six detail views — is used by those three and by nothing
 * else in the app. What actually differed was the chrome around them and
 * where a detail opens, and that is an option:
 *
 *   scroll     One page, everything down it, details as sheets over the top.
 *   pages      Overview / Income / Your limit as separate pages. A detail
 *              replaces the page and offers a way back.
 *   workspace  The same pages, but a detail opens BESIDE what you were
 *              looking at, and both stay on screen.
 *
 * Kept as three files rather than one component full of `if (shell === …)`,
 * because the chrome genuinely is three different things — a scroll has no
 * navigation to speak of, and the workspace has a pane stack the other two
 * have no use for. The shared half lives in `Detail.tsx` and `Surfaces.tsx`
 * and is written once.
 *
 * Lazily loaded for the same reason App.tsx splits the layouts: a phone on
 * metered data should fetch the shell in use, not all three.
 */
const SHELLS = {
  scroll: lazy(() => import('./ScrollShell').then((m) => ({ default: m.ScrollShell }))),
  pages: lazy(() => import('./PagesShell').then((m) => ({ default: m.PagesShell }))),
  workspace: lazy(() => import('./WorkspaceShell').then((m) => ({ default: m.WorkspaceShell })))
} as const;

export function TrackerOverview() {
  const { ui } = useTracker();
  const Shell = SHELLS[ui.overviewShell] ?? SHELLS.pages;
  return (
    <Suspense fallback={null}>
      <Shell />
    </Suspense>
  );
}
