import { applicationDefault, cert, getApps, initializeApp, type App } from 'firebase-admin/app';
import type { Env } from './env.js';

/**
 * Initialises the Admin SDK once. Credentials come from FIREBASE_SERVICE_ACCOUNT_BASE64 (Railway),
 * the emulators, or Application Default Credentials.
 */
export function initFirebaseAdmin(env: Env): App {
  const existing = getApps()[0];
  if (existing) return existing;
  if (env.FIREBASE_SERVICE_ACCOUNT_BASE64) {
    const json = JSON.parse(Buffer.from(env.FIREBASE_SERVICE_ACCOUNT_BASE64, 'base64').toString('utf8'));
    return initializeApp({ credential: cert(json), projectId: json.project_id });
  }
  if (process.env.FIRESTORE_EMULATOR_HOST || process.env.FIREBASE_AUTH_EMULATOR_HOST) {
    return initializeApp({ projectId: env.FIREBASE_PROJECT_ID ?? 'demo-sportbridge' });
  }
  return initializeApp({ credential: applicationDefault(), projectId: env.FIREBASE_PROJECT_ID });
}
