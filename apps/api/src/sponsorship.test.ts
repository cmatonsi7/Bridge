import { beforeEach, describe, expect, it } from 'vitest';
import request from 'supertest';
import type { DecodedIdToken } from 'firebase-admin/auth';
import type { SponsorshipOfferDoc, SponsorshipRequestDoc, UserDoc } from '@sportbridge/shared';
import { createApp, type AppDeps } from './app.js';
import type { Outbox, Person, SponsorshipRepoPort } from './services/sponsorship.js';

const yearsAgo = (n: number) => {
  const d = new Date();
  return new Date(Date.UTC(d.getUTCFullYear() - n, d.getUTCMonth(), d.getUTCDate()))
    .toISOString()
    .slice(0, 10);
};
const user = (uid: string, role: UserDoc['role'], over: Partial<UserDoc> = {}): UserDoc => ({
  uid,
  email: `${uid}@example.com`,
  firstName: uid[0]!.toUpperCase() + uid.slice(1),
  surname: 'Smith',
  displayName: `${uid} Smith`,
  role,
  status: 'active',
  isMinor: false,
  onboardingComplete: true,
  termsVersion: 'v',
  termsAcceptedAt: 't',
  createdAt: 't',
  updatedAt: 't',
  ...over,
});

function fakeStore() {
  const people = new Map<string, Person>();
  const requests = new Map<string, SponsorshipRequestDoc>();
  const offers = new Map<string, SponsorshipOfferDoc>();
  const notes: Outbox = [];
  const audits: Record<string, unknown>[] = [];
  let n = 0;
  const repo: SponsorshipRepoPort = {
    newRequestId: () => `req${++n}`,
    async getPerson(uid) {
      return people.get(uid) ?? null;
    },
    async activeRequestsFor(a) {
      return [...requests.values()].filter(
        (r) => r.athleteUid === a && (r.status === 'open' || r.status === 'pending_review'),
      );
    },
    async createRequest(id, doc, outbox, audit) {
      requests.set(id, doc);
      notes.push(...outbox);
      audits.push(audit);
    },
    async mutateRequest(id, decide) {
      const r = decide(requests.has(id) ? { ...requests.get(id)! } : null);
      requests.set(id, { ...requests.get(id)!, ...r.changes });
      notes.push(...r.outbox);
      audits.push(r.audit);
    },
    async createOffer(id, requestId, build) {
      const req = requests.get(requestId) ?? null;
      const r = build(req ? { ...req } : null);
      if (offers.has(id)) throw new Error('ALREADY_OFFERED');
      offers.set(id, r.offer);
      requests.set(requestId, { ...req!, offerCount: req!.offerCount + 1 });
      notes.push(...r.outbox);
      audits.push(r.audit);
    },
    async mutateOffer(id, decide) {
      const o = offers.get(id) ?? null;
      const r = decide(o ? { ...o } : null, o ? (requests.get(o.requestId) ?? null) : null);
      offers.set(id, { ...o!, ...r.changes });
      notes.push(...r.outbox);
      audits.push(r.audit);
    },
  };
  return { people, requests, offers, notes, audits, repo };
}

type Token = Partial<DecodedIdToken> & { uid: string; role?: string; admin?: boolean };
const TOKENS: Record<string, Token> = {
  adult: { uid: 'adult', role: 'athlete', email_verified: true },
  unverified: { uid: 'unverified', role: 'athlete', email_verified: false },
  kid: { uid: 'kid', role: 'athlete', email_verified: true },
  mom: { uid: 'mom', role: 'guardian', email_verified: true },
  coach: { uid: 'coach', role: 'coach', email_verified: true },
  org: { uid: 'org', role: 'organisation', email_verified: true },
  other: { uid: 'other', role: 'athlete', email_verified: true },
  staff: { uid: 'staff', role: 'admin', admin: true, email_verified: true },
};

