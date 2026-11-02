import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';
import { loadEnv } from './config/env.js';
import { initFirebaseAdmin } from './config/firebaseAdmin.js';
import { firebaseAuthPort, firestoreUserRepo } from './services/firebasePorts.js';
import { createApp } from './app.js';

const env = loadEnv();
const firebaseApp = initFirebaseAdmin(env);
const here = path.dirname(fileURLToPath(import.meta.url));
const webDistDir = env.WEB_DIST_DIR ?? path.resolve(here, '../../web/dist');

const app = createApp({
  auth: firebaseAuthPort(getAuth(firebaseApp)),
  users: firestoreUserRepo(getFirestore(firebaseApp)),
  webDistDir,
  trustProxyHops: env.TRUST_PROXY_HOPS,
});

app.listen(env.PORT, () => {
  console.log(`[api] SportBridge listening on :${env.PORT} (${env.NODE_ENV})`);
});
