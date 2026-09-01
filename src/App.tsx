import { TrackerProvider, useTracker } from './state/TrackerProvider';
import { hasMeaningfulData } from './domain/earnings';
import { Onboarding } from './components/Onboarding';
import { PayGuardShell } from './components/payguard/PayGuardShell';
import { useAuth } from './auth/useAuth';
import { SignInScreen } from './components/SignInScreen';
import { Calc20SignInScreen } from './components/calc20/SignInScreen';
import { TermsGate } from './components/TermsGate';
import { TERMS_VERSION } from './domain/legal';
import { canSync, saveConsentRecord } from './state/cloudSync';
import type { Session } from './auth/session';
import type { LedgerTheme, UiState } from './state/storage';
import { loadUi } from './state/storage';
import type { ReviewAnchor } from './review/types';
import { lazy, Suspense } from 'react';

/** The review console is a workshop tool. Loading it lazily behind this check
 *  means a published build never downloads it at all — it only exists on the
 *  dev server and on a localhost `vite preview`. */
const REVIEW_HOST = import.meta.env.DEV
  || /^(localhost|127\.0\.0\.1|\[::1\])$/.test(window.location.hostname);

const ReviewProvider = lazy(() => import('./review/ReviewProvider')
  .then((module) => ({ default: module.ReviewProvider })));

/*
 * One layout per chunk.
 *
 * Nine layouts were shipping in a single 494kB bundle so that one of them
 * could render. On a Lifeline handset — a cheap Android on metered data,
 * which is what a large share of this app's users are holding — that is a
 * download and a parse of eight screens nobody asked for, before the ninth
 * appears. Split, the browser fetches the shell and the one layout in use.
 *
 * The fallback is deliberately `null`: these chunks are small and local, the
 * gap is a frame or two, and a spinner that flashes is worse than nothing.
 */
const LAYOUTS = {
  classic: lazy(() => import('./components/TrackerClassic').then((m) => ({ default: m.TrackerClassic }))),
  v2: lazy(() => import('./components/TrackerV2').then((m) => ({ default: m.TrackerV2 }))),
  responsive: lazy(() => import('./components/TrackerV3').then((m) => ({ default: m.TrackerV3 }))),
  ledger: lazy(() => import('./components/ledger/TrackerLedger').then((m) => ({ default: m.TrackerLedger }))),
  payguard: lazy(() => import('./components/payguard/TrackerPayGuard').then((m) => ({ default: m.TrackerPayGuard }))),
  workrecord: lazy(() => import('./components/workrecord/TrackerWorkRecord').then((m) => ({ default: m.TrackerWorkRecord }))),
  horizon: lazy(() => import('./components/horizon/TrackerHorizon').then((m) => ({ default: m.TrackerHorizon }))),
  pocket: lazy(() => import('./components/pocket/TrackerPocket').then((m) => ({ default: m.TrackerPocket }))),
  calc20: lazy(() => import('./components/calc20/TrackerCalc20').then((m) => ({ default: m.TrackerCalc20 })))
} as const;

export default function App() {
  const auth = useAuth();

  // Bypassed on localhost/dev — see auth/session.ts. Everyone else sees the
  // sign-in screen once; earnings data itself never leaves the device unless
  // cloud sync is separately turned on. The saved layout is read from
  // storage rather than context, since this sits above the provider.
  if (auth.locked) {
    return loadUi().layout === 'calc20'
      ? <Calc20SignInScreen auth={auth} />
      : <SignInScreen auth={auth} />;
  }

  return (
    <TrackerProvider session={auth.session} onSignOut={auth.signOut}>
      <Root session={auth.session} />
    </TrackerProvider>
  );
}

function Root({ session }: { session: Session | null }) {
  const { data, ui, setUi } = useTracker();

  // Calc20 was ported with its own terms gate and its own empty state, both
  // written in its visual language. It therefore takes the whole screen from
  // here rather than being dropped inside this one's gates — the consent it
  // records is the same version, against the same UiState fields.
  const calc20 = ui.layout === 'calc20';

  // Signed-out / local-only use never sees this — there's no identity to
  // attach consent to, so the gate only ever appears once someone signs in.
  if (!calc20 && session && ui.termsAcceptedVersion !== TERMS_VERSION) {
    return (
      <TermsGate
        onAgree={() => {
          const acceptedAt = new Date().toISOString();
          setUi({ termsAcceptedVersion: TERMS_VERSION, termsAcceptedAt: acceptedAt });
          if (canSync(session.email)) {
            saveConsentRecord(session.uid, TERMS_VERSION, acceptedAt).catch(() => {
              // Offline, or rules not deployed yet — local acceptance still stands.
            });
          }
        }}
      />
    );
  }

  if (!calc20 && !ui.onboarded && !hasMeaningfulData(data)) {
    // Both PayGuard-skinned layouts open onto the same palette they will
    // land in, rather than index.css's default.
    return ui.layout === 'payguard' || ui.layout === 'workrecord'
      ? <PayGuardShell><Onboarding /></PayGuardShell>
      : <Onboarding />;
  }

  const Layout = LAYOUTS[ui.layout] ?? LAYOUTS.responsive;
  const tracker = (
    <Suspense fallback={null}>
      <Layout />
    </Suspense>
  );

  if (!REVIEW_HOST) return tracker;

  return (
    <Suspense fallback={tracker}>
      <ReviewProvider
        layout={ui.layout}
        onNavigate={(anchor: ReviewAnchor) => setUi(uiPatchForAnchor(anchor))}
      >
        {tracker}
      </ReviewProvider>
    </Suspense>
  );
}

/** A review note remembers which layout and palette it was written under, so
 *  following one puts the app back in that state rather than dropping you on
 *  the current screen and hoping. */
function uiPatchForAnchor(anchor: ReviewAnchor): Partial<UiState> {
  const patch: Partial<UiState> = { layout: anchor.layout };
  const sub = anchor.theme?.sub as LedgerTheme | undefined;

  if (sub) {
    if (anchor.layout === 'ledger') patch.ledgerTheme = sub;
    if (anchor.layout === 'payguard') patch.payguardTheme = sub;
    if (anchor.layout === 'workrecord') patch.workRecordTheme = sub;
  }
  // Ledger owns its own palette; the light/dark switch is for the others.
  if (anchor.layout !== 'ledger' && anchor.theme?.dark !== undefined) {
    patch.theme = anchor.theme.dark ? 'dark' : 'light';
  }
  return patch;
}
