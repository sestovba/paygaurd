// Cloud sync for the tracker JSON — gated to a short allowlist of accounts.
//
// Everyone else's data stays exactly as before: device-only, never touching
// Firebase. This check is a convenience, not the real boundary — the
// Firestore security rules enforce the same allowlist server-side, so a
// signed-in account outside it is refused by Firestore even if this check
// were bypassed.
//
// This app shares a Firebase project with sga_calc20 (same allowlisted
// Google account), but writes to its own `paycheckGuardUsers` collection —
// a distinct path so the two apps' synced data can never collide or
// overwrite each other. See firestore.rules.example for the security rule
// this collection needs added to the project.

import type { TrackerData } from '../domain/types';
import { getApp } from '../auth/firebase';

const FLAGGED_EMAILS = ['sergystovba@gmail.com'];
const COLLECTION = 'paycheckGuardUsers';

export function canSync(email: string | null | undefined): boolean {
  return Boolean(email && FLAGGED_EMAILS.includes(email.toLowerCase()));
}

async function getStore() {
  const [app, mod] = await Promise.all([getApp(), import('firebase/firestore')]);
  return { db: mod.getFirestore(app as never), mod };
}

/** Null when there is nothing saved yet for this account. */
export async function loadCloudData(uid: string): Promise<TrackerData | null> {
  const { db, mod } = await getStore();
  const snap = await mod.getDoc(mod.doc(db, COLLECTION, uid));
  if (!snap.exists()) return null;
  const stored = snap.data().trackerData;
  return stored && typeof stored === 'object' ? stored as TrackerData : null;
}

export async function saveCloudData(uid: string, data: TrackerData): Promise<void> {
  const { db, mod } = await getStore();
  await mod.setDoc(mod.doc(db, COLLECTION, uid), {
    trackerData: data,
    updatedAt: Date.now()
  });
}

/** Turning cloud sync off removes the account's copy, not just this device's link to it. */
export async function deleteCloudData(uid: string): Promise<void> {
  const { db, mod } = await getStore();
  await mod.deleteDoc(mod.doc(db, COLLECTION, uid));
}

/**
 * A durable, off-device record that this account agreed to the terms —
 * independent of whether data sync itself is turned on, so accepting terms
 * never silently starts syncing earnings data too.
 */
export async function saveConsentRecord(uid: string, version: string, acceptedAt: string): Promise<void> {
  const { db, mod } = await getStore();
  await mod.setDoc(
    mod.doc(db, COLLECTION, uid),
    { termsAcceptedVersion: version, termsAcceptedAt: acceptedAt },
    { merge: true }
  );
}
