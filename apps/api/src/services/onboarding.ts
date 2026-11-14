import {
  COLLECTIONS,
  CURRENT_TERMS_VERSION,
  isMinor,
  parseIsoDate,
  type OnboardingData,
  type SelfServiceRole,
  type UserDoc,
} from '@sportbridge/shared';
import type { AuthPort, OnboardingWrite, UserRepoPort } from './ports.js';
import { HttpError } from '../middleware/errors.js';

const PROFILE_COLLECTION: Record<Exclude<SelfServiceRole, 'organisation'>, string> = {
  athlete: COLLECTIONS.athleteProfiles,
  guardian: COLLECTIONS.guardianProfiles,
  coach: COLLECTIONS.coachProfiles,
};

/** Pure: turns validated input into the exact documents to write. Age is always computed here, never trusted. */
export function buildOnboardingWrite(
  uid: string,
  email: string,
  input: OnboardingData,
  now: Date,
  newId: (collection: string) => string,
): OnboardingWrite {
  // Organisation accounts give no date of birth: SportBridge does not need an administrator's birth date.
  // They confirm they are an adult acting for the organisation, and that confirmation is required here too.
  const isOrganisation = input.role === 'organisation';
  if (isOrganisation && input.adultConfirmed !== true) {
    throw new HttpError(
      400,
      'ADULT_NOT_CONFIRMED',
      'Confirm you are 18 or over and authorised to act for this organisation',
    );
  }
  const dob = isOrganisation ? null : parseIsoDate(input.dateOfBirth ?? '');
  if (!isOrganisation && !dob) throw new HttpError(400, 'INVALID_DOB', 'Enter a valid date of birth');
  const minor = dob ? isMinor(dob, now) : false;
  if (minor && input.role !== 'athlete') {
    throw new HttpError(400, 'MINOR_ROLE', 'Under-18 accounts can only be athlete accounts');
  }
  const ts = now.toISOString();
  const orgId = input.role === 'organisation' ? newId(COLLECTIONS.organisations) : undefined;

  const user: UserDoc = {
    uid,
    email: email.toLowerCase(),
    firstName: input.firstName,
    surname: input.surname,
    displayName: `${input.firstName} ${input.surname}`,
    role: input.role,
    status: minor ? 'restricted' : 'active',
    isMinor: minor,
    onboardingComplete: true,
    ...(orgId ? { organisationId: orgId } : {}),
    termsVersion: CURRENT_TERMS_VERSION,
    termsAcceptedAt: ts,
    createdAt: ts,
    updatedAt: ts,
  };

  const write: OnboardingWrite = {
    uid,
    user,
    privateDetails: isOrganisation
      ? { mobile: input.mobile }
      : { dateOfBirth: input.dateOfBirth!, mobile: input.mobile },
    audit: { type: 'account.onboarded', uid, role: input.role, isMinor: minor, at: ts },
  };

  if (input.role === 'organisation') {
    write.organisation = {
      id: orgId!,
      data: {
        name: input.organisationName!,
        type: input.organisationType!,
        ownerUid: uid,
        verified: false,
        createdAt: ts,
        updatedAt: ts,
      },
    };
  } else {
    write.roleProfile = {
      collection: PROFILE_COLLECTION[input.role],
      data: {
        uid,
        displayName: user.displayName,
        // Minors start fully private until a guardian is verified.
        visibility: minor ? 'private' : 'members',
        createdAt: ts,
        updatedAt: ts,
      },
    };
  }

  if (minor) {
    write.guardianLink = {
      id: newId(COLLECTIONS.guardianLinks),
      data: {
        athleteUid: uid,
        athleteName: user.displayName,
        guardianEmail: input.guardianEmail!,
        guardianUid: null,
        relationship: input.guardianRelationship!,
        status: 'pending',
        requestedAt: ts,
        verifiedAt: null,
        consentVersion: null,
      },
    };
  }
  return write;
}

export interface OnboardingResult {
  user: UserDoc;
  created: boolean;
}

export async function completeOnboarding(
  deps: { auth: AuthPort; users: UserRepoPort; now?: () => Date },
  caller: { uid: string; email?: string; claims: Record<string, unknown> },
  input: OnboardingData,
): Promise<OnboardingResult> {
  if (caller.claims.admin === true || caller.claims.role === 'admin') {
    throw new HttpError(403, 'ADMIN_ACCOUNT', 'Administrator accounts are set up by SportBridge staff');
  }
  if (!caller.email) throw new HttpError(400, 'NO_EMAIL', 'Your account has no email address');

  const existing = await deps.users.getUser(caller.uid);
  if (existing) {
    // Idempotent: a retried request never changes the role. It only restores a claim lost by a failed attempt.
    if (caller.claims.role !== existing.role)
      await deps.auth.setCustomUserClaims(caller.uid, { role: existing.role });
    return { user: existing, created: false };
  }

  const write = buildOnboardingWrite(
    caller.uid,
    caller.email,
    input,
    (deps.now ?? (() => new Date()))(),
    deps.users.newId,
  );
  try {
    await deps.users.commitOnboarding(write);
  } catch (err) {
    if (err instanceof Error && err.message === 'ALREADY_ONBOARDED') {
      const user = await deps.users.getUser(caller.uid);
      if (user) return { user, created: false };
    }
    throw err;
  }
  await deps.auth.setCustomUserClaims(caller.uid, { role: write.user.role });
  return { user: write.user, created: true };
}
