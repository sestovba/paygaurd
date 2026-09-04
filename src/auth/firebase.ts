// Firebase app and auth, loaded lazily.
//
// The SDK is a large dependency and nothing needs it until someone signs in,
// so it is imported on demand rather than at module load. That keeps the
// first paint free of it and means a build with auth bypassed never fetches
// it at all.

import type { User } from 'firebase/auth';
import { firebaseConfig } from './config';

let appPromise: Promise<unknown> | null = null;

/** Shared app instance — anything needing Firebase (auth, sync) goes through this. */
export async function getApp() {
  if (!appPromise) {
    appPromise = (async () => {
      const { initializeApp, getApps } = await import('firebase/app');
      return getApps().length ? getApps()[0] : initializeApp(firebaseConfig());
    })();
  }
  return appPromise;
}

export async function getAuthInstance() {
  const [app, mod] = await Promise.all([getApp(), import('firebase/auth')]);
  return { auth: mod.getAuth(app as never), mod };
}

export interface Identity {
  uid: string;
  email: string | null;
  displayName: string | null;
  photoURL: string | null;
}

export function toIdentity(user: User): Identity {
  return {
    uid: user.uid,
    email: user.email,
    displayName: user.displayName,
    photoURL: user.photoURL
  };
}

/**
 * The popup guard.
 *
 * Web only. A Capacitor WebView cannot complete signInWithPopup — native
 * builds need @capacitor-firebase/authentication with the provider
 * configured (for Google, an SHA-1 fingerprint plus google-services.json).
 * Guarded here so the failure is a clear message rather than a hung popup.
 */
function assertPopupPossible(): void {
  if (typeof window !== 'undefined' && window.location.protocol === 'capacitor:') {
    throw new Error('NATIVE_AUTH_REQUIRED');
  }
}

/** Google sign-in. */
export async function signInWithGoogle(): Promise<Identity> {
  assertPopupPossible();

  const { auth, mod } = await getAuthInstance();
  const provider = new mod.GoogleAuthProvider();
  provider.setCustomParameters({ prompt: 'select_account' });

  const result = await mod.signInWithPopup(auth, provider);
  return toIdentity(result.user);
}

/**
 * Apple sign-in.
 *
 * Needs Apple switched on in Firebase Console → Authentication → Sign-in
 * method, which in turn needs a paid Apple Developer team, a Services ID and
 * a key. Until that is done Firebase answers `auth/operation-not-allowed`,
 * and useAuth turns that into a sentence saying so rather than a dead button.
 *
 * Apple returns the name and email only on the very first authorisation, so
 * both scopes are asked for; after that `displayName` is null and the app
 * falls back to the email, which is what `initialsFor` already expects.
 */
export async function signInWithApple(): Promise<Identity> {
  assertPopupPossible();

  const { auth, mod } = await getAuthInstance();
  const provider = new mod.OAuthProvider('apple.com');
  provider.addScope('email');
  provider.addScope('name');

  const result = await mod.signInWithPopup(auth, provider);
  return toIdentity(result.user);
}

/**
 * Email and password.
 *
 * The third way in, and the only one that needs no other company's account.
 * A lot of this app's users are on a cheap Android handset signed in to
 * somebody else's Google account, or to none — a password they chose is the
 * one route that is always theirs.
 */
export async function signInWithEmail(email: string, password: string): Promise<Identity> {
  const { auth, mod } = await getAuthInstance();
  const result = await mod.signInWithEmailAndPassword(auth, email.trim(), password);
  return toIdentity(result.user);
}

export async function createAccountWithEmail(email: string, password: string): Promise<Identity> {
  const { auth, mod } = await getAuthInstance();
  const result = await mod.createUserWithEmailAndPassword(auth, email.trim(), password);
  return toIdentity(result.user);
}

/** Sends the reset link. Resolves the same way whether or not the address has
 *  an account, so the screen never becomes a way to test which emails exist. */
export async function sendResetEmail(email: string): Promise<void> {
  const { auth, mod } = await getAuthInstance();
  try {
    await mod.sendPasswordResetEmail(auth, email.trim());
  } catch (err) {
    const code = (err as { code?: string })?.code ?? '';
    if (code === 'auth/user-not-found') return;
    throw err;
  }
}

export async function signOutOfFirebase(): Promise<void> {
  try {
    const { auth, mod } = await getAuthInstance();
    await mod.signOut(auth);
  } catch {
    // Signing out locally is what matters; a network failure here is not
    // worth surfacing.
  }
}

/** Fires once with the restored user, then on every change. */
export async function watchAuth(
  onChange: (identity: Identity | null) => void
): Promise<() => void> {
  const { auth, mod } = await getAuthInstance();
  return mod.onAuthStateChanged(auth, (user) => {
    onChange(user ? toIdentity(user) : null);
  });
}
