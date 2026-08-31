// Firebase config — shared with the sga_calc20 project (same Firebase
// project, same allowlisted Google account). This app writes to its own
// Firestore collection (see ../state/cloudSync.ts), so the two never touch
// each other's stored data.
//
// An apiKey is a public client identifier, not a secret — it ships in the
// bundle of every web app. Access is controlled by two things:
//
//   1. Authorized domains: Firebase Console > Authentication > Settings.
//      Only origins listed there can complete a sign-in.
//   2. Firestore security rules, which gate reads/writes to the allowlisted
//      account. See FIREBASE.md.
//
// Values are read from the environment when present so a deploy can override
// them, and fall back to the literals so a fresh clone runs with no setup.

export interface FirebaseConfig {
  apiKey: string;
  authDomain: string;
  projectId: string;
  storageBucket: string;
  messagingSenderId: string;
  appId: string;
  measurementId?: string;
}

const FALLBACK: FirebaseConfig = {
  apiKey: 'AIzaSyA4roAlMMPJzll7SfwbnRWMSFig6CACwcM',
  authDomain: 'ssdi-d12f0.firebaseapp.com',
  projectId: 'ssdi-d12f0',
  storageBucket: 'ssdi-d12f0.firebasestorage.app',
  messagingSenderId: '896795212551',
  appId: '1:896795212551:web:02124ccc501bb5613b63a2',
  measurementId: 'G-JTEGETS3TW'
};

function env(key: string): string | undefined {
  const bag = (import.meta as unknown as { env?: Record<string, string> }).env;
  const v = bag?.[key];
  return v && v.length ? v : undefined;
}

export function firebaseConfig(): FirebaseConfig {
  return {
    apiKey: env('VITE_FIREBASE_API_KEY') ?? FALLBACK.apiKey,
    authDomain: env('VITE_FIREBASE_AUTH_DOMAIN') ?? FALLBACK.authDomain,
    projectId: env('VITE_FIREBASE_PROJECT_ID') ?? FALLBACK.projectId,
    storageBucket: env('VITE_FIREBASE_STORAGE_BUCKET') ?? FALLBACK.storageBucket,
    messagingSenderId: env('VITE_FIREBASE_SENDER_ID') ?? FALLBACK.messagingSenderId,
    appId: env('VITE_FIREBASE_APP_ID') ?? FALLBACK.appId,
    measurementId: env('VITE_FIREBASE_MEASUREMENT_ID') ?? FALLBACK.measurementId
  };
}

/**
 * Analytics is deliberately not initialised. This app handles disability
 * benefit earnings; sending page and event data to Google is a privacy
 * decision, not a default.
 */
export const ANALYTICS_ENABLED = false;
