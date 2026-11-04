import { COLLECTIONS, type GuardianLinkDoc } from '@sportbridge/shared';
import type { Firestore } from 'firebase-admin/firestore';
import type { GuardianRepoPort } from './guardian.js';

export function firestoreGuardianRepo(db: Firestore): GuardianRepoPort {
  return {
    async mutateLink(linkId, decide) {
      await db.runTransaction(async (tx) => {
        const linkRef = db.collection(COLLECTIONS.guardianLinks).doc(linkId);
        const linkSnap = await tx.get(linkRef);
        const link = linkSnap.exists ? (linkSnap.data() as GuardianLinkDoc) : null;
        const userRef = link ? db.collection(COLLECTIONS.users).doc(link.athleteUid) : null;
        const userSnap = userRef ? await tx.get(userRef) : null;
        const guardians = (userSnap?.get('guardianUids') as string[] | undefined) ?? [];
        const result = decide(link, guardians);
        const ts = new Date().toISOString();
        tx.update(linkRef, result.link);
        if (result.athlete && userRef) tx.update(userRef, { ...result.athlete, updatedAt: ts });
        tx.create(db.collection(COLLECTIONS.auditLogs).doc(), result.audit);
      });
    },
  };
}
