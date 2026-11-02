import type { DecodedIdToken } from 'firebase-admin/auth';
import type { GuardianLinkDoc, OrganisationDoc, PrivateDetailsDoc, UserDoc } from '@sportbridge/shared';

/** Narrow interfaces over Firebase so business logic is testable without the SDK. */
export interface AuthPort {
  verifyIdToken(token: string): Promise<DecodedIdToken>;
  setCustomUserClaims(uid: string, claims: Record<string, unknown>): Promise<void>;
}

export interface OnboardingWrite {
  uid: string;
  user: UserDoc;
  privateDetails: PrivateDetailsDoc;
  /** athleteProfiles / coachProfiles / guardianProfiles doc; organisation owners get `organisation` instead. */
  roleProfile?: { collection: string; data: Record<string, unknown> };
  organisation?: { id: string; data: OrganisationDoc };
  guardianLink?: { id: string; data: GuardianLinkDoc };
  audit: Record<string, unknown>;
}

export interface UserRepoPort {
  getUser(uid: string): Promise<UserDoc | null>;
  newId(collection: string): string;
  /** Writes everything atomically. Throws Error('ALREADY_ONBOARDED') if users/{uid} exists. */
  commitOnboarding(write: OnboardingWrite): Promise<void>;
}
