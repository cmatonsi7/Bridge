import { z } from 'zod';

/**
 * Coach credential verification (Phase 5b).
 *
 * A coach declares their qualifications and uploads proof; staff read the documents and decide. Until
 * they do, the coach shows no badge at all — not a "pending" one. A parent reading a coach's profile
 * should never see a word that looks like SportBridge vouching for someone nobody has checked.
 *
 * Verification is also a gate, not only a badge: an unverified coach cannot request a connection with
 * an athlete. That is a deliberate trade — it slows coach sign-ups down to the speed of the review
 * queue — and it is one switch (`CONNECTION_REQUIRES_VERIFICATION`) if the client wants it opened up.
 *
 * ---- Both switches are OFF right now (2026-11-16) ----
 * Firebase Storage is not provisioned on the project: since 3 February 2026 Cloud Storage requires the
 * paid Blaze plan, and the client is not ready to subscribe. So a coach cannot upload anything, which
 * means they cannot complete verification, which — with the gate on — would leave every coach unable to
 * contact anybody with no way to fix it themselves.
 *
 * Blocking everyone is worse than postponing the check, so the gate is open. The alternative considered
 * and rejected was to accept text-only submissions and keep the gate: that would keep the badge while
 * quietly making it mean less than the page claims, which is the one thing a safeguarding feature must
 * never do. No badge is shown to anyone while this is off, so nothing false is said about any coach.
 *
 * To turn the feature back on once Storage exists: set both constants below to true. Nothing else
 * changes — the review queue, the decision flow, the notifications and the rules are all already live.
 */

/** Whether an unverified coach is blocked from requesting connections. See the note above. */
export const CONNECTION_REQUIRES_VERIFICATION = false;

/** Whether coaches can upload credential documents. Requires Firebase Storage (Blaze). See above. */
export const CREDENTIAL_UPLOADS_ENABLED = false;

export const CREDENTIAL_STATUSES = ['draft', 'submitted', 'verified', 'rejected'] as const;
export type CredentialStatus = (typeof CREDENTIAL_STATUSES)[number];

export const CREDENTIAL_STATUS_LABELS: Record<CredentialStatus, string> = {
  draft: 'Not submitted',
  submitted: 'Awaiting review',
  verified: 'Verified',
  rejected: 'Needs attention',
};

/**
 * What the coach is told at each stage. Written for the coach, not for staff.
 *
 * These depend on the switches above, because a message that promises a check nobody can perform — or
 * threatens a block that is not in force — is worse than no message at all.
 */
export const CREDENTIAL_STATUS_MESSAGES: Record<CredentialStatus, string> = {
  draft: CREDENTIAL_UPLOADS_ENABLED
    ? `Add your qualifications and upload proof of each one, then send them to SportBridge for review.${
        CONNECTION_REQUIRES_VERIFICATION
          ? ' Until you are verified you cannot send connection requests to athletes.'
          : ''
      }`
    : 'Credential checks are not open yet. You can add your qualifications on your profile now, and SportBridge will ask for proof of them when document uploads are switched on.',
  submitted:
    'SportBridge is reviewing your documents. We will let you know as soon as a decision is made.',
  verified: `SportBridge has checked your documents. Your profile shows the Verified coach badge${
    CONNECTION_REQUIRES_VERIFICATION ? ' and you can send connection requests' : ''
  }.`,
  rejected: 'SportBridge could not verify your documents. Read the note below and send them again.',
};

/** Only these upload types. Checked in the API, in Storage rules, and in the browser. */
export const CREDENTIAL_MIME_TYPES = ['application/pdf', 'image/jpeg', 'image/png'] as const;
export type CredentialMimeType = (typeof CREDENTIAL_MIME_TYPES)[number];
export const CREDENTIAL_MAX_BYTES = 5 * 1024 * 1024;
export const CREDENTIAL_MAX_DOCS = 10;

export const credentialTypeLabel = (mime: string) =>
  mime === 'application/pdf' ? 'PDF' : mime === 'image/png' ? 'PNG image' : 'JPEG image';

