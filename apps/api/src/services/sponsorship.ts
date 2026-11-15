import {
  CHILD_SPONSORSHIP_ENABLED,
  SPONSORSHIP_DAYS,
  ageBand,
  ageOn,
  isLiveRequest,
  offerId,
  offerResponseSchema,
  parseIsoDate,
  sponsorshipOfferSchema,
  sponsorshipReportSchema,
  sponsorshipRequestSchema,
  sponsorshipReviewSchema,
  type NotificationDoc,
  type SponsorshipOfferDoc,
  type SponsorshipRequestDoc,
  type UserDoc,
} from '@sportbridge/shared';
import { HttpError } from '../middleware/errors.js';

export interface Person {
  user: UserDoc;
  dateOfBirth: string | null;
}

export type Outbox = { uid: string; notification: NotificationDoc }[];
type Audit = Record<string, unknown>;

export interface SponsorshipRepoPort {
  newRequestId(): string;
  getPerson(uid: string): Promise<Person | null>;
  /** Requests for this athlete that are open or waiting for review. */
  activeRequestsFor(athleteUid: string): Promise<SponsorshipRequestDoc[]>;
  createRequest(id: string, doc: SponsorshipRequestDoc, outbox: Outbox, audit: Audit): Promise<void>;
  mutateRequest(
    id: string,
    decide: (r: SponsorshipRequestDoc | null) => {
      changes: Partial<SponsorshipRequestDoc>;
      outbox: Outbox;
      audit: Audit;
    },
  ): Promise<void>;
  /** Creates the offer and adds one to the request's count, atomically. Throws Error('ALREADY_OFFERED'). */
  createOffer(
    id: string,
    requestId: string,
    build: (r: SponsorshipRequestDoc | null) => { offer: SponsorshipOfferDoc; outbox: Outbox; audit: Audit },
  ): Promise<void>;
  mutateOffer(
    id: string,
    decide: (
      o: SponsorshipOfferDoc | null,
      r: SponsorshipRequestDoc | null,
    ) => { changes: Partial<SponsorshipOfferDoc>; outbox: Outbox; audit: Audit },
  ): Promise<void>;
}

export interface Caller {
  uid: string;
  role?: string;
  admin?: boolean;
  emailVerified: boolean;
  email?: string;
}

const note = (type: NotificationDoc['type'], title: string, body: string, link: string, at: string) => ({
  uid: '',
  notification: { type, title, body, link, read: false, createdAt: at } as NotificationDoc,
});
const to = (uid: string, n: ReturnType<typeof note>) => ({ uid, notification: n.notification });

const ageOf = (p: Person, now: Date) => {
  const d = p.dateOfBirth ? parseIsoDate(p.dateOfBirth) : null;
  if (!d) throw new HttpError(400, 'NO_DOB', 'Your date of birth is missing. Contact SportBridge support.');
  return ageOn(d, now);
};
const addDays = (now: Date, days: number) => new Date(now.getTime() + days * 86400000).toISOString();

/** An adult athlete asks for themselves; a confirmed parent asks for their child (switched off for now). */
export async function createRequest(repo: SponsorshipRepoPort, c: Caller, raw: unknown, now = new Date()) {
  const input = sponsorshipRequestSchema.parse(raw);
  if (!c.emailVerified) throw new HttpError(403, 'EMAIL_NOT_VERIFIED', 'Verify your email address first');

  let athleteUid: string;
  let forChild = false;
  if (c.role === 'athlete') {
    if (input.forChildUid) throw new HttpError(400, 'BAD_REQUEST', 'Athletes ask for themselves');
    athleteUid = c.uid;
  } else if (c.role === 'guardian') {
    if (!input.forChildUid) throw new HttpError(400, 'CHILD_REQUIRED', 'Choose which child this is for');
    if (!CHILD_SPONSORSHIP_ENABLED)
      throw new HttpError(
        403,
        'CHILD_SPONSORSHIP_NOT_OPEN',
        'Sponsorship requests for children are not open yet',
      );
    athleteUid = input.forChildUid;
    forChild = true;
  } else {
    throw new HttpError(403, 'NOT_ALLOWED', 'Only athletes, or parents for their child, can ask for support');
  }

  const athlete = await repo.getPerson(athleteUid);
  if (!athlete || athlete.user.role !== 'athlete')
    throw new HttpError(404, 'ATHLETE_NOT_FOUND', 'We couldn’t find that athlete');
  const age = ageOf(athlete, now);
  if (forChild) {
    if (!(athlete.user.guardianUids ?? []).includes(c.uid))
      throw new HttpError(403, 'NOT_GUARDIAN', 'You are not a confirmed parent or guardian of this child');
  } else {
    // A child never asks for money themselves, whatever their settings say.
    if (age < 18 || athlete.user.isMinor)
      throw new HttpError(
        403,
        'MINOR_CANNOT_REQUEST',
        'Under-18s cannot ask for sponsorship. A parent or guardian can, once this opens.',
      );
    if (athlete.user.status !== 'active')
      throw new HttpError(403, 'ACCOUNT_RESTRICTED', 'Your account cannot ask for support right now');
  }

  const active = (await repo.activeRequestsFor(athleteUid)).filter(
    (r) => r.status === 'pending_review' || isLiveRequest(r, now),
  );
  if (active.length)
    throw new HttpError(409, 'ALREADY_REQUESTED', 'There is already an open request. Close it first.');

  const ts = now.toISOString();
  const id = repo.newRequestId();
  const u = athlete.user;
  const doc: SponsorshipRequestDoc = {
    requesterUid: c.uid,
    athleteUid,
    forChild,
    displayName: forChild ? null : `${u.firstName} ${u.surname.charAt(0)}.`.trim(),
    ageBand: ageBand(age),
    title: input.title,
    story: input.story,
    category: input.category,
    amountZar: input.amountZar,
    sport: input.sport,
    province: input.province,
    // A child's request waits for staff; an adult's goes live at once.
    status: forChild ? 'pending_review' : 'open',
    offerCount: 0,
    reportCount: 0,
    reviewNote: null,
    createdAt: ts,
    updatedAt: ts,
    expiresAt: addDays(now, SPONSORSHIP_DAYS),
  };
  await repo.createRequest(id, doc, [], {
    type: 'sponsorship.requested',
    requestId: id,
    by: c.uid,
    athleteUid,
    forChild,
    at: ts,
  });
  return { id, status: doc.status };
}