describe('sponsorship', () => {
  let s: ReturnType<typeof fakeStore>;
  let app: ReturnType<typeof createApp>;
  const as = (who: keyof typeof TOKENS) => ({ Authorization: `Bearer ${who}` });
  const ask = {
    title: 'Boots for the season',
    story: 'My boots split and I need new ones for league games.',
    category: 'Kit & equipment',
    amountZar: 900,
    sport: 'Football',
    province: 'Gauteng',
  };
  const post = (path: string, who: keyof typeof TOKENS, body: unknown = {}) =>
    request(app).post(`/api${path}`).set(as(who)).send(body);

  beforeEach(() => {
    s = fakeStore();
    const auth = {
      async verifyIdToken(t: string) {
        const tok = TOKENS[t];
        if (!tok) throw new Error('bad token');
        return tok as DecodedIdToken;
      },
      async setCustomUserClaims() {},
    };
    app = createApp({ auth, sponsorship: s.repo } as unknown as AppDeps);
    const adult = (uid: string, role: UserDoc['role']) =>
      s.people.set(uid, { user: user(uid, role), dateOfBirth: yearsAgo(30) });
    adult('adult', 'athlete');
    adult('unverified', 'athlete');
    adult('other', 'athlete');
    adult('coach', 'coach');
    adult('org', 'organisation');
    adult('mom', 'guardian');
    s.people.set('kid', {
      user: user('kid', 'athlete', { isMinor: true, guardianUids: ['mom'] }),
      dateOfBirth: yearsAgo(15),
    });
  });

  it('an adult athlete asks, and the request is listed at once for 30 days without their full name', async () => {
    const res = await post('/sponsorship/requests', 'adult', ask);
    expect(res.status).toBe(201);
    expect(res.body.status).toBe('open');
    const r = s.requests.get(res.body.id)!;
    expect(r.displayName).toBe('Adult S.');
    expect(r.ageBand).toBe('Adult');
    const days = (Date.parse(r.expiresAt) - Date.now()) / 86400000;
    expect(Math.round(days)).toBe(30);
    expect(s.audits.at(-1)).toMatchObject({ type: 'sponsorship.requested', by: 'adult' });
  });

  it('a child cannot ask, a parent cannot ask yet, and coaches and organisations cannot ask at all', async () => {
    expect((await post('/sponsorship/requests', 'kid', ask)).body.error.code).toBe('MINOR_CANNOT_REQUEST');
    expect((await post('/sponsorship/requests', 'mom', { ...ask, forChildUid: 'kid' })).body.error.code).toBe(
      'CHILD_SPONSORSHIP_NOT_OPEN',
    );
    expect((await post('/sponsorship/requests', 'coach', ask)).status).toBe(403);
    expect((await post('/sponsorship/requests', 'org', ask)).status).toBe(403);
    expect((await post('/sponsorship/requests', 'unverified', ask)).body.error.code).toBe(
      'EMAIL_NOT_VERIFIED',
    );
    expect(s.requests.size).toBe(0);
  });

  it('allows one open request at a time, and a new one once the old one is closed', async () => {
    const first = await post('/sponsorship/requests', 'adult', ask);
    expect((await post('/sponsorship/requests', 'adult', ask)).status).toBe(409);
    expect((await post(`/sponsorship/requests/${first.body.id}/close`, 'other')).status).toBe(403);
    expect((await post(`/sponsorship/requests/${first.body.id}/close`, 'adult')).status).toBe(200);
    expect((await post('/sponsorship/requests', 'adult', ask)).status).toBe(201);
  });

  it('refuses nonsense amounts', async () => {
    expect((await post('/sponsorship/requests', 'adult', { ...ask, amountZar: 5 })).status).toBe(400);
  });

  it('adult athletes, coaches and organisations can offer; parents, children and the asker cannot', async () => {
    const { id } = (await post('/sponsorship/requests', 'adult', ask)).body;
    const msg = { message: 'I can cover the boots for you.' };
    for (const who of ['coach', 'org', 'other'] as const)
      expect((await post(`/sponsorship/requests/${id}/offers`, who, msg)).status).toBe(201);
    expect((await post(`/sponsorship/requests/${id}/offers`, 'mom', msg)).status).toBe(403);
    expect((await post(`/sponsorship/requests/${id}/offers`, 'kid', msg)).body.error.code).toBe(
      'MINOR_CANNOT_OFFER',
    );
    expect((await post(`/sponsorship/requests/${id}/offers`, 'adult', msg)).body.error.code).toBe(
      'OWN_REQUEST',
    );
    expect((await post(`/sponsorship/requests/${id}/offers`, 'coach', msg)).body.error.code).toBe(
      'ALREADY_OFFERED',
    );
    expect(s.requests.get(id)!.offerCount).toBe(3);
    expect(s.notes.filter((n) => n.uid === 'adult')).toHaveLength(3);
  });

  it('nobody sees an email until the asker accepts; then both sides do', async () => {
    const { id } = (await post('/sponsorship/requests', 'adult', ask)).body;
    const offer = (
      await post(`/sponsorship/requests/${id}/offers`, 'coach', { message: 'Happy to pay for boots.' })
    ).body.id;
    expect(s.offers.get(offer)!.contacts).toBeNull();
    expect((await post(`/sponsorship/offers/${offer}/respond`, 'coach', { accept: true })).status).toBe(403);
    expect((await post(`/sponsorship/offers/${offer}/respond`, 'adult', { accept: true })).status).toBe(200);
    expect(s.offers.get(offer)).toMatchObject({
      status: 'accepted',
      contacts: { requesterEmail: 'adult@example.com', offererEmail: 'coach@example.com' },
    });
    expect(s.notes.at(-1)).toMatchObject({ uid: 'coach', notification: { type: 'sponsorship.response' } });
    expect((await post(`/sponsorship/offers/${offer}/respond`, 'adult', { accept: false })).status).toBe(409);
  });

  it('a declined offer shares nothing, and an offerer can withdraw while it is pending', async () => {
    const { id } = (await post('/sponsorship/requests', 'adult', ask)).body;
    const a = (
      await post(`/sponsorship/requests/${id}/offers`, 'coach', { message: 'Happy to pay for boots.' })
    ).body.id;
    const b = (await post(`/sponsorship/requests/${id}/offers`, 'org', { message: 'We can donate boots.' }))
      .body.id;
    await post(`/sponsorship/offers/${a}/respond`, 'adult', { accept: false });
    expect(s.offers.get(a)).toMatchObject({ status: 'declined', contacts: null });
    expect((await post(`/sponsorship/offers/${b}/withdraw`, 'coach')).status).toBe(403);
    expect((await post(`/sponsorship/offers/${b}/withdraw`, 'org')).status).toBe(200);
    expect(s.offers.get(b)!.status).toBe('withdrawn');
  });

  it('no offers once a request is closed or past its 30 days', async () => {
    const { id } = (await post('/sponsorship/requests', 'adult', ask)).body;
    s.requests.set(id, { ...s.requests.get(id)!, expiresAt: '2020-01-01T00:00:00.000Z' });
    expect(
      (await post(`/sponsorship/requests/${id}/offers`, 'coach', { message: 'Happy to pay for boots.' })).body
        .error.code,
    ).toBe('REQUEST_CLOSED');
    // An expired request no longer blocks a new one.
    expect((await post('/sponsorship/requests', 'adult', ask)).status).toBe(201);
  });

  it('only staff review, and only requests waiting for review; approval restarts the 30 days', async () => {
    s.requests.set('kidreq', {
      requesterUid: 'mom',
      athleteUid: 'kid',
      forChild: true,
      displayName: null,
      ageBand: '13–15',
      ...ask,
      status: 'pending_review',
      offerCount: 0,
      reportCount: 0,
      reviewNote: null,
      createdAt: 't',
      updatedAt: 't',
      expiresAt: '2020-01-01T00:00:00.000Z',
    });
    expect((await post('/admin/sponsorship/requests/kidreq/review', 'coach', { approve: true })).status).toBe(
      403,
    );
    expect(
      (await post('/sponsorship/requests/kidreq/offers', 'coach', { message: 'Happy to pay for boots.' }))
        .status,
    ).toBe(404);
    expect((await post('/admin/sponsorship/requests/kidreq/review', 'staff', { approve: true })).status).toBe(
      200,
    );
    expect(s.requests.get('kidreq')!.status).toBe('open');
    expect(Date.parse(s.requests.get('kidreq')!.expiresAt)).toBeGreaterThan(Date.now() + 29 * 86400000);
    expect(s.notes.at(-1)).toMatchObject({ uid: 'mom', notification: { type: 'sponsorship.reviewed' } });
    expect(
      (await post('/admin/sponsorship/requests/kidreq/review', 'staff', { approve: false })).status,
    ).toBe(409);
  });

  it('anyone signed in can report a request for staff, and staff can close it', async () => {
    const { id } = (await post('/sponsorship/requests', 'adult', ask)).body;
    expect(
      (await post(`/sponsorship/requests/${id}/report`, 'coach', { reason: 'Looks like a scam' })).status,
    ).toBe(200);
    expect((await post(`/sponsorship/requests/${id}/report`, 'adult', { reason: 'testing it' })).status).toBe(
      400,
    );
    expect(s.requests.get(id)!.reportCount).toBe(1);
    expect((await post(`/sponsorship/requests/${id}/close`, 'staff')).status).toBe(200);
    expect(s.requests.get(id)!.status).toBe('closed');
  });

  it('rejects malformed ids and signed-out calls', async () => {
    expect((await request(app).post('/api/sponsorship/requests').send(ask)).status).toBe(401);
    expect((await post('/sponsorship/offers/bad id/respond', 'adult', { accept: true })).status).toBe(400);
  });
});
