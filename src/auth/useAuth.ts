// Auth state for the app. One hook, so components never touch Firebase or
// localStorage directly. Google is the only provider.

import { useCallback, useEffect, useRef, useState } from 'react';
import { signInWithGoogle, signOutOfFirebase, watchAuth } from './firebase';
import {
  clearSession, isAuthBypassed, readSession, writeSession, type Session
} from './session';

export type AuthPhase = 'ready' | 'signing-in' | 'error';

export interface AuthState {
  session: Session | null;
  /** True when the sign-in screen should be shown instead of the app. */
  locked: boolean;
  phase: AuthPhase;
  error: string;
  signIn: () => Promise<void>;
  signOut: () => Promise<void>;
}

function messageFor(err: unknown): string {
  const code = (err as { code?: string })?.code ?? '';
  const raw = (err as { message?: string })?.message ?? '';

  // Closing the popup is a choice, not an error worth showing.
  if (code === 'auth/popup-closed-by-user' || code === 'auth/cancelled-popup-request') return '';

  if (raw === 'NATIVE_AUTH_REQUIRED') {
    return 'This build needs the native Google plugin.';
  }
  if (code === 'auth/popup-blocked') {
    return 'Your browser blocked the sign-in window. Allow popups for this site, then try again.';
  }
  if (code === 'auth/unauthorized-domain') {
    return 'This domain is not authorised. Add it in Firebase under Authentication → Settings → Authorized domains.';
  }
  if (code === 'auth/network-request-failed') {
    return 'No connection. Check your network and try again.';
  }
  return 'Could not sign in. Try again.';
}

export function useAuth(): AuthState {
  const [session, setSession] = useState<Session | null>(() => readSession());
  const [phase, setPhase] = useState<AuthPhase>('ready');
  const [error, setError] = useState('');
  const mounted = useRef(true);

  useEffect(() => () => { mounted.current = false; }, []);

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

  const signIn = useCallback(async () => {
    setPhase('signing-in');
    setError('');
    try {
      const identity = await signInWithGoogle();
      if (!mounted.current) return;
      setSession(writeSession(identity));
      setPhase('ready');
    } catch (err) {
      if (!mounted.current) return;
      const message = messageFor(err);
      setError(message);
      setPhase(message ? 'error' : 'ready');
    }
  }, []);

  const signOut = useCallback(async () => {
    clearSession();
    setSession(null);
    setPhase('ready');
    setError('');
    await signOutOfFirebase();
  }, []);

  return {
    session,
    locked: !isAuthBypassed() && session === null,
    phase,
    error,
    signIn,
    signOut
  };
}
