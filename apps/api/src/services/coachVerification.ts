import {
  canSubmit,
  credentialDecisionSchema,
  CREDENTIAL_UPLOADS_ENABLED,
  credentialStoragePath,
  registerCredentialDocSchema,
  CREDENTIAL_MAX_DOCS,
  type CoachVerificationDoc,
  type CoachVerificationNoteDoc,
  type CredentialDocRecord,
  type CredentialStatus,
  type NotificationDoc,
} from '@sportbridge/shared';
import { HttpError } from '../middleware/errors.js';

export type Outbox = { uid: string; notification: NotificationDoc }[];
type Audit = Record<string, unknown>;

export interface CoachVerificationRepoPort {
  newDocId(): string;
  getCoach(uid: string): Promise<{ uid: string; displayName: string; role: string } | null>;
  get(uid: string): Promise<CoachVerificationDoc | null>;
  create(uid: string, doc: CoachVerificationDoc): Promise<CoachVerificationDoc>;
  update(uid: string, changes: Partial<CoachVerificationDoc>, outbox: Outbox, audit: Audit): Promise<void>;
  /** Writes the staff-only note to its own document, which the coach cannot read. */
  putInternalNote(uid: string, note: CoachVerificationNoteDoc): Promise<void>;
  countQualifications(uid: string): Promise<number>;
  listDocs(uid: string): Promise<CredentialDocRecord[]>;
  addDoc(uid: string, doc: CredentialDocRecord, audit: Audit): Promise<void>;
  removeDoc(uid: string, docId: string, audit: Audit): Promise<CredentialDocRecord | null>;
  /** Everyone awaiting review, plus those already decided, for the staff queue. */
  queue(): Promise<CoachVerificationDoc[]>;
  /** A short-lived link staff can open to read one document. */
  signedUrlFor(storagePath: string, expiresInMs: number): Promise<string>;
  deleteFile(storagePath: string): Promise<void>;
}

export interface Caller {
  uid: string;
  role?: string;
  admin?: boolean;
  emailVerified: boolean;
}

const note = (title: string, body: string, at: string): NotificationDoc => ({
  type: 'coach.verification',
  title,
  body,
  link: '/app/profile',
  read: false,
  createdAt: at,
});

function requireCoach(c: Caller) {
  if (c.role !== 'coach') throw new HttpError(403, 'NOT_COACH', 'Only coaches have credentials to verify');
}

/** Reads the coach's verification record, creating an empty draft the first time they look at it. */
export async function getVerification(
  repo: CoachVerificationRepoPort,
  c: Caller,
  now = new Date(),
): Promise<CoachVerificationDoc> {
  const existing = await repo.get(c.uid);
  if (existing) return existing;
  const coach = await repo.getCoach(c.uid);
  if (!coach) throw new HttpError(404, 'NO_PROFILE', 'Finish setting up your account first');
  const ts = now.toISOString();
  return repo.create(c.uid, {
    uid: c.uid,
    displayName: coach.displayName,
    status: 'draft',
    decisionNote: null,
    submittedAt: null,
    decidedAt: null,
    decidedByUid: null,
    docCount: 0,
    createdAt: ts,
    updatedAt: ts,
  });
}

/** Everything the coach's own credentials page needs in one call. */
export async function credentialsView(repo: CoachVerificationRepoPort, c: Caller, now = new Date()) {
  requireCoach(c);
  const verification = await getVerification(repo, c, now);
  const [docs, qualificationCount] = await Promise.all([
    repo.listDocs(c.uid),
    repo.countQualifications(c.uid),
  ]);
  return {
    verification,
    documents: docs,
    qualificationCount,
    canSubmit: canSubmit(verification.status, qualificationCount, docs.length),
  };
}

/**
 * Records a document the coach has just uploaded to Storage.
 * The file goes straight from the browser to Storage (rules there check type and size); this records
 * it so staff can find it, and re-checks type and size rather than trusting what the browser claims.
 */
export async function registerDocument(
  repo: CoachVerificationRepoPort,
  c: Caller,
  raw: unknown,
  now = new Date(),
) {
  requireCoach(c);
  const input = registerCredentialDocSchema.parse(raw ?? {});
  const verification = await getVerification(repo, c, now);
  if (verification.status === 'verified') {
    throw new HttpError(409, 'ALREADY_VERIFIED', 'Your credentials are already verified');
  }
  if (verification.status === 'submitted') {
    throw new HttpError(
      409,
      'UNDER_REVIEW',
      'Your documents are being reviewed. Wait for the decision before adding more.',
    );
  }
  const docs = await repo.listDocs(c.uid);
  if (docs.length >= CREDENTIAL_MAX_DOCS) {
    throw new HttpError(409, 'TOO_MANY_DOCS', `You can upload up to ${CREDENTIAL_MAX_DOCS} documents`);
  }
  const docId = repo.newDocId();
  // The path is computed here, never taken from the browser: a caller cannot point this record at
  // somebody else's file.
  const storagePath = credentialStoragePath(c.uid, docId);
  if (input.storagePath !== storagePath) {
    throw new HttpError(400, 'BAD_PATH', 'That upload could not be matched to your account');
  }
  const record: CredentialDocRecord = {
    id: docId,
    qualificationId: input.qualificationId,
    fileName: input.fileName,
    contentType: input.contentType,
    sizeBytes: input.sizeBytes,
    storagePath,
    uploadedAt: now.toISOString(),
  };
  await repo.addDoc(c.uid, record, {
    type: 'coach.credential_uploaded',
    uid: c.uid,
    docId,
    at: record.uploadedAt,
  });
  return record;
}

