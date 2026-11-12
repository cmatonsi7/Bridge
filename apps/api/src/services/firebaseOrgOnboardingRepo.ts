import {
  COLLECTIONS,
  unclaimedEntryId,
  type ClaimDoc,
  type OrganisationFullDoc,
  type UserDoc,
} from '@sportbridge/shared';
import type { Firestore } from 'firebase-admin/firestore';
import type { ClaimContext, OrgOnboardingRepoPort } from './orgOnboarding.js';

const CLAIMS = 'organisationClaims';
const DIRECTORY = 'directoryProfiles';
const LISTINGS = 'listings';
const VERIFICATIONS = 'organisationVerifications';

export function firestoreOrgOnboardingRepo(db: Firestore): OrgOnboardingRepoPort {
  const orgRef = (id: string) => db.collection(COLLECTIONS.organisations).doc(id);
  const claimRef = (id: string) => db.collection(CLAIMS).doc(id);
  const entryRef = (key: string) => db.collection(DIRECTORY).doc(key);

  return {
    newOrganisationId: () => db.collection(COLLECTIONS.organisations).doc().id,

    async createUnclaimed(id, org, entry, claim, audit) {
      await db.runTransaction(async (tx) => {
        tx.create(orgRef(id), org);
        tx.create(claimRef(id), claim);
        tx.create(entryRef(entry.uid), entry);
        tx.create(db.collection(COLLECTIONS.auditLogs).doc(), audit);
      });
    },

    async replaceClaim(orgId, claim: ClaimDoc, audit) {
      await db.runTransaction(async (tx) => {
        const org = await tx.get(orgRef(orgId));
        if (!org.exists || (org.data() as OrganisationFullDoc).claimStatus !== 'unclaimed')
          throw new Error('NOT_UNCLAIMED');
        tx.set(claimRef(orgId), claim);
        tx.create(db.collection(COLLECTIONS.auditLogs).doc(), {
          ...audit,
          organisationName: (org.data() as OrganisationFullDoc).name,
        });
      });
    },

    async removeUnclaimed(orgId, audit) {
      await db.runTransaction(async (tx) => {
        const org = await tx.get(orgRef(orgId));
        if (!org.exists || (org.data() as OrganisationFullDoc).claimStatus !== 'unclaimed')
          throw new Error('NOT_UNCLAIMED');
        tx.delete(orgRef(orgId));
        tx.delete(claimRef(orgId));
        tx.delete(entryRef(unclaimedEntryId(orgId)));
        tx.create(db.collection(COLLECTIONS.auditLogs).doc(), {
          ...audit,
          organisationName: (org.data() as OrganisationFullDoc).name,
        });
      });
    },

    async setVerification(a) {
      return db.runTransaction(async (tx) => {
        const orgSnap = await tx.get(orgRef(a.orgId));
        if (!orgSnap.exists) throw new Error('NOT_FOUND');
        const org = orgSnap.data() as OrganisationFullDoc;
        if (!org.ownerUid) throw new Error('UNCLAIMED');
        if (a.verified && org.verified) throw new Error('ALREADY');
        if (!a.verified && !org.verified) throw new Error('NOT_VERIFIED');
        // Listings carry a copy of the badge. All of them change together with the organisation.
        const listings = await tx.get(db.collection(LISTINGS).where('orgId', '==', a.orgId).limit(401));
        if (listings.size > 400) throw new Error('TOO_MANY_LISTINGS');
        const entry = await tx.get(entryRef(org.ownerUid));

        tx.update(orgRef(a.orgId), {
          verified: a.verified,
          verifiedAt: a.verified ? a.at : null,
          updatedAt: a.at,
        });
        for (const l of listings.docs) tx.update(l.ref, { orgVerified: a.verified });
        if (entry.exists) tx.update(entryRef(org.ownerUid), { verified: a.verified, updatedAt: a.at });
        tx.set(db.collection(VERIFICATIONS).doc(a.orgId), {
          orgId: a.orgId,
          verified: a.verified,
          decidedBy: a.by,
          decidedAt: a.at,
          note: a.note,
        });
        tx.create(
          db.collection(COLLECTIONS.users).doc(org.ownerUid).collection('notifications').doc(),
          a.notify(org.ownerUid, org.name),
        );
        tx.create(db.collection(COLLECTIONS.auditLogs).doc(), a.audit(org.name));
        return { name: org.name };
      });
    },

    async loadClaim(codeHash, uid): Promise<ClaimContext | null> {
      const found = await db.collection(CLAIMS).where('codeHash', '==', codeHash).limit(1).get();
      const claimDoc = found.docs[0];
      if (!claimDoc) return null;
      const claim = claimDoc.data() as ClaimDoc;
      const [org, userSnap] = await Promise.all([
        orgRef(claim.orgId).get(),
        db.collection(COLLECTIONS.users).doc(uid).get(),
      ]);
      if (!org.exists || !userSnap.exists) return null;
      const user = userSnap.data() as UserDoc;
      const ownOrgId = user.organisationId ?? null;
      let ownOrg: OrganisationFullDoc | null = null;
      let ownListingCount = 0;
      if (ownOrgId && ownOrgId !== claim.orgId) {
        const own = await orgRef(ownOrgId).get();
        ownOrg = own.exists ? (own.data() as OrganisationFullDoc) : null;
        ownListingCount = (await db.collection(LISTINGS).where('orgId', '==', ownOrgId).limit(1).get()).size;
      }
      return {
        orgId: claim.orgId,
        org: org.data() as OrganisationFullDoc,
        claim,
        user,
        ownOrgId,
        ownOrg,
        ownListingCount,
      };
    },

    async commitClaim(ctx, uid, at, audit) {
      await db.runTransaction(async (tx) => {
        // Re-read inside the transaction: two people must not be able to claim the same organisation.
        const org = await tx.get(orgRef(ctx.orgId));
        const claim = await tx.get(claimRef(ctx.orgId));
        if (!org.exists || !claim.exists) throw new Error('NOT_UNCLAIMED');
        const o = org.data() as OrganisationFullDoc;
        if (o.claimStatus !== 'unclaimed' || o.ownerUid !== null) throw new Error('NOT_UNCLAIMED');
        if ((claim.data() as ClaimDoc).codeHash !== ctx.claim.codeHash) throw new Error('NOT_UNCLAIMED');

        tx.update(orgRef(ctx.orgId), { ownerUid: uid, claimStatus: 'claimed', claimedAt: at, updatedAt: at });
        tx.delete(claimRef(ctx.orgId));
        tx.delete(entryRef(unclaimedEntryId(ctx.orgId)));
        tx.update(db.collection(COLLECTIONS.users).doc(uid), { organisationId: ctx.orgId, updatedAt: at });
        if (ctx.ownOrgId && ctx.ownOrgId !== ctx.orgId) {
          tx.delete(orgRef(ctx.ownOrgId));
          tx.delete(entryRef(uid)); // rebuilt from the claimed organisation by the directory sync
        }
        tx.create(db.collection(COLLECTIONS.auditLogs).doc(), audit);
      });
    },
  };
}
