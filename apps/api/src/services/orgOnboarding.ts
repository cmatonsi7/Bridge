import { createHash, randomInt } from 'node:crypto';
import {
  CLAIM_CODE_ALPHABET,
  CLAIM_CODE_LENGTH,
  CLAIM_CODE_VALID_DAYS,
  DEFAULT_ORG_PRIVACY,
  formatClaimCode,
  normaliseClaimCode,
  unclaimedEntryId,
  unclaimedOrganisationSchema,
  verifyRequestSchema,
  type ClaimDoc,
  type DirectoryEntryDoc,
  type NotificationDoc,
  type OrganisationFullDoc,
  type UnclaimedOrganisationFields,
  type UnclaimedOrganisationInput,
  type UserDoc,
  type VerifyRequestInput,
} from '@sportbridge/shared';
import { HttpError } from '../middleware/errors.js';

/** What the claim needs to know, loaded in one place so the decision is made on a consistent view. */
export interface ClaimContext {
  orgId: string;
  org: OrganisationFullDoc;
  claim: ClaimDoc;
  user: UserDoc;
  ownOrgId: string | null;
  ownOrg: OrganisationFullDoc | null;
  ownListingCount: number;
}

export interface OrgOnboardingRepoPort {
  newOrganisationId(): string;
  createUnclaimed(
    id: string,
    org: OrganisationFullDoc,
    entry: DirectoryEntryDoc,
    claim: ClaimDoc,
    audit: Record<string, unknown>,
  ): Promise<void>;
  /** Replaces the claim code of an organisation that is still unclaimed. Throws Error('NOT_UNCLAIMED') otherwise. */
  replaceClaim(orgId: string, claim: ClaimDoc, audit: Record<string, unknown>): Promise<void>;
  /** Deletes an unclaimed organisation, its claim and its directory entry. Throws Error('NOT_UNCLAIMED') otherwise. */
  removeUnclaimed(orgId: string, audit: Record<string, unknown>): Promise<void>;
  /**
   * Verifies or un-verifies an organisation in ONE transaction: the organisation, every one of its listings
   * (which carry a copy of the badge), its directory entry, a staff-only record, a notification and the audit entry.
   * Throws Error with code NOT_FOUND, UNCLAIMED, ALREADY, NOT_VERIFIED or TOO_MANY_LISTINGS.
   */
  setVerification(args: VerificationArgs): Promise<{ name: string }>;
  loadClaim(codeHash: string, uid: string): Promise<ClaimContext | null>;
  /** Re-checks the organisation is still unclaimed and applies the claim atomically. Throws Error('NOT_UNCLAIMED') if it was taken meanwhile. */
  commitClaim(ctx: ClaimContext, uid: string, at: string, audit: Record<string, unknown>): Promise<void>;
}

export interface VerificationArgs {
  orgId: string;
  verified: boolean;
  by: string;
  at: string;
  note: string | null;
  notify: (ownerUid: string, organisationName: string) => NotificationDoc;
  audit: (organisationName: string) => Record<string, unknown>;
}

export interface OnboardingCaller {
  uid: string;
  role?: string;
  emailVerified: boolean;
}

export const hashClaimCode = (code: string) => createHash('sha256').update(code).digest('hex');

/** A random code from the unambiguous alphabet, e.g. "7K4M9XQ2". */
export function generateClaimCode(): string {
  let c = '';
  for (let i = 0; i < CLAIM_CODE_LENGTH; i++) c += CLAIM_CODE_ALPHABET[randomInt(CLAIM_CODE_ALPHABET.length)];
  return c;
}

export const expiry = (now: Date) => new Date(now.getTime() + CLAIM_CODE_VALID_DAYS * 86400000).toISOString();
const INVALID = () =>
  new HttpError(
    404,
    'CODE_INVALID',
    'That claim code isn’t valid. Check it and try again, or ask SportBridge for a new one.',
  );

/** The directory entry for an organisation nobody owns yet: public institutional details only. */
export function buildUnclaimedEntry(orgId: string, org: OrganisationFullDoc, at: string): DirectoryEntryDoc {
  return {
    uid: unclaimedEntryId(orgId),
    role: 'organisation',
    displayName: org.name,
    sports: org.sports ?? [],
    province: org.province ?? null,
    city: org.city ?? null,
    headline: org.description?.slice(0, 140) ?? null,
    tags: org.offerings ?? [],
    orgId,
    orgType: org.type,
    verified: false,
    claimed: false,
    updatedAt: at,
  };
}

