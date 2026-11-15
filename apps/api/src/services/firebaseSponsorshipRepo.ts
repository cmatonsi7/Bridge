import {
  COLLECTIONS,
  type PrivateDetailsDoc,
  type SponsorshipOfferDoc,
  type SponsorshipRequestDoc,
  type UserDoc,
} from '@sportbridge/shared';
import { FieldValue, type Firestore, type Transaction } from 'firebase-admin/firestore';
import type { Outbox, SponsorshipRepoPort } from './sponsorship.js';

export const SPONSORSHIP_REQUESTS = 'sponsorshipRequests';
export const SPONSORSHIP_OFFERS = 'sponsorshipOffers';

export function firestoreSponsorshipRepo(db: Firestore): SponsorshipRepoPort {
  const writeOutbox = (tx: Transaction, outbox: Outbox) => {
    for (const o of outbox)
      tx.create(
        db.collection(COLLECTIONS.users).doc(o.uid).collection('notifications').doc(),
        o.notification,
      );
  };
  const requests = db.collection(SPONSORSHIP_REQUESTS);
  const offers = db.collection(SPONSORSHIP_OFFERS);
  return {
    newRequestId: () => requests.doc().id,
    async getPerson(uid) {
      if (!uid) return null;
      const [u, d] = await Promise.all([
        db.collection(COLLECTIONS.users).doc(uid).get(),
        db.collection(COLLECTIONS.users).doc(uid).collection(COLLECTIONS.privateDetails).doc('details').get(),
      ]);
      if (!u.exists) return null;
      return {
        user: u.data() as UserDoc,
        dateOfBirth: d.exists ? ((d.data() as PrivateDetailsDoc).dateOfBirth ?? null) : null,
      };
    },
    async activeRequestsFor(athleteUid) {
      const s = await requests
        .where('athleteUid', '==', athleteUid)
        .where('status', 'in', ['open', 'pending_review'])
        .get();
      return s.docs.map((d) => d.data() as SponsorshipRequestDoc);
    },
    async createRequest(id, doc, outbox, audit) {
      await db.runTransaction(async (tx) => {
        tx.create(requests.doc(id), doc);
        writeOutbox(tx, outbox);
        tx.create(db.collection(COLLECTIONS.auditLogs).doc(), audit);
      });
    },
    async mutateRequest(id, decide) {
      await db.runTransaction(async (tx) => {
        const snap = await tx.get(requests.doc(id));
        const r = decide(snap.exists ? (snap.data() as SponsorshipRequestDoc) : null);
        tx.update(requests.doc(id), r.changes);
        writeOutbox(tx, r.outbox);
        tx.create(db.collection(COLLECTIONS.auditLogs).doc(), r.audit);
      });
    },
    async createOffer(id, requestId, build) {
      await db.runTransaction(async (tx) => {
        const [req, existing] = await Promise.all([tx.get(requests.doc(requestId)), tx.get(offers.doc(id))]);
        const r = build(req.exists ? (req.data() as SponsorshipRequestDoc) : null);
        if (existing.exists) throw new Error('ALREADY_OFFERED');
        tx.create(offers.doc(id), r.offer);
        tx.update(requests.doc(requestId), { offerCount: FieldValue.increment(1) });
        writeOutbox(tx, r.outbox);
        tx.create(db.collection(COLLECTIONS.auditLogs).doc(), r.audit);
      });
    },
    async mutateOffer(id, decide) {
      await db.runTransaction(async (tx) => {
        const snap = await tx.get(offers.doc(id));
        const o = snap.exists ? (snap.data() as SponsorshipOfferDoc) : null;
        const req = o ? await tx.get(requests.doc(o.requestId)) : null;
        const r = decide(o, req?.exists ? (req.data() as SponsorshipRequestDoc) : null);
        tx.update(offers.doc(id), r.changes);
        writeOutbox(tx, r.outbox);
        tx.create(db.collection(COLLECTIONS.auditLogs).doc(), r.audit);
      });
    },
  };
}
