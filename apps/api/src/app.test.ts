import { describe, expect, it, beforeEach } from 'vitest';
import request from 'supertest';
import type { DecodedIdToken } from 'firebase-admin/auth';
import type { UserDoc } from '@sportbridge/shared';
import { createApp } from './app.js';
import type { AuthPort, OnboardingWrite, UserRepoPort } from './services/ports.js';

type Token = Partial<DecodedIdToken> & { uid: string; role?: string; admin?: boolean };

function fakes() {
  const tokens = new Map<string, Token>();
  const claims = new Map<string, Record<string, unknown>>();
  const users = new Map<string, UserDoc>();
  const writes: OnboardingWrite[] = [];
  let failClaimsOnce = false;
  let id = 0;
  const auth: AuthPort = {
    async verifyIdToken(t) {
      const tok = tokens.get(t);
      if (!tok) throw new Error('bad token');
      return tok as DecodedIdToken;
    },
    async setCustomUserClaims(uid, c) {
      if (failClaimsOnce) {
        failClaimsOnce = false;
        throw new Error('claims down');
      }
      claims.set(uid, c);
    },
  };
  const repo: UserRepoPort = {
    async getUser(uid) {
      return users.get(uid) ?? null;
    },
    newId: (c) => `${c}-${++id}`,
    async commitOnboarding(w) {
      if (users.has(w.uid)) throw new Error('ALREADY_ONBOARDED');
      users.set(w.uid, w.user);
      writes.push(w);
    },
  };
  return {
    tokens,
    claims,
    users,
    writes,
    auth,
    repo,
    failClaims: () => {
      failClaimsOnce = true;
    },
  };
}

const yearsAgo = (n: number) => {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear() - n, now.getUTCMonth(), now.getUTCDate()))
    .toISOString()
    .slice(0, 10);
};
const adult = {
  firstName: 'Jordan',
  surname: 'Mokoena',
  mobile: '082 123 4567',
  dateOfBirth: yearsAgo(25),
  role: 'athlete',
  termsAccepted: true,
};

