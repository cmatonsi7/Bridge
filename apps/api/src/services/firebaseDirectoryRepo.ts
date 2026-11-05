import {
  COLLECTIONS,
  type AthleteProfileDoc,
  type CoachProfileDoc,
  type ConnectionDoc,
  type DirectoryEntryDoc,
  type OrganisationFullDoc,
  type UserDoc,
} from '@sportbridge/shared';
import type { Firestore, Transaction } from 'firebase-admin/firestore';
import type { Outbox } from './applications.js';
import type { DirectoryRepoPort } from './directory.js';

const DIRECTORY = 'directoryProfiles';
const CONNECTIONS = 'connections';

export function firestoreDirectoryRepo(db: Firestore): DirectoryRepoPort {
  const writeOutbox = (tx: Transaction, outbox: Outbox) => {
    for (const o of outbox)
      tx.create(
        db.collection(COLLECTIONS.users).doc(o.uid).collection('notifications').doc(),
        o.notification,
      );
  };
  return {
    async getSubject(uid) {
      const u = await db.collection(COLLECTIONS.users).doc(uid).get();
      if (!u.exists) return null;
      const user = u.data() as UserDoc;
      const [a, c] = await Promise.all([
        db.collection(COLLECTIONS.athleteProfiles).doc(uid).get(),
        db.collection(COLLECTIONS.coachProfiles).doc(uid).get(),
      ]);
      let organisation: (OrganisationFullDoc & { id: string }) | null = null;
      if (user.organisationId) {
        const o = await db.collection(COLLECTIONS.organisations).doc(user.organisationId).get();
        if (o.exists) organisation = { id: o.id, ...(o.data() as OrganisationFullDoc) };
      }
      return {
        user,
        athlete: a.exists ? (a.data() as AthleteProfileDoc) : null,
        coach: c.exists ? (c.data() as CoachProfileDoc) : null,
        organisation,
      };
    },
    async putEntry(uid, entry: DirectoryEntryDoc) {
      await db.collection(DIRECTORY).doc(uid).set(entry);
    },
    async removeEntry(uid) {
      await db.collection(DIRECTORY).doc(uid).delete();
    },
    async getConnection(id) {
      const s = await db.collection(CONNECTIONS).doc(id).get();
      return s.exists ? (s.data() as ConnectionDoc) : null;
    },
    async createConnection(id, doc, outbox, audit) {
      await db.runTransaction(async (tx) => {
        const ref = db.collection(CONNECTIONS).doc(id);
        const existing = await tx.get(ref);
        // A previously declined or ended request may be sent again; a live one may not.
        if (existing.exists && ['pending', 'accepted'].includes((existing.data() as ConnectionDoc).status)) {
          throw new Error('ALREADY_EXISTS');
        }
        tx.set(ref, doc);
        writeOutbox(tx, outbox);
        tx.create(db.collection(COLLECTIONS.auditLogs).doc(), audit);
      });
    },
    async mutateConnection(id, decide) {
      await db.runTransaction(async (tx) => {
        const ref = db.collection(CONNECTIONS).doc(id);
        const snap = await tx.get(ref);
        const conn = snap.exists ? (snap.data() as ConnectionDoc) : null;
        const u = conn ? await tx.get(db.collection(COLLECTIONS.users).doc(conn.athleteUid)) : null;
        const guardians = (u?.get('guardianUids') as string[] | undefined) ?? [];
        const r = decide(conn, guardians);
        tx.update(ref, r.changes);
        writeOutbox(tx, r.outbox);
        tx.create(db.collection(COLLECTIONS.auditLogs).doc(), r.audit);
      });
    },
  };
}
