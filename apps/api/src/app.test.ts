import { describe, expect, it, beforeEach } from 'vitest';
import request from 'supertest';
import type { DecodedIdToken } from 'firebase-admin/auth';
import type { UserDoc } from '@sportbridge/shared';
import { createApp } from './app.js';
import type { AuthPort, OnboardingWrite, UserRepoPort } from './services/ports.js';
import type { GuardianRepoPort } from './services/guardian.js';
import type { ApplicationsRepoPort, ApplicantRecords, Outbox } from './services/applications.js';
import type { DirectoryRepoPort, DirectorySubject } from './services/directory.js';
import type { OrgOnboardingRepoPort } from './services/orgOnboarding.js';
import type { ClaimDoc, OrganisationFullDoc } from '@sportbridge/shared';
import type { ConnectionDoc, DirectoryEntryDoc } from '@sportbridge/shared';
import type { ApplicationDoc, GuardianLinkDoc, ListingDoc } from '@sportbridge/shared';

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
  const listings = new Map<string, ListingDoc>();
  const applicants = new Map<string, ApplicantRecords>();
  const apps = new Map<string, ApplicationDoc>();
  const sent: Outbox = [];
  const applications: ApplicationsRepoPort = {
    async getListing(id) {
      return listings.get(id) ?? null;
    },
    async getApplicant(uid) {
      return applicants.get(uid) ?? null;
    },
    async createApplication(id, doc, outbox, audit) {
      if (apps.has(id)) throw new Error('ALREADY_APPLIED');
      apps.set(id, doc);
      sent.push(...outbox);
      audits.push(audit);
    },
    async mutateApplication(id, decide) {
      const app = apps.get(id) ?? null;
      const g = app ? (applicants.get(app.applicantUid)?.user.guardianUids ?? []) : [];
      const r = decide(app ? structuredClone(app) : null, g);
      apps.set(id, { ...app!, ...r.changes });
      sent.push(...r.outbox);
      audits.push(r.audit);
    },
  };
  const subjects = new Map<string, DirectorySubject>();
  const entries = new Map<string, DirectoryEntryDoc>();
  const connections = new Map<string, ConnectionDoc>();
  const directory: DirectoryRepoPort = {
    async getSubject(uid) {
      return subjects.get(uid) ?? null;
    },
    async putEntry(uid, entry) {
      entries.set(uid, entry);
    },
    async removeEntry(uid) {
      entries.delete(uid);
    },
    async getConnection(id) {
      return connections.get(id) ?? null;
    },
    async createConnection(id, doc, outbox, audit) {
      const ex = connections.get(id);
      if (ex && ['pending', 'accepted'].includes(ex.status)) throw new Error('ALREADY_EXISTS');
      connections.set(id, doc);
      sent.push(...outbox);
      audits.push(audit);
    },
    async mutateConnection(id, decide) {
      const conn = connections.get(id) ?? null;
      const g = conn ? (subjects.get(conn.athleteUid)?.user.guardianUids ?? []) : [];
      const r = decide(conn ? structuredClone(conn) : null, g);
      connections.set(id, { ...conn!, ...r.changes });
      sent.push(...r.outbox);
      audits.push(r.audit);
    },
  };
  const orgs = new Map<string, OrganisationFullDoc>();
  const orgClaims = new Map<string, ClaimDoc>();
  const orgUsers = new Map<string, UserDoc>();
  const listingCounts = new Map<string, number>();
  const orgListings = new Map<string, { orgId: string; orgVerified: boolean }>();
  const verifications = new Map<string, { verified: boolean; note: string | null; decidedBy: string }>();
  let orgSeq = 0;
  const orgOnboarding: OrgOnboardingRepoPort = {
    newOrganisationId: () => `org${++orgSeq}`,
    async createUnclaimed(id, org, entry, claim, audit) {
      orgs.set(id, org);
      orgClaims.set(id, claim);
      entries.set(entry.uid, entry);
      audits.push(audit);
    },
    async replaceClaim(orgId, claim, audit) {
      if (orgs.get(orgId)?.claimStatus !== 'unclaimed') throw new Error('NOT_UNCLAIMED');
      orgClaims.set(orgId, claim);
      audits.push(audit);
    },
    async removeUnclaimed(orgId, audit) {
      if (orgs.get(orgId)?.claimStatus !== 'unclaimed') throw new Error('NOT_UNCLAIMED');
      orgs.delete(orgId);
      orgClaims.delete(orgId);
      entries.delete(`org_${orgId}`);
      audits.push(audit);
    },
    async setVerification(a) {
      const o = orgs.get(a.orgId);
      if (!o) throw new Error('NOT_FOUND');
      if (!o.ownerUid) throw new Error('UNCLAIMED');
      if (a.verified && o.verified) throw new Error('ALREADY');
      if (!a.verified && !o.verified) throw new Error('NOT_VERIFIED');
      orgs.set(a.orgId, { ...o, verified: a.verified, verifiedAt: a.verified ? a.at : null });
      for (const [id, l] of orgListings)
        if (l.orgId === a.orgId) orgListings.set(id, { ...l, orgVerified: a.verified });
      const entry = entries.get(o.ownerUid);
      if (entry) entries.set(o.ownerUid, { ...entry, verified: a.verified });
      verifications.set(a.orgId, { verified: a.verified, note: a.note, decidedBy: a.by });
      sent.push({ uid: o.ownerUid, notification: a.notify(o.ownerUid, o.name) });
      audits.push(a.audit(o.name));
      return { name: o.name };
    },
    async loadClaim(hash, uid) {
      const claim = [...orgClaims.values()].find((c) => c.codeHash === hash);
      const user = orgUsers.get(uid);
      const org = claim ? orgs.get(claim.orgId) : undefined;
      if (!claim || !org || !user) return null;
      const ownOrgId = user.organisationId ?? null;
      const ownOrg = ownOrgId && ownOrgId !== claim.orgId ? (orgs.get(ownOrgId) ?? null) : null;
      return {
        orgId: claim.orgId,
        org,
        claim,
        user,
        ownOrgId,
        ownOrg,
        ownListingCount: ownOrgId ? (listingCounts.get(ownOrgId) ?? 0) : 0,
      };
    },
    async commitClaim(ctx, uid, at, audit) {
      const o = orgs.get(ctx.orgId);
      if (!o || o.claimStatus !== 'unclaimed' || o.ownerUid !== null) throw new Error('NOT_UNCLAIMED');
      orgs.set(ctx.orgId, { ...o, ownerUid: uid, claimStatus: 'claimed', claimedAt: at });
      orgClaims.delete(ctx.orgId);
      entries.delete(`org_${ctx.orgId}`);
      orgUsers.set(uid, { ...orgUsers.get(uid)!, organisationId: ctx.orgId });
      if (ctx.ownOrgId && ctx.ownOrgId !== ctx.orgId) {
        orgs.delete(ctx.ownOrgId);
        entries.delete(uid);
      }
      audits.push(audit);
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
    applications,
    directory,
    orgOnboarding,
    orgListings,
    verifications,
    orgs,
    orgClaims,
    orgUsers,
    listingCounts,
    subjects,
    entries,
    connections,
    listings,
    applicants,
    apps,
    sent,
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
    app = createApp({
      auth: f.auth,
      users: f.repo,
      guardians: f.guardians,
      applications: f.applications,
      directory: f.directory,
      orgOnboarding: f.orgOnboarding,
    });
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
  const appWithDist = createApp({
    auth: f.auth,
    users: f.repo,
    guardians: f.guardians,
    applications: f.applications,
    webDistDir: dist,
  });

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
    const app = createApp({
      auth: f.auth,
      users: f.repo,
      guardians: f.guardians,
      applications: f.applications,
    });
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
    app = createApp({
      auth: f.auth,
      users: f.repo,
      guardians: f.guardians,
      applications: f.applications,
      directory: f.directory,
      orgOnboarding: f.orgOnboarding,
    });
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

describe('applications', () => {
  let f: ReturnType<typeof fakes>;
  let app: ReturnType<typeof createApp>;
  const yearsAgo = (n: number) => {
    const d = new Date();
    return new Date(Date.UTC(d.getUTCFullYear() - n, d.getUTCMonth(), d.getUTCDate()))
      .toISOString()
      .slice(0, 10);
  };
  const future = new Date(Date.now() + 10 * 86400000).toISOString().slice(0, 10);
  const listing: ListingDoc = {
    kind: 'opportunity',
    type: 'Trial',
    title: 'U17 Trials',
    description: 'Open trials for the U17 squad.',
    sports: ['Football'],
    province: 'Gauteng',
    city: 'Soweto',
    ageMin: 14,
    ageMax: 30,
    deadline: future,
    startDate: null,
    endDate: null,
    isFree: true,
    priceZar: null,
    inclusions: [],
    status: 'published',
    orgId: 'org1',
    ownerUid: 'org-owner',
    orgName: 'Soweto FC',
    orgVerified: false,
    createdAt: 't',
    updatedAt: 't',
    publishedAt: 't',
  };
  const records = (uid: string, over: Partial<ApplicantRecords['user']>, dob: string): ApplicantRecords => ({
    user: {
      uid,
      email: `${uid}@example.com`,
      firstName: 'A',
      surname: 'B',
      displayName: `${uid} B`,
      role: 'athlete',
      status: 'active',
      isMinor: false,
      onboardingComplete: true,
      termsVersion: 'v',
      termsAcceptedAt: 't',
      createdAt: 't',
      updatedAt: 't',
      ...over,
    },
    profile: {
      uid,
      displayName: `${uid} B`,
      visibility: 'members',
      createdAt: 't',
      updatedAt: 't',
      sport: 'Football',
      position: 'Wing',
      skills: ['Teamwork'],
    },
    details: { dateOfBirth: dob, mobile: '0821234567' },
  });
  beforeEach(() => {
    f = fakes();
    app = createApp({
      auth: f.auth,
      users: f.repo,
      guardians: f.guardians,
      applications: f.applications,
      directory: f.directory,
      orgOnboarding: f.orgOnboarding,
    });
    f.listings.set('L1', { ...listing });
    f.listings.set('LD', { ...listing, status: 'draft' });
    f.listings.set('LC', { ...listing, status: 'closed' });
    f.listings.set('LA', { ...listing, ageMin: 19, ageMax: 30 });
    f.applicants.set('adult', records('adult', {}, yearsAgo(25)));
    f.applicants.set('kid', records('kid', { isMinor: true, guardianUids: ['mom'] }, yearsAgo(15)));
    f.applicants.set(
      'restricted',
      records('restricted', { isMinor: true, status: 'restricted' }, yearsAgo(15)),
    );
    for (const [t, uid, role] of [
      ['t-adult', 'adult', 'athlete'],
      ['t-kid', 'kid', 'athlete'],
      ['t-restricted', 'restricted', 'athlete'],
      ['t-org', 'org-owner', 'organisation'],
      ['t-other-org', 'other-owner', 'organisation'],
      ['t-mom', 'mom', 'guardian'],
      ['t-stranger', 'stranger', 'guardian'],
      ['t-coach', 'coach', 'coach'],
    ] as const) {
      f.tokens.set(t, { uid, email: `${uid}@example.com`, email_verified: true, role });
    }
  });
  const post = (path: string, token: string, body: unknown = {}) =>
    request(app)
      .post(path)
      .set('Authorization', `Bearer ${token}`)
      .send(body as object);

  it('an adult applies; the organisation gets their contact details and a notification', async () => {
    const r = await post('/api/applications', 't-adult', { listingId: 'L1', note: 'Keen to trial' });
    expect(r.status).toBe(201);
    const a = f.apps.get('L1_adult')!;
    expect(a).toMatchObject({
      status: 'submitted',
      ownerUid: 'org-owner',
      applicantIsMinor: false,
      note: 'Keen to trial',
    });
    expect(a.snapshot).toMatchObject({
      age: 25,
      email: 'adult@example.com',
      phone: '0821234567',
      sport: 'Football',
    });
    expect(f.sent.map((s) => s.uid)).toEqual(['org-owner']);
  });

  it('a child application never carries contact details, and their parent is told', async () => {
    expect((await post('/api/applications', 't-kid', { listingId: 'L1' })).status).toBe(201);
    const a = f.apps.get('L1_kid')!;
    expect(a.applicantIsMinor).toBe(true);
    expect(a.snapshot.email).toBeNull();
    expect(a.snapshot.phone).toBeNull();
    expect(a.snapshot.age).toBe(15);
    expect(f.sent.map((s) => s.uid).sort()).toEqual(['mom', 'org-owner']);
  });

  it('blocks restricted children, non-athletes, drafts, closed listings and wrong ages', async () => {
    expect((await post('/api/applications', 't-restricted', { listingId: 'L1' })).body.error.code).toBe(
      'GUARDIAN_REQUIRED',
    );
    expect((await post('/api/applications', 't-coach', { listingId: 'L1' })).status).toBe(403);
    expect((await post('/api/applications', 't-adult', { listingId: 'LD' })).status).toBe(404);
    expect((await post('/api/applications', 't-adult', { listingId: 'LC' })).status).toBe(409);
    expect((await post('/api/applications', 't-kid', { listingId: 'LA' })).body.error.code).toBe(
      'AGE_OUT_OF_RANGE',
    );
    expect(f.apps.size).toBe(0);
  });

  it('allows one application per person per listing', async () => {
    await post('/api/applications', 't-adult', { listingId: 'L1' });
    const again = await post('/api/applications', 't-adult', { listingId: 'L1' });
    expect(again.status).toBe(409);
    expect(again.body.error.code).toBe('ALREADY_APPLIED');
  });

  it("only the listing's organisation reviews it, through allowed steps only", async () => {
    await post('/api/applications', 't-kid', { listingId: 'L1' });
    expect(
      (await post('/api/applications/L1_kid/status', 't-other-org', { status: 'accepted' })).status,
    ).toBe(404);
    expect((await post('/api/applications/L1_kid/status', 't-adult', { status: 'accepted' })).status).toBe(
      403,
    );
    expect((await post('/api/applications/L1_kid/status', 't-org', { status: 'shortlisted' })).status).toBe(
      200,
    );
    expect(
      (
        await post('/api/applications/L1_kid/status', 't-org', {
          status: 'accepted',
          message: 'See you Saturday',
        })
      ).status,
    ).toBe(200);
    expect((await post('/api/applications/L1_kid/status', 't-org', { status: 'declined' })).status).toBe(409);
    const a = f.apps.get('L1_kid')!;
    expect(a.status).toBe('accepted');
    expect(a.orgMessage).toBe('See you Saturday');
    expect(a.history.map((h) => h.status)).toEqual(['submitted', 'shortlisted', 'accepted']);
    // the child and the parent both hear about the decision
    expect(f.sent.filter((s) => s.notification.type === 'application.status').map((s) => s.uid)).toContain(
      'mom',
    );
  });

  it("a verified parent can withdraw their child's application; strangers cannot", async () => {
    await post('/api/applications', 't-kid', { listingId: 'L1' });
    expect((await post('/api/applications/L1_kid/withdraw', 't-stranger')).status).toBe(404);
    expect((await post('/api/applications/L1_kid/withdraw', 't-mom')).status).toBe(200);
    const a = f.apps.get('L1_kid')!;
    expect(a.status).toBe('withdrawn');
    expect(a.history.at(-1)!.by).toBe('guardian');
    expect((await post('/api/applications/L1_kid/withdraw', 't-kid')).status).toBe(409);
  });

  it('rejects malformed ids and signed-out calls', async () => {
    expect((await post('/api/applications/../x/withdraw', 't-adult')).status).toBe(404);
    expect((await post('/api/applications/bad$id/withdraw', 't-adult')).status).toBe(400);
    expect((await request(app).post('/api/applications').send({ listingId: 'L1' })).status).toBe(401);
  });
});

describe('directory and connections', () => {
  let f: ReturnType<typeof fakes>;
  let app: ReturnType<typeof createApp>;
  const subject = (
    uid: string,
    role: string,
    over: Record<string, unknown> = {},
    profiles: Record<string, unknown> = {},
  ): DirectorySubject => ({
    user: {
      uid,
      email: `${uid}@example.com`,
      firstName: 'A',
      surname: 'B',
      displayName: `${uid} B`,
      role: role as never,
      status: 'active',
      isMinor: false,
      onboardingComplete: true,
      termsVersion: 'v',
      termsAcceptedAt: 't',
      createdAt: 't',
      updatedAt: 't',
      ...over,
    },
    athlete: null,
    coach: null,
    organisation: null,
    ...profiles,
  });
  const athleteProfile = (discoverable: boolean) => ({
    athlete: {
      uid: 'x',
      displayName: 'x',
      visibility: 'members',
      createdAt: 't',
      updatedAt: 't',
      sport: 'Football',
      position: 'Wing',
      province: 'Gauteng',
      city: 'Soweto',
      skills: ['Teamwork'],
      privacy: { discoverable, showAchievements: false, allowEnquiries: false },
    },
  });
  beforeEach(() => {
    f = fakes();
    app = createApp({
      auth: f.auth,
      users: f.repo,
      guardians: f.guardians,
      applications: f.applications,
      directory: f.directory,
      orgOnboarding: f.orgOnboarding,
    });
    f.subjects.set('adult', subject('adult', 'athlete', {}, athleteProfile(true)));
    f.subjects.set('shy', subject('shy', 'athlete', {}, athleteProfile(false)));
    f.subjects.set(
      'kid',
      subject('kid', 'athlete', { isMinor: true, guardianUids: ['mom'] }, athleteProfile(true)),
    );
    f.subjects.set(
      'lonekid',
      subject('lonekid', 'athlete', { isMinor: true, guardianUids: [] }, athleteProfile(true)),
    );
    f.subjects.set(
      'coach1',
      subject(
        'coach1',
        'coach',
        {},
        {
          coach: {
            uid: 'coach1',
            displayName: 'Coach One',
            visibility: 'members',
            createdAt: 't',
            updatedAt: 't',
            sports: ['Football'],
            coachingLevel: 'Club',
            privacy: { discoverable: true, showQualifications: false, allowEnquiries: true },
          },
        },
      ),
    );
    for (const [t, uid, role] of [
      ['t-adult', 'adult', 'athlete'],
      ['t-kid', 'kid', 'athlete'],
      ['t-coach', 'coach1', 'coach'],
      ['t-mom', 'mom', 'guardian'],
      ['t-stranger', 'stranger', 'guardian'],
      ['t-shy', 'shy', 'athlete'],
    ] as const) {
      f.tokens.set(t, { uid, email: `${uid}@example.com`, email_verified: true, role });
    }
  });
  const post = (path: string, token: string, body: unknown = {}) =>
    request(app)
      .post(path)
      .set('Authorization', `Bearer ${token}`)
      .send(body as object);

  it('lists a discoverable adult athlete but never a child, whatever their settings say', async () => {
    expect((await post('/api/directory/sync', 't-adult')).body).toEqual({ listed: true, reason: null });
    expect(f.entries.get('adult')).toMatchObject({
      role: 'athlete',
      sports: ['Football'],
      province: 'Gauteng',
    });
    // the child has discoverable: true and is still refused
    f.tokens.set('t-kid2', { uid: 'kid', email: 'kid@example.com', email_verified: true, role: 'athlete' });
    expect((await post('/api/directory/sync', 't-kid2')).body).toEqual({ listed: false, reason: 'UNDER_18' });
    expect(f.entries.has('kid')).toBe(false);
  });

  it('never lists someone who has not opted in, and removes them when they opt out', async () => {
    expect((await post('/api/directory/sync', 't-shy')).body).toEqual({
      listed: false,
      reason: 'SWITCH_OFF',
    });
    await post('/api/directory/sync', 't-adult');
    expect(f.entries.has('adult')).toBe(true);
    f.subjects.set('adult', subject('adult', 'athlete', {}, athleteProfile(false)));
    expect((await post('/api/directory/sync', 't-adult')).body).toEqual({
      listed: false,
      reason: 'SWITCH_OFF',
    });
    expect(f.entries.has('adult')).toBe(false);
  });

  it('says why someone is not listed: inactive account or missing profile', async () => {
    f.subjects.set('new', subject('new', 'athlete', { status: 'restricted' }, athleteProfile(true)));
    f.tokens.set('t-new', { uid: 'new', email: 'new@example.com', email_verified: true, role: 'athlete' });
    expect((await post('/api/directory/sync', 't-new')).body.reason).toBe('NOT_ACTIVE');
    f.subjects.set('noprof', subject('noprof', 'athlete'));
    f.tokens.set('t-noprof', {
      uid: 'noprof',
      email: 'n@example.com',
      email_verified: true,
      role: 'athlete',
    });
    expect((await post('/api/directory/sync', 't-noprof')).body.reason).toBe('NO_PROFILE');
  });

  it('a directory entry never carries contact details or a date of birth', async () => {
    await post('/api/directory/sync', 't-adult');
    const e = f.entries.get('adult')!;
    expect(JSON.stringify(e)).not.toMatch(/@example\.com/);
    expect(e).not.toHaveProperty('email');
    expect(e).not.toHaveProperty('dateOfBirth');
  });

  it("a coach requests a connection; a child's request goes to the parent, who accepts", async () => {
    expect(
      (await post('/api/connections', 't-coach', { athleteUid: 'kid', message: 'Saw you at trials' })).status,
    ).toBe(201);
    expect(f.connections.get('coach1_kid')).toMatchObject({ status: 'pending', athleteIsMinor: true });
    expect(f.sent.map((s) => s.uid).sort()).toEqual(['kid', 'mom']);
    // the child cannot answer for themselves
    expect((await post('/api/connections/coach1_kid/accept', 't-kid')).status).toBe(403);
    expect((await post('/api/connections/coach1_kid/accept', 't-stranger')).status).toBe(403);
    expect((await post('/api/connections/coach1_kid/accept', 't-mom')).status).toBe(200);
    expect(f.connections.get('coach1_kid')).toMatchObject({
      status: 'accepted',
      decidedByRole: 'guardian',
      decidedByUid: 'mom',
    });
  });

  it('an adult athlete answers for themselves and can end the connection', async () => {
    await post('/api/connections', 't-coach', { athleteUid: 'adult' });
    expect((await post('/api/connections/coach1_adult/accept', 't-mom')).status).toBe(403);
    expect((await post('/api/connections/coach1_adult/accept', 't-adult')).status).toBe(200);
    expect((await post('/api/connections/coach1_adult/accept', 't-adult')).status).toBe(409);
    expect((await post('/api/connections/coach1_adult/end', 't-adult')).status).toBe(200);
    expect(f.connections.get('coach1_adult')!.status).toBe('ended');
  });

  it('refuses non-coaches, self-connections, duplicates and children with no confirmed parent', async () => {
    expect((await post('/api/connections', 't-adult', { athleteUid: 'kid' })).status).toBe(403);
    expect((await post('/api/connections', 't-coach', { athleteUid: 'coach1' })).status).toBe(400); // self-connection
    expect((await post('/api/connections', 't-coach', { athleteUid: 'lonekid' })).body.error.code).toBe(
      'NO_GUARDIAN',
    );
    await post('/api/connections', 't-coach', { athleteUid: 'adult' });
    expect((await post('/api/connections', 't-coach', { athleteUid: 'adult' })).status).toBe(409);
  });

  it("a parent can end their child's connection; a stranger cannot", async () => {
    await post('/api/connections', 't-coach', { athleteUid: 'kid' });
    await post('/api/connections/coach1_kid/accept', 't-mom');
    expect((await post('/api/connections/coach1_kid/end', 't-stranger')).status).toBe(404);
    expect((await post('/api/connections/coach1_kid/end', 't-mom')).status).toBe(200);
  });
});

describe('organisation onboarding: staff add schools, representatives claim them', () => {
  let f: ReturnType<typeof fakes>;
  let app: ReturnType<typeof createApp>;
  const school = {
    name: 'Soweto High School',
    type: 'school',
    description: 'A public high school in Soweto.',
    contactEmail: 'office@sowetohigh.edu.za',
    contactPhone: '0111234567',
    website: 'https://sowetohigh.edu.za',
    city: 'Soweto',
    province: 'Gauteng',
    sports: ['Football', 'Netball'],
    ageGroups: ['Under 16'],
    offerings: [],
    facilities: ['Grass Field'],
    schoolNumber: '700123456',
    sourceNote: 'Gauteng schools list, Nov 2026',
  };
  const user = (uid: string, over: Record<string, unknown> = {}): UserDoc =>
    ({
      uid,
      email: `${uid}@example.com`,
      firstName: 'A',
      surname: 'B',
      displayName: `${uid} B`,
      role: 'organisation',
      status: 'active',
      isMinor: false,
      onboardingComplete: true,
      termsVersion: 'v',
      termsAcceptedAt: 't',
      createdAt: 't',
      updatedAt: 't',
      ...over,
    }) as UserDoc;
  const ownOrg = (over: Record<string, unknown> = {}): OrganisationFullDoc => ({
    name: 'My School',
    type: 'school',
    ownerUid: 'rep',
    verified: false,
    createdAt: 't',
    updatedAt: 't',
    ...over,
  });
  beforeEach(() => {
    f = fakes();
    app = createApp({
      auth: f.auth,
      users: f.repo,
      guardians: f.guardians,
      applications: f.applications,
      directory: f.directory,
      orgOnboarding: f.orgOnboarding,
    });
    for (const [t, uid, role, extra] of [
      ['t-staff', 'staff', 'admin', { admin: true }],
      ['t-rep', 'rep', 'organisation', {}],
      ['t-other', 'other', 'organisation', {}],
      ['t-athlete', 'ath', 'athlete', {}],
    ] as const)
      f.tokens.set(t, { uid, email: `${uid}@example.com`, email_verified: true, role, ...extra });
    f.tokens.set('t-rep-unverified', {
      uid: 'rep',
      email: 'rep@example.com',
      email_verified: false,
      role: 'organisation',
    });
    f.orgUsers.set('rep', user('rep', { organisationId: 'own1' }));
    f.orgs.set('own1', ownOrg());
    f.orgUsers.set('other', user('other', { organisationId: 'own2' }));
    f.orgs.set('own2', ownOrg({ ownerUid: 'other' }));
  });
  const post = (path: string, token: string, body: unknown = {}) =>
    request(app)
      .post(path)
      .set('Authorization', `Bearer ${token}`)
      .send(body as object);
  const addSchool = async () =>
    (await post('/api/admin/organisations', 't-staff', school)).body as { id: string; claimCode: string };

  it('staff add a school: it is unclaimed, unverified, listed without contact details, and the code is shown once', async () => {
    const r = await post('/api/admin/organisations', 't-staff', school);
    expect(r.status).toBe(201);
    expect(r.body.claimCode).toMatch(/^SB-[A-Z2-9]{4}-[A-Z2-9]{4}$/);
    const org = f.orgs.get(r.body.id)!;
    expect(org).toMatchObject({
      ownerUid: null,
      claimStatus: 'unclaimed',
      source: 'staff_import',
      verified: false,
      importedBy: 'staff',
      schoolNumber: '700123456',
    });
    expect(org.sourceNote).toBe('Gauteng schools list, Nov 2026');
    // the audit trail names the organisation, so the staff Activity log is readable
    expect(f.audits.at(-1)).toMatchObject({
      type: 'organisation.imported',
      organisationName: 'Soweto High School',
      by: 'staff',
    });
    const entry = f.entries.get(`org_${r.body.id}`)!;
    expect(entry).toMatchObject({
      role: 'organisation',
      displayName: 'Soweto High School',
      claimed: false,
      verified: false,
    });
    expect(JSON.stringify(entry)).not.toMatch(/sowetohigh|0111234567/);
    // only a hash is stored, never the code
    const stored = f.orgClaims.get(r.body.id)!;
    expect(JSON.stringify(stored)).not.toContain(r.body.claimCode.replace(/-/g, '').slice(2));
    expect(stored.codeHash).toMatch(/^[0-9a-f]{64}$/);
  });

  it('only staff can add, re-code or remove organisations', async () => {
    const { id } = await addSchool();
    for (const t of ['t-rep', 't-athlete']) {
      expect((await post('/api/admin/organisations', t, school)).status).toBe(403);
      expect((await post(`/api/admin/organisations/${id}/claim-code`, t)).status).toBe(403);
      expect((await post(`/api/admin/organisations/${id}/remove`, t)).status).toBe(403);
    }
    expect((await request(app).post('/api/admin/organisations').send(school)).status).toBe(401);
    expect((await post('/api/admin/organisations', 't-staff', { ...school, sourceNote: '' })).status).toBe(
      400,
    );
    expect((await post('/api/admin/organisations', 't-staff', { ...school, name: ' ' })).status).toBe(400);
  });

  it('a new code replaces the old one; removal works only for unclaimed organisations', async () => {
    const { id, claimCode } = await addSchool();
    const fresh = (await post(`/api/admin/organisations/${id}/claim-code`, 't-staff')).body
      .claimCode as string;
    expect(fresh).not.toBe(claimCode);
    expect((await post('/api/organisations/claim', 't-rep', { code: claimCode })).body.error.code).toBe(
      'CODE_INVALID',
    );
    expect((await post('/api/organisations/claim', 't-rep', { code: fresh })).status).toBe(200);
    expect((await post(`/api/admin/organisations/${id}/remove`, 't-staff')).status).toBe(409);
    expect((await post(`/api/admin/organisations/${id}/claim-code`, 't-staff')).status).toBe(409);
    const second = await addSchool();
    expect((await post(`/api/admin/organisations/${second.id}/remove`, 't-staff')).status).toBe(200);
    expect(f.orgs.has(second.id)).toBe(false);
    expect(f.entries.has(`org_${second.id}`)).toBe(false);
  });

  it('a representative claims a school with the code, however they type it, and takes over the record', async () => {
    const { id, claimCode } = await addSchool();
    f.subjects.set('rep', {
      user: user('rep', { organisationId: id }),
      athlete: null,
      coach: null,
      organisation: { id, ...f.orgs.get(id)!, ownerUid: 'rep', claimStatus: 'claimed' },
    });
    const typed = claimCode.toLowerCase().replace(/-/g, ' ');
    const r = await post('/api/organisations/claim', 't-rep', { code: typed });
    expect(r.status).toBe(200);
    expect(r.body).toEqual({ organisationId: id, name: 'Soweto High School' });
    expect(f.orgs.get(id)).toMatchObject({ ownerUid: 'rep', claimStatus: 'claimed' });
    expect(f.orgUsers.get('rep')!.organisationId).toBe(id);
    expect(f.orgs.has('own1')).toBe(false); // their empty, self-registered record is replaced
    expect(f.orgClaims.has(id)).toBe(false); // the code is spent
    expect(f.audits.at(-1)).toMatchObject({
      type: 'organisation.claimed',
      organisationName: 'Soweto High School',
      by: 'rep',
    });
    expect(f.entries.has(`org_${id}`)).toBe(false);
    expect(f.entries.get('rep')).toMatchObject({ role: 'organisation', orgId: id }); // now listed under the owner
    expect((await post('/api/organisations/claim', 't-other', { code: claimCode })).body.error.code).toBe(
      'CODE_INVALID',
    );
  });

  it('refuses wrong codes, non-organisations and unverified emails, with the same answer for wrong and used codes', async () => {
    const { claimCode } = await addSchool();
    expect((await post('/api/organisations/claim', 't-rep', { code: 'SB-AAAA-BBBB' })).body.error.code).toBe(
      'CODE_INVALID',
    );
    expect((await post('/api/organisations/claim', 't-rep', { code: 'nonsense' })).body.error.code).toBe(
      'CODE_INVALID',
    );
    expect((await post('/api/organisations/claim', 't-athlete', { code: claimCode })).status).toBe(403);
    expect((await post('/api/organisations/claim', 't-rep-unverified', { code: claimCode })).status).toBe(
      403,
    );
    expect((await post('/api/organisations/claim', 't-rep', {})).status).toBe(400);
    expect((await request(app).post('/api/organisations/claim').send({ code: claimCode })).status).toBe(401);
  });

  it('never replaces a verified organisation or one that already has listings, and expired codes stop working', async () => {
    const { id, claimCode } = await addSchool();
    f.orgs.set('own1', ownOrg({ verified: true }));
    expect((await post('/api/organisations/claim', 't-rep', { code: claimCode })).body.error.code).toBe(
      'OWN_ORG_VERIFIED',
    );
    f.orgs.set('own1', ownOrg());
    f.listingCounts.set('own1', 2);
    expect((await post('/api/organisations/claim', 't-rep', { code: claimCode })).body.error.code).toBe(
      'OWN_ORG_HAS_LISTINGS',
    );
    expect(f.orgs.get('own1')).toBeDefined(); // nothing was lost
    expect(f.orgs.get(id)!.claimStatus).toBe('unclaimed');
    f.listingCounts.set('own1', 0);
    f.orgClaims.set(id, { ...f.orgClaims.get(id)!, expiresAt: '2020-01-01T00:00:00.000Z' });
    const expired = await post('/api/organisations/claim', 't-rep', { code: claimCode });
    expect(expired.status).toBe(410);
    expect(expired.body.error.code).toBe('CODE_EXPIRED');
  });

  describe('verification', () => {
    const claimed = () => {
      f.orgs.set('verif1', {
        name: 'Soweto High School',
        type: 'school',
        ownerUid: 'rep',
        verified: false,
        claimStatus: 'claimed',
        source: 'staff_import',
        createdAt: 't',
        updatedAt: 't',
      });
      f.entries.set('rep', {
        uid: 'rep',
        role: 'organisation',
        displayName: 'Soweto High School',
        sports: [],
        province: 'Gauteng',
        city: 'Soweto',
        headline: null,
        tags: [],
        orgId: 'verif1',
        verified: false,
        claimed: true,
        updatedAt: 't',
      });
      f.orgListings.set('l1', { orgId: 'verif1', orgVerified: false });
      f.orgListings.set('l2', { orgId: 'verif1', orgVerified: false });
      f.orgListings.set('other', { orgId: 'someone-else', orgVerified: false });
    };

    it('staff verify an organisation: the organisation, all its listings and its directory entry change together, and nobody else’s do', async () => {
      claimed();
      const r = await post('/api/admin/organisations/verif1/verify', 't-staff', {
        note: 'Phoned the principal; school number matches the DBE list.',
      });
      expect(r.status).toBe(200);
      expect(f.orgs.get('verif1')).toMatchObject({ verified: true });
      expect(f.orgs.get('verif1')!.verifiedAt).toBeTruthy();
      expect(f.orgListings.get('l1')!.orgVerified).toBe(true);
      expect(f.orgListings.get('l2')!.orgVerified).toBe(true);
      expect(f.orgListings.get('other')!.orgVerified).toBe(false);
      expect(f.entries.get('rep')!.verified).toBe(true);
      expect(f.verifications.get('verif1')).toEqual({
        verified: true,
        note: 'Phoned the principal; school number matches the DBE list.',
        decidedBy: 'staff',
      });
      expect(f.audits.at(-1)).toMatchObject({
        type: 'organisation.verified',
        organisationName: 'Soweto High School',
        by: 'staff',
        note: 'Phoned the principal; school number matches the DBE list.',
      });
    });

    it('tells the owner, without revealing the staff note', async () => {
      claimed();
      await post('/api/admin/organisations/verif1/verify', 't-staff', { note: 'internal remark' });
      const n = f.sent.filter((s) => s.uid === 'rep').at(-1)!.notification;
      expect(n).toMatchObject({
        type: 'organisation.verification',
        title: 'Your organisation is now verified',
        link: '/app/profile',
      });
      expect(JSON.stringify(n)).not.toContain('internal remark');
    });

    it('removing verification reverses everything it changed', async () => {
      claimed();
      await post('/api/admin/organisations/verif1/verify', 't-staff');
      expect(
        (
          await post('/api/admin/organisations/verif1/unverify', 't-staff', {
            note: 'Contact details could not be confirmed.',
          })
        ).status,
      ).toBe(200);
      expect(f.orgs.get('verif1')).toMatchObject({ verified: false, verifiedAt: null });
      expect(f.orgListings.get('l1')!.orgVerified).toBe(false);
      expect(f.entries.get('rep')!.verified).toBe(false);
      expect(f.sent.filter((s) => s.uid === 'rep').at(-1)!.notification.title).toBe('Verification removed');
      expect(f.audits.at(-1)).toMatchObject({ type: 'organisation.unverified' });
    });

    it('only staff can verify', async () => {
      claimed();
      for (const t of ['t-rep', 't-athlete']) {
        expect((await post('/api/admin/organisations/verif1/verify', t)).status).toBe(403);
        expect((await post('/api/admin/organisations/verif1/unverify', t)).status).toBe(403);
      }
      expect((await request(app).post('/api/admin/organisations/verif1/verify')).status).toBe(401);
      expect(f.orgs.get('verif1')!.verified).toBe(false);
    });

    it('refuses organisations nobody has claimed, repeats, missing organisations and over-long notes', async () => {
      const { id } = await addSchool();
      expect((await post(`/api/admin/organisations/${id}/verify`, 't-staff')).body.error.code).toBe(
        'UNCLAIMED',
      );
      claimed();
      expect((await post('/api/admin/organisations/verif1/unverify', 't-staff')).body.error.code).toBe(
        'NOT_VERIFIED',
      );
      expect(
        (await post('/api/admin/organisations/verif1/verify', 't-staff', { note: 'x'.repeat(301) })).status,
      ).toBe(400);
      await post('/api/admin/organisations/verif1/verify', 't-staff');
      expect((await post('/api/admin/organisations/verif1/verify', 't-staff')).body.error.code).toBe(
        'ALREADY_VERIFIED',
      );
      expect((await post('/api/admin/organisations/nosuchorg/verify', 't-staff')).status).toBe(404);
      expect((await post('/api/admin/organisations/bad$id/verify', 't-staff')).status).toBe(400);
    });
  });
});
