import { beforeEach, describe, expect, it } from 'vitest';
import request from 'supertest';
import type { DecodedIdToken } from 'firebase-admin/auth';
import { TRIAL_DAYS, type MembershipDoc } from '@sportbridge/shared';
import { createApp, type AppDeps } from './app.js';
import { assertWithinApplicationLimit, type MembershipRepoPort } from './services/membership.js';

function fakeStore() {
  const records = new Map<string, MembershipDoc>();
  const audits: Record<string, unknown>[] = [];
  const repo: MembershipRepoPort = {
    async get(uid) {
      const m = records.get(uid);
      return m ? { ...m } : null;
    },
    async create(doc, audit) {
      const existing = records.get(doc.uid);
      if (existing) return { ...existing };
      records.set(doc.uid, doc);
      audits.push(audit);
      return { ...doc };
    },
    async update(uid, changes, audit) {
      records.set(uid, { ...records.get(uid)!, ...changes });
      if (audit) audits.push(audit);
    },
  };
  return { records, audits, repo };
}

type Token = Partial<DecodedIdToken> & { uid: string; role?: string; admin?: boolean };
const TOKENS: Record<string, Token> = {
  athlete: { uid: 'athlete', role: 'athlete', email_verified: true },
  coach: { uid: 'coach', role: 'coach', email_verified: true },
  org: { uid: 'org', role: 'organisation', email_verified: true },
};

const membership = (over: Partial<MembershipDoc> = {}): MembershipDoc => ({
  uid: 'athlete',
  plan: 'starter',
  status: 'free',
  billingPeriod: null,
  trialEndsAt: null,
  interest: null,
  createdAt: 't',
  updatedAt: 't',
  ...over,
});

describe('membership', () => {
  let s: ReturnType<typeof fakeStore>;
  let app: ReturnType<typeof createApp>;
  const as = (who: keyof typeof TOKENS) => ({ Authorization: `Bearer ${who}` });
  const get = (who: keyof typeof TOKENS) => request(app).get('/api/membership').set(as(who));
  const post = (who: keyof typeof TOKENS, body: unknown = {}) =>
    request(app).post('/api/membership/interest').set(as(who)).send(body);

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
    app = createApp({ auth, membership: s.repo } as unknown as AppDeps);
  });

  it('starts an athlete free on Starter, with the free limits', async () => {
    const res = await get('athlete');
    expect(res.status).toBe(200);
    expect(res.body.membership).toMatchObject({ plan: 'starter', status: 'free', trialEndsAt: null });
    expect(res.body.limits.activeApplications).toBe(3);
    expect(s.audits.at(-1)).toMatchObject({ type: 'membership.started', actorUid: 'athlete' });
  });

  it('gives an organisation a 30-day trial the first time it asks, and keeps the same one after that', async () => {
    const first = await get('org');
    expect(first.body.membership).toMatchObject({ plan: 'organisation', status: 'trialing' });
    expect(first.body.trialDaysLeft).toBe(TRIAL_DAYS);
    expect(first.body.limits.liveListings).toBeNull();

    const again = await get('org');
    expect(again.body.membership.trialEndsAt).toBe(first.body.membership.trialEndsAt);
    expect(s.audits.filter((a) => a.type === 'membership.started')).toHaveLength(1);
  });

  it('lets a lapsed trial fall back to the free limits, and writes that down, without charging anything', async () => {
    s.records.set(
      'org',
      membership({
        uid: 'org',
        plan: 'organisation',
        status: 'trialing',
        trialEndsAt: '2020-01-01T00:00:00.000Z',
      }),
    );
    const res = await get('org');
    expect(res.body.status).toBe('lapsed');
    expect(res.body.limits.liveListings).toBe(1);
    expect(res.body.trialDaysLeft).toBe(0);
    // The stored record is corrected so it says the same thing the app shows.
    expect(s.records.get('org')!.status).toBe('lapsed');
    expect(s.audits.at(-1)).toMatchObject({ type: 'membership.trial_ended' });
  });

  it('records interest in a paid plan without granting it or taking money', async () => {
    const res = await post('athlete', { plan: 'pro', billingPeriod: 'annual' });
    expect(res.status).toBe(200);
    expect(res.body.membership.interest).toMatchObject({ plan: 'pro', billingPeriod: 'annual' });
    // Nothing is unlocked: still Starter, still the free limits.
    expect(res.body.membership.plan).toBe('starter');
    expect(res.body.membership.status).toBe('free');
    expect(res.body.limits.activeApplications).toBe(3);
    expect(s.audits.at(-1)).toMatchObject({ type: 'membership.interest', plan: 'pro' });
  });

  it('keeps each plan to the accounts it is for, and refuses nonsense', async () => {
    expect((await post('athlete', { plan: 'organisation', billingPeriod: 'monthly' })).status).toBe(403);
    expect((await post('org', { plan: 'pro', billingPeriod: 'monthly' })).status).toBe(403);
    expect((await post('coach', { plan: 'starter', billingPeriod: 'monthly' })).status).toBe(400);
  });

  it('refuses anyone who is not signed in', async () => {
    expect((await request(app).get('/api/membership')).status).toBe(401);
    expect((await request(app).post('/api/membership/interest').send({})).status).toBe(401);
  });
});

describe('the application limit', () => {
  const now = new Date('2026-11-16T12:00:00.000Z');

  it('stops a Starter account at three applications still waiting for an answer', () => {
    const m = membership();
    expect(() => assertWithinApplicationLimit(m, 2, now)).not.toThrow();
    expect(() => assertWithinApplicationLimit(m, 3, now)).toThrow(/3 applications at a time/);
  });

  it('does not stop an organisation, a paid member, or someone with no record yet', () => {
    const org = membership({
      plan: 'organisation',
      status: 'trialing',
      trialEndsAt: '2030-01-01T00:00:00.000Z',
    });
    expect(() => assertWithinApplicationLimit(org, 99, now)).not.toThrow();
    expect(() =>
      assertWithinApplicationLimit(membership({ plan: 'pro', status: 'active' }), 99, now),
    ).not.toThrow();
    expect(() => assertWithinApplicationLimit(null, 99, now)).not.toThrow();
  });
});