describe('API', () => {
  let f: ReturnType<typeof fakes>;
  let app: ReturnType<typeof createApp>;
  beforeEach(() => {
    f = fakes();
    app = createApp({ auth: f.auth, users: f.repo });
    f.tokens.set('t-jordan', { uid: 'u1', email: 'Jordan@Example.com', email_verified: false });
    f.tokens.set('t-teen', { uid: 'u2', email: 'teen@example.com' });
    f.tokens.set('t-admin', { uid: 'u3', email: 'admin@example.com', role: 'admin', admin: true });
  });

  it('health check responds', async () => {
    const r = await request(app).get('/api/health');
    expect(r.status).toBe(200);
    expect(r.body.status).toBe('ok');
  });

  it('rejects unauthenticated and invalid tokens', async () => {
    expect((await request(app).post('/api/onboarding').send(adult)).status).toBe(401);
    expect(
      (await request(app).post('/api/onboarding').set('Authorization', 'Bearer nope').send(adult)).status,
    ).toBe(401);
  });

  it('onboards an adult athlete and sets the role claim from the server', async () => {
    const r = await request(app).post('/api/onboarding').set('Authorization', 'Bearer t-jordan').send(adult);
    expect(r.status).toBe(201);
    expect(r.body.user).toMatchObject({
      role: 'athlete',
      isMinor: false,
      status: 'active',
      email: 'jordan@example.com',
    });
    expect(f.claims.get('u1')).toEqual({ role: 'athlete' });
    expect(f.writes[0]!.privateDetails).toEqual({ dateOfBirth: adult.dateOfBirth, mobile: '0821234567' });
    expect(f.writes[0]!.roleProfile?.collection).toBe('athleteProfiles');
  });

  it('ignores client-supplied privileged fields', async () => {
    const r = await request(app)
      .post('/api/onboarding')
      .set('Authorization', 'Bearer t-jordan')
      .send({ ...adult, isMinor: false, status: 'active', admin: true, membership: 'pro' });
    expect(r.status).toBe(201);
    expect(r.body.user.admin).toBeUndefined();
    expect(r.body.user.membership).toBeUndefined();
  });

  it('refuses admin as a self-service role', async () => {
    const r = await request(app)
      .post('/api/onboarding')
      .set('Authorization', 'Bearer t-jordan')
      .send({ ...adult, role: 'admin' });
    expect(r.status).toBe(400);
    expect(f.claims.size).toBe(0);
  });

  it('refuses onboarding for administrator accounts', async () => {
    const r = await request(app).post('/api/onboarding').set('Authorization', 'Bearer t-admin').send(adult);
    expect(r.status).toBe(403);
  });

  it('creates a restricted minor with a pending guardian link', async () => {
    const r = await request(app)
      .post('/api/onboarding')
      .set('Authorization', 'Bearer t-teen')
      .send({
        ...adult,
        dateOfBirth: yearsAgo(15),
        guardianEmail: 'Mom@Example.com',
        guardianRelationship: 'parent',
        guardianConsentAcknowledged: true,
      });
    expect(r.status).toBe(201);
    expect(r.body.user).toMatchObject({ isMinor: true, status: 'restricted' });
    const w = f.writes[0]!;
    expect(w.guardianLink?.data).toMatchObject({
      guardianEmail: 'mom@example.com',
      status: 'pending',
      guardianUid: null,
    });
    expect(w.roleProfile?.data.visibility).toBe('private');
  });

  it('rejects a minor without guardian details, and minors as coaches', async () => {
    const a = await request(app)
      .post('/api/onboarding')
      .set('Authorization', 'Bearer t-teen')
      .send({ ...adult, dateOfBirth: yearsAgo(15) });
    expect(a.status).toBe(400);
    expect(Object.keys(a.body.error.fields)).toEqual(expect.arrayContaining(['guardianEmail']));
    const b = await request(app)
      .post('/api/onboarding')
      .set('Authorization', 'Bearer t-teen')
      .send({
        ...adult,
        role: 'coach',
        dateOfBirth: yearsAgo(16),
        guardianEmail: 'm@e.co',
        guardianRelationship: 'parent',
        guardianConsentAcknowledged: true,
      });
    expect(b.status).toBe(400);
  });

  it('creates an organisation owned by the caller', async () => {
    const r = await request(app)
      .post('/api/onboarding')
      .set('Authorization', 'Bearer t-jordan')
      .send({ ...adult, role: 'organisation', organisationName: 'Soweto FC', organisationType: 'club' });
    expect(r.status).toBe(201);
    const w = f.writes[0]!;
    expect(w.organisation?.data).toMatchObject({ ownerUid: 'u1', name: 'Soweto FC', verified: false });
    expect(r.body.user.organisationId).toBe(w.organisation?.id);
    expect(w.roleProfile).toBeUndefined();
  });

  it('is idempotent and cannot be used to change role', async () => {
    await request(app).post('/api/onboarding').set('Authorization', 'Bearer t-jordan').send(adult);
    const again = await request(app)
      .post('/api/onboarding')
      .set('Authorization', 'Bearer t-jordan')
      .send({ ...adult, role: 'coach' });
    expect(again.status).toBe(200);
    expect(again.body.user.role).toBe('athlete');
    expect(f.writes).toHaveLength(1);
  });

  it('repairs a missing claim on retry after a partial failure', async () => {
    f.failClaims();
    const first = await request(app)
      .post('/api/onboarding')
      .set('Authorization', 'Bearer t-jordan')
      .send(adult);
    expect(first.status).toBe(500);
    expect(f.claims.get('u1')).toBeUndefined();
    const retry = await request(app)
      .post('/api/onboarding')
      .set('Authorization', 'Bearer t-jordan')
      .send(adult);
    expect(retry.status).toBe(200);
    expect(f.claims.get('u1')).toEqual({ role: 'athlete' });
  });

  it('returns JSON 404 for unknown API routes and 400 for bad JSON', async () => {
    expect((await request(app).get('/api/nope')).status).toBe(404);
    const r = await request(app)
      .post('/api/onboarding')
      .set('Authorization', 'Bearer t-jordan')
      .set('Content-Type', 'application/json')
      .send('{bad');
    expect(r.status).toBe(400);
  });
});
