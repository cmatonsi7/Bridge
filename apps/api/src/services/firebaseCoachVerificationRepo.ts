import { COLLECTIONS, type CoachVerificationDoc, type CredentialDocRecord, type UserDoc } from '@sportbridge/shared';
import { FieldValue, type Firestore, type Transaction } from 'firebase-admin/firestore';
import type { Storage } from 'firebase-admin/storage';
import type { CoachVerificationRepoPort, Outbox } from './coachVerification.js';

export const COACH_VERIFICATIONS = 'coachVerifications';
export const COACH_VERIFICATION_NOTES = 'coachVerificationNotes';
export const CREDENTIAL_DOCS = 'credentialDocs';
const QUALIFICATIONS = 'qualifications';

export function firestoreCoachVerificationRepo(db: Firestore, storage?: Storage): CoachVerificationRepoPort {
  const verifications = db.collection(COACH_VERIFICATIONS);
  const docsFor = (uid: string) =>
    db.collection(COLLECTIONS.coachProfiles).doc(uid).collection(CREDENTIAL_DOCS);
  const writeOutbox = (tx: Transaction, outbox: Outbox) => {
    for (const o of outbox)
      tx.create(
        db.collection(COLLECTIONS.users).doc(o.uid).collection('notifications').doc(),
        o.notification,
      );
  };
  const bucket = () => {
    if (!storage) throw new Error('STORAGE_NOT_CONFIGURED');
    return storage.bucket();
  };

  return {
    newDocId: () => docsFor('x').doc().id,

    async getCoach(uid) {
      const s = await db.collection(COLLECTIONS.users).doc(uid).get();
      if (!s.exists) return null;
      const u = s.data() as UserDoc;
      return { uid, displayName: u.displayName, role: u.role };
    },

    async get(uid) {
      const s = await verifications.doc(uid).get();
      return s.exists ? (s.data() as CoachVerificationDoc) : null;
    },

    async create(uid, doc) {
      return db.runTransaction(async (tx) => {
        const ref = verifications.doc(uid);
        const snap = await tx.get(ref);
        if (snap.exists) return snap.data() as CoachVerificationDoc;
        tx.create(ref, doc);
        return doc;
      });
    },

    async update(uid, changes, outbox, audit) {
      await db.runTransaction(async (tx) => {
        tx.set(verifications.doc(uid), changes, { merge: true });
        writeOutbox(tx, outbox);
        tx.create(db.collection(COLLECTIONS.auditLogs).doc(), audit);
      });
    },

    async putInternalNote(uid, note) {
      await db.collection(COACH_VERIFICATION_NOTES).doc(uid).set(note);
    },

    async countQualifications(uid) {
      const s = await db
        .collection(COLLECTIONS.coachProfiles)
        .doc(uid)
        .collection(QUALIFICATIONS)
        .count()
        .get();
      return s.data().count;
    },

    async listDocs(uid) {
      const s = await docsFor(uid).orderBy('uploadedAt', 'asc').get();
      return s.docs.map((d) => d.data() as CredentialDocRecord);
    },

    async addDoc(uid, doc, audit) {
      await db.runTransaction(async (tx) => {
        tx.create(docsFor(uid).doc(doc.id), doc);
        tx.set(verifications.doc(uid), { docCount: FieldValue.increment(1) }, { merge: true });
        tx.create(db.collection(COLLECTIONS.auditLogs).doc(), audit);
      });
    },

    async removeDoc(uid, docId, audit) {
      return db.runTransaction(async (tx) => {
        const ref = docsFor(uid).doc(docId);
        const snap = await tx.get(ref);
        if (!snap.exists) return null;
        const record = snap.data() as CredentialDocRecord;
        tx.delete(ref);
        tx.set(verifications.doc(uid), { docCount: FieldValue.increment(-1) }, { merge: true });
        tx.create(db.collection(COLLECTIONS.auditLogs).doc(), audit);
        return record;
      });
    },

    async queue() {
      const s = await verifications.where('status', 'in', ['submitted', 'verified', 'rejected']).get();
      return s.docs.map((d) => d.data() as CoachVerificationDoc);
    },

    async signedUrlFor(storagePath, expiresInMs) {
      const [url] = await bucket()
        .file(storagePath)
        .getSignedUrl({ action: 'read', expires: Date.now() + expiresInMs });
      return url;
    },

    async deleteFile(storagePath) {
      await bucket().file(storagePath).delete({ ignoreNotFound: true });
    },
  };
}