export async function closeRequest(repo: SponsorshipRepoPort, c: Caller, id: string, now = new Date()) {
  const ts = now.toISOString();
  await repo.mutateRequest(id, (r) => {
    if (!r) throw new HttpError(404, 'REQUEST_NOT_FOUND', 'This request could not be found');
    const staff = c.admin === true;
    if (r.requesterUid !== c.uid && !staff)
      throw new HttpError(403, 'NOT_YOURS', 'Only the person who asked can close this request');
    if (r.status === 'closed' || r.status === 'rejected')
      throw new HttpError(409, 'ALREADY_CLOSED', 'This request is already closed');
    return {
      changes: { status: 'closed', updatedAt: ts },
      outbox: [],
      audit: { type: 'sponsorship.closed', requestId: id, by: c.uid, staff, at: ts },
    };
  });
}

export async function reviewRequest(
  repo: SponsorshipRepoPort,
  c: Caller,
  id: string,
  raw: unknown,
  now = new Date(),
) {
  const input = sponsorshipReviewSchema.parse(raw);
  if (!c.admin) throw new HttpError(403, 'NOT_ADMIN', 'Only SportBridge staff can review requests');
  const ts = now.toISOString();
  await repo.mutateRequest(id, (r) => {
    if (!r) throw new HttpError(404, 'REQUEST_NOT_FOUND', 'This request could not be found');
    if (r.status !== 'pending_review')
      throw new HttpError(409, 'NOT_PENDING', 'This request is not waiting for review');
    const n = note(
      'sponsorship.reviewed',
      input.approve ? 'Your sponsorship request is live' : 'Your sponsorship request was not approved',
      input.approve
        ? `"${r.title}" is now listed for ${SPONSORSHIP_DAYS} days.`
        : `"${r.title}" was not approved.${input.note ? ` ${input.note}` : ''}`,
      '/app/sponsorship',
      ts,
    );
    return {
      changes: input.approve
        ? // The 30 days start when it is listed, not when it was written.
          { status: 'open', reviewNote: input.note, updatedAt: ts, expiresAt: addDays(now, SPONSORSHIP_DAYS) }
        : { status: 'rejected', reviewNote: input.note, updatedAt: ts },
      outbox: [to(r.requesterUid, n)],
      audit: { type: 'sponsorship.reviewed', requestId: id, by: c.uid, approve: input.approve, at: ts },
    };
  });
}

export async function reportRequest(
  repo: SponsorshipRepoPort,
  c: Caller,
  id: string,
  raw: unknown,
  now = new Date(),
) {
  const input = sponsorshipReportSchema.parse(raw);
  const ts = now.toISOString();
  await repo.mutateRequest(id, (r) => {
    if (!r) throw new HttpError(404, 'REQUEST_NOT_FOUND', 'This request could not be found');
    if (r.requesterUid === c.uid)
      throw new HttpError(400, 'OWN_REQUEST', 'You cannot report your own request');
    return {
      changes: { reportCount: r.reportCount + 1, updatedAt: ts },
      outbox: [],
      audit: { type: 'sponsorship.reported', requestId: id, by: c.uid, reason: input.reason, at: ts },
    };
  });
}

