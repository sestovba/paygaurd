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
 * Google sign-in.
 *
 * Web only. A Capacitor WebView cannot complete signInWithPopup — native
 * builds need @capacitor-firebase/authentication with Google Sign-In
 * configured (SHA-1 fingerprint plus google-services.json). Guarded here so
 * the failure is a clear message rather than a hung popup.
 */
export async function signInWithGoogle(): Promise<Identity> {
  if (typeof window !== 'undefined' && window.location.protocol === 'capacitor:') {
    throw new Error('NATIVE_AUTH_REQUIRED');
  }

  const { auth, mod } = await getAuthInstance();
  const provider = new mod.GoogleAuthProvider();
  provider.setCustomParameters({ prompt: 'select_account' });

  const result = await mod.signInWithPopup(auth, provider);
  return toIdentity(result.user);
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
