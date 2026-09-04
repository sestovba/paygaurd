// Where the sign-in gate applies, and the local session record.
//
// Google, Apple, or an email address and a password — and, below them, the
// way past without any of the three. Earnings data lives on the device
// whichever route is taken and never leaves it unless cloud sync is turned
// on, which is gated to an allowlist in state/cloudSync.ts. Signing in
// identifies the person for display and for that optional sync. It has never
// been a lock on the data, which is why "use it without an account" can be a
// real answer rather than a smaller door.

import type { Identity } from './firebase';

const SESSION_KEY = 'pg-session-v1';

/**
 * True where the gate should never appear: local development, a file:// open,
 * and Capacitor native builds, which cannot run the popup flow.
 */
export function isAuthBypassed(): boolean {
  if (typeof window === 'undefined') return true;

  // Design work on the gate. It is bypassed on every host it can be worked
  // on, so without this the screen could only be seen by deploying it —
  // which is how it went a year without being looked at. `?signin` renders
  // the screen and grants nothing; it cannot let anyone past a gate that is
  // already open here.
  if (new URLSearchParams(window.location.search).has('signin')) return false;

  const { protocol, hostname } = window.location;

  if (protocol === 'file:' || protocol === 'capacitor:') return true;
  if (hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '::1') return true;
  if (hostname === '' || hostname.endsWith('.local')) return true;

  const meta = (import.meta as unknown as { env?: Record<string, unknown> }).env;
  if (meta?.DEV) return true;

  return false;
}

/*
 * Using it without an account.
 *
 * The gate asks who you are so the app can put a name on the record and, for
 * an allowlisted address, sync it. Neither is worth locking someone out over:
 * the earnings live on the device either way. This flag is that answer —
 * "no account" — remembered so they are not asked again.
 *
 * It deliberately does not create a Session. A local user stays `session:
 * null`, which is exactly the shape the app already handles on localhost, so
 * cloud sync stays off and the terms gate (which needs an identity to attach
 * consent to) stays out of the way. Signing in later is the same screen again.
 */
const LOCAL_ONLY_KEY = 'pg-local-only-v1';

export function readLocalOnly(): boolean {
  try {
    return localStorage.getItem(LOCAL_ONLY_KEY) === '1';
  } catch {
    return false;
  }
}

export function writeLocalOnly(on: boolean): void {
  try {
    if (on) localStorage.setItem(LOCAL_ONLY_KEY, '1');
    else localStorage.removeItem(LOCAL_ONLY_KEY);
  } catch { /* storage unavailable; the choice lasts this session only */ }
}

export interface Session {
  uid: string;
  email: string | null;
  displayName: string | null;
  photoURL: string | null;
  at: number;
}

export function readSession(): Session | null {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Session;
    return parsed && typeof parsed.uid === 'string' ? parsed : null;
  } catch {
    return null;
  }
}

export function writeSession(identity: Identity): Session {
  const session: Session = { ...identity, at: Date.now() };
  try {
    localStorage.setItem(SESSION_KEY, JSON.stringify(session));
  } catch { /* storage unavailable; session stays in memory */ }
  return session;
}

export function clearSession(): void {
  try {
    localStorage.removeItem(SESSION_KEY);
  } catch { /* ignore */ }
}

export function requiresSignIn(): boolean {
  return !isAuthBypassed() && readSession() === null && !readLocalOnly();
}

/**
 * Initials for the avatar. Two names give first and last; one name gives its
 * first two letters. Falls back to the email local part, then a dash — never
 * an empty circle.
 */
export function initialsFor(session: Session | null): string {
  const name = session?.displayName?.trim();
  if (name) {
    const parts = name.split(/\s+/).filter(Boolean);
    if (parts.length > 1) {
      return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    }
    return name.slice(0, 2).toUpperCase();
  }

  const email = session?.email?.trim();
  if (email) return email.slice(0, 2).toUpperCase();

  return '—';
}

export function displayNameFor(session: Session | null): string {
  if (!session) return 'Not signed in';
  return session.displayName || session.email || 'Signed in';
}
