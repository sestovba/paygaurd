/*
 * Firebase, absent.
 *
 * The standalone export is one file with nothing behind it — no origin to
 * authorise, no popup that could complete, no account to sync to. But
 * TrackerProvider reaches cloudSync and cloudSync reaches the SDK, and the
 * single-file build inlines every dynamic import, so leaving the real
 * package in place would fold ~400kB of Firebase into a page that can never
 * call it.
 *
 * vite.calc20.config.ts aliases `firebase/app`, `firebase/auth` and
 * `firebase/firestore` to this module instead. Every member the app reaches
 * for is here, and every one of them throws: the export is device-only by
 * construction rather than by a check someone could remove later.
 *
 * Adding a Firebase call to src/auth or src/state means adding it here too —
 * the build fails loudly on a missing export rather than at the user's end.
 */

function absent(): never {
  throw new Error('This is the standalone export — it has no cloud side.');
}

/* firebase/app */
export const initializeApp = absent;
/** Empty, so getApp() takes the initializeApp branch and throws there. */
export const getApps = (): unknown[] => [];

/* firebase/auth */
export const getAuth = absent;
export const signInWithPopup = absent;
export const onAuthStateChanged = absent;
export const signOut = absent;
export class GoogleAuthProvider {
  constructor() { absent(); }
  setCustomParameters(): void { absent(); }
}

/* firebase/firestore */
export const getFirestore = absent;
export const doc = absent;
export const getDoc = absent;
export const setDoc = absent;
export const deleteDoc = absent;
