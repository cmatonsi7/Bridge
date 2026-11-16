import {
  COLLECTIONS,
  type ApplicationDoc,
  type ConnectionDoc,
  type MessageDoc,
  type ThreadDoc,
  type UserDoc,
} from '@sportbridge/shared';
import { type Firestore, type Transaction } from 'firebase-admin/firestore';
import type { MessagesRepoPort, Outbox } from './messages.js';

export const MESSAGE_THREADS = 'messageThreads';
export const MESSAGE_ENTRIES = 'entries';
const CONNECTIONS = 'connections';
const APPLICATIONS = 'applications';

/** Firestore allows at most 30 values in an `in` query, so long lists are asked for in batches. */
const IN_LIMIT = 30;
const chunk = <T>(items: T[]): T[][] => {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += IN_LIMIT) out.push(items.slice(i, i + IN_LIMIT));
  return out;
};

export function firestoreMessagesRepo(db: Firestore): MessagesRepoPort {
  const threads = db.collection(MESSAGE_THREADS);
  const writeOutbox = (tx: Transaction, outbox: Outbox) => {
    for (const o of outbox)
      tx.create(
        db.collection(COLLECTIONS.users).doc(o.uid).collection('notifications').doc(),
        o.notification,
      );
  };
  return {
    newMessageId: () => threads.doc().collection(MESSAGE_ENTRIES).doc().id,

    async getPerson(uid) {
      if (!uid) return null;
      const s = await db.collection(COLLECTIONS.users).doc(uid).get();
      if (!s.exists) return null;
      const u = s.data() as UserDoc;
      return {
        uid,
        displayName: u.displayName,
        role: u.role,
        isMinor: u.isMinor === true,
        guardianUids: u.guardianUids ?? [],
      };
    },

    async getThread(id) {
      const s = await threads.doc(id).get();
      return s.exists ? (s.data() as ThreadDoc) : null;
    },

    async threadsFor(uid) {
      const s = await threads.where('participantUids', 'array-contains', uid).get();
      return s.docs.map((d) => d.data() as ThreadDoc);
    },

    async entries(threadId, limit) {
      const s = await threads
        .doc(threadId)
        .collection(MESSAGE_ENTRIES)
        .orderBy('sentAt', 'asc')
        .limit(limit)
        .get();
      return s.docs.map((d) => d.data() as MessageDoc);
    },

    async ensureThread(id, build) {
      // Two people can accept and open at the same moment; whoever loses keeps the thread that exists.
      return db.runTransaction(async (tx) => {
        const ref = threads.doc(id);
        const snap = await tx.get(ref);
        if (snap.exists) return snap.data() as ThreadDoc;
        const doc = build();
        tx.create(ref, doc);
        return doc;
      });
    },

    async appendMessage(threadId, message, threadChanges, outbox, audit) {
      await db.runTransaction(async (tx) => {
        const ref = threads.doc(threadId);
        tx.create(ref.collection(MESSAGE_ENTRIES).doc(message.id), message);
        tx.update(ref, threadChanges);
        writeOutbox(tx, outbox);
        tx.create(db.collection(COLLECTIONS.auditLogs).doc(), audit);
      });
    },

    async updateThread(id, changes, audit) {
      await db.runTransaction(async (tx) => {
        tx.update(threads.doc(id), changes);
        tx.create(db.collection(COLLECTIONS.auditLogs).doc(), audit);
      });
    },

    async getConnection(id) {
      const s = await db.collection(CONNECTIONS).doc(id).get();
      return s.exists ? (s.data() as ConnectionDoc) : null;
    },

    async getApplication(id) {
      const s = await db.collection(APPLICATIONS).doc(id).get();
      return s.exists ? (s.data() as ApplicationDoc) : null;
    },

    async childrenOf(uid) {
      const s = await db
        .collection(COLLECTIONS.users)
        .where('guardianUids', 'array-contains', uid)
        .get();
      return s.docs.map((d) => d.id);
    },

    async acceptedConnectionIds(uids) {
      if (uids.length === 0) return [];
      // Firestore has no OR across fields, so each side is asked for separately.
      const results = await Promise.all(
        chunk(uids).flatMap((batch) =>
          (['coachUid', 'athleteUid'] as const).map((field) =>
            db.collection(CONNECTIONS).where('status', '==', 'accepted').where(field, 'in', batch).get(),
          ),
        ),
      );
      return [...new Set(results.flatMap((r) => r.docs).map((d) => d.id))];
    },

    async liveApplicationIds(uids) {
      if (uids.length === 0) return [];
      const live = ['shortlisted', 'accepted'];
      const results = await Promise.all(
        chunk(uids).flatMap((batch) =>
          (['applicantUid', 'ownerUid'] as const).map((field) =>
            db.collection(APPLICATIONS).where('status', 'in', live).where(field, 'in', batch).get(),
          ),
        ),
      );
      return [...new Set(results.flatMap((r) => r.docs).map((d) => d.id))];
    },
  };
}
