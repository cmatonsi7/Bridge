import type { AccountStatus, GuardianRelationship, OrganisationType, Role } from './roles.js';

/** Firestore collection names, in one place so rules, client and server agree. */
export const COLLECTIONS = {
  users: 'users',
  privateDetails: 'private', // users/{uid}/private/details
  athleteProfiles: 'athleteProfiles',
  coachProfiles: 'coachProfiles',
  guardianProfiles: 'guardianProfiles',
  organisations: 'organisations',
  guardianLinks: 'guardianLinks',
  auditLogs: 'auditLogs',
} as const;

/** ISO-8601 string as written by the server; Firestore Timestamps are converted at the boundary. */
export type IsoDateTime = string;

/** users/{uid} — readable by the owner (and admins). Sensitive fields are server-written only. */
export interface UserDoc {
  uid: string;
  email: string;
  firstName: string;
  surname: string;
  displayName: string;
  role: Role; // server-written, mirrors the custom claim
  status: AccountStatus; // server-written
  isMinor: boolean; // server-computed from DOB
  onboardingComplete: boolean; // server-written
  organisationId?: string; // server-written for organisation owners
  /** Verified guardians of a minor athlete (server-written when a parent confirms a link). */
  guardianUids?: string[];
  termsVersion: string;
  termsAcceptedAt: IsoDateTime;
  createdAt: IsoDateTime;
  updatedAt: IsoDateTime;
}

/** users/{uid}/private/details — never public. Owner, verified guardians (Phase 2) and admins only. */
export interface PrivateDetailsDoc {
  dateOfBirth: string; // YYYY-MM-DD
  mobile: string;
}

export type GuardianLinkStatus = 'pending' | 'verified' | 'declined' | 'revoked';

/** guardianLinks/{linkId} — server-written only. */
export interface GuardianLinkDoc {
  athleteUid: string;
  /** Child's display name, so the parent recognises the request before any access is granted. */
  athleteName?: string;
  guardianEmail: string;
  guardianUid: string | null; // set when the guardian accepts (Phase 2)
  relationship: GuardianRelationship;
  status: GuardianLinkStatus;
  requestedAt: IsoDateTime;
  verifiedAt: IsoDateTime | null;
  consentVersion: string | null;
  /** Set when the parent declines or later withdraws consent. */
  closedAt?: IsoDateTime | null;
}

export interface OrganisationDoc {
  name: string;
  type: OrganisationType;
  ownerUid: string;
  verified: boolean; // server-written
  createdAt: IsoDateTime;
  updatedAt: IsoDateTime;
}

/** Shape returned by GET /api/me and POST /api/onboarding. */
export interface SessionProfile {
  user: UserDoc;
  guardianLinkStatus?: GuardianLinkStatus;
}
