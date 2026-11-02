import { initializeApp, type FirebaseApp } from 'firebase/app';
import { connectAuthEmulator, getAuth, type Auth } from 'firebase/auth';
import { connectFirestoreEmulator, getFirestore, type Firestore } from 'firebase/firestore';

/**
 * Firebase web configuration. These values identify the project and are safe to ship to browsers;
 * access is controlled by Firebase Auth and the security rules, not by keeping them secret.
 */
const config = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

const useEmulators = import.meta.env.VITE_USE_FIREBASE_EMULATORS === 'true';
export const firebaseConfigured = Boolean(config.apiKey && config.projectId && config.appId) || useEmulators;

let app: FirebaseApp | undefined;
let auth: Auth | undefined;
let db: Firestore | undefined;

if (firebaseConfigured) {
  app = initializeApp(
    useEmulators && !config.apiKey ? { apiKey: 'demo', projectId: 'demo-sportbridge' } : config,
  );
  auth = getAuth(app);
  db = getFirestore(app);
  if (useEmulators) {
    connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true });
    connectFirestoreEmulator(db, '127.0.0.1', 8081);
  }
}

export function requireAuth(): Auth {
  if (!auth) throw new Error('FIREBASE_NOT_CONFIGURED');
  return auth;
}
export function requireDb(): Firestore {
  if (!db) throw new Error('FIREBASE_NOT_CONFIGURED');
  return db;
}
