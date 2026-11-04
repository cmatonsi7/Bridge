import {
  ORG_TRANSITIONS,
  WITHDRAWABLE,
  ageOn,
  applicationId,
  isOpen,
  parseIsoDate,
  APPLICATION_STATUS_LABELS,
  type ApplicantSnapshot,
  type ApplicationDoc,
  type ApplicationHistoryEntry,
  type AthleteProfileDoc,
  type ListingDoc,
  type NotificationDoc,
  type PrivateDetailsDoc,
  type StatusChangeInput,
  type UserDoc,
} from '@sportbridge/shared';
import { applySchema, statusChangeSchema, type ApplyInput } from '@sportbridge/shared';
import { HttpError } from '../middleware/errors.js';

export interface ApplicantRecords {
  user: UserDoc;
  profile: AthleteProfileDoc | null;
  details: PrivateDetailsDoc | null;
}

/** Notifications to write alongside an application change, keyed by recipient uid. */
export type Outbox = { uid: string; notification: NotificationDoc }[];

export interface ApplicationsRepoPort {
  getListing(id: string): Promise<ListingDoc | null>;
  getApplicant(uid: string): Promise<ApplicantRecords | null>;
  /** Creates the application atomically; throws Error('ALREADY_APPLIED') if it exists. */
  createApplication(
    id: string,
    doc: ApplicationDoc,
    outbox: Outbox,
    audit: Record<string, unknown>,
  ): Promise<void>;
  /**
   * Loads the application and the applicant's current guardians, lets `decide` validate and return the
   * changes, then writes application + notifications + audit in one transaction.
   */
  mutateApplication(
    id: string,
    decide: (
      app: ApplicationDoc | null,
      guardianUids: string[],
    ) => {
      changes: Partial<ApplicationDoc>;
      outbox: Outbox;
      audit: Record<string, unknown>;
    },
  ): Promise<void>;
}

export interface Caller {
  uid: string;
  role?: string;
  emailVerified: boolean;
}

const note = (
  type: NotificationDoc['type'],
  title: string,
  body: string,
  link: string,
  at: string,
): NotificationDoc => ({
  type,
  title,
  body,
  link,
  read: false,
  createdAt: at,
});

/** The applicant's details as an organisation will see them. Contact details only for adults. */
export function buildSnapshot(r: ApplicantRecords, age: number): ApplicantSnapshot {
  const minor = age < 18;
  const p = r.profile;
  return {
    displayName: r.user.displayName,
    age,
    isMinor: minor,
    sport: p?.sport ?? null,
    position: p?.position ?? null,
    city: p?.city ?? null,
    province: p?.province ?? null,
    bio: p?.bio ?? null,
    skills: p?.skills ?? [],
    email: minor ? null : r.user.email,
    phone: minor ? null : (r.details?.mobile ?? null),
  };
}

export async function apply(repo: ApplicationsRepoPort, c: Caller, raw: ApplyInput, now = new Date()) {
  const input = applySchema.parse(raw);
  if (c.role !== 'athlete') throw new HttpError(403, 'NOT_ATHLETE', 'Only athlete accounts can apply');
  if (!c.emailVerified)
    throw new HttpError(403, 'EMAIL_NOT_VERIFIED', 'Verify your email address before applying');

  const [listing, records] = await Promise.all([repo.getListing(input.listingId), repo.getApplicant(c.uid)]);
  if (!listing || listing.status === 'draft')
    throw new HttpError(404, 'LISTING_NOT_FOUND', 'This listing could not be found');
  if (!isOpen(listing, now.toISOString().slice(0, 10)))
    throw new HttpError(409, 'LISTING_CLOSED', 'This listing is closed');
  if (!records) throw new HttpError(403, 'NO_PROFILE', 'Finish setting up your account before applying');

  // A child's account stays restricted until a parent or guardian confirms it.
  if (records.user.status !== 'active') {
    throw new HttpError(
      403,
      records.user.isMinor ? 'GUARDIAN_REQUIRED' : 'ACCOUNT_RESTRICTED',
      records.user.isMinor
        ? 'A parent or guardian must confirm your account before you can apply'
        : 'Your account cannot apply right now. Contact SportBridge support.',
    );
  }
  const dob = records.details?.dateOfBirth ? parseIsoDate(records.details.dateOfBirth) : null;
  if (!dob) throw new HttpError(400, 'NO_DOB', 'Your date of birth is missing. Contact SportBridge support.');
  const age = ageOn(dob, now);
  if (age < listing.ageMin || age > listing.ageMax) {
    throw new HttpError(
      400,
      'AGE_OUT_OF_RANGE',
      `This ${listing.kind} is for ages ${listing.ageMin}–${listing.ageMax}`,
    );
  }

  const ts = now.toISOString();
  const id = applicationId(input.listingId, c.uid);
  const snapshot = buildSnapshot(records, age);
  const doc: ApplicationDoc = {
    listingId: input.listingId,
    listingTitle: listing.title,
    listingKind: listing.kind,
    orgId: listing.orgId,
    orgName: listing.orgName,
    ownerUid: listing.ownerUid,
    applicantUid: c.uid,
    applicantIsMinor: snapshot.isMinor,
    status: 'submitted',
    note: input.note,
    orgMessage: null,
    snapshot,
    history: [{ status: 'submitted', at: ts, by: 'applicant' }],
    createdAt: ts,
    updatedAt: ts,
  };
  const outbox: Outbox = [
    {
      uid: listing.ownerUid,
      notification: note(
        'application.received',
        'New application',
        `${snapshot.displayName} applied to ${listing.title}`,
        '/app/applications',
        ts,
      ),
    },
    ...(records.user.guardianUids ?? []).map((g) => ({
      uid: g,
      notification: note(
        'application.child_applied',
        'Your child applied',
        `${snapshot.displayName} applied to ${listing.title} (${listing.orgName})`,
        `/app/children/${c.uid}`,
        ts,
      ),
    })),
  ];
  try {
    await repo.createApplication(id, doc, outbox, {
      type: 'application.created',
      applicationId: id,
      applicantUid: c.uid,
      listingId: input.listingId,
      at: ts,
    });
  } catch (err) {
    if (err instanceof Error && err.message === 'ALREADY_APPLIED') {
      throw new HttpError(409, 'ALREADY_APPLIED', 'You have already applied to this listing');
    }
    throw err;
  }
  return { id };
}

