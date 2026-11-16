import { COLLECTIONS, type MembershipDoc } from '@sportbridge/shared';
import type { Firestore } from 'firebase-admin/firestore';
import type { MembershipRepoPort } from './membership.js';

export const MEMBERSHIPS = 'memberships';

export function firestoreMembershipRepo(db: Firestore): MembershipRepoPort {
  const memberships = db.collection(MEMBERSHIPS);
  return {
    async get(uid) {
      const s = await memberships.doc(uid).get();
      return s.exists ? (s.data() as MembershipDoc) : null;
    },
    async create(doc, audit) {
      // Two tabs can ask for the same new record at once; whoever loses keeps the record that is there.
      return db.runTransaction(async (tx) => {
        const ref = memberships.doc(doc.uid);
        const snap = await tx.get(ref);
        if (snap.exists) return snap.data() as MembershipDoc;
        tx.create(ref, doc);
        tx.create(db.collection(COLLECTIONS.auditLogs).doc(), audit);
        return doc;
      });
    },
    async update(uid, changes, audit) {
      await db.runTransaction(async (tx) => {
        tx.update(memberships.doc(uid), changes);
        if (audit) tx.create(db.collection(COLLECTIONS.auditLogs).doc(), audit);
      });
    },
  };
}
