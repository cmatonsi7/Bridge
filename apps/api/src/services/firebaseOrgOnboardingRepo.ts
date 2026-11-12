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
