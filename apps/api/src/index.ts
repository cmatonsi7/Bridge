import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';
import { loadEnv } from './config/env.js';
import { initFirebaseAdmin } from './config/firebaseAdmin.js';
import { firebaseAuthPort, firestoreUserRepo } from './services/firebasePorts.js';
import { firestoreGuardianRepo } from './services/firebaseGuardianRepo.js';
import { firestoreApplicationsRepo } from './services/firebaseApplicationsRepo.js';
import { firestoreDirectoryRepo } from './services/firebaseDirectoryRepo.js';
import { firestoreOrgOnboardingRepo } from './services/firebaseOrgOnboardingRepo.js';
import { firestoreOrgImportRepo } from './services/firebaseOrgImportRepo.js';
import { firestoreSponsorshipRepo } from './services/firebaseSponsorshipRepo.js';
import { firestoreMembershipRepo } from './services/firebaseMembershipRepo.js';
import { firestoreMessagesRepo } from './services/firebaseMessagesRepo.js';
import { firestoreCoachVerificationRepo } from './services/firebaseCoachVerificationRepo.js';
import { getStorage } from 'firebase-admin/storage';
import { createApp } from './app.js';

const env = loadEnv();
const firebaseApp = initFirebaseAdmin(env);
const here = path.dirname(fileURLToPath(import.meta.url));
const webDistDir = env.WEB_DIST_DIR ?? path.resolve(here, '../../web/dist');

const messagesRepo = firestoreMessagesRepo(getFirestore(firebaseApp));

const app = createApp({
  auth: firebaseAuthPort(getAuth(firebaseApp)),
  users: firestoreUserRepo(getFirestore(firebaseApp)),
  guardians: firestoreGuardianRepo(getFirestore(firebaseApp)),
  applications: firestoreApplicationsRepo(getFirestore(firebaseApp)),
  directory: firestoreDirectoryRepo(getFirestore(firebaseApp)),
  orgOnboarding: firestoreOrgOnboardingRepo(getFirestore(firebaseApp)),
  orgImport: firestoreOrgImportRepo(getFirestore(firebaseApp)),
  sponsorship: firestoreSponsorshipRepo(getFirestore(firebaseApp)),
  membership: firestoreMembershipRepo(getFirestore(firebaseApp)),
  messages: messagesRepo,
  coachVerification: firestoreCoachVerificationRepo(
    getFirestore(firebaseApp),
    getStorage(firebaseApp),
  ),
  webDistDir,
  trustProxyHops: env.TRUST_PROXY_HOPS,
});

app.listen(env.PORT, () => {
  console.log(`[api] SportBridge listening on :${env.PORT} (${env.NODE_ENV})`);
});
