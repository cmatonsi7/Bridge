import {
  connectRequestSchema,
  connectionId,
  isAnswerable,
  isEndable,
  type AthleteProfileDoc,
  type CoachProfileDoc,
  type ConnectRequestInput,
  type ConnectionDoc,
  type DirectoryEntryDoc,
  type ListingReason,
  type NotificationDoc,
  type OrganisationFullDoc,
  type UserDoc,
} from '@sportbridge/shared';
import { HttpError } from '../middleware/errors.js';
import type { Outbox } from './applications.js';

export interface DirectorySubject {
  user: UserDoc;
  athlete: AthleteProfileDoc | null;
  coach: CoachProfileDoc | null;
  organisation: (OrganisationFullDoc & { id: string }) | null;
}

export interface DirectoryRepoPort {
  getSubject(uid: string): Promise<DirectorySubject | null>;
  putEntry(uid: string, entry: DirectoryEntryDoc): Promise<void>;
  removeEntry(uid: string): Promise<void>;
  getConnection(id: string): Promise<ConnectionDoc | null>;
  createConnection(
    id: string,
    doc: ConnectionDoc,
    outbox: Outbox,
    audit: Record<string, unknown>,
  ): Promise<void>;
  mutateConnection(
    id: string,
    decide: (
      c: ConnectionDoc | null,
      guardianUids: string[],
    ) => {
      changes: Partial<ConnectionDoc>;
      outbox: Outbox;
      audit: Record<string, unknown>;
    },
  ): Promise<void>;
}

