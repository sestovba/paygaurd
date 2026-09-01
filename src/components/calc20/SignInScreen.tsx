import type { AuthState } from '../../auth/useAuth';

/**
 * One button. Google is the only way in, so there is nothing to choose
 * between and no form to fill.
 */
export function SignInScreen({ auth }: { auth: AuthState }) {
  const busy = auth.phase === 'signing-in';

  return (
    <div className="signin-shell">
      <div className="signin-panel">
        <div>
          <div className="eyebrow">SSDI Income Tracker</div>
          <h1 className="signin-title">Sign in to your work record</h1>
          <p className="signin-note">
            Your earnings stay on this device. Signing in is how the app knows
            who you are.
          </p>
        </div>

        <div className="signin-actions">
          <button
            className="signin-google"
            type="button"
            onClick={auth.signIn}
            disabled={busy}
          >
            <img
              className="signin-google__mark"
              src="/google-mark.svg"
              alt=""
              width={18}
              height={18}
            />
            {busy ? 'Signing in…' : 'Continue with Google'}
          </button>

          {auth.error ? (
            <div className="signin-error" role="alert">{auth.error}</div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
