import { CURRENT_TERMS_VERSION, type GuardianLinkDoc } from '@sportbridge/shared';
import { HttpError } from '../middleware/errors.js';

/** Storage operations for guardian links. Each mutation runs atomically (a Firestore transaction). */
export interface GuardianRepoPort {
  /**
   * Loads the link and the athlete's current guardian list, lets `decide` validate them and
   * return the changes, then writes link + athlete + audit together.
   */
  mutateLink(
    linkId: string,
    decide: (
      link: GuardianLinkDoc | null,
      athleteGuardianUids: string[],
    ) => {
      link: Partial<GuardianLinkDoc>;
      athlete?: { guardianUids: string[]; status?: 'active' | 'restricted' };
      audit: Record<string, unknown>;
    },
  ): Promise<void>;
}

export interface GuardianCaller {
  uid: string;
  email?: string;
  emailVerified: boolean;
  role?: string;
}

function requireGuardian(c: GuardianCaller) {
  if (c.role !== 'guardian')
    throw new HttpError(403, 'NOT_GUARDIAN', 'Only parent / guardian accounts can do this');
  if (!c.emailVerified || !c.email) {
    throw new HttpError(
      403,
      'EMAIL_NOT_VERIFIED',
      'Verify your email address before managing a child account',
    );
  }
}

/** The request must have been addressed to this parent's verified email. */
function requireAddressedTo(link: GuardianLinkDoc | null, c: GuardianCaller): GuardianLinkDoc {
  if (!link || link.guardianEmail !== c.email!.toLowerCase()) {
    // Same response whether the link doesn't exist or belongs to someone else.
    throw new HttpError(404, 'LINK_NOT_FOUND', 'This request could not be found');
  }
  return link;
}

export async function confirmLink(
  repo: GuardianRepoPort,
  c: GuardianCaller,
  linkId: string,
  now = new Date(),
) {
  requireGuardian(c);
  const ts = now.toISOString();
  await repo.mutateLink(linkId, (raw, guardians) => {
    const link = requireAddressedTo(raw, c);
    if (link.status !== 'pending')
      throw new HttpError(409, 'LINK_NOT_PENDING', 'This request has already been answered');
    return {
      link: {
        status: 'verified',
        guardianUid: c.uid,
        verifiedAt: ts,
        consentVersion: CURRENT_TERMS_VERSION,
        closedAt: null,
      },
      athlete: { guardianUids: Array.from(new Set([...guardians, c.uid])), status: 'active' },
      audit: {
        type: 'guardian.confirmed',
        linkId,
        athleteUid: link.athleteUid,
        guardianUid: c.uid,
        consentVersion: CURRENT_TERMS_VERSION,
        at: ts,
      },
    };
  });
}

export async function declineLink(
  repo: GuardianRepoPort,
  c: GuardianCaller,
  linkId: string,
  now = new Date(),
) {
  requireGuardian(c);
  const ts = now.toISOString();
  await repo.mutateLink(linkId, (raw) => {
    const link = requireAddressedTo(raw, c);
    if (link.status !== 'pending')
      throw new HttpError(409, 'LINK_NOT_PENDING', 'This request has already been answered');
    return {
      link: { status: 'declined', guardianUid: c.uid, closedAt: ts },
      audit: { type: 'guardian.declined', linkId, athleteUid: link.athleteUid, guardianUid: c.uid, at: ts },
    };
  });
}

/** Withdraw consent. The child returns to a restricted account if no other verified guardian remains. */
export async function revokeLink(
  repo: GuardianRepoPort,
  c: GuardianCaller,
  linkId: string,
  now = new Date(),
) {
  requireGuardian(c);
  const ts = now.toISOString();
  await repo.mutateLink(linkId, (link, guardians) => {
    if (!link || link.guardianUid !== c.uid)
      throw new HttpError(404, 'LINK_NOT_FOUND', 'This link could not be found');
    if (link.status !== 'verified')
      throw new HttpError(409, 'LINK_NOT_ACTIVE', 'Consent is not currently given for this child');
    const remaining = guardians.filter((g) => g !== c.uid);
    return {
      link: { status: 'revoked', closedAt: ts },
      athlete: { guardianUids: remaining, status: remaining.length ? 'active' : 'restricted' },
      audit: { type: 'guardian.revoked', linkId, athleteUid: link.athleteUid, guardianUid: c.uid, at: ts },
    };
  });
}
