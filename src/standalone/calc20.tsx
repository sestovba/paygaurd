/*
 * Entry point for the standalone Calc20 page.
 *
 * src/main.tsx boots the whole app: sign-in, the onboarding gate, the terms
 * gate, nine other layouts behind lazy imports, and the review console. This
 * boots one layout on the same data and nothing else.
 *
 * What it deliberately leaves out:
 *
 *   * Auth. There is no session, so the header shows no account and cloud
 *     sync stays hidden — the same state the app is in on localhost, where
 *     isAuthBypassed() already turns the gate off. See firebase-absent.ts
 *     for why the SDK is not in the file either.
 *   * The layout switcher, which would offer eight screens this page cannot
 *     draw. VITE_STANDALONE takes that row out of Settings; the config sets
 *     it, so the export can never be built with the row left in.
 *   * The review console, which App.tsx owns and this entry never imports.
 *
 * The data is not left out. Reads and writes go to the same `pg-data-v1`
 * record in localStorage, so a browser that has used PayGuard opens this
 * page on the months it already has — and anything typed here is there when
 * the full app is opened again.
 */

import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { TrackerProvider } from '../state/TrackerProvider';
import { TrackerCalc20 } from '../components/calc20/TrackerCalc20';

/* The four the layout actually reads. main.tsx also loads ledger, payguard
   and workrecord; every rule in those is scoped to its own layout class, so
   none of them can reach this screen and none of them are worth the bytes.
   Order matters for the last two exactly as it does there: chrome after the
   layout so .pg-calc20 can override the shared toasts, overlay last. */
import '../index.css';
import '../styles/calc20.css';
import '../styles/chrome.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <TrackerProvider>
      <TrackerCalc20 />
    </TrackerProvider>
  </StrictMode>
);