/**
 * coachProfiles/{uid}/credentialDocs/{docId} — one uploaded document.
 * The file itself lives in Storage at coachCredentials/{uid}/{docId}; this is only its record.
 * Readable by the coach and staff, and by nobody else ever: these are identity documents.
 */
export interface CredentialDocRecord {
  id: string;
  /** The qualification this proves, if the coach linked it to one. */
  qualificationId: string | null;
  fileName: string;
  contentType: CredentialMimeType;
  sizeBytes: number;
  storagePath: string;
  uploadedAt: string;
}

/**
 * coachVerifications/{uid} — the review itself. Server-written only; a coach cannot set their own status.
 */
export interface CoachVerificationDoc {
  uid: string;
  displayName: string;
  status: CredentialStatus;
  /** What staff told the coach when rejecting. Shown to the coach, so it must be usable, not internal shorthand. */
  decisionNote: string | null;
  submittedAt: string | null;
  decidedAt: string | null;
  decidedByUid: string | null;
  docCount: number;
  createdAt: string;
  updatedAt: string;
}

/**
 * coachVerificationNotes/{uid} — the staff-only note, kept in its own document because the coach can
 * read their own CoachVerificationDoc. "Internal" has to mean internal, or staff will stop writing
 * anything useful in it.
 */
export interface CoachVerificationNoteDoc {
  uid: string;
  internalNote: string | null;
  decidedByUid: string;
  decidedAt: string;
}

export const submitCredentialsSchema = z.object({});

export const credentialDecisionSchema = z.object({
  verified: z.boolean(),
  /** Shown to the coach. Required on a rejection: "no" without a reason is not a decision anyone can act on. */
  decisionNote: z
    .string()
    .trim()
    .max(500, 'Keep the note under 500 characters')
    .transform((v) => (v === '' ? null : v))
    .nullable()
    .optional()
    .transform((v) => v ?? null),
  internalNote: z
    .string()
    .trim()
    .max(500, 'Keep the note under 500 characters')
    .transform((v) => (v === '' ? null : v))
    .nullable()
    .optional()
    .transform((v) => v ?? null),
});
export type CredentialDecisionInput = z.input<typeof credentialDecisionSchema>;

export const registerCredentialDocSchema = z.object({
  qualificationId: z
    .string()
    .trim()
    .max(128)
    .transform((v) => (v === '' ? null : v))
    .nullable()
    .optional()
    .transform((v) => v ?? null),
  fileName: z.string().trim().min(1, 'Missing file name').max(200),
  contentType: z.enum(CREDENTIAL_MIME_TYPES, {
    errorMap: () => ({ message: 'Upload a PDF, JPEG or PNG' }),
  }),
  sizeBytes: z
    .number()
    .int()
    .positive('That file is empty')
    .max(CREDENTIAL_MAX_BYTES, 'Each document must be under 5 MB'),
  storagePath: z.string().trim().min(1).max(300),
});
export type RegisterCredentialDocInput = z.input<typeof registerCredentialDocSchema>;

export const credentialStoragePath = (uid: string, docId: string) => `coachCredentials/${uid}/${docId}`;

/**
 * A coach may submit once they have at least one qualification and one document proving something.
 * With uploads switched off nobody can reach that state, which is deliberate: an empty submission
 * would put a coach in the review queue with nothing for staff to actually check.
 */
export function canSubmit(
  status: CredentialStatus,
  qualificationCount: number,
  docCount: number,
  uploadsEnabled = CREDENTIAL_UPLOADS_ENABLED,
) {
  if (!uploadsEnabled) return false;
  if (status === 'submitted' || status === 'verified') return false;
  return qualificationCount > 0 && docCount > 0;
}

/**
 * Whether this coach is allowed to send connection requests.
 * `required` defaults to the switch above; it is a parameter so the gate's behaviour can be tested
 * in both settings, not only whichever one happens to be configured today.
 */
export const coachCanConnect = (
  status: CredentialStatus | undefined,
  required = CONNECTION_REQUIRES_VERIFICATION,
) => !required || status === 'verified';
