// Auth state for the app. One hook, so components never touch Firebase or
// localStorage directly.
//
// Three ways in and one way past. Google and Apple are one tap for anyone
// already signed in to the handset; an email address and a password is the
// route that belongs to nobody else and works on a borrowed phone. "Use it
// without an account" is not a fourth provider — it is the answer "none of
// these", and it is honoured, because the earnings never leave the device
// either way (see auth/session.ts).
//
// There is no sign-in-or-register choice. Asking someone which one they are
// is asking them to remember whether they have been here before, on the one
// screen where being wrong stops them — and it is a question the server can
// answer. `continueWithEmail` answers it: see the note on that function.

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  createAccountWithEmail, sendResetEmail, signInWithApple, signInWithEmail,
  signInWithGoogle, signOutOfFirebase, watchAuth, type Identity
} from './firebase';
import {
  clearSession, isAuthBypassed, readLocalOnly, readSession, writeLocalOnly,
  writeSession, type Session
} from './session';

export type AuthPhase = 'ready' | 'signing-in' | 'error';

/** Which button is waiting. One spinner on the control that was pressed
 *  beats a screen-wide busy state that disables the others for no reason. */
export type AuthMethod = 'google' | 'apple' | 'email' | 'reset';

export interface AuthState {
  session: Session | null;
  /** True when the sign-in screen should be shown instead of the app. */
  locked: boolean;
  phase: AuthPhase;
  pending: AuthMethod | null;
  error: string;
  /** Something that went right and is not a screen change — the reset email. */
  notice: string;
  signInWithGoogle: () => Promise<void>;
  signInWithApple: () => Promise<void>;
  /** One form for both. Signs in if the account exists, creates it if not. */
  continueWithEmail: (email: string, password: string) => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
  /** Past the gate with no account. Reversible: signing out returns here. */
  continueWithoutAccount: () => void;
  signOut: () => Promise<void>;
}

/**
 * The answers that can mean "there is no account at this address yet".
 *
 * `invalid-credential` is the one that matters: with email enumeration
 * protection on — the default — it is what Firebase says for a wrong password
 * *and* for an address it has never seen. The two are told apart by trying to
 * create the account, not by this list.
 */
const MIGHT_BE_NEW = new Set([
  'auth/invalid-credential',
  'auth/invalid-login-credentials',
  'auth/user-not-found'
]);

/** Raised by the router when creating proves the account was already there. */
const WRONG_PASSWORD = 'WRONG_PASSWORD';

const WRONG_PASSWORD_SAID =
  'There is an account for that email address, and that is not its password. '
  + 'Try again, or use the reset link below.';

/**
 * Firebase's codes, said out loud.
 *
 * Every string here is aimed at someone who is not going to look anything up:
 * what happened, and what to do next, in that order. No code numbers, no
 * "authentication", no "credential".
 */
function messageFor(err: unknown): string {
  const code = (err as { code?: string })?.code ?? '';
  const raw = (err as { message?: string })?.message ?? '';

  // Closing the popup is a choice, not an error worth showing.
  if (code === 'auth/popup-closed-by-user' || code === 'auth/cancelled-popup-request') return '';

  if (raw === 'NATIVE_AUTH_REQUIRED') {
    return 'This build needs the native Google plugin.';
  }
  if (raw === WRONG_PASSWORD) {
    return WRONG_PASSWORD_SAID;
  }

  switch (code) {
    case 'auth/popup-blocked':
      return 'Your browser blocked the sign-in window. Allow pop-ups for this site, then try again.';
    case 'auth/unauthorized-domain':
      return 'This domain is not authorised. Add it in Firebase under Authentication → Settings → Authorized domains.';
    case 'auth/operation-not-allowed':
      return 'That way in is not switched on yet. Use one of the others.';
    case 'auth/network-request-failed':
      return 'No connection. Check your network and try again.';
    case 'auth/invalid-email':
      return 'That does not look like an email address.';
    case 'auth/missing-password':
      return 'Type your password.';
    case 'auth/email-already-in-use':
      return WRONG_PASSWORD_SAID;
    case 'auth/weak-password':
      return 'Choose a longer password — at least 6 characters.';
    case 'auth/user-disabled':
      return 'That account has been turned off.';
    case 'auth/too-many-requests':
      return 'Too many tries. Wait a few minutes, then try again.';
    // Firebase answers the same way for a wrong password and an address with
    // no account, so the app has to as well — and should, since saying which
    // one it was tells a stranger whether an address has an account here.
    case 'auth/invalid-credential':
    case 'auth/wrong-password':
    case 'auth/user-not-found':
      return WRONG_PASSWORD_SAID;
    default:
      return 'Could not sign in. Try again.';
  }
}

