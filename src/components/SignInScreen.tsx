import { useState } from 'react';
import type { AuthState } from '../auth/useAuth';
import { loadUi, saveUiPatch } from '../state/storage';
import type { LayoutMode } from '../state/storage';
import { BrandMark } from './ui';
import { PayGuardShell } from './payguard/PayGuardShell';
import { LayoutSwitcher } from './LayoutSwitcher';
import { AppleMark, GoogleMark } from './signin/marks';
import { providerOrder, SIGN_IN_COPY as T, useSignInForm } from './signin/form';

import { ButtonBase } from '../design-system';
/**
 * The gate, in PayGuard's skin. Calc20 draws the same screen in its own —
 * everything that is not markup is shared, in signin/form.ts.
 *
 * Three things here are decisions rather than styling:
 *
 * 1. Real labels above the fields, not placeholders inside them. A
 *    placeholder disappears the moment you type, which leaves someone
 *    checking their own work looking at two unlabelled boxes; it is also the
 *    lowest-contrast text on the screen, on an app whose readers include
 *    people who cannot read low-contrast text.
 * 2. A Show button on the password. Typing a password blind, on a phone, is
 *    where this form is lost — and the alternative to showing it is three
 *    failed attempts and a rate limit.
 * 3. "Use it without an account" is a real way through, not a link to
 *    somewhere else. Nobody on SSDI should be locked out of a calculator by
 *    a company's sign-in.
 * 4. One form, not a sign-in tab and a register tab. Which of the two is
 *    happening is the server's question to answer, not the reader's — see
 *    continueWithEmail in auth/useAuth.ts.
 */
export function SignInScreen({ auth }: { auth: AuthState }) {
  const form = useSignInForm(auth);
  const order = providerOrder();

  /* The layout picker is a workshop control, not a step in signing in — it
   * belongs to whoever is comparing the eight layouts, and everyone else is
   * here to get in. `?signin` is the flag that renders this screen on a host
   * that would otherwise skip it (auth/session.ts), so it is exactly the
   * flag that says a maintainer is looking. Everyone else changes layout in
   * Settings, where the rest of the preferences are. */
  const workshop = new URLSearchParams(window.location.search).has('signin');
  const [layout, setLayout] = useState<LayoutMode>(() => loadUi().layout);

  function changeLayout(nextLayout: LayoutMode) {
    setLayout(saveUiPatch({ layout: nextLayout }).layout);
  }

  return (
    <PayGuardShell>
      <div className="pg-signin">
        <header className="pg-signin-head">
          <BrandMark />
          <p className="pg-signin-lede">{T.lede}</p>
          <p className="pg-signin-sub">{T.sublede}</p>
        </header>

        <div className="pg-signin-providers">
          {order.map((provider, index) => (
            <ButtonBase
              key={provider}
              type="button"
              className="pg-signin-provider"
              data-lead={index === 0}
              onClick={provider === 'apple' ? auth.signInWithApple : auth.signInWithGoogle}
              disabled={auth.pending !== null}
            >
              {provider === 'apple' ? <AppleMark /> : <GoogleMark />}
              <span>{provider === 'apple' ? T.apple : T.google}</span>
            </ButtonBase>
          ))}
        </div>

        <div className="pg-signin-or"><span>{T.or}</span></div>

        <form className="pg-signin-form" onSubmit={form.submit} noValidate>
          <div className="pg-signin-row">
            <label className="pg-signin-label" htmlFor="pg-signin-email">{T.emailLabel}</label>
            <input
              id="pg-signin-email"
              className="pg-signin-input"
              type="email"
              inputMode="email"
              autoComplete="email"
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              value={form.email}
              onChange={(event) => form.setEmail(event.target.value)}
            />
          </div>

          <div className="pg-signin-row">
            <div className="pg-signin-label-row">
              <label className="pg-signin-label" htmlFor="pg-signin-password">{T.passwordLabel}</label>
              <ButtonBase type="button" className="pg-signin-reveal" onClick={form.togglePassword}>
                {form.passwordVisible ? T.hide : T.show}
              </ButtonBase>
            </div>
            <input
              id="pg-signin-password"
              className="pg-signin-input"
              type={form.passwordVisible ? 'text' : 'password'}
              autoComplete="current-password"
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              value={form.password}
              onChange={(event) => form.setPassword(event.target.value)}
              aria-describedby="pg-signin-password-hint"
            />
            <p className="pg-signin-hint" id="pg-signin-password-hint">{T.passwordHint}</p>
          </div>

          <ButtonBase type="submit" className="pg-signin-submit" disabled={auth.pending !== null}>
            {form.submitLabel}
          </ButtonBase>
          <p className="pg-signin-hint">{T.submitNote}</p>

          <ButtonBase type="button" className="pg-signin-link" onClick={form.forgot} disabled={form.resetting}>
            {form.resetting ? T.forgotBusy : T.forgot}
          </ButtonBase>
        </form>

        {form.message ? (
          <p
            className="pg-signin-message"
            data-tone={form.message.tone}
            role={form.message.tone === 'error' ? 'alert' : 'status'}
          >
            {form.message.text}
          </p>
        ) : null}

        <div className="pg-signin-local">
          <ButtonBase type="button" className="pg-signin-local-btn" onClick={auth.continueWithoutAccount}>
            {T.localTitle}
          </ButtonBase>
          <p className="pg-signin-note">{T.localNote}</p>
        </div>

        {workshop ? (
          <div className="pg-signin-workshop">
            <LayoutSwitcher value={layout} onChange={changeLayout} variant="select" />
          </div>
        ) : null}
      </div>
    </PayGuardShell>
  );
}
