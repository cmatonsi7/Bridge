import { describe, expect, it, beforeEach } from 'vitest';
import request from 'supertest';
import type { DecodedIdToken } from 'firebase-admin/auth';
import type { UserDoc } from '@sportbridge/shared';
import { createApp } from './app.js';
import type { AuthPort, OnboardingWrite, UserRepoPort } from './services/ports.js';
import type { GuardianRepoPort } from './services/guardian.js';
import type { GuardianLinkDoc } from '@sportbridge/shared';

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
  const links = new Map<string, GuardianLinkDoc>();
  const athletes = new Map<string, { guardianUids: string[]; status: string }>();
  const audits: Record<string, unknown>[] = [];
  const guardians: GuardianRepoPort = {
    async mutateLink(id, decide) {
      const link = links.get(id) ?? null;
      const a = link ? (athletes.get(link.athleteUid) ?? { guardianUids: [], status: 'restricted' }) : null;
      const r = decide(link ? { ...link } : null, a ? [...a.guardianUids] : []);
      links.set(id, { ...link!, ...r.link } as GuardianLinkDoc);
      if (r.athlete && link) athletes.set(link.athleteUid, { status: a!.status, ...r.athlete });
      audits.push(r.audit);
    },
  };
  return {
    tokens,
    claims,
    users,
    writes,
    auth,
    repo,
    guardians,
    links,
    athletes,
    audits,
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
    app = createApp({ auth: f.auth, users: f.repo, guardians: f.guardians });
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

describe('static asset serving (stale-cache protection)', () => {
  // Regression test for the production crash where a browser holding a stale index.html
  // requested a chunk that no longer existed, got index.html back with status 200, and
  // executed HTML as JavaScript ("n is not a function" on every page until a hard refresh).
  const fs = require('node:fs') as typeof import('node:fs');
  const os = require('node:os') as typeof import('node:os');
  const pathMod = require('node:path') as typeof import('node:path');

  const dist = fs.mkdtempSync(pathMod.join(os.tmpdir(), 'sbdist-'));
  fs.mkdirSync(pathMod.join(dist, 'assets'), { recursive: true });
  fs.writeFileSync(pathMod.join(dist, 'index.html'), '<!doctype html><title>SportBridge</title>');
  fs.writeFileSync(pathMod.join(dist, 'assets', 'index-REAL.js'), 'export const ok = 1;');

  const f = fakes();
  const appWithDist = createApp({ auth: f.auth, users: f.repo, guardians: f.guardians, webDistDir: dist });

  it('serves an existing hashed asset as JavaScript', async () => {
    const r = await request(appWithDist).get('/assets/index-REAL.js');
    expect(r.status).toBe(200);
    expect(r.headers['content-type']).toMatch(/javascript/);
  });

  it('404s a missing asset instead of serving the SPA shell', async () => {
    const r = await request(appWithDist).get('/assets/index-STALEHASH.js');
    expect(r.status).toBe(404);
    expect(r.text).not.toMatch(/<!doctype html>/i);
  });

  it('404s any missing file-like path rather than returning HTML', async () => {
    for (const p of ['/old-chunk.js', '/missing.css', '/nope.webp']) {
      const r = await request(appWithDist).get(p);
      expect(r.status).toBe(404);
      expect(r.text).not.toMatch(/<!doctype html>/i);
    }
  });

  it('still serves index.html for real SPA routes, uncached', async () => {
    const r = await request(appWithDist).get('/discover');
    expect(r.status).toBe(200);
    expect(r.text).toMatch(/SportBridge/);
    expect(r.headers['cache-control']).toMatch(/no-store|no-cache/);
  });
});

describe('Content-Security-Policy allows what Firebase Auth actually needs', () => {
  // Regression test: our CSP originally allowed scripts only from 'self'. Firebase Auth loads
  // https://apis.google.com/js/api.js itself (for its sign-up abuse-protection / reCAPTCHA
  // check) even when the app only uses email/password — not a Google Sign-In feature we chose.
  // The browser silently blocked that script, which surfaced as "TypeError: n is not a
  // function" the first time a user interacted with Auth (e.g. on /register). This pins the
  // CSP header so the policy can't quietly regress to blocking it again.
  it('includes apis.google.com in script-src', async () => {
    const f = fakes();
    const app = createApp({ auth: f.auth, users: f.repo, guardians: f.guardians });
    const r = await request(app).get('/api/health');
    const csp = r.headers['content-security-policy'] as string;
    expect(csp).toBeTruthy();
    expect(csp).toMatch(/script-src[^;]*'self'[^;]*apis\.google\.com/);
    expect(csp).toMatch(/connect-src[^;]*apis\.google\.com/);
  });
});

describe('guardian links', () => {
  let f: ReturnType<typeof fakes>;
  let app: ReturnType<typeof createApp>;
  const pending: GuardianLinkDoc = {
    athleteUid: 'kid',
    athleteName: 'Thabo Mokoena',
    guardianEmail: 'mom@example.com',
    guardianUid: null,
    relationship: 'parent',
    status: 'pending',
    requestedAt: 't',
    verifiedAt: null,
    consentVersion: null,
  };
  beforeEach(() => {
    f = fakes();
    app = createApp({ auth: f.auth, users: f.repo, guardians: f.guardians });
    f.links.set('L1', { ...pending });
    f.athletes.set('kid', { guardianUids: [], status: 'restricted' });
    f.tokens.set('t-mom', { uid: 'mom', email: 'Mom@Example.com', email_verified: true, role: 'guardian' });
    f.tokens.set('t-mom-unverified', {
      uid: 'mom',
      email: 'mom@example.com',
      email_verified: false,
      role: 'guardian',
    });
    f.tokens.set('t-stranger', { uid: 'x', email: 'x@example.com', email_verified: true, role: 'guardian' });
    f.tokens.set('t-athlete', { uid: 'a', email: 'mom@example.com', email_verified: true, role: 'athlete' });
  });
  const post = (path: string, token: string) =>
    request(app).post(path).set('Authorization', `Bearer ${token}`);

  it('confirms a request addressed to the parent (email match is case-insensitive)', async () => {
    const r = await post('/api/guardian/links/L1/confirm', 't-mom');
    expect(r.status).toBe(200);
    expect(f.links.get('L1')).toMatchObject({ status: 'verified', guardianUid: 'mom' });
    expect(f.links.get('L1')!.consentVersion).toBeTruthy();
    expect(f.athletes.get('kid')).toEqual({ guardianUids: ['mom'], status: 'active' });
    expect(f.audits[0]).toMatchObject({ type: 'guardian.confirmed', athleteUid: 'kid', guardianUid: 'mom' });
  });

  it('refuses unverified emails, non-guardians and other parents', async () => {
    expect((await post('/api/guardian/links/L1/confirm', 't-mom-unverified')).status).toBe(403);
    expect((await post('/api/guardian/links/L1/confirm', 't-athlete')).status).toBe(403);
    expect((await post('/api/guardian/links/L1/confirm', 't-stranger')).status).toBe(404);
    expect((await post('/api/guardian/links/NOPE/confirm', 't-mom')).status).toBe(404);
    expect(f.links.get('L1')!.status).toBe('pending');
    expect(f.athletes.get('kid')!.status).toBe('restricted');
  });

  it('declines without granting access', async () => {
    expect((await post('/api/guardian/links/L1/decline', 't-mom')).status).toBe(200);
    expect(f.links.get('L1')!.status).toBe('declined');
    expect(f.athletes.get('kid')).toEqual({ guardianUids: [], status: 'restricted' });
  });

  it('cannot answer a request twice', async () => {
    await post('/api/guardian/links/L1/confirm', 't-mom');
    expect((await post('/api/guardian/links/L1/decline', 't-mom')).status).toBe(409);
    expect((await post('/api/guardian/links/L1/confirm', 't-mom')).status).toBe(409);
  });

  it('withdrawing consent restricts the child again, and only the linked parent can do it', async () => {
    await post('/api/guardian/links/L1/confirm', 't-mom');
    expect((await post('/api/guardian/links/L1/revoke', 't-stranger')).status).toBe(404);
    expect((await post('/api/guardian/links/L1/revoke', 't-mom')).status).toBe(200);
    expect(f.links.get('L1')!.status).toBe('revoked');
    expect(f.athletes.get('kid')).toEqual({ guardianUids: [], status: 'restricted' });
  });

  it('keeps the child active if another verified guardian remains', async () => {
    f.athletes.set('kid', { guardianUids: ['dad'], status: 'active' });
    await post('/api/guardian/links/L1/confirm', 't-mom');
    await post('/api/guardian/links/L1/revoke', 't-mom');
    expect(f.athletes.get('kid')).toEqual({ guardianUids: ['dad'], status: 'active' });
  });

  it('rejects malformed ids and unauthenticated calls', async () => {
    expect((await post('/api/guardian/links/bad$id/confirm', 't-mom')).status).toBe(400);
    expect((await request(app).post('/api/guardian/links/L1/confirm')).status).toBe(401);
  });
});