export function useAuth(): AuthState {
  const [session, setSession] = useState<Session | null>(() => readSession());
  const [localOnly, setLocalOnly] = useState<boolean>(() => readLocalOnly());
  const [phase, setPhase] = useState<AuthPhase>('ready');
  const [pending, setPending] = useState<AuthMethod | null>(null);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const mounted = useRef(true);

  /*
   * Set true on mount, not just false on unmount.
   *
   * StrictMode mounts, unmounts and remounts every component in development.
   * A latch that is only ever cleared therefore stays cleared for the rest of
   * the component's life, and every `if (!mounted.current) return` after an
   * await silently threw the result away — the sign-in screen sat on "One
   * moment…" for ever, in dev, whatever Firebase answered. It worked in a
   * production build, which is the worst version of this: the one screen that
   * cannot be reached on localhost was also the one that behaved differently
   * there.
   */
  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; };
  }, []);

  // Pick up a Firebase session restored from a previous visit, so a signed-in
  // user is not asked again. Skipped where auth is bypassed, which keeps the
  // SDK out of local development entirely.
  useEffect(() => {
    if (isAuthBypassed()) return;

    let stop: (() => void) | undefined;
    let cancelled = false;

    watchAuth((identity) => {
      if (cancelled) return;
      if (identity) setSession(writeSession(identity));
      else setSession(null);
    })
      .then((unsub) => { stop = unsub; })
      .catch(() => { /* offline or blocked; a stored session still applies */ });

    return () => { cancelled = true; if (stop) stop(); };
  }, []);

  /** Every way in has the same three beats, so they are written once. */
  const attempt = useCallback(async (method: AuthMethod, run: () => Promise<Identity>) => {
    setPhase('signing-in');
    setPending(method);
    setError('');
    setNotice('');
    try {
      const identity = await run();
      if (!mounted.current) return;
      setSession(writeSession(identity));
      // Signing in supersedes an earlier "no account", so the choice does not
      // sit in storage waiting to skip the gate for the next person.
      writeLocalOnly(false);
      setLocalOnly(false);
      setPhase('ready');
      setPending(null);
    } catch (err) {
      if (!mounted.current) return;
      const message = messageFor(err);
      setError(message);
      setPhase(message ? 'error' : 'ready');
      setPending(null);
    }
  }, []);

  const googleIn = useCallback(() => attempt('google', signInWithGoogle), [attempt]);
  const appleIn = useCallback(() => attempt('apple', signInWithApple), [attempt]);

  /**
   * The one email button, and the routing behind it.
   *
   * Sign in first, because most people pressing it have been here before —
   * that is one round trip for the common case. Only the failures that can
   * mean "no account at this address" fall through to creating one, and if
   * creating answers `email-already-in-use` then the address does have an
   * account and the password was simply wrong, which is what the reader is
   * told. A network failure or a rate limit never reaches the create branch.
   *
   * The reason it has to be inferred at all is Firebase's email enumeration
   * protection, which is on by default and deliberately makes "wrong
   * password" and "no such account" the same answer (auth/invalid-credential),
   * and empties fetchSignInMethodsForEmail. Asking outright is not available;
   * this is the shape that stays correct whether or not it is switched on.
   *
   * It does mean a mistyped address makes a second, empty account rather than
   * refusing. That is the trade every combined form makes, and here it lands
   * softly: the record is on the device, so the cost is one wrong name on it.
   */
  const continueWithEmail = useCallback(
    (email: string, password: string) => attempt('email', async () => {
      try {
        return await signInWithEmail(email, password);
      } catch (err) {
        const code = (err as { code?: string })?.code ?? '';
        if (!MIGHT_BE_NEW.has(code)) throw err;

        try {
          return await createAccountWithEmail(email, password);
        } catch (createErr) {
          const createCode = (createErr as { code?: string })?.code ?? '';
          if (createCode === 'auth/email-already-in-use') throw new Error(WRONG_PASSWORD);
          throw createErr;
        }
      }
    }),
    [attempt]
  );

  const resetPassword = useCallback(async (email: string) => {
    setPending('reset');
    setError('');
    setNotice('');
    try {
      await sendResetEmail(email);
      if (!mounted.current) return;
      setNotice(`If there is an account for ${email.trim()}, a link to set a new password is on its way there.`);
      setPhase('ready');
    } catch (err) {
      if (!mounted.current) return;
      const message = messageFor(err);
      setError(message || 'Could not send that email. Try again.');
      setPhase('error');
    } finally {
      if (mounted.current) setPending(null);
    }
  }, []);

  const continueWithoutAccount = useCallback(() => {
    writeLocalOnly(true);
    setLocalOnly(true);
    setError('');
    setNotice('');
    setPhase('ready');
  }, []);

  const signOut = useCallback(async () => {
    clearSession();
    writeLocalOnly(false);
    setSession(null);
    setLocalOnly(false);
    setPhase('ready');
    setPending(null);
    setError('');
    setNotice('');
    await signOutOfFirebase();
  }, []);

  return {
    session,
    locked: !isAuthBypassed() && session === null && !localOnly,
    phase,
    pending,
    error,
    notice,
    signInWithGoogle: googleIn,
    signInWithApple: appleIn,
    continueWithEmail,
    resetPassword,
    continueWithoutAccount,
    signOut
  };
}