/** The id the browser must upload to before calling registerDocument. */
export function nextUploadTarget(repo: CoachVerificationRepoPort, c: Caller) {
  requireCoach(c);
  const docId = repo.newDocId();
  return { docId, storagePath: credentialStoragePath(c.uid, docId) };
}

export async function removeDocument(
  repo: CoachVerificationRepoPort,
  c: Caller,
  docId: string,
  now = new Date(),
) {
  requireCoach(c);
  const verification = await getVerification(repo, c, now);
  if (verification.status === 'submitted') {
    throw new HttpError(409, 'UNDER_REVIEW', 'You cannot change your documents while they are being reviewed');
  }
  const removed = await repo.removeDoc(c.uid, docId, {
    type: 'coach.credential_removed',
    uid: c.uid,
    docId,
    at: now.toISOString(),
  });
  if (!removed) throw new HttpError(404, 'DOC_NOT_FOUND', 'That document could not be found');
  // The record is gone either way; a file left behind is tidied up but never blocks the coach.
  await repo.deleteFile(removed.storagePath).catch(() => undefined);
}

export async function submitForReview(
  repo: CoachVerificationRepoPort,
  c: Caller,
  now = new Date(),
  /** Defaults to the switch; a parameter so both settings stay testable. */
  uploadsEnabled = CREDENTIAL_UPLOADS_ENABLED,
) {
  requireCoach(c);
  const verification = await getVerification(repo, c, now);
  const [docs, qualificationCount] = await Promise.all([
    repo.listDocs(c.uid),
    repo.countQualifications(c.uid),
  ]);
  if (verification.status === 'verified') {
    throw new HttpError(409, 'ALREADY_VERIFIED', 'Your credentials are already verified');
  }
  if (verification.status === 'submitted') {
    throw new HttpError(409, 'ALREADY_SUBMITTED', 'Your documents are already being reviewed');
  }
  if (!canSubmit(verification.status, qualificationCount, docs.length, uploadsEnabled)) {
    throw new HttpError(
      400,
      'NOTHING_TO_REVIEW',
      uploadsEnabled
        ? 'Add at least one qualification and upload a document proving it'
        : 'Credential reviews are not open yet',
    );
  }
  const ts = now.toISOString();
  await repo.update(
    c.uid,
    {
      status: 'submitted',
      submittedAt: ts,
      decisionNote: null,
      decidedAt: null,
      decidedByUid: null,
      docCount: docs.length,
      updatedAt: ts,
    },
    [],
    { type: 'coach.credentials_submitted', uid: c.uid, docs: docs.length, at: ts },
  );
}

/** The staff review queue, with a readable link per document. */
export async function reviewQueue(repo: CoachVerificationRepoPort, c: Caller) {
  if (!c.admin) throw new HttpError(403, 'NOT_ADMIN', 'Staff only');
  const items = await repo.queue();
  const withDocs = await Promise.all(
    items.map(async (v) => {
      const docs = await repo.listDocs(v.uid);
      const links = await Promise.all(
        docs.map(async (d) => ({
          ...d,
          // Short-lived on purpose: these are identity documents, and a link that lives forever is a leak.
          url: await repo.signedUrlFor(d.storagePath, 15 * 60 * 1000).catch(() => null),
        })),
      );
      return { ...v, documents: links };
    }),
  );
  return withDocs.sort((a, b) => (a.submittedAt ?? a.createdAt).localeCompare(b.submittedAt ?? b.createdAt));
}

/** Staff verify a coach, or take verification away. */
export async function decideCredentials(
  repo: CoachVerificationRepoPort,
  c: Caller,
  coachUid: string,
  raw: unknown,
  now = new Date(),
) {
  if (!c.admin) throw new HttpError(403, 'NOT_ADMIN', 'Staff only');
  const input = credentialDecisionSchema.parse(raw ?? {});
  const verification = await repo.get(coachUid);
  if (!verification) throw new HttpError(404, 'NOT_FOUND', 'This coach has not submitted any credentials');
  if (!input.verified && !input.decisionNote) {
    // Telling a coach "no" with no reason leaves them nothing to fix.
    throw new HttpError(400, 'NOTE_REQUIRED', 'Tell the coach why, so they know what to send again');
  }
  const ts = now.toISOString();
  const status: CredentialStatus = input.verified ? 'verified' : 'rejected';
  const title = input.verified ? 'Your coaching credentials are verified' : 'We could not verify your documents';
  const body = input.verified
    ? 'Your profile now shows the Verified coach badge, and you can send connection requests to athletes.'
    : (input.decisionNote ?? 'Please check your documents and send them again.');

  await repo.update(
    coachUid,
    { status, decisionNote: input.decisionNote, decidedAt: ts, decidedByUid: c.uid, updatedAt: ts },
    [{ uid: coachUid, notification: note(title, body, ts) }],
    { type: `coach.${status}`, uid: coachUid, by: c.uid, at: ts },
  );
  // Kept in its own staff-only document, never on the record the coach can read.
  if (input.internalNote) {
    await repo.putInternalNote(coachUid, {
      uid: coachUid,
      internalNote: input.internalNote,
      decidedByUid: c.uid,
      decidedAt: ts,
    });
  }
}

/** Used by the connection gate: what this coach's verification status is, if any. */
export async function statusOf(
  repo: CoachVerificationRepoPort,
  uid: string,
): Promise<CredentialStatus | undefined> {
  const v = await repo.get(uid);
  return v?.status;
}
