import { TrackerProvider, useTracker } from './state/TrackerProvider';
import { hasMeaningfulData } from './domain/earnings';
import { Onboarding } from './components/Onboarding';
import { TrackerClassic } from './components/TrackerClassic';
import { TrackerV2 } from './components/TrackerV2';
import { TrackerV3 } from './components/TrackerV3';
import { TrackerLedger } from './components/ledger/TrackerLedger';
import { TrackerPayGuard } from './components/payguard/TrackerPayGuard';
import { TrackerWorkRecord } from './components/workrecord/TrackerWorkRecord';
import { PayGuardShell } from './components/payguard/PayGuardShell';
import { useAuth } from './auth/useAuth';
import { SignInScreen } from './components/SignInScreen';
import { TermsGate } from './components/TermsGate';
import { TERMS_VERSION } from './domain/legal';
import { canSync, saveConsentRecord } from './state/cloudSync';
import type { Session } from './auth/session';
import type { LedgerTheme, UiState } from './state/storage';
import type { ReviewAnchor } from './review/types';
import { lazy, Suspense } from 'react';

/** The review console is a workshop tool. Loading it lazily behind this check
 *  means a published build never downloads it at all — it only exists on the
 *  dev server and on a localhost `vite preview`. */
const REVIEW_HOST = import.meta.env.DEV
  || /^(localhost|127\.0\.0\.1|\[::1\])$/.test(window.location.hostname);

const ReviewProvider = lazy(() => import('./review/ReviewProvider')
  .then((module) => ({ default: module.ReviewProvider })));

export default function App() {
  const auth = useAuth();

  // Bypassed on localhost/dev — see auth/session.ts. Everyone else sees the
  // sign-in screen once; earnings data itself never leaves the device unless
  // cloud sync is separately turned on.
  if (auth.locked) return <SignInScreen auth={auth} />;

  return (
    <TrackerProvider session={auth.session} onSignOut={auth.signOut}>
      <Root session={auth.session} />
    </TrackerProvider>
  );
}

function Root({ session }: { session: Session | null }) {
  const { data, ui, setUi } = useTracker();

  // Signed-out / local-only use never sees this — there's no identity to
  // attach consent to, so the gate only ever appears once someone signs in.
  if (session && ui.termsAcceptedVersion !== TERMS_VERSION) {
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

  if (!ui.onboarded && !hasMeaningfulData(data)) {
    // Both PayGuard-skinned layouts open onto the same palette they will
    // land in, rather than index.css's default.
    return ui.layout === 'payguard' || ui.layout === 'workrecord'
      ? <PayGuardShell><Onboarding /></PayGuardShell>
      : <Onboarding />;
  }

  const tracker = ui.layout === 'classic' ? <TrackerClassic />
    : ui.layout === 'v2' ? <TrackerV2 />
      : ui.layout === 'ledger' ? <TrackerLedger />
        : ui.layout === 'payguard' ? <TrackerPayGuard />
          : ui.layout === 'workrecord' ? <TrackerWorkRecord />
            : <TrackerV3 />;

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
