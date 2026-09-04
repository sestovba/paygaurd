import { useMemo } from 'react';
import type { AuthState } from '../../auth/useAuth';
import { loadUi } from '../../state/storage';
import { useAppearance } from './appearance';
import { AppleMark, GoogleMark } from '../signin/marks';
import { providerOrder, SIGN_IN_COPY as T, useSignInForm } from '../signin/form';

import { ButtonBase } from '../../design-system';
/**
 * The same gate as components/SignInScreen.tsx, in Calc20's skin.
 *
 * Two screens, one behaviour: the words, the validation and the order of the
 * provider buttons all come from signin/form.ts, so this file is markup and
 * nothing else. If the two ever disagree about what the screen does, this is
 * the file that has drifted.
 */
export function SignInScreen({ auth }: { auth: AuthState }) {
  const form = useSignInForm(auth);
  const order = providerOrder();

  return (
    <div className="signin-shell">
      <div className="signin-panel">
        <div>
          <div className="eyebrow">SSDI Tracker</div>
          <h1 className="signin-title">Your work record</h1>
          <p className="signin-note">{T.lede}</p>
          <p className="signin-note">{T.sublede}</p>
        </div>

        <div className="signin-actions">
          {order.map((provider, index) => (
            <ButtonBase
              key={provider}
              type="button"
              className="signin-provider"
              data-lead={index === 0}
              onClick={provider === 'apple' ? auth.signInWithApple : auth.signInWithGoogle}
              disabled={auth.pending !== null}
            >
              {provider === 'apple' ? <AppleMark /> : <GoogleMark />}
              <span>{provider === 'apple' ? T.apple : T.google}</span>
            </ButtonBase>
          ))}
        </div>

        <div className="signin-or"><span>{T.or}</span></div>

        <form className="signin-form" onSubmit={form.submit} noValidate>
          <div className="signin-row">
            <label className="signin-label" htmlFor="c20-signin-email">{T.emailLabel}</label>
            <input
              id="c20-signin-email"
              className="signin-input"
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

          <div className="signin-row">
            <div className="signin-label-row">
              <label className="signin-label" htmlFor="c20-signin-password">{T.passwordLabel}</label>
              <ButtonBase type="button" className="signin-reveal" onClick={form.togglePassword}>
                {form.passwordVisible ? T.hide : T.show}
              </ButtonBase>
            </div>
            <input
              id="c20-signin-password"
              className="signin-input"
              type={form.passwordVisible ? 'text' : 'password'}
              autoComplete="current-password"
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              value={form.password}
              onChange={(event) => form.setPassword(event.target.value)}
              aria-describedby="c20-signin-password-hint"
            />
            <p className="signin-hint" id="c20-signin-password-hint">{T.passwordHint}</p>
          </div>

          <ButtonBase type="submit" className="signin-submit" disabled={auth.pending !== null}>
            {form.submitLabel}
          </ButtonBase>
          <p className="signin-hint">{T.submitNote}</p>

          <ButtonBase type="button" className="signin-link" onClick={form.forgot} disabled={form.resetting}>
            {form.resetting ? T.forgotBusy : T.forgot}
          </ButtonBase>
        </form>

        {form.message ? (
          <p
            className="signin-message"
            data-tone={form.message.tone}
            role={form.message.tone === 'error' ? 'alert' : 'status'}
          >
            {form.message.text}
          </p>
        ) : null}

        <div className="signin-local">
          <ButtonBase type="button" className="signin-local-btn" onClick={auth.continueWithoutAccount}>
            {T.localTitle}
          </ButtonBase>
          <p className="signin-note">{T.localNote}</p>
        </div>
      </div>
    </div>
  );
}

/**
 * The same screen, wearing this layout's chrome.
 *
 * Sign-in happens before the tracker — and so before any provider — so the
 * saved preferences are read straight from storage. Someone who left the app
 * on Calc20 comes back to Calc20's sign-in rather than to PayGuard's.
 */
export function Calc20SignInScreen({ auth }: { auth: AuthState }) {
  const ui = useMemo(() => loadUi(), []);
  useAppearance({ theme: ui.theme, glassStrength: ui.calc20.glassStrength });
  return <SignInScreen auth={auth} />;
}
