import {
  analyseImport,
  formatClaimCode,
  importRequestSchema,
  type ClaimDoc,
  type DirectoryEntryDoc,
  type ExistingOrganisationKey,
  type ImportBatchDoc,
  type ImportRequest,
  type OrganisationFullDoc,
} from '@sportbridge/shared';
import { HttpError } from '../middleware/errors.js';
import {
  buildUnclaimedEntry,
  buildUnclaimedOrganisation,
  expiry,
  generateClaimCode,
  hashClaimCode,
  type OnboardingCaller,
} from './orgOnboarding.js';

export interface ImportItem {
  id: string;
  org: OrganisationFullDoc;
  entry: DirectoryEntryDoc;
  claim: ClaimDoc;
}

export interface OrgImportRepoPort {
  /** Name, province and school number of every organisation, for duplicate detection. */
  listOrganisationKeys(): Promise<ExistingOrganisationKey[]>;
  newBatchId(): string;
  newOrganisationId(): string;
  /** Written BEFORE the schools are, listing their ids, so a half-finished import can still be undone. */
  startBatch(id: string, batch: ImportBatchDoc): Promise<void>;
  writeOrganisations(items: ImportItem[]): Promise<void>;
  finishBatch(id: string, patch: Partial<ImportBatchDoc>, audit: Record<string, unknown>): Promise<void>;
  getBatch(id: string): Promise<ImportBatchDoc | null>;
  /** Removes the batch's organisations that are still unclaimed; claimed ones stay. */
  undoBatch(
    id: string,
    by: string,
    at: string,
    audit: (removed: number, keptNames: string[]) => Record<string, unknown>,
  ): Promise<{ removed: number; kept: string[] }>;
}

/** Everything the preview shows: counts and one line per row, but never the parsed data itself. */
function summarise(a: ReturnType<typeof analyseImport>) {
  return {
    counts: a.counts,
    importable: a.importable,
    rows: a.rows.map(({ data: _data, ...row }) => row),
  };
}

async function analyse(repo: OrgImportRepoPort, raw: ImportRequest) {
  const input = importRequestSchema.parse(raw);
  const analysis = analyseImport(input.csv, input.source, await repo.listOrganisationKeys());
  if (analysis.fatal) throw new HttpError(400, 'IMPORT_INVALID', analysis.fatal);
  return { input, analysis };
}

/** Judges every row and writes nothing. */
export async function previewImport(repo: OrgImportRepoPort, _admin: OnboardingCaller, raw: ImportRequest) {
  const { analysis } = await analyse(repo, raw);
  return summarise(analysis);
}

/**
 * Imports the rows that are ready. The file is analysed again here: the server never trusts what the browser
 * says about a row. Duplicates and errors are always skipped. Returns the claim codes, which exist only in this
 * response (only their hashes are stored).
 */
export async function runImport(
  repo: OrgImportRepoPort,
  admin: OnboardingCaller,
  raw: ImportRequest,
  now = new Date(),
) {
  const { input, analysis } = await analyse(repo, raw);
  const rows = analysis.rows.filter((r) => r.data !== null);
  if (rows.length === 0) {
    throw new HttpError(
      400,
      'NOTHING_TO_IMPORT',
      'There is nothing to import: every row is a duplicate or has an error.',
    );
  }
  const ts = now.toISOString();
  const batchId = repo.newBatchId();

  const items: ImportItem[] = [];
  const codes = new Map<string, string>();
  for (const r of rows) {
    const id = repo.newOrganisationId();
    const code = generateClaimCode();
    const org: OrganisationFullDoc = {
      ...buildUnclaimedOrganisation(r.data!, admin.uid, ts),
      importBatchId: batchId,
    };
    codes.set(id, formatClaimCode(code));
    items.push({
      id,
      org,
      entry: buildUnclaimedEntry(id, org, ts),
      claim: {
        orgId: id,
        codeHash: hashClaimCode(code),
        createdAt: ts,
        createdBy: admin.uid,
        expiresAt: expiry(now),
      },
    });
  }

  const batch: ImportBatchDoc = {
    createdAt: ts,
    createdBy: admin.uid,
    sourceNote: input.source,
    fileName: input.fileName ?? null,
    rowCount: analysis.rows.length,
    createdCount: items.length,
    skippedCount: analysis.rows.length - items.length,
    status: 'importing',
    orgIds: items.map((i) => i.id),
  };
  await repo.startBatch(batchId, batch);
  try {
    await repo.writeOrganisations(items);
  } catch (err) {
    console.error('[import] stopped part-way', batchId, err);
    throw new HttpError(
      500,
      'IMPORT_INCOMPLETE',
      `The import stopped part-way (batch ${batchId}). Use “Undo this import” on that batch, or upload the file again: schools already added are skipped as duplicates.`,
    );
  }
  await repo.finishBatch(
    batchId,
    { status: 'active' },
    {
      type: 'organisation.import_batch',
      batchId,
      createdCount: items.length,
      skippedCount: batch.skippedCount,
      sourceNote: input.source,
      by: admin.uid,
      at: ts,
    },
  );

  return {
    batchId,
    created: items.map((i) => ({
      id: i.id,
      name: i.org.name,
      city: i.org.city ?? '',
      province: i.org.province ?? '',
      claimCode: codes.get(i.id)!,
    })),
    skipped: analysis.rows.filter((r) => r.data === null).map(({ data: _d, ...row }) => row),
  };
}

/** Removes what an import added, as long as nobody has claimed it. Claimed schools are never touched. */
export async function undoImport(
  repo: OrgImportRepoPort,
  admin: OnboardingCaller,
  batchId: string,
  now = new Date(),
) {
  const batch = await repo.getBatch(batchId);
  if (!batch) throw new HttpError(404, 'BATCH_NOT_FOUND', 'This import could not be found');
  if (batch.status === 'undone')
    throw new HttpError(409, 'ALREADY_UNDONE', 'This import has already been undone');
  const at = now.toISOString();
  return repo.undoBatch(batchId, admin.uid, at, (removed, kept) => ({
    type: 'organisation.import_undone',
    batchId,
    removedCount: removed,
    keptCount: kept.length,
    by: admin.uid,
    at,
  }));
}