export async function changeStatus(
  repo: ApplicationsRepoPort,
  c: Caller,
  id: string,
  raw: StatusChangeInput,
  now = new Date(),
) {
  const input = statusChangeSchema.parse(raw);
  if (c.role !== 'organisation')
    throw new HttpError(403, 'NOT_ORGANISATION', 'Only organisations can review applications');
  const ts = now.toISOString();
  await repo.mutateApplication(id, (app, guardians) => {
    // Same answer whether it doesn't exist or belongs to another organisation.
    if (!app || app.ownerUid !== c.uid)
      throw new HttpError(404, 'APPLICATION_NOT_FOUND', 'This application could not be found');
    if (!ORG_TRANSITIONS[app.status].includes(input.status)) {
      throw new HttpError(
        409,
        'BAD_TRANSITION',
        `An application that is ${APPLICATION_STATUS_LABELS[app.status].toLowerCase()} can’t be changed to that`,
      );
    }
    const entry: ApplicationHistoryEntry = { status: input.status, at: ts, by: 'organisation' };
    const label = APPLICATION_STATUS_LABELS[input.status];
    const body = `${app.orgName}: ${app.listingTitle} — ${label}${input.message ? `. “${input.message}”` : ''}`;
    return {
      changes: {
        status: input.status,
        orgMessage: input.message ?? app.orgMessage,
        history: [...app.history, entry],
        updatedAt: ts,
      },
      outbox: [
        {
          uid: app.applicantUid,
          notification: note('application.status', 'Application update', body, '/app/applications', ts),
        },
        ...(app.applicantIsMinor ? guardians : []).map((g) => ({
          uid: g,
          notification: note(
            'application.status',
            `Update for ${app.snapshot.displayName}`,
            body,
            `/app/children/${app.applicantUid}`,
            ts,
          ),
        })),
      ],
      audit: { type: 'application.status', applicationId: id, status: input.status, by: c.uid, at: ts },
    };
  });
}

/** The applicant, or a verified guardian of the applicant, may withdraw. */
export async function withdraw(repo: ApplicationsRepoPort, c: Caller, id: string, now = new Date()) {
  const ts = now.toISOString();
  await repo.mutateApplication(id, (app, guardians) => {
    const isApplicant = !!app && app.applicantUid === c.uid;
    const isGuardian = !!app && c.role === 'guardian' && guardians.includes(c.uid);
    if (!app || (!isApplicant && !isGuardian))
      throw new HttpError(404, 'APPLICATION_NOT_FOUND', 'This application could not be found');
    if (!WITHDRAWABLE.includes(app.status))
      throw new HttpError(409, 'NOT_WITHDRAWABLE', 'This application can no longer be withdrawn');
    const by: ApplicationHistoryEntry['by'] = isApplicant ? 'applicant' : 'guardian';
    const outbox: Outbox = [
      {
        uid: app.ownerUid,
        notification: note(
          'application.withdrawn',
          'Application withdrawn',
          `${app.snapshot.displayName} withdrew from ${app.listingTitle}`,
          '/app/applications',
          ts,
        ),
      },
    ];
    if (isGuardian) {
      outbox.push({
        uid: app.applicantUid,
        notification: note(
          'application.withdrawn',
          'Application withdrawn',
          `Your parent or guardian withdrew your application to ${app.listingTitle}`,
          '/app/applications',
          ts,
        ),
      });
    }
    return {
      changes: {
        status: 'withdrawn',
        history: [...app.history, { status: 'withdrawn', at: ts, by }],
        updatedAt: ts,
      },
      outbox,
      audit: { type: 'application.withdrawn', applicationId: id, by: c.uid, as: by, at: ts },
    };
  });
}
