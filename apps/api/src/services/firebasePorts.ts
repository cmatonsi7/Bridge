import { COLLECTIONS, type UserDoc } from '@sportbridge/shared';
import type { Auth } from 'firebase-admin/auth';
import type { Firestore } from 'firebase-admin/firestore';
import type { AuthPort, OnboardingWrite, UserRepoPort } from './ports.js';

export function firebaseAuthPort(auth: Auth): AuthPort {
  return {
    // checkRevoked=true so "sign out everywhere" and suspensions take effect immediately.
    verifyIdToken: (token) => auth.verifyIdToken(token, true),
    setCustomUserClaims: (uid, claims) => auth.setCustomUserClaims(uid, claims),
  };
}

export function firestoreUserRepo(db: Firestore): UserRepoPort {
  return {
    async getUser(uid) {
      const snap = await db.collection(COLLECTIONS.users).doc(uid).get();
      return snap.exists ? (snap.data() as UserDoc) : null;
    },
    newId: (collection) => db.collection(collection).doc().id,
    async commitOnboarding(w: OnboardingWrite) {
      await db.runTransaction(async (tx) => {
        const userRef = db.collection(COLLECTIONS.users).doc(w.uid);
        if ((await tx.get(userRef)).exists) throw new Error('ALREADY_ONBOARDED');
        tx.create(userRef, w.user);
        tx.create(userRef.collection(COLLECTIONS.privateDetails).doc('details'), w.privateDetails);
        if (w.roleProfile) tx.set(db.collection(w.roleProfile.collection).doc(w.uid), w.roleProfile.data);
        if (w.organisation)
          tx.create(db.collection(COLLECTIONS.organisations).doc(w.organisation.id), w.organisation.data);
        if (w.guardianLink)
          tx.create(db.collection(COLLECTIONS.guardianLinks).doc(w.guardianLink.id), w.guardianLink.data);
        tx.create(db.collection(COLLECTIONS.auditLogs).doc(), w.audit);
      });
    },
  };
}