export interface DirectoryCaller {
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

export interface ListingDecision {
  entry: DirectoryEntryDoc | null;
  reason: ListingReason | null;
}

/**
 * Decides whether a subject is listed, and if not, why. Under-18 athletes are never listed,
 * whatever their settings say, and this is checked before anything else.
 */
export function decideListing(s: DirectorySubject, at: string): ListingDecision {
  const { user } = s;
  if (user.role === 'athlete' && user.isMinor) return { entry: null, reason: 'UNDER_18' };
  if (user.status !== 'active') return { entry: null, reason: 'NOT_ACTIVE' };
  const base = { uid: user.uid, displayName: user.displayName, updatedAt: at };

  if (user.role === 'athlete') {
    const p = s.athlete;
    if (!p) return { entry: null, reason: 'NO_PROFILE' };
    if (!p.privacy?.discoverable) return { entry: null, reason: 'SWITCH_OFF' };
    return {
      reason: null,
      entry: {
        ...base,
        role: 'athlete',
        sports: p.sport ? [p.sport] : [],
        province: p.province ?? null,
        city: p.city ?? null,
        headline: [p.position, p.club].filter(Boolean).join(' · ') || null,
        tags: p.skills ?? [],
      },
    };
  }
  if (user.role === 'coach') {
    const p = s.coach;
    if (!p) return { entry: null, reason: 'NO_PROFILE' };
    if (!p.privacy?.discoverable) return { entry: null, reason: 'SWITCH_OFF' };
    return {
      reason: null,
      entry: {
        ...base,
        role: 'coach',
        sports: p.sports ?? [],
        province: p.province ?? null,
        city: p.city ?? null,
        headline:
          [p.coachingLevel && `${p.coachingLevel} level`, p.organisation].filter(Boolean).join(' · ') || null,
        tags: p.specialisations ?? [],
      },
    };
  }
  if (user.role === 'organisation') {
    const o = s.organisation;
    if (!o) return { entry: null, reason: 'NO_PROFILE' };
    if (!o.privacy?.listed) return { entry: null, reason: 'SWITCH_OFF' };
    return {
      reason: null,
      entry: {
        ...base,
        role: 'organisation',
        displayName: o.name,
        sports: o.sports ?? [],
        province: o.province ?? null,
        city: o.city ?? null,
        headline: o.description?.slice(0, 140) ?? null,
        tags: o.offerings ?? [],
        orgId: o.id,
        orgType: o.type,
        verified: o.verified,
      },
    };
  }
  return { entry: null, reason: 'NOT_LISTABLE' };
}

/** The directory entry a subject should have, or null if they must not be listed. */
export const buildEntry = (s: DirectorySubject, at: string): DirectoryEntryDoc | null =>
  decideListing(s, at).entry;

/** Rebuilds the caller's own directory entry from their real records. Called after they save settings. */
export async function syncOwnEntry(repo: DirectoryRepoPort, c: DirectoryCaller, now = new Date()) {
  const s = await repo.getSubject(c.uid);
  if (!s) throw new HttpError(404, 'NO_PROFILE', 'Finish setting up your account first');
  const { entry, reason } = decideListing(s, now.toISOString());
  if (entry) await repo.putEntry(c.uid, entry);
  else await repo.removeEntry(c.uid);
  return { listed: entry !== null, reason };
}

export async function requestConnection(
  repo: DirectoryRepoPort,
  c: DirectoryCaller,
  raw: ConnectRequestInput,
  now = new Date(),
) {
  const input = connectRequestSchema.parse(raw);
  if (c.role !== 'coach') throw new HttpError(403, 'NOT_COACH', 'Only coaches can send connection requests');
  if (!c.emailVerified) throw new HttpError(403, 'EMAIL_NOT_VERIFIED', 'Verify your email address first');
  if (input.athleteUid === c.uid) throw new HttpError(400, 'SELF', 'You cannot connect with yourself');

  const [coach, athlete] = await Promise.all([repo.getSubject(c.uid), repo.getSubject(input.athleteUid)]);
  if (!coach) throw new HttpError(404, 'NO_PROFILE', 'Finish setting up your account first');
  if (!athlete || athlete.user.role !== 'athlete' || athlete.user.status !== 'active') {
    throw new HttpError(404, 'ATHLETE_NOT_FOUND', 'This athlete could not be found');
  }
  const ts = now.toISOString();
  const id = connectionId(c.uid, input.athleteUid);
  const minor = athlete.user.isMinor;
  const guardians = athlete.user.guardianUids ?? [];
  // A child's request goes to their parents; the child is told but cannot answer.
  if (minor && guardians.length === 0) {
    throw new HttpError(
      409,
      'NO_GUARDIAN',
      'This athlete’s account is not yet confirmed by a parent or guardian',
    );
  }
  const doc: ConnectionDoc = {
    coachUid: c.uid,
    coachName: coach.user.displayName,
    athleteUid: input.athleteUid,
    athleteName: athlete.user.displayName,
    athleteIsMinor: minor,
    decidedByUid: null,
    decidedByRole: null,
    status: 'pending',
    message: input.message,
    createdAt: ts,
    updatedAt: ts,
  };
  const body = `${coach.user.displayName} would like to connect${input.message ? `: “${input.message}”` : ''}`;
  const outbox: Outbox = minor
    ? [
        ...guardians.map((g) => ({
          uid: g,
          notification: note(
            'application.status',
            `Coach request for ${athlete.user.displayName}`,
            body,
            '/app/connections',
            ts,
          ),
        })),
        {
          uid: input.athleteUid,
          notification: note(
            'application.status',
            'A coach asked to connect',
            `${coach.user.displayName} asked to connect. Your parent or guardian will decide.`,
            '/app/connections',
            ts,
          ),
        },
      ]
    : [
        {
          uid: input.athleteUid,
          notification: note('application.status', 'A coach asked to connect', body, '/app/connections', ts),
        },
      ];

  try {
    await repo.createConnection(id, doc, outbox, {
      type: 'connection.requested',
      connectionId: id,
      coachUid: c.uid,
      athleteUid: input.athleteUid,
      at: ts,
    });
  } catch (err) {
    if (err instanceof Error && err.message === 'ALREADY_EXISTS') {
      throw new HttpError(409, 'ALREADY_REQUESTED', 'You have already sent this athlete a request');
    }
    throw err;
  }
  return { id };
}

/** Accept or decline. An adult athlete answers for themselves; a child's parent answers for them. */
export async function answerConnection(
  repo: DirectoryRepoPort,
  c: DirectoryCaller,
  id: string,
  accept: boolean,
  now = new Date(),
) {
  const ts = now.toISOString();
  await repo.mutateConnection(id, (conn, guardians) => {
    if (!conn) throw new HttpError(404, 'CONNECTION_NOT_FOUND', 'This request could not be found');
    const asAthlete = conn.athleteUid === c.uid && !conn.athleteIsMinor && c.role === 'athlete';
    const asGuardian = conn.athleteIsMinor && c.role === 'guardian' && guardians.includes(c.uid);
    if (!asAthlete && !asGuardian) {
      // A child trying to answer their own request lands here deliberately.
      throw new HttpError(
        403,
        'NOT_ALLOWED',
        conn.athleteIsMinor
          ? 'Only a confirmed parent or guardian can answer this request'
          : 'Only the athlete can answer this request',
      );
    }
    if (!isAnswerable(conn.status))
      throw new HttpError(409, 'ALREADY_ANSWERED', 'This request has already been answered');
    const who: 'athlete' | 'guardian' = asGuardian ? 'guardian' : 'athlete';
    const status = accept ? 'accepted' : 'declined';
    const body = `${conn.athleteName}: connection ${accept ? 'accepted' : 'declined'}`;
    return {
      changes: { status, decidedByUid: c.uid, decidedByRole: who, updatedAt: ts },
      outbox: [
        {
          uid: conn.coachUid,
          notification: note('application.status', 'Connection update', body, '/app/connections', ts),
        },
      ],
      audit: { type: `connection.${status}`, connectionId: id, by: c.uid, as: who, at: ts },
    };
  });
}

/** The coach, the adult athlete, or a child's parent may end an accepted connection. */
export async function endConnection(
  repo: DirectoryRepoPort,
  c: DirectoryCaller,
  id: string,
  now = new Date(),
) {
  const ts = now.toISOString();
  await repo.mutateConnection(id, (conn, guardians) => {
    if (!conn) throw new HttpError(404, 'CONNECTION_NOT_FOUND', 'This connection could not be found');
    const allowed =
      conn.coachUid === c.uid ||
      (conn.athleteUid === c.uid && !conn.athleteIsMinor) ||
      (c.role === 'guardian' && guardians.includes(c.uid));
    if (!allowed) throw new HttpError(404, 'CONNECTION_NOT_FOUND', 'This connection could not be found');
    if (!isEndable(conn.status)) throw new HttpError(409, 'NOT_ACTIVE', 'This connection is not active');
    const other = conn.coachUid === c.uid ? conn.athleteUid : conn.coachUid;
    return {
      changes: { status: 'ended', updatedAt: ts },
      outbox: [
        {
          uid: other,
          notification: note(
            'application.status',
            'Connection ended',
            `Your connection with ${conn.coachUid === c.uid ? conn.coachName : conn.athleteName} has ended`,
            '/app/connections',
            ts,
          ),
        },
      ],
      audit: { type: 'connection.ended', connectionId: id, by: c.uid, at: ts },
    };
  });
}
