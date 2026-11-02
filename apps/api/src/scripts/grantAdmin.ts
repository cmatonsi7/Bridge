/**
 * Grants or revokes the administrator claim. Run by SportBridge staff only, from a trusted machine:
 *   npm run grant-admin -w apps/api -- person@example.com
 *   npm run grant-admin -w apps/api -- person@example.com --revoke
 * The person must already have a SportBridge account (any role) and must sign out and in again afterwards.
 */
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';
import { loadEnv } from '../config/env.js';
import { initFirebaseAdmin } from '../config/firebaseAdmin.js';

async function main() {
  const [email, flag] = process.argv.slice(2);
  if (!email) throw new Error('Usage: grant-admin <email> [--revoke]');
  const revoke = flag === '--revoke';
  const app = initFirebaseAdmin(loadEnv());
  const auth = getAuth(app);
  const db = getFirestore(app);
  const user = await auth.getUserByEmail(email);
  const now = new Date().toISOString();

  if (revoke) {
    const userDoc = await db.collection('users').doc(user.uid).get();
    const previousRole = (userDoc.get('previousRole') as string | undefined) ?? 'athlete';
    await auth.setCustomUserClaims(user.uid, { role: previousRole });
    await db.collection('users').doc(user.uid).set({ role: previousRole, updatedAt: now }, { merge: true });
  } else {
    await auth.setCustomUserClaims(user.uid, { role: 'admin', admin: true });
    const ref = db.collection('users').doc(user.uid);
    const snap = await ref.get();
    await ref.set(
      { role: 'admin', previousRole: snap.get('role') ?? null, status: 'active', updatedAt: now },
      { merge: true },
    );
  }
  await auth.revokeRefreshTokens(user.uid); // forces a fresh sign-in so the new claim applies everywhere
  await db
    .collection('auditLogs')
    .add({ type: revoke ? 'admin.revoked' : 'admin.granted', uid: user.uid, at: now, by: 'cli' });
  console.log(
    `${revoke ? 'Revoked' : 'Granted'} administrator access for ${email}. They must sign in again.`,
  );
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
