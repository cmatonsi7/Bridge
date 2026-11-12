import {
  COLLECTIONS,
  unclaimedEntryId,
  type ImportBatchDoc,
  type OrganisationFullDoc,
} from '@sportbridge/shared';
import type { Firestore } from 'firebase-admin/firestore';
import type { OrgImportRepoPort } from './orgImport.js';

const BATCHES = 'importBatches';
const CLAIMS = 'organisationClaims';
const DIRECTORY = 'directoryProfiles';
/** A write batch holds at most 500 writes; each school needs three (record, claim, directory entry). */
const WRITE_CHUNK = 150;
const UNDO_CHUNK = 100;

export function firestoreOrgImportRepo(db: Firestore): OrgImportRepoPort {
  const orgRef = (id: string) => db.collection(COLLECTIONS.organisations).doc(id);
  const claimRef = (id: string) => db.collection(CLAIMS).doc(id);
  const entryRef = (key: string) => db.collection(DIRECTORY).doc(key);
  const batchRef = (id: string) => db.collection(BATCHES).doc(id);

  return {
    async listOrganisationKeys() {
      const snap = await db
        .collection(COLLECTIONS.organisations)
        .select('name', 'province', 'schoolNumber')
        .limit(20000)
        .get();
      return snap.docs.map((d) => ({
        id: d.id,
        name: (d.get('name') as string | undefined) ?? '',
        province: (d.get('province') as string | undefined) ?? null,
        schoolNumber: (d.get('schoolNumber') as string | undefined) ?? null,
      }));
    },
    newBatchId: () => batchRef(db.collection(BATCHES).doc().id).id,
    newOrganisationId: () => db.collection(COLLECTIONS.organisations).doc().id,

    async startBatch(id, batch) {
      await batchRef(id).create(batch);
    },

    async writeOrganisations(items) {
      for (let i = 0; i < items.length; i += WRITE_CHUNK) {
        const wb = db.batch();
        for (const it of items.slice(i, i + WRITE_CHUNK)) {
          wb.create(orgRef(it.id), it.org);
          wb.create(claimRef(it.id), it.claim);
          wb.create(entryRef(it.entry.uid), it.entry);
        }
        await wb.commit();
      }
    },

    async finishBatch(id, patch, audit) {
      const wb = db.batch();
      wb.update(batchRef(id), patch);
      wb.create(db.collection(COLLECTIONS.auditLogs).doc(), audit);
      await wb.commit();
    },

    async getBatch(id) {
      const s = await batchRef(id).get();
      return s.exists ? (s.data() as ImportBatchDoc) : null;
    },

    async undoBatch(id, by, at, audit) {
      const batch = (await batchRef(id).get()).data() as ImportBatchDoc;
      let removed = 0;
      const kept: string[] = [];
      for (let i = 0; i < batch.orgIds.length; i += UNDO_CHUNK) {
        const chunk = batch.orgIds.slice(i, i + UNDO_CHUNK);
        // One transaction per chunk, re-reading each record, so a school claimed a moment ago is never deleted.
        const result = await db.runTransaction(async (tx) => {
          const snaps = await tx.getAll(...chunk.map(orgRef));
          let r = 0;
          const k: string[] = [];
          for (const s of snaps) {
            if (!s.exists) continue;
            const o = s.data() as OrganisationFullDoc;
            if (o.claimStatus === 'unclaimed' && !o.ownerUid) {
              tx.delete(s.ref);
              tx.delete(claimRef(s.id));
              tx.delete(entryRef(unclaimedEntryId(s.id)));
              r++;
            } else {
              k.push(o.name);
            }
          }
          return { r, k };
        });
        removed += result.r;
        kept.push(...result.k);
      }
      const wb = db.batch();
      wb.update(batchRef(id), {
        status: 'undone',
        undoneAt: at,
        undoneBy: by,
        removedCount: removed,
        keptCount: kept.length,
      });
      wb.create(db.collection(COLLECTIONS.auditLogs).doc(), audit(removed, kept));
      await wb.commit();
      return { removed, kept };
    },
  };
}
