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
import type { Palette, UiState } from './state/storage';
import { isLegacyLayoutId, loadUi, SHELL_FOR_LEGACY } from './state/storage';
import type { ReviewAnchor } from './review/types';
import { lazy, Suspense } from 'react';

/** The review console is a workshop tool. Loading it lazily behind this check
 *  means a published build never downloads it at all — it only exists on the
 *  dev server and on a localhost `vite preview`. */
const REVIEW_HOST = import.meta.env.DEV
  || /^(localhost|127\.0\.0\.1|\[::1\])$/.test(window.location.hostname);

/* The console renders the app inside a narrow frame when a phone width is
 * chosen, so the app's own media queries resolve against a real viewport
 * rather than a narrow box in a wide one. That frame loads this same page,
 * which must therefore come up as the app alone — otherwise every frame
 * carries another console, each with its own frame. */
const FRAMED = new URLSearchParams(window.location.search).get('frame') === '1';

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
  overview: lazy(() => import('./components/overview/TrackerOverview').then((m) => ({ default: m.TrackerOverview }))),
  ledger: lazy(() => import('./components/ledger/TrackerLedger').then((m) => ({ default: m.TrackerLedger }))),
  payguard: lazy(() => import('./components/payguard/TrackerPayGuard').then((m) => ({ default: m.TrackerPayGuard }))),
  workrecord: lazy(() => import('./components/workrecord/TrackerWorkRecord').then((m) => ({ default: m.TrackerWorkRecord }))),
  horizon: lazy(() => import('./components/horizon/TrackerHorizon').then((m) => ({ default: m.TrackerHorizon }))),
  pocket: lazy(() => import('./components/pocket/TrackerPocket').then((m) => ({ default: m.TrackerPocket }))),
  charm: lazy(() => import('./components/charm/TrackerCharm').then((m) => ({ default: m.TrackerCharm }))),
  plan: lazy(() => import('./components/plan/TrackerPlan').then((m) => ({ default: m.TrackerPlan }))),
  calc20: lazy(() => import('./components/calc20/TrackerCalc20').then((m) => ({ default: m.TrackerCalc20 }))),
  beautiful: lazy(() => import('./components/beautiful/TrackerBeautiful').then((m) => ({ default: m.TrackerBeautiful })))
} as const;

/**
 * The class each layout draws its own root <div> with — `.pl` for plan, `.hz`
 * for horizon, and so on. Screens that render BEFORE a layout mounts (the
 * introduction, and the sign-in and terms gates above it) have no such div of
 * their own, so this is how they borrow one. See the note in Root below.
 *
 * payguard and workrecord are absent on purpose: they share a real shell
 * component, PayGuardShell, which does more than set a class.
 */
const ROOT_CLASS: Partial<Record<UiState['layout'], string>> = {
  overview: 'pg-overview',
  ledger: 'pg-ledger',
  horizon: 'hz',
  pocket: 'pk',
  charm: 'ch',
  plan: 'pl',
  beautiful: 'bb'
};

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
    /*
     * The introduction wears the layout it is about to open into.
     *
     * "Why does that introduction look the same for plan, and not styled like
     * plan?" — because it was not inside plan, or inside anything. Only the
     * two PayGuard-skinned layouts wrapped it; every other layout got a bare
     * <Onboarding /> with no root class on it at all. A layout's stylesheet
     * is scoped to that class, so outside it the screen resolved none of the
     * --pg-* scale and fell back to whatever index.css happened to say. Which
     * is also why its buttons had square corners: `.btn-primary` asks for
     * var(--pg-radius-md), and an unresolved var() drops the declaration
     * rather than falling back. One shared screen, eight layouts, and it
     * belonged to none of them.
     *
     * ROOT_CLASS is the same class each TrackerX renders on its own outermost
     * div. Nothing is duplicated: adding a layout means adding its id here
     * beside the import above, and if it is missed the screen is exactly as
     * unstyled as it was before — never worse.
     */
    const shell = <Onboarding />;
    return ui.layout === 'payguard' || ui.layout === 'workrecord'
      ? <PayGuardShell>{shell}</PayGuardShell>
      : <div className={ROOT_CLASS[ui.layout] ?? ''} data-chrome-root>{shell}</div>;
  }

  const Layout = LAYOUTS[ui.layout] ?? LAYOUTS.plan;
  const tracker = (
    <Suspense fallback={null}>
      <Layout />
    </Suspense>
  );

  if (!REVIEW_HOST || FRAMED) return tracker;

  return (
    <Suspense fallback={tracker}>
      <ReviewProvider
        layout={ui.layout}
        shell={ui.overviewShell}
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
  const patch: Partial<UiState> = isLegacyLayoutId(anchor.layout)
    ? {}
    : { layout: anchor.layout };
  const sub = anchor.theme?.sub as Palette | undefined;

  /* A note taken before classic / v2 / responsive became one layout names
     one of the three, and that is exactly which shell it was written
     against — so it sets the shell rather than being dropped. */
  if (isLegacyLayoutId(anchor.layout)) {
    patch.layout = 'overview';
    patch.overviewShell = SHELL_FOR_LEGACY[anchor.layout];
  }

  // One palette field, so no per-layout branch — and no exception for
  // ledger, which now takes the app's light/dark like everything else.
  if (sub) patch.palette = sub;
  if (anchor.theme?.dark !== undefined) {
    patch.theme = anchor.theme.dark ? 'dark' : 'light';
  }
  return patch;
}
