// Where the sign-in gate applies, and the local session record.
//
// Google is the only way in. Earnings data still lives on the device and
// never leaves it unless cloud sync is explicitly turned on — signing in
// identifies the person for display and for that optional sync. It is not a
// lock on the data.

import type { Identity } from './firebase';

const SESSION_KEY = 'pg-session-v1';

/**
 * True where the gate should never appear: local development, a file:// open,
 * and Capacitor native builds, which cannot run the popup flow.
 */
export function isAuthBypassed(): boolean {
  if (typeof window === 'undefined') return true;

  const { protocol, hostname } = window.location;

  if (protocol === 'file:' || protocol === 'capacitor:') return true;
  if (hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '::1') return true;
  if (hostname === '' || hostname.endsWith('.local')) return true;

  const meta = (import.meta as unknown as { env?: Record<string, unknown> }).env;
  if (meta?.DEV) return true;

  return false;
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
  return !isAuthBypassed() && readSession() === null;
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
