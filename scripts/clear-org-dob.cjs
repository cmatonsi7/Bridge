/**
 * One-off: remove the stored date of birth from organisation accounts created before SportBridge
 * stopped asking for one. Nothing else is touched. Run with the service account key available:
 *   node scripts/clear-org-dob.cjs           # shows what would change
 *   node scripts/clear-org-dob.cjs --apply   # makes the change
 */
const { initializeApp, cert } = require('firebase-admin/app');
const { getFirestore, FieldValue } = require('firebase-admin/firestore');

const key = process.env.FIREBASE_SERVICE_ACCOUNT_BASE64;
if (!key) {
  console.error('Set FIREBASE_SERVICE_ACCOUNT_BASE64 first.');
  process.exit(1);
}
initializeApp({ credential: cert(JSON.parse(Buffer.from(key, 'base64').toString('utf8'))) });
const db = getFirestore();
const apply = process.argv.includes('--apply');

(async () => {
  const users = await db.collection('users').where('role', '==', 'organisation').get();
  let found = 0;
  for (const u of users.docs) {
    const ref = db.collection('users').doc(u.id).collection('private').doc('details');
    const snap = await ref.get();
    if (!snap.exists || snap.get('dateOfBirth') === undefined) continue;
    found++;
    console.log(`${apply ? 'clearing' : 'would clear'}: ${u.get('displayName') ?? u.id}`);
    if (apply) await ref.update({ dateOfBirth: FieldValue.delete() });
  }
  console.log(found === 0 ? 'No organisation account has a stored date of birth.' : `${found} account(s) ${apply ? 'cleared' : 'to clear — rerun with --apply'}.`);
  process.exit(0);
})().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