/** An adult athlete, coach or organisation offers help. Parents and children never do. */
export async function makeOffer(
  repo: SponsorshipRepoPort,
  c: Caller,
  requestId: string,
  raw: unknown,
  now = new Date(),
) {
  const input = sponsorshipOfferSchema.parse(raw);
  if (c.role !== 'athlete' && c.role !== 'coach' && c.role !== 'organisation')
    throw new HttpError(403, 'NOT_ALLOWED', 'Only athletes, coaches and organisations can offer help');
  if (!c.emailVerified) throw new HttpError(403, 'EMAIL_NOT_VERIFIED', 'Verify your email address first');
  const me = await repo.getPerson(c.uid);
  if (!me) throw new HttpError(403, 'NO_PROFILE', 'Finish setting up your account first');
  if (c.role === 'athlete' && (me.user.isMinor || ageOf(me, now) < 18))
    throw new HttpError(403, 'MINOR_CANNOT_OFFER', 'Under-18s cannot offer sponsorship');
  if (me.user.status !== 'active')
    throw new HttpError(403, 'ACCOUNT_RESTRICTED', 'Your account cannot offer help right now');

  const ts = now.toISOString();
  const id = offerId(requestId, c.uid);
  try {
    await repo.createOffer(id, requestId, (r) => {
      if (!r || r.status === 'pending_review' || r.status === 'rejected')
        throw new HttpError(404, 'REQUEST_NOT_FOUND', 'This request could not be found');
      if (!isLiveRequest(r, now))
        throw new HttpError(409, 'REQUEST_CLOSED', 'This request is no longer open');
      if (r.requesterUid === c.uid || r.athleteUid === c.uid)
        throw new HttpError(400, 'OWN_REQUEST', 'You cannot offer help on your own request');
      return {
        offer: {
          requestId,
          requestTitle: r.title,
          requesterUid: r.requesterUid,
          offererUid: c.uid,
          offererName: me.user.displayName,
          offererRole: c.role as SponsorshipOfferDoc['offererRole'],
          message: input.message,
          status: 'pending',
          contacts: null,
          createdAt: ts,
          updatedAt: ts,
        },
        outbox: [
          to(
            r.requesterUid,
            note(
              'sponsorship.offer',
              'Someone offered to help',
              `${me.user.displayName} offered to help with "${r.title}".`,
              '/app/sponsorship',
              ts,
            ),
          ),
        ],
        audit: { type: 'sponsorship.offered', requestId, offerId: id, by: c.uid, at: ts },
      };
    });
  } catch (err) {
    if (err instanceof Error && err.message === 'ALREADY_OFFERED')
      throw new HttpError(409, 'ALREADY_OFFERED', 'You have already offered to help with this request');
    throw err;
  }
  return { id };
}

/** The person who asked accepts or declines. Only on accepting does each side see the other's email. */
export async function respondToOffer(
  repo: SponsorshipRepoPort,
  c: Caller,
  id: string,
  raw: unknown,
  now = new Date(),
) {
  const { accept } = offerResponseSchema.parse(raw);
  const ts = now.toISOString();
  // Emails are read before the transaction; they are only written if the checks inside it pass.
  let requesterEmail: string | null = null;
  let offererEmail: string | null = null;
  if (accept) {
    const [, offererUid] = id.split('_');
    const [me, offerer] = await Promise.all([repo.getPerson(c.uid), repo.getPerson(offererUid ?? '')]);
    requesterEmail = me?.user.email ?? null;
    offererEmail = offerer?.user.email ?? null;
    if (!requesterEmail || !offererEmail)
      throw new HttpError(409, 'CONTACT_MISSING', 'We couldn’t introduce you. Contact SportBridge support.');
  }
  await repo.mutateOffer(id, (o, r) => {
    if (!o || !r) throw new HttpError(404, 'OFFER_NOT_FOUND', 'This offer could not be found');
    if (o.requesterUid !== c.uid)
      throw new HttpError(403, 'NOT_YOURS', 'Only the person who asked can answer this offer');
    if (o.status !== 'pending')
      throw new HttpError(409, 'ALREADY_ANSWERED', 'This offer has already been answered');
    return {
      changes: accept
        ? {
            status: 'accepted',
            contacts: { requesterEmail: requesterEmail!, offererEmail: offererEmail! },
            updatedAt: ts,
          }
        : { status: 'declined', updatedAt: ts },
      outbox: [
        to(
          o.offererUid,
          note(
            'sponsorship.response',
            accept ? 'Your offer was accepted' : 'Your offer was declined',
            accept
              ? `Your offer to help with "${o.requestTitle}" was accepted. You can now see their email address.`
              : `Your offer to help with "${o.requestTitle}" was declined. Thank you for offering.`,
            '/app/sponsorship',
            ts,
          ),
        ),
      ],
      audit: { type: 'sponsorship.offer_answered', offerId: id, by: c.uid, accept, at: ts },
    };
  });
}

export async function withdrawOffer(repo: SponsorshipRepoPort, c: Caller, id: string, now = new Date()) {
  const ts = now.toISOString();
  await repo.mutateOffer(id, (o) => {
    if (!o) throw new HttpError(404, 'OFFER_NOT_FOUND', 'This offer could not be found');
    if (o.offererUid !== c.uid) throw new HttpError(403, 'NOT_YOURS', 'This is not your offer');
    if (o.status !== 'pending')
      throw new HttpError(409, 'ALREADY_ANSWERED', 'This offer has already been answered');
    return {
      changes: { status: 'withdrawn', updatedAt: ts },
      outbox: [],
      audit: { type: 'sponsorship.offer_withdrawn', offerId: id, by: c.uid, at: ts },
    };
  });
}
