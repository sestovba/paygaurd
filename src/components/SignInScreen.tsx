import { useState } from 'react';
import type { AuthState } from '../auth/useAuth';
import { loadUi, saveUiPatch } from '../state/storage';
import type { LayoutMode } from '../state/storage';
import { BrandMark } from './ui';
import { PayGuardShell } from './payguard/PayGuardShell';
import { LayoutSwitcher } from './LayoutSwitcher';

/**
 * The Google mark, inlined rather than loaded from /public. This build ships
 * with base './' to arbitrary subpaths, where a URL for the asset resolves
 * against whatever directory the page happens to sit in — an <img> here broke
 * on every deploy that was not the origin root. Inline markup has no path to
 * get wrong, and costs one fewer request on the one screen that blocks entry.
 */
function GoogleMark() {
  return (
    <svg width={18} height={18} viewBox="0 0 18 18" aria-hidden="true" focusable="false">
      <path fill="#4285F4" d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.717v2.258h2.908c1.702-1.567 2.684-3.874 2.684-6.615z" />
      <path fill="#34A853" d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332C2.438 15.983 5.482 18 9 18z" />
      <path fill="#FBBC05" d="M3.964 10.71c-.18-.54-.282-1.117-.282-1.71s.102-1.17.282-1.71V4.958H.957C.348 6.173 0 7.548 0 9s.348 2.827.957 4.042l3.007-2.332z" />
      <path fill="#EA4335" d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0 5.482 0 2.438 2.017.957 4.958L3.964 7.29C4.672 5.163 6.656 3.58 9 3.58z" />
    </svg>
  );
}

/** Google is the only sign-in method; the separate layout choice is a
 * device-local preference and never depends on an authenticated session. */
export function SignInScreen({ auth }: { auth: AuthState }) {
  const busy = auth.phase === 'signing-in';
  const [layout, setLayout] = useState<LayoutMode>(() => loadUi().layout);

  function changeLayout(nextLayout: LayoutMode) {
    setLayout(saveUiPatch({ layout: nextLayout }).layout);
  }

  return (
    <PayGuardShell>
      <div className="panel flex w-full max-w-sm flex-col gap-6 p-6 sm:p-8">
        <BrandMark />
        <div>
          <p className="label-caps text-accent-foreground">PayGuard</p>
          <h1 className="display-figure mt-1 text-3xl">Sign in to your work record</h1>
          <p className="type-muted mt-2">
            Your earnings stay on this device. Signing in is how the app knows
            who you are.
          </p>
        </div>

        <LayoutSwitcher value={layout} onChange={changeLayout} variant="select" />

        <div className="flex flex-col gap-3">
          <button
            type="button"
            onClick={auth.signIn}
            disabled={busy}
            className="pg-btn pg-btn-lg w-full gap-2.5 text-sm disabled:opacity-60"
          >
            <GoogleMark />
            {busy ? 'Signing in…' : 'Continue with Google'}
          </button>

          {auth.error ? (
            <div role="alert" className="rounded-lg border border-destructive/30 bg-destructive/10 px-3.5 py-3 text-sm text-destructive">
              {auth.error}
            </div>
          ) : null}
        </div>
      </div>
    </PayGuardShell>
  );
}
