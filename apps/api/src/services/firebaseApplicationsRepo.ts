import {
  COLLECTIONS,
  type ApplicationDoc,
  type AthleteProfileDoc,
  type ListingDoc,
  type PrivateDetailsDoc,
  type UserDoc,
} from '@sportbridge/shared';
import type { Firestore, Transaction } from 'firebase-admin/firestore';
import type { ApplicationsRepoPort, Outbox } from './applications.js';

const APPLICATIONS = 'applications';
const LISTINGS = 'listings';

export function firestoreApplicationsRepo(db: Firestore): ApplicationsRepoPort {
  const writeOutbox = (tx: Transaction, outbox: Outbox) => {
    for (const o of outbox)
      tx.create(
        db.collection(COLLECTIONS.users).doc(o.uid).collection('notifications').doc(),
        o.notification,
      );
  };
  return {
    async getListing(id) {
      const s = await db.collection(LISTINGS).doc(id).get();
      return s.exists ? (s.data() as ListingDoc) : null;
    },
    async getApplicant(uid) {
      const [u, p, d] = await Promise.all([
        db.collection(COLLECTIONS.users).doc(uid).get(),
        db.collection(COLLECTIONS.athleteProfiles).doc(uid).get(),
        db.collection(COLLECTIONS.users).doc(uid).collection(COLLECTIONS.privateDetails).doc('details').get(),
      ]);
      if (!u.exists) return null;
      return {
        user: u.data() as UserDoc,
        profile: p.exists ? (p.data() as AthleteProfileDoc) : null,
        details: d.exists ? (d.data() as PrivateDetailsDoc) : null,
      };
    },
    async createApplication(id, doc, outbox, audit) {
      await db.runTransaction(async (tx) => {
        const ref = db.collection(APPLICATIONS).doc(id);
        if ((await tx.get(ref)).exists) throw new Error('ALREADY_APPLIED');
        tx.create(ref, doc);
        writeOutbox(tx, outbox);
        tx.create(db.collection(COLLECTIONS.auditLogs).doc(), audit);
      });
    },
    async mutateApplication(id, decide) {
      await db.runTransaction(async (tx) => {
        const ref = db.collection(APPLICATIONS).doc(id);
        const snap = await tx.get(ref);
        const app = snap.exists ? (snap.data() as ApplicationDoc) : null;
        const userSnap = app ? await tx.get(db.collection(COLLECTIONS.users).doc(app.applicantUid)) : null;
        const guardians = (userSnap?.get('guardianUids') as string[] | undefined) ?? [];
        const r = decide(app, guardians);
        tx.update(ref, r.changes);
        writeOutbox(tx, r.outbox);
        tx.create(db.collection(COLLECTIONS.auditLogs).doc(), r.audit);
      });
    },
  };
}