/** Staff add a school or organisation. Returns the claim code once; only its hash is stored. */
/** An organisation added by staff on its behalf: nobody owns it, it is unverified, and it is listed publicly. */
export function buildUnclaimedOrganisation(
  f: UnclaimedOrganisationFields,
  importedBy: string,
  ts: string,
): OrganisationFullDoc {
  const { schoolNumber, sourceNote, ...profile } = f;
  return {
    ...profile,
    ownerUid: null,
    verified: false,
    claimStatus: 'unclaimed',
    source: 'staff_import',
    schoolNumber,
    sourceNote,
    importedBy,
    claimedAt: null,
    privacy: { ...DEFAULT_ORG_PRIVACY, listed: true },
    createdAt: ts,
    updatedAt: ts,
  };
}

export async function createUnclaimedOrganisation(
  repo: OrgOnboardingRepoPort,
  admin: OnboardingCaller,
  raw: UnclaimedOrganisationInput,
  now = new Date(),
) {
  const f = unclaimedOrganisationSchema.parse(raw);
  const ts = now.toISOString();
  const id = repo.newOrganisationId();
  const org = buildUnclaimedOrganisation(f, admin.uid, ts);
  const code = generateClaimCode();
  const claim: ClaimDoc = {
    orgId: id,
    codeHash: hashClaimCode(code),
    createdAt: ts,
    createdBy: admin.uid,
    expiresAt: expiry(now),
  };
  await repo.createUnclaimed(id, org, buildUnclaimedEntry(id, org, ts), claim, {
    type: 'organisation.imported',
    organisationId: id,
    organisationName: f.name,
    by: admin.uid,
    source: f.sourceNote,
    at: ts,
  });
  return { id, claimCode: formatClaimCode(code), expiresAt: claim.expiresAt };
}

export async function regenerateClaimCode(
  repo: OrgOnboardingRepoPort,
  admin: OnboardingCaller,
  orgId: string,
  now = new Date(),
) {
  const ts = now.toISOString();
  const code = generateClaimCode();
  const claim: ClaimDoc = {
    orgId,
    codeHash: hashClaimCode(code),
    createdAt: ts,
    createdBy: admin.uid,
    expiresAt: expiry(now),
  };
  try {
    await repo.replaceClaim(orgId, claim, {
      type: 'organisation.claim_code_reset',
      organisationId: orgId,
      by: admin.uid,
      at: ts,
    });
  } catch (err) {
    if (err instanceof Error && err.message === 'NOT_UNCLAIMED')
      throw new HttpError(
        409,
        'NOT_UNCLAIMED',
        'This organisation has already been claimed, or does not exist',
      );
    throw err;
  }
  return { claimCode: formatClaimCode(code), expiresAt: claim.expiresAt };
}

/** Removal on request. Only organisations nobody owns can be removed this way. */
export async function removeUnclaimedOrganisation(
  repo: OrgOnboardingRepoPort,
  admin: OnboardingCaller,
  orgId: string,
  now = new Date(),
) {
  try {
    await repo.removeUnclaimed(orgId, {
      type: 'organisation.removed',
      organisationId: orgId,
      by: admin.uid,
      at: now.toISOString(),
    });
  } catch (err) {
    if (err instanceof Error && err.message === 'NOT_UNCLAIMED')
      throw new HttpError(409, 'NOT_UNCLAIMED', 'Only an organisation nobody has claimed can be removed');
    throw err;
  }
}

/**
 * A school or club representative takes over a staff-added record with the code staff gave them.
 * Their own empty, self-registered organisation is replaced; anything with listings or a verified badge is
 * left alone and referred to support, so nothing can be lost or hijacked.
 */
export async function claimOrganisation(
  repo: OrgOnboardingRepoPort,
  c: OnboardingCaller,
  rawCode: string,
  now = new Date(),
) {
  if (c.role !== 'organisation')
    throw new HttpError(403, 'NOT_ORGANISATION', 'Only organisation accounts can claim an organisation');
  if (!c.emailVerified)
    throw new HttpError(
      403,
      'EMAIL_NOT_VERIFIED',
      'Verify your email address before claiming an organisation',
    );
  const code = normaliseClaimCode(rawCode);
  if (!code) throw INVALID();
  const ctx = await repo.loadClaim(hashClaimCode(code), c.uid);
  // The same answer for a wrong code, a used code and a code for something already claimed.
  if (!ctx || ctx.org.claimStatus !== 'unclaimed' || ctx.org.ownerUid !== null) throw INVALID();
  if (new Date(ctx.claim.expiresAt).getTime() < now.getTime()) {
    throw new HttpError(410, 'CODE_EXPIRED', 'This claim code has expired. Ask SportBridge for a new one.');
  }
  if (ctx.user.role !== 'organisation')
    throw new HttpError(403, 'NOT_ORGANISATION', 'Only organisation accounts can claim an organisation');
  if (ctx.ownOrg) {
    if (ctx.ownOrg.verified) {
      throw new HttpError(
        409,
        'OWN_ORG_VERIFIED',
        'Your current organisation is verified, so it can’t be replaced automatically. Contact SportBridge.',
      );
    }
    if (ctx.ownListingCount > 0) {
      throw new HttpError(
        409,
        'OWN_ORG_HAS_LISTINGS',
        'Your current organisation already has listings. Contact SportBridge so we can move them across safely.',
      );
    }
  }
  try {
    await repo.commitClaim(ctx, c.uid, now.toISOString(), {
      type: 'organisation.claimed',
      organisationId: ctx.orgId,
      organisationName: ctx.org.name,
      by: c.uid,
      replacedOrganisationId: ctx.ownOrgId,
      at: now.toISOString(),
    });
  } catch (err) {
    if (err instanceof Error && err.message === 'NOT_UNCLAIMED') throw INVALID();
    throw err;
  }
  return { organisationId: ctx.orgId, name: ctx.org.name };
}

const VERIFICATION_ERRORS: Record<string, [number, string, string]> = {
  NOT_FOUND: [404, 'ORGANISATION_NOT_FOUND', 'This organisation could not be found'],
  UNCLAIMED: [
    409,
    'UNCLAIMED',
    'An organisation nobody has claimed can’t be verified yet. Verify it once its representative has claimed it.',
  ],
  ALREADY: [409, 'ALREADY_VERIFIED', 'This organisation is already verified'],
  NOT_VERIFIED: [409, 'NOT_VERIFIED', 'This organisation is not currently verified'],
  TOO_MANY_LISTINGS: [
    409,
    'TOO_MANY_LISTINGS',
    'This organisation has too many listings to update safely at once. Contact the developer.',
  ],
};

/** Staff verify an organisation, or remove its verification. The note is internal and never shown to the organisation. */
export async function setOrganisationVerification(
  repo: OrgOnboardingRepoPort,
  admin: OnboardingCaller,
  orgId: string,
  verified: boolean,
  raw: VerifyRequestInput,
  now = new Date(),
) {
  const { note } = verifyRequestSchema.parse(raw ?? {});
  const at = now.toISOString();
  try {
    return await repo.setVerification({
      orgId,
      verified,
      by: admin.uid,
      at,
      note,
      notify: (_ownerUid, name) => ({
        type: 'organisation.verification',
        title: verified ? 'Your organisation is now verified' : 'Verification removed',
        body: verified
          ? `SportBridge has verified ${name}. Your profile, listings and directory entry now show the Verified badge.`
          : `SportBridge has removed the Verified badge from ${name}. Contact SportBridge if you have questions.`,
        link: '/app/profile',
        read: false,
        createdAt: at,
      }),
      audit: (name) => ({
        type: verified ? 'organisation.verified' : 'organisation.unverified',
        organisationId: orgId,
        organisationName: name,
        by: admin.uid,
        note,
        at,
      }),
    });
  } catch (err) {
    const known = err instanceof Error ? VERIFICATION_ERRORS[err.message] : undefined;
    if (known) throw new HttpError(known[0], known[1], known[2]);
    throw err;
  }
}
