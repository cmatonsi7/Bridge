/**
 * Firestore and Storage security-rules tests. Requires Java and the Firebase emulators:
 *   npm run test:rules
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
  type RulesTestEnvironment,
} from '@firebase/rules-unit-testing';
import {
  doc,
  getDoc,
  setDoc,
  updateDoc,
  deleteDoc,
  collection,
  getDocs,
  query,
  where,
  orderBy,
  limit,
  getCountFromServer,
  type Firestore,
} from 'firebase/firestore';
import { deleteObject, getMetadata, ref, uploadString } from 'firebase/storage';

let env: RulesTestEnvironment;

const now = '2026-11-02T00:00:00.000Z';
const user = (uid: string, extra: Record<string, unknown> = {}) => ({
  uid,
  email: `${uid}@example.com`,
  firstName: 'A',
  surname: 'B',
  displayName: 'A B',
  role: 'athlete',
  status: 'active',
  isMinor: false,
  onboardingComplete: true,
  termsVersion: 'v',
  termsAcceptedAt: now,
  createdAt: now,
  updatedAt: now,
  ...extra,
});

beforeAll(async () => {
  env = await initializeTestEnvironment({
    projectId: 'demo-sportbridge',
    firestore: { rules: readFileSync(resolve(__dirname, 'firestore.rules'), 'utf8') },
    storage: { rules: readFileSync(resolve(__dirname, 'storage.rules'), 'utf8') },
  });
});
afterAll(async () => env?.cleanup());

beforeEach(async () => {
  await env.clearFirestore();
  await env.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore();
    await setDoc(doc(db, 'users/alice'), user('alice'));
    await setDoc(doc(db, 'users/alice/private/details'), { dateOfBirth: '2000-01-01', mobile: '0820000000' });
    await setDoc(doc(db, 'users/teen'), user('teen', { isMinor: true, status: 'restricted' }));
    await setDoc(doc(db, 'users/bob'), user('bob', { role: 'coach' }));
    await setDoc(doc(db, 'athleteProfiles/alice'), {
      uid: 'alice',
      displayName: 'A B',
      visibility: 'members',
      createdAt: now,
      updatedAt: now,
    });
    await setDoc(doc(db, 'athleteProfiles/teen'), {
      uid: 'teen',
      displayName: 'T',
      visibility: 'private',
      createdAt: now,
      updatedAt: now,
    });
    await setDoc(doc(db, 'organisations/org1'), {
      name: 'Soweto FC',
      type: 'club',
      ownerUid: 'bob',
      verified: false,
      createdAt: now,
      updatedAt: now,
    });
    await setDoc(doc(db, 'guardianLinks/l1'), {
      athleteUid: 'teen',
      guardianEmail: 'mom@example.com',
      guardianUid: null,
      status: 'pending',
    });
    await setDoc(doc(db, 'auditLogs/a1'), { type: 'x' });
  });
});

// Reuse one Firestore client per identity instead of minting a new
// Firebase app on every call. Each test still gets a clean slate via
// env.clearFirestore() in beforeEach — this only avoids piling up
// hundreds of live, never-torn-down client instances across a run this
// size, which is what was tripping "Firestore has already been started
// and its settings can no longer be changed" late in the suite.
const dbCache = new Map<string, Firestore>();
const as = (uid: string, claims: Record<string, unknown> = {}) => {
  const key = `${uid}:${JSON.stringify(claims)}`;
  let db = dbCache.get(key);
  if (!db) {
    db = env.authenticatedContext(uid, claims).firestore();
    dbCache.set(key, db);
  }
  return db;
};
let anonDb: Firestore | undefined;
const anon = () => (anonDb ??= env.unauthenticatedContext().firestore());

describe('users', () => {
  it('owner can read own doc; others and anonymous cannot', async () => {
    await assertSucceeds(getDoc(doc(as('alice', { role: 'athlete' }), 'users/alice')));
    await assertFails(getDoc(doc(as('bob', { role: 'coach' }), 'users/alice')));
    await assertFails(getDoc(doc(anon(), 'users/alice')));
  });
  it('admin can read any user', async () => {
    await assertSucceeds(getDoc(doc(as('root', { role: 'admin', admin: true }), 'users/alice')));
  });
  it('a role claim of "admin" without admin:true grants nothing', async () => {
    await assertFails(getDoc(doc(as('mallory', { role: 'admin' }), 'users/alice')));
  });
  it('clients cannot create user docs (onboarding is server-side)', async () => {
    await assertFails(setDoc(doc(as('eve'), 'users/eve'), user('eve')));
  });
  it('owner may edit their name only', async () => {
    const db = as('alice', { role: 'athlete' });
    await assertSucceeds(
      updateDoc(doc(db, 'users/alice'), { firstName: 'Ali', displayName: 'Ali B', updatedAt: now }),
    );
    await assertFails(updateDoc(doc(db, 'users/alice'), { role: 'organisation' }));
    // A real change is needed here: alice is already 'active', so writing 'active' would change nothing.
    await assertFails(updateDoc(doc(db, 'users/alice'), { status: 'suspended' }));
    // A restricted child must not be able to lift their own restriction (only a confirming parent can, server-side).
    await assertFails(updateDoc(doc(as('teen', { role: 'athlete' }), 'users/teen'), { status: 'active' }));
    await assertFails(updateDoc(doc(as('teen', { role: 'athlete' }), 'users/teen'), { isMinor: false }));
    await assertFails(updateDoc(doc(db, 'users/alice'), { firstName: '' }));
  });
  it('nobody can delete a user doc from the client', async () => {
    await assertFails(deleteDoc(doc(as('alice', { role: 'athlete' }), 'users/alice')));
  });
  it('private details are owner/admin read-only', async () => {
    await assertSucceeds(getDoc(doc(as('alice'), 'users/alice/private/details')));
    await assertFails(getDoc(doc(as('bob'), 'users/alice/private/details')));
    await assertFails(
      setDoc(doc(as('alice'), 'users/alice/private/details'), { dateOfBirth: '2015-01-01', mobile: '1' }),
    );
  });
});

describe('role profiles', () => {
  it('adult can change visibility; minor cannot', async () => {
    await assertSucceeds(updateDoc(doc(as('alice'), 'athleteProfiles/alice'), { visibility: 'public' }));
    await assertFails(updateDoc(doc(as('teen'), 'athleteProfiles/teen'), { visibility: 'public' }));
  });
  it("cannot write another user's profile or change uid", async () => {
    await assertFails(updateDoc(doc(as('bob'), 'athleteProfiles/alice'), { displayName: 'x' }));
    await assertFails(updateDoc(doc(as('alice'), 'athleteProfiles/alice'), { uid: 'bob' }));
  });
});

describe('organisations', () => {
  it('owner can edit name but not ownership or verification', async () => {
    const db = as('bob', { role: 'organisation' });
    await assertSucceeds(updateDoc(doc(db, 'organisations/org1'), { name: 'Soweto FC Juniors' }));
    await assertFails(updateDoc(doc(db, 'organisations/org1'), { verified: true }));
    await assertFails(updateDoc(doc(db, 'organisations/org1'), { ownerUid: 'alice' }));
    await assertFails(updateDoc(doc(as('alice'), 'organisations/org1'), { name: 'Hijack' }));
  });
});

describe('guardian links, audit log, unknown collections', () => {
  it('athlete sees own guardian link; others do not; nobody writes', async () => {
    await assertSucceeds(getDoc(doc(as('teen'), 'guardianLinks/l1')));
    await assertFails(getDoc(doc(as('alice'), 'guardianLinks/l1')));
    await assertFails(updateDoc(doc(as('teen'), 'guardianLinks/l1'), { status: 'verified' }));
  });
  it('audit log is admin-read only', async () => {
    await assertFails(getDocs(collection(as('alice'), 'auditLogs')));
    await assertSucceeds(getDocs(collection(as('root', { admin: true, role: 'admin' }), 'auditLogs')));
  });
  it('collections without rules are denied (memberships, payments)', async () => {
    await assertFails(setDoc(doc(as('alice'), 'memberships/alice'), { plan: 'pro', status: 'active' }));
    await assertFails(getDoc(doc(as('alice'), 'payments/p1')));
  });
});

describe('storage', () => {
  const pdf = { contentType: 'application/pdf' };

  it('denies uploads to any path that is not a coach credential', async () => {
    const s = env.authenticatedContext('alice').storage();
    await assertFails(uploadString(ref(s, 'users/alice/avatar.png'), 'x'));
    await assertFails(uploadString(ref(s, 'anything/else.pdf'), 'x', 'raw', pdf));
  });

  it('lets a coach upload their own credential document (Phase 5b)', async () => {
    const s = env.authenticatedContext('bob').storage();
    await assertSucceeds(uploadString(ref(s, 'coachCredentials/bob/doc1'), 'x', 'raw', pdf));
    await assertSucceeds(
      uploadString(ref(s, 'coachCredentials/bob/doc2'), 'x', 'raw', { contentType: 'image/png' }),
    );
  });

  it('refuses a file type nobody can review, and anything over 5 MB', async () => {
    const s = env.authenticatedContext('bob').storage();
    await assertFails(
      uploadString(ref(s, 'coachCredentials/bob/bad'), 'x', 'raw', { contentType: 'application/zip' }),
    );
    // uploadString sends text/plain by default, which is not on the list either.
    await assertFails(uploadString(ref(s, 'coachCredentials/bob/plain'), 'x'));
    const big = 'x'.repeat(5 * 1024 * 1024 + 10);
    await assertFails(uploadString(ref(s, 'coachCredentials/bob/big'), big, 'raw', pdf));
  });

  it('keeps one coach out of another coach’s documents entirely', async () => {
    const other = env.authenticatedContext('alice').storage();
    await assertFails(uploadString(ref(other, 'coachCredentials/bob/doc1'), 'x', 'raw', pdf));
    await assertFails(getMetadata(ref(other, 'coachCredentials/bob/doc1')));
    await assertFails(getMetadata(ref(env.unauthenticatedContext().storage(), 'coachCredentials/bob/doc1')));
  });

  it('never lets anyone delete a credential file from the browser', async () => {
    const s = env.authenticatedContext('bob').storage();
    await uploadString(ref(s, 'coachCredentials/bob/doc1'), 'x', 'raw', pdf);
    await assertFails(deleteObject(ref(s, 'coachCredentials/bob/doc1')));
  });
});

describe('athlete profile fields (Phase 2a)', () => {
  const db = () => as('alice', { role: 'athlete' });
  it('accepts values from the fixed lists', async () => {
    await assertSucceeds(
      updateDoc(doc(db(), 'athleteProfiles/alice'), {
        sport: 'Football',
        position: 'Midfielder',
        province: 'Gauteng',
        experienceYears: 4,
        skills: ['Teamwork', 'Leadership'],
        interests: ['Football', 'Sports Science'],
        privacy: { discoverable: true, showAchievements: false, allowEnquiries: false },
        updatedAt: now,
      }),
    );
  });
  it('rejects values outside the fixed lists', async () => {
    await assertFails(updateDoc(doc(db(), 'athleteProfiles/alice'), { sport: 'Quidditch', updatedAt: now }));
    await assertFails(
      updateDoc(doc(db(), 'athleteProfiles/alice'), { skills: ['Juggling'], updatedAt: now }),
    );
    await assertFails(
      updateDoc(doc(db(), 'athleteProfiles/alice'), { province: 'Atlantis', updatedAt: now }),
    );
  });
  it('rejects unknown fields and bad types', async () => {
    await assertFails(updateDoc(doc(db(), 'athleteProfiles/alice'), { verified: true, updatedAt: now }));
    await assertFails(
      updateDoc(doc(db(), 'athleteProfiles/alice'), { experienceYears: 'four', updatedAt: now }),
    );
    await assertFails(
      updateDoc(doc(db(), 'athleteProfiles/alice'), { bio: 'x'.repeat(601), updatedAt: now }),
    );
  });
  it('lets the owner manage achievements, nobody else', async () => {
    const a = {
      title: 'District Champions',
      year: 2025,
      organisation: 'Soweto FC',
      detail: null,
      createdAt: now,
      updatedAt: now,
    };
    await assertSucceeds(setDoc(doc(db(), 'athleteProfiles/alice/achievements/a1'), a));
    await assertSucceeds(getDoc(doc(db(), 'athleteProfiles/alice/achievements/a1')));
    await assertFails(getDoc(doc(as('bob'), 'athleteProfiles/alice/achievements/a1')));
    await assertFails(setDoc(doc(as('bob'), 'athleteProfiles/alice/achievements/a2'), a));
    await assertFails(setDoc(doc(db(), 'athleteProfiles/alice/achievements/a3'), { ...a, title: '' }));
    await assertFails(setDoc(doc(db(), 'athleteProfiles/alice/achievements/a4'), { ...a, featured: true }));
    await assertSucceeds(deleteDoc(doc(db(), 'athleteProfiles/alice/achievements/a1')));
  });
  it('lets the owner change their mobile but never their date of birth', async () => {
    await assertSucceeds(updateDoc(doc(db(), 'users/alice/private/details'), { mobile: '+27821234567' }));
    await assertFails(updateDoc(doc(db(), 'users/alice/private/details'), { mobile: 'not a number' }));
    await assertFails(updateDoc(doc(db(), 'users/alice/private/details'), { dateOfBirth: '2015-01-01' }));
  });
});

describe('guardians (Phase 2b)', () => {
  beforeEach(async () => {
    await env.withSecurityRulesDisabled(async (ctx) => {
      const db = ctx.firestore();
      await setDoc(doc(db, 'guardianLinks/l2'), {
        athleteUid: 'teen',
        athleteName: 'T',
        guardianEmail: 'dad@example.com',
        guardianUid: null,
        status: 'pending',
      });
      await setDoc(doc(db, 'users/teen2'), user('teen2', { isMinor: true, guardianUids: ['mom'] }));
      await setDoc(doc(db, 'athleteProfiles/teen2'), {
        uid: 'teen2',
        displayName: 'T2',
        visibility: 'private',
        createdAt: now,
        updatedAt: now,
      });
      await setDoc(doc(db, 'athleteProfiles/teen2/achievements/a1'), {
        title: 'Champs',
        year: 2025,
        organisation: null,
        detail: null,
        createdAt: now,
        updatedAt: now,
      });
    });
  });
  const dad = (verified: boolean) =>
    as('dad', { role: 'guardian', email: 'Dad@Example.com', email_verified: verified });

  it('a parent sees requests addressed to their verified email only', async () => {
    await assertSucceeds(getDoc(doc(dad(true), 'guardianLinks/l2')));
    await assertFails(getDoc(doc(dad(false), 'guardianLinks/l2')));
    await assertFails(
      getDoc(
        doc(as('x', { role: 'guardian', email: 'x@example.com', email_verified: true }), 'guardianLinks/l2'),
      ),
    );
  });
  it('a parent cannot answer a request from the browser', async () => {
    await assertFails(
      updateDoc(doc(dad(true), 'guardianLinks/l2'), { status: 'verified', guardianUid: 'dad' }),
    );
  });
  it('a verified guardian can read the child profile and achievements but not edit them', async () => {
    const mom = as('mom', { role: 'guardian' });
    await assertSucceeds(getDoc(doc(mom, 'users/teen2')));
    await assertSucceeds(getDoc(doc(mom, 'athleteProfiles/teen2')));
    await assertSucceeds(getDoc(doc(mom, 'athleteProfiles/teen2/achievements/a1')));
    await assertFails(updateDoc(doc(mom, 'athleteProfiles/teen2'), { bio: 'x', updatedAt: now }));
    await assertFails(getDoc(doc(mom, 'users/teen2/private/details')));
  });
  it('an unlinked guardian cannot read the child', async () => {
    await assertFails(getDoc(doc(as('dad', { role: 'guardian' }), 'athleteProfiles/teen2')));
  });
});

describe('coach profiles (Phase 2c)', () => {
  beforeEach(async () => {
    await env.withSecurityRulesDisabled(async (ctx) => {
      const db = ctx.firestore();
      await setDoc(doc(db, 'users/coach1'), user('coach1', { role: 'coach' }));
      await setDoc(doc(db, 'coachProfiles/coach1'), {
        uid: 'coach1',
        displayName: 'C',
        visibility: 'members',
        createdAt: now,
        updatedAt: now,
      });
    });
  });
  const coach = () => as('coach1', { role: 'coach' });
  it('accepts values from the fixed lists', async () => {
    await assertSucceeds(
      updateDoc(doc(coach(), 'coachProfiles/coach1'), {
        sports: ['Football'],
        coachingLevel: 'Club',
        province: 'Gauteng',
        experienceYears: 8,
        specialisations: ['Youth Development'],
        services: ['Group Sessions'],
        ageGroups: ['Under 16'],
        updatedAt: now,
      }),
    );
  });
  it('rejects values outside the lists and unknown fields', async () => {
    await assertFails(
      updateDoc(doc(coach(), 'coachProfiles/coach1'), { coachingLevel: 'Galactic', updatedAt: now }),
    );
    await assertFails(
      updateDoc(doc(coach(), 'coachProfiles/coach1'), { services: ['Babysitting'], updatedAt: now }),
    );
    await assertFails(updateDoc(doc(coach(), 'coachProfiles/coach1'), { verified: true, updatedAt: now }));
  });
  it('lets the coach manage their own qualifications, nobody else', async () => {
    const q = { title: 'SAFA C Licence', issuer: 'SAFA', year: 2022, createdAt: now, updatedAt: now };
    await assertSucceeds(setDoc(doc(coach(), 'coachProfiles/coach1/qualifications/q1'), q));
    await assertFails(setDoc(doc(as('alice'), 'coachProfiles/coach1/qualifications/q2'), q));
    await assertFails(
      setDoc(doc(coach(), 'coachProfiles/coach1/qualifications/q3'), { ...q, verified: true }),
    );
    await assertFails(getDoc(doc(as('alice'), 'coachProfiles/coach1/qualifications/q1')));
  });
});

describe('organisation profiles (Phase 2d)', () => {
  const owner = () => as('bob', { role: 'organisation' });
  it('accepts a valid profile from the fixed lists', async () => {
    await assertSucceeds(
      updateDoc(doc(owner(), 'organisations/org1'), {
        description: 'Community football club.',
        contactEmail: 'info@sowetofc.co.za',
        contactPhone: '0111234567',
        website: 'https://sowetofc.co.za',
        province: 'Gauteng',
        sports: ['Football'],
        ageGroups: ['Under 16'],
        offerings: ['Trials'],
        facilities: ['Grass Field'],
        privacy: { listed: true, showContactDetails: false, acceptEnquiries: true },
        updatedAt: now,
      }),
    );
  });
  it('rejects bad contact details and values outside the lists', async () => {
    await assertFails(
      updateDoc(doc(owner(), 'organisations/org1'), { contactEmail: 'nope', updatedAt: now }),
    );
    await assertFails(
      updateDoc(doc(owner(), 'organisations/org1'), { website: 'javascript:alert(1)', updatedAt: now }),
    );
    await assertFails(
      updateDoc(doc(owner(), 'organisations/org1'), { facilities: ['Helipad'], updatedAt: now }),
    );
    await assertFails(updateDoc(doc(owner(), 'organisations/org1'), { type: 'cartel', updatedAt: now }));
  });
  it('never lets the owner verify themselves or hand over ownership', async () => {
    await assertFails(updateDoc(doc(owner(), 'organisations/org1'), { verified: true, updatedAt: now }));
    await assertFails(updateDoc(doc(owner(), 'organisations/org1'), { ownerUid: 'alice', updatedAt: now }));
  });
});

describe('listings (Phase 3a)', () => {
  const listing = (over: Record<string, unknown> = {}) => ({
    kind: 'opportunity',
    type: 'Trial',
    title: 'U17 Trials',
    description: 'Open trials for the U17 provincial squad.',
    sports: ['Football'],
    province: 'Gauteng',
    city: 'Soweto',
    ageMin: 14,
    ageMax: 17,
    deadline: '2030-01-31',
    startDate: null,
    endDate: null,
    isFree: true,
    priceZar: null,
    inclusions: [],
    status: 'published',
    orgId: 'org1',
    ownerUid: 'bob',
    orgName: 'Soweto FC',
    orgVerified: false,
    createdAt: now,
    updatedAt: now,
    publishedAt: now,
    ...over,
  });
  beforeEach(async () => {
    await env.withSecurityRulesDisabled(async (ctx) => {
      const db = ctx.firestore();
      await setDoc(doc(db, 'users/bob'), user('bob', { role: 'organisation', organisationId: 'org1' }));
      await setDoc(doc(db, 'listings/pub'), listing());
      await setDoc(doc(db, 'listings/draft'), listing({ status: 'draft' }));
    });
  });
  const owner = () => as('bob', { role: 'organisation' });

  it('anyone, even signed out, reads published listings; drafts only by the owner', async () => {
    await assertSucceeds(getDoc(doc(anon(), 'listings/pub')));
    await assertFails(getDoc(doc(anon(), 'listings/draft')));
    await assertFails(getDoc(doc(as('alice'), 'listings/draft')));
    await assertSucceeds(getDoc(doc(owner(), 'listings/draft')));
  });
  it('the organisation owner can create a valid listing for their own organisation', async () => {
    await assertSucceeds(setDoc(doc(owner(), 'listings/new1'), listing()));
  });
  it('rejects a faked verified badge, a wrong organisation, non-organisations and bad data', async () => {
    await assertFails(setDoc(doc(owner(), 'listings/n2'), listing({ orgVerified: true })));
    await assertFails(setDoc(doc(owner(), 'listings/n3'), listing({ orgName: 'Kaizer Chiefs' })));
    await assertFails(setDoc(doc(owner(), 'listings/n4'), listing({ orgId: 'someone-else' })));
    await assertFails(
      setDoc(doc(as('alice', { role: 'athlete' }), 'listings/n5'), listing({ ownerUid: 'alice' })),
    );
    await assertFails(setDoc(doc(owner(), 'listings/n6'), listing({ ageMin: 18, ageMax: 10 })));
    await assertFails(setDoc(doc(owner(), 'listings/n7'), listing({ isFree: false, priceZar: null })));
    await assertFails(setDoc(doc(owner(), 'listings/n8'), listing({ type: 'Raffle' })));
  });
  it('owner can close a listing but not reassign it; only drafts can be deleted', async () => {
    await assertSucceeds(updateDoc(doc(owner(), 'listings/pub'), { status: 'closed', updatedAt: now }));
    await assertFails(updateDoc(doc(owner(), 'listings/pub'), { orgId: 'org2', updatedAt: now }));
    await assertFails(updateDoc(doc(as('alice'), 'listings/pub'), { title: 'Hijacked', updatedAt: now }));
    await assertFails(deleteDoc(doc(owner(), 'listings/pub')));
    await assertSucceeds(deleteDoc(doc(owner(), 'listings/draft')));
  });
  it('members manage only their own saved shortlist', async () => {
    const saved = { listingId: 'pub', kind: 'opportunity', title: 'U17 Trials', savedAt: now };
    await assertSucceeds(setDoc(doc(as('alice'), 'users/alice/saved/pub'), saved));
    await assertSucceeds(getDoc(doc(as('alice'), 'users/alice/saved/pub')));
    await assertFails(getDoc(doc(as('bob'), 'users/alice/saved/pub')));
    await assertFails(setDoc(doc(as('bob'), 'users/alice/saved/x'), { ...saved, listingId: 'x' }));
    await assertSucceeds(deleteDoc(doc(as('alice'), 'users/alice/saved/pub')));
  });
});

describe('applications and notifications (Phase 3b)', () => {
  const application = {
    listingId: 'L1',
    listingTitle: 'U17 Trials',
    listingKind: 'opportunity',
    orgId: 'org1',
    orgName: 'Soweto FC',
    ownerUid: 'bob',
    applicantUid: 'teen2',
    applicantIsMinor: true,
    status: 'submitted',
    note: null,
    orgMessage: null,
    snapshot: { displayName: 'T', age: 15, isMinor: true },
    history: [],
    createdAt: now,
    updatedAt: now,
  };
  beforeEach(async () => {
    await env.withSecurityRulesDisabled(async (ctx) => {
      const db = ctx.firestore();
      await setDoc(doc(db, 'users/teen2'), user('teen2', { isMinor: true, guardianUids: ['mom'] }));
      await setDoc(doc(db, 'applications/L1_teen2'), application);
      await setDoc(doc(db, 'users/alice/notifications/n1'), {
        type: 'application.status',
        title: 't',
        body: 'b',
        link: '/app',
        read: false,
        createdAt: now,
      });
    });
  });

  it("the applicant, the listing organisation and the child's verified parent can read it; nobody else", async () => {
    await assertSucceeds(getDoc(doc(as('teen2', { role: 'athlete' }), 'applications/L1_teen2')));
    await assertSucceeds(getDoc(doc(as('bob', { role: 'organisation' }), 'applications/L1_teen2')));
    await assertSucceeds(getDoc(doc(as('mom', { role: 'guardian' }), 'applications/L1_teen2')));
    await assertFails(getDoc(doc(as('alice', { role: 'athlete' }), 'applications/L1_teen2')));
    await assertFails(getDoc(doc(as('other-org', { role: 'organisation' }), 'applications/L1_teen2')));
    await assertFails(getDoc(doc(anon(), 'applications/L1_teen2')));
  });
  it('the list queries the app uses are allowed for the right people', async () => {
    await assertSucceeds(
      getDocs(query(collection(as('teen2'), 'applications'), where('applicantUid', '==', 'teen2'))),
    );
    await assertSucceeds(
      getDocs(query(collection(as('bob'), 'applications'), where('ownerUid', '==', 'bob'))),
    );
    await assertSucceeds(
      getDocs(
        query(
          collection(as('mom', { role: 'guardian' }), 'applications'),
          where('applicantUid', '==', 'teen2'),
        ),
      ),
    );
    await assertFails(
      getDocs(query(collection(as('alice'), 'applications'), where('applicantUid', '==', 'teen2'))),
    );
  });
  it('nobody can create, change or delete applications from the browser', async () => {
    await assertFails(
      setDoc(doc(as('alice', { role: 'athlete' }), 'applications/L1_alice'), {
        ...application,
        applicantUid: 'alice',
      }),
    );
    await assertFails(
      updateDoc(doc(as('bob', { role: 'organisation' }), 'applications/L1_teen2'), { status: 'accepted' }),
    );
    await assertFails(updateDoc(doc(as('teen2'), 'applications/L1_teen2'), { status: 'withdrawn' }));
    await assertFails(deleteDoc(doc(as('bob'), 'applications/L1_teen2')));
  });
  it('people read and mark only their own notifications, and cannot write any', async () => {
    await assertSucceeds(getDoc(doc(as('alice'), 'users/alice/notifications/n1')));
    await assertSucceeds(updateDoc(doc(as('alice'), 'users/alice/notifications/n1'), { read: true }));
    await assertFails(updateDoc(doc(as('alice'), 'users/alice/notifications/n1'), { title: 'changed' }));
    await assertFails(getDoc(doc(as('bob'), 'users/alice/notifications/n1')));
    await assertFails(
      setDoc(doc(as('bob'), 'users/alice/notifications/n2'), {
        type: 'x',
        title: 't',
        body: 'b',
        link: '/',
        read: false,
        createdAt: now,
      }),
    );
  });
});

describe('directory and connections (Phase 3c)', () => {
  beforeEach(async () => {
    await env.withSecurityRulesDisabled(async (ctx) => {
      const db = ctx.firestore();
      await setDoc(doc(db, 'directoryProfiles/adult'), {
        uid: 'adult',
        role: 'athlete',
        displayName: 'A B',
        sports: ['Football'],
        province: 'Gauteng',
        city: 'Soweto',
        headline: null,
        tags: [],
        updatedAt: now,
      });
      await setDoc(doc(db, 'users/teen3'), user('teen3', { isMinor: true, guardianUids: ['mom'] }));
      await setDoc(doc(db, 'connections/coach1_teen3'), {
        coachUid: 'coach1',
        coachName: 'Coach One',
        athleteUid: 'teen3',
        athleteName: 'T',
        athleteIsMinor: true,
        decidedByUid: null,
        decidedByRole: null,
        status: 'pending',
        message: null,
        createdAt: now,
        updatedAt: now,
      });
    });
  });
  it('any signed-in member can search the directory; signed-out visitors cannot', async () => {
    await assertSucceeds(getDoc(doc(as('alice', { role: 'athlete' }), 'directoryProfiles/adult')));
    await assertSucceeds(getDocs(collection(as('bob', { role: 'coach' }), 'directoryProfiles')));
    await assertFails(getDoc(doc(anon(), 'directoryProfiles/adult')));
  });
  it('nobody can add themselves to the directory from the browser', async () => {
    await assertFails(
      setDoc(doc(as('alice'), 'directoryProfiles/alice'), {
        uid: 'alice',
        role: 'athlete',
        displayName: 'A',
        sports: [],
        province: null,
        city: null,
        headline: null,
        tags: [],
        updatedAt: now,
      }),
    );
    await assertFails(deleteDoc(doc(as('alice'), 'directoryProfiles/adult')));
  });
  it("a connection is readable by the coach, the athlete and the child's parent only", async () => {
    await assertSucceeds(getDoc(doc(as('coach1', { role: 'coach' }), 'connections/coach1_teen3')));
    await assertSucceeds(getDoc(doc(as('teen3', { role: 'athlete' }), 'connections/coach1_teen3')));
    await assertSucceeds(getDoc(doc(as('mom', { role: 'guardian' }), 'connections/coach1_teen3')));
    await assertFails(getDoc(doc(as('alice', { role: 'athlete' }), 'connections/coach1_teen3')));
    await assertFails(getDoc(doc(anon(), 'connections/coach1_teen3')));
  });
  it('nobody can accept a connection from the browser, not even the parent', async () => {
    await assertFails(
      updateDoc(doc(as('mom', { role: 'guardian' }), 'connections/coach1_teen3'), { status: 'accepted' }),
    );
    await assertFails(updateDoc(doc(as('teen3'), 'connections/coach1_teen3'), { status: 'accepted' }));
    await assertFails(
      setDoc(doc(as('coach1'), 'connections/coach1_alice'), {
        coachUid: 'coach1',
        athleteUid: 'alice',
        status: 'accepted',
      }),
    );
  });
  it('the list queries the app uses work for coach, athlete and parent', async () => {
    await assertSucceeds(
      getDocs(query(collection(as('coach1'), 'connections'), where('coachUid', '==', 'coach1'))),
    );
    await assertSucceeds(
      getDocs(query(collection(as('teen3'), 'connections'), where('athleteUid', '==', 'teen3'))),
    );
    await assertSucceeds(
      getDocs(
        query(collection(as('mom', { role: 'guardian' }), 'connections'), where('athleteUid', '==', 'teen3')),
      ),
    );
    await assertFails(
      getDocs(query(collection(as('alice'), 'connections'), where('athleteUid', '==', 'teen3'))),
    );
  });
});

describe('directory audience: children see coaches and organisations only (Phase 3c)', () => {
  beforeEach(async () => {
    await env.withSecurityRulesDisabled(async (ctx) => {
      const db = ctx.firestore();
      await setDoc(doc(db, 'users/kid5'), user('kid5', { isMinor: true, guardianUids: ['mom'] }));
      await setDoc(doc(db, 'users/adult5'), user('adult5', { isMinor: false }));
      const base = {
        displayName: 'X',
        sports: ['Football'],
        province: 'Gauteng',
        city: 'Soweto',
        headline: null,
        tags: [],
        updatedAt: now,
      };
      await setDoc(doc(db, 'directoryProfiles/athleteX'), { uid: 'athleteX', role: 'athlete', ...base });
      await setDoc(doc(db, 'directoryProfiles/coachX'), { uid: 'coachX', role: 'coach', ...base });
      await setDoc(doc(db, 'directoryProfiles/orgX'), { uid: 'orgX', role: 'organisation', ...base });
    });
  });
  it('an adult reads any listed profile and an unfiltered list', async () => {
    const adult = as('adult5', { role: 'athlete' });
    await assertSucceeds(getDoc(doc(adult, 'directoryProfiles/athleteX')));
    await assertSucceeds(getDoc(doc(adult, 'directoryProfiles/coachX')));
    await assertSucceeds(getDocs(collection(adult, 'directoryProfiles')));
  });
  it('a child reads coaches and organisations but not other athletes', async () => {
    const kid = as('kid5', { role: 'athlete' });
    await assertSucceeds(getDoc(doc(kid, 'directoryProfiles/coachX')));
    await assertSucceeds(getDoc(doc(kid, 'directoryProfiles/orgX')));
    await assertFails(getDoc(doc(kid, 'directoryProfiles/athleteX')));
  });
  it('a child list must be limited to coaches and organisations', async () => {
    const kid = as('kid5', { role: 'athlete' });
    await assertSucceeds(
      getDocs(query(collection(kid, 'directoryProfiles'), where('role', 'in', ['coach', 'organisation']))),
    );
    await assertFails(getDocs(collection(kid, 'directoryProfiles')));
    await assertFails(getDocs(query(collection(kid, 'directoryProfiles'), where('role', '==', 'athlete'))));
  });
});

describe('organisation onboarding: unclaimed schools and claim codes (Phase 4)', () => {
  beforeEach(async () => {
    await env.withSecurityRulesDisabled(async (ctx) => {
      const db = ctx.firestore();
      await setDoc(doc(db, 'organisations/school1'), {
        name: 'Soweto High School',
        type: 'school',
        ownerUid: null,
        verified: false,
        claimStatus: 'unclaimed',
        source: 'staff_import',
        schoolNumber: '700123456',
        sourceNote: 'list',
        importedBy: 'staff',
        contactEmail: 'office@sowetohigh.edu.za',
        privacy: { listed: true, showContactDetails: false, acceptEnquiries: false },
        createdAt: now,
        updatedAt: now,
      });
      await setDoc(doc(db, 'organisationClaims/school1'), {
        orgId: 'school1',
        codeHash: 'x'.repeat(64),
        createdAt: now,
        createdBy: 'staff',
        expiresAt: now,
      });
      await setDoc(doc(db, 'directoryProfiles/org_school1'), {
        uid: 'org_school1',
        role: 'organisation',
        displayName: 'Soweto High School',
        sports: [],
        province: 'Gauteng',
        city: 'Soweto',
        headline: null,
        tags: [],
        orgId: 'school1',
        verified: false,
        claimed: false,
        updatedAt: now,
      });
      await setDoc(doc(db, 'users/kid6'), user('kid6', { isMinor: true }));
    });
  });
  const staff = () => as('staff', { role: 'admin', admin: true });

  it('claim codes can be read or written by nobody, staff included', async () => {
    for (const c of [staff(), as('bob', { role: 'organisation' }), anon()]) {
      await assertFails(getDoc(doc(c, 'organisationClaims/school1')));
      await assertFails(
        setDoc(doc(c, 'organisationClaims/school1'), { orgId: 'school1', codeHash: 'y'.repeat(64) }),
      );
      await assertFails(deleteDoc(doc(c, 'organisationClaims/school1')));
    }
  });
  it('an unclaimed school is visible to staff only, not to other organisations or visitors', async () => {
    await assertSucceeds(getDoc(doc(staff(), 'organisations/school1')));
    await assertFails(getDoc(doc(as('bob', { role: 'organisation' }), 'organisations/school1')));
    await assertFails(getDoc(doc(anon(), 'organisations/school1')));
  });
  it('nobody can take over a school, edit it, or post listings for it from the browser', async () => {
    const bob = as('bob', { role: 'organisation' });
    await assertFails(updateDoc(doc(bob, 'organisations/school1'), { ownerUid: 'bob', updatedAt: now }));
    await assertFails(
      updateDoc(doc(bob, 'organisations/school1'), { description: 'mine now', updatedAt: now }),
    );
    await assertFails(updateDoc(doc(staff(), 'organisations/school1'), { verified: true, updatedAt: now }));
    await assertFails(
      setDoc(doc(bob, 'listings/hijack'), {
        kind: 'opportunity',
        type: 'Trial',
        title: 'Trials',
        description: 'x'.repeat(30),
        sports: ['Football'],
        province: 'Gauteng',
        city: 'Soweto',
        ageMin: 14,
        ageMax: 17,
        deadline: '2030-01-01',
        startDate: null,
        endDate: null,
        isFree: true,
        priceZar: null,
        inclusions: [],
        status: 'published',
        orgId: 'school1',
        ownerUid: 'bob',
        orgName: 'Soweto High School',
        orgVerified: false,
        createdAt: now,
        updatedAt: now,
        publishedAt: now,
      }),
    );
  });
  it('the directory shows the unclaimed school to everyone, signed in or not, children included', async () => {
    await assertSucceeds(getDoc(doc(as('alice', { role: 'athlete' }), 'directoryProfiles/org_school1')));
    await assertSucceeds(getDoc(doc(as('kid6', { role: 'athlete' }), 'directoryProfiles/org_school1')));
    // organisations are public now (Phase 4 public pages): a visitor can see an organisation's entry
    await assertSucceeds(getDoc(doc(anon(), 'directoryProfiles/org_school1')));
  });
  it('once claimed, the owner edits their profile but cannot change the claim fields', async () => {
    await env.withSecurityRulesDisabled(async (ctx) => {
      await updateDoc(doc(ctx.firestore(), 'organisations/school1'), {
        ownerUid: 'bob',
        claimStatus: 'claimed',
      });
    });
    const bob = as('bob', { role: 'organisation' });
    await assertSucceeds(
      updateDoc(doc(bob, 'organisations/school1'), { description: 'Our school.', updatedAt: now }),
    );
    await assertFails(
      updateDoc(doc(bob, 'organisations/school1'), { claimStatus: 'unclaimed', updatedAt: now }),
    );
    await assertFails(
      updateDoc(doc(bob, 'organisations/school1'), { source: 'self_registered', updatedAt: now }),
    );
    await assertFails(updateDoc(doc(bob, 'organisations/school1'), { verified: true, updatedAt: now }));
  });
});

describe('admin dashboard reads (Phase 4)', () => {
  beforeEach(async () => {
    await env.withSecurityRulesDisabled(async (ctx) => {
      const db = ctx.firestore();
      await setDoc(doc(db, 'organisations/orgA'), {
        name: 'Org A',
        type: 'club',
        ownerUid: 'bob',
        verified: false,
        claimStatus: 'claimed',
        source: 'self_registered',
        createdAt: now,
        updatedAt: now,
      });
      await setDoc(doc(db, 'applications/L1_alice'), {
        listingId: 'L1',
        applicantUid: 'alice',
        ownerUid: 'bob',
        status: 'submitted',
        createdAt: now,
        updatedAt: now,
      });
      await setDoc(doc(db, 'auditLogs/a1'), {
        type: 'organisation.imported',
        organisationName: 'Org A',
        by: 'staff',
        at: now,
      });
    });
  });
  const staff = () => as('staff', { role: 'admin', admin: true });

  it('staff can count accounts, organisations and applications for the Overview', async () => {
    await assertSucceeds(
      getCountFromServer(query(collection(staff(), 'users'), where('role', '==', 'athlete'))),
    );
    await assertSucceeds(
      getCountFromServer(
        query(collection(staff(), 'organisations'), where('claimStatus', '==', 'unclaimed')),
      ),
    );
    await assertSucceeds(
      getCountFromServer(query(collection(staff(), 'organisations'), where('verified', '==', false))),
    );
    await assertSucceeds(
      getCountFromServer(query(collection(staff(), 'applications'), where('createdAt', '>=', '2026-01-01'))),
    );
  });
  it('nobody else can count accounts, organisations or applications', async () => {
    const alice = as('alice', { role: 'athlete' });
    const bob = as('bob', { role: 'organisation' });
    await assertFails(getCountFromServer(query(collection(alice, 'users'), where('role', '==', 'athlete'))));
    await assertFails(
      getCountFromServer(query(collection(bob, 'organisations'), where('verified', '==', false))),
    );
    await assertFails(
      getCountFromServer(query(collection(alice, 'applications'), where('createdAt', '>=', '2026-01-01'))),
    );
    await assertFails(getCountFromServer(query(collection(anon(), 'users'), where('role', '==', 'athlete'))));
  });
  it('staff can read the activity log, newest first; nobody else can', async () => {
    await assertSucceeds(getDocs(query(collection(staff(), 'auditLogs'), orderBy('at', 'desc'), limit(300))));
    await assertFails(
      getDocs(
        query(collection(as('alice', { role: 'athlete' }), 'auditLogs'), orderBy('at', 'desc'), limit(300)),
      ),
    );
    await assertFails(
      getDocs(
        query(
          collection(as('bob', { role: 'organisation' }), 'auditLogs'),
          orderBy('at', 'desc'),
          limit(300),
        ),
      ),
    );
  });
  it('staff can list the organisations they added, and nobody can edit the log', async () => {
    await assertSucceeds(
      getDocs(query(collection(staff(), 'organisations'), where('source', '==', 'staff_import'), limit(500))),
    );
    await assertFails(
      setDoc(doc(staff(), 'auditLogs/forged'), { type: 'organisation.imported', by: 'staff', at: now }),
    );
    await assertFails(deleteDoc(doc(staff(), 'auditLogs/a1')));
  });
});

describe('verification (Phase 4)', () => {
  beforeEach(async () => {
    await env.withSecurityRulesDisabled(async (ctx) => {
      const db = ctx.firestore();
      await setDoc(doc(db, 'organisations/vorg'), {
        name: 'Verified FC',
        type: 'club',
        ownerUid: 'bob',
        verified: true,
        verifiedAt: now,
        claimStatus: 'claimed',
        createdAt: now,
        updatedAt: now,
      });
      await setDoc(doc(db, 'organisationVerifications/vorg'), {
        orgId: 'vorg',
        verified: true,
        decidedBy: 'staff',
        decidedAt: now,
        note: 'internal note',
      });
    });
  });
  const staff = () => as('staff', { role: 'admin', admin: true });

  it('staff read the verification record and its internal note; the organisation cannot', async () => {
    await assertSucceeds(getDoc(doc(staff(), 'organisationVerifications/vorg')));
    await assertFails(getDoc(doc(as('bob', { role: 'organisation' }), 'organisationVerifications/vorg')));
    await assertFails(getDoc(doc(as('alice', { role: 'athlete' }), 'organisationVerifications/vorg')));
    await assertFails(getDoc(doc(anon(), 'organisationVerifications/vorg')));
  });
  it('nobody can write a verification record from a browser, staff included', async () => {
    await assertFails(
      setDoc(doc(staff(), 'organisationVerifications/vorg'), {
        orgId: 'vorg',
        verified: false,
        decidedBy: 'staff',
        decidedAt: now,
        note: null,
      }),
    );
    await assertFails(
      setDoc(doc(as('bob', { role: 'organisation' }), 'organisationVerifications/mine'), {
        orgId: 'mine',
        verified: true,
        decidedBy: 'bob',
        decidedAt: now,
        note: null,
      }),
    );
    await assertFails(deleteDoc(doc(staff(), 'organisationVerifications/vorg')));
  });
  it('an owner cannot change their own badge or its date', async () => {
    const bob = as('bob', { role: 'organisation' });
    await assertFails(updateDoc(doc(bob, 'organisations/vorg'), { verified: false, updatedAt: now }));
    await assertFails(
      updateDoc(doc(bob, 'organisations/vorg'), { verifiedAt: '2030-01-01T00:00:00.000Z', updatedAt: now }),
    );
    await assertSucceeds(
      updateDoc(doc(bob, 'organisations/vorg'), { description: 'Updated by the owner.', updatedAt: now }),
    );
  });
  it('staff cannot change the badge from a browser either: it only happens through the server', async () => {
    await assertFails(updateDoc(doc(staff(), 'organisations/vorg'), { verified: false, updatedAt: now }));
  });
});

describe('spreadsheet import records (Phase 4)', () => {
  beforeEach(async () => {
    await env.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), 'importBatches/b1'), {
        createdAt: now,
        createdBy: 'staff',
        sourceNote: 'list',
        fileName: 'schools.csv',
        rowCount: 3,
        createdCount: 2,
        skippedCount: 1,
        status: 'active',
        orgIds: ['o1', 'o2'],
      });
    });
  });
  const staff = () => as('staff', { role: 'admin', admin: true });

  it('staff can read and list import batches; nobody else can', async () => {
    await assertSucceeds(getDoc(doc(staff(), 'importBatches/b1')));
    await assertSucceeds(
      getDocs(query(collection(staff(), 'importBatches'), orderBy('createdAt', 'desc'), limit(20))),
    );
    await assertFails(getDoc(doc(as('bob', { role: 'organisation' }), 'importBatches/b1')));
    await assertFails(
      getDocs(
        query(
          collection(as('alice', { role: 'athlete' }), 'importBatches'),
          orderBy('createdAt', 'desc'),
          limit(20),
        ),
      ),
    );
    await assertFails(getDoc(doc(anon(), 'importBatches/b1')));
  });
  it('nobody can write an import batch from a browser, staff included', async () => {
    await assertFails(
      setDoc(doc(staff(), 'importBatches/forged'), {
        createdAt: now,
        createdBy: 'staff',
        status: 'active',
        orgIds: [],
      }),
    );
    await assertFails(updateDoc(doc(staff(), 'importBatches/b1'), { status: 'undone' }));
    await assertFails(deleteDoc(doc(staff(), 'importBatches/b1')));
  });
});

describe('public pages (Phase 4): organisations are public, people are not', () => {
  beforeEach(async () => {
    await env.withSecurityRulesDisabled(async (ctx) => {
      const db = ctx.firestore();
      const entry = (uid: string, role: string, extra: Record<string, unknown> = {}) => ({
        uid,
        role,
        displayName: uid,
        sports: ['Football'],
        province: 'Gauteng',
        city: 'Soweto',
        headline: null,
        tags: [],
        updatedAt: now,
        ...extra,
      });
      await setDoc(
        doc(db, 'directoryProfiles/org_pub1'),
        entry('org_pub1', 'organisation', { orgId: 'pub1', verified: false, claimed: false }),
      );
      await setDoc(
        doc(db, 'directoryProfiles/orgowner'),
        entry('orgowner', 'organisation', { orgId: 'pub2', verified: true, claimed: true }),
      );
      await setDoc(doc(db, 'directoryProfiles/ath1'), entry('ath1', 'athlete'));
      await setDoc(doc(db, 'directoryProfiles/coach1'), entry('coach1', 'coach'));
      await setDoc(doc(db, 'listings/open1'), {
        orgId: 'pub2',
        status: 'published',
        title: 'Trials',
        kind: 'opportunity',
      });
      await setDoc(doc(db, 'listings/draft1'), {
        orgId: 'pub2',
        status: 'draft',
        title: 'Secret draft',
        kind: 'opportunity',
      });
      await setDoc(doc(db, 'organisations/pub2'), {
        name: 'Org Two',
        type: 'club',
        ownerUid: 'orgowner',
        verified: true,
        contactEmail: 'private@example.com',
        createdAt: now,
        updatedAt: now,
      });
    });
  });

  it('a visitor who is not signed in can read and list organisations', async () => {
    await assertSucceeds(getDoc(doc(anon(), 'directoryProfiles/org_pub1')));
    await assertSucceeds(getDoc(doc(anon(), 'directoryProfiles/orgowner')));
    const list = await assertSucceeds(
      getDocs(
        query(collection(anon(), 'directoryProfiles'), where('role', '==', 'organisation'), limit(500)),
      ),
    );
    expect(list.size).toBe(2);
  });

  it('a visitor cannot read athletes or coaches, one by one or in a list', async () => {
    await assertFails(getDoc(doc(anon(), 'directoryProfiles/ath1')));
    await assertFails(getDoc(doc(anon(), 'directoryProfiles/coach1')));
    await assertFails(
      getDocs(query(collection(anon(), 'directoryProfiles'), where('role', '==', 'athlete'), limit(50))),
    );
    await assertFails(
      getDocs(query(collection(anon(), 'directoryProfiles'), where('role', '==', 'coach'), limit(50))),
    );
    await assertFails(
      getDocs(
        query(
          collection(anon(), 'directoryProfiles'),
          where('role', 'in', ['coach', 'organisation']),
          limit(50),
        ),
      ),
    );
    await assertFails(getDocs(query(collection(anon(), 'directoryProfiles'), limit(50)))); // an unfiltered list would expose people
  });

  it('signed-in members and children see exactly what they saw before', async () => {
    await assertSucceeds(getDoc(doc(as('alice', { role: 'athlete' }), 'directoryProfiles/ath1')));
    await assertSucceeds(getDoc(doc(as('alice', { role: 'athlete' }), 'directoryProfiles/coach1')));
    await env.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), 'users/kid7'), user('kid7', { isMinor: true }));
    });
    const kid = as('kid7', { role: 'athlete' });
    await assertFails(getDoc(doc(kid, 'directoryProfiles/ath1')));
    await assertSucceeds(getDoc(doc(kid, 'directoryProfiles/coach1')));
    await assertSucceeds(
      getDocs(
        query(
          collection(kid, 'directoryProfiles'),
          where('role', 'in', ['coach', 'organisation']),
          limit(50),
        ),
      ),
    );
  });

  it('nobody can change the public directory from a browser', async () => {
    await assertFails(
      setDoc(doc(anon(), 'directoryProfiles/org_forged'), {
        uid: 'org_forged',
        role: 'organisation',
        displayName: 'Fake School',
      }),
    );
    await assertFails(
      updateDoc(doc(as('orgowner', { role: 'organisation' }), 'directoryProfiles/orgowner'), {
        verified: true,
      }),
    );
  });

  it('a visitor sees an organisation’s published listings, never drafts or its private record', async () => {
    const open = await assertSucceeds(
      getDocs(
        query(
          collection(anon(), 'listings'),
          where('orgId', '==', 'pub2'),
          where('status', '==', 'published'),
          limit(50),
        ),
      ),
    );
    expect(open.size).toBe(1);
    await assertFails(getDoc(doc(anon(), 'listings/draft1')));
    await assertFails(
      getDocs(query(collection(anon(), 'listings'), where('orgId', '==', 'pub2'), limit(50))),
    );
    await assertFails(getDoc(doc(anon(), 'organisations/pub2')));
  });
});

describe('sponsorship (Phase 3d)', () => {
  const req = (over: Record<string, unknown> = {}) => ({
    requesterUid: 'alice',
    athleteUid: 'alice',
    forChild: false,
    displayName: 'A B.',
    status: 'open',
    title: 'Boots',
    ...over,
  });
  beforeEach(async () => {
    await env.withSecurityRulesDisabled(async (ctx) => {
      const db = ctx.firestore();
      await setDoc(doc(db, 'sponsorshipRequests/open1'), req());
      await setDoc(
        doc(db, 'sponsorshipRequests/pending1'),
        req({ requesterUid: 'mom', athleteUid: 'teen', forChild: true, status: 'pending_review' }),
      );
      await setDoc(doc(db, 'sponsorshipOffers/open1_bob'), {
        requestId: 'open1',
        requesterUid: 'alice',
        offererUid: 'bob',
        status: 'accepted',
        contacts: { requesterEmail: 'alice@example.com', offererEmail: 'bob@example.com' },
      });
      await setDoc(doc(db, 'users/mom'), user('mom', { role: 'guardian' }));
    });
  });

  it('signed-in adults see open requests; children and the signed-out world do not', async () => {
    await assertSucceeds(getDoc(doc(as('bob', { role: 'coach' }), 'sponsorshipRequests/open1')));
    await assertSucceeds(
      getDocs(
        query(collection(as('bob', { role: 'coach' }), 'sponsorshipRequests'), where('status', '==', 'open')),
      ),
    );
    await assertFails(getDoc(doc(as('teen', { role: 'athlete' }), 'sponsorshipRequests/open1')));
    await assertFails(getDoc(doc(anon(), 'sponsorshipRequests/open1')));
  });

  it('a request waiting for review is seen only by the person who asked and by staff', async () => {
    await assertSucceeds(getDoc(doc(as('mom', { role: 'guardian' }), 'sponsorshipRequests/pending1')));
    await assertSucceeds(
      getDoc(doc(as('staff', { role: 'admin', admin: true }), 'sponsorshipRequests/pending1')),
    );
    await assertFails(getDoc(doc(as('bob', { role: 'coach' }), 'sponsorshipRequests/pending1')));
    await assertFails(
      getDocs(
        query(
          collection(as('bob', { role: 'coach' }), 'sponsorshipRequests'),
          where('status', '==', 'pending_review'),
        ),
      ),
    );
  });

  it('an offer, with its contact details, is seen only by the two people involved and staff', async () => {
    await assertSucceeds(getDoc(doc(as('alice'), 'sponsorshipOffers/open1_bob')));
    await assertSucceeds(getDoc(doc(as('bob', { role: 'coach' }), 'sponsorshipOffers/open1_bob')));
    await assertSucceeds(getDoc(doc(as('staff', { admin: true }), 'sponsorshipOffers/open1_bob')));
    await assertFails(getDoc(doc(as('mom', { role: 'guardian' }), 'sponsorshipOffers/open1_bob')));
    await assertFails(
      getDocs(
        query(
          collection(as('mom', { role: 'guardian' }), 'sponsorshipOffers'),
          where('requestId', '==', 'open1'),
        ),
      ),
    );
  });

  it('nobody writes sponsorship records from the browser', async () => {
    await assertFails(setDoc(doc(as('alice'), 'sponsorshipRequests/mine'), req()));
    await assertFails(updateDoc(doc(as('alice'), 'sponsorshipRequests/open1'), { status: 'closed' }));
    await assertFails(updateDoc(doc(as('alice'), 'sponsorshipOffers/open1_bob'), { status: 'declined' }));
    await assertFails(deleteDoc(doc(as('bob', { role: 'coach' }), 'sponsorshipOffers/open1_bob')));
  });
});

describe('calendar entries (Phase 3d)', () => {
  const entry = (over: Record<string, unknown> = {}) => ({
    title: 'Morning training',
    date: '2026-12-01',
    endDate: null,
    note: null,
    createdAt: now,
    updatedAt: now,
    ...over,
  });
  beforeEach(async () => {
    await env.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), 'users/alice/calendarEntries/e1'), entry());
    });
  });

  it('the owner manages their own entries; nobody else can read or write them', async () => {
    await assertSucceeds(getDoc(doc(as('alice'), 'users/alice/calendarEntries/e1')));
    await assertFails(getDoc(doc(as('bob'), 'users/alice/calendarEntries/e1')));
    await assertSucceeds(
      setDoc(doc(as('alice'), 'users/alice/calendarEntries/e2'), entry({ title: 'Trials' })),
    );
    await assertFails(setDoc(doc(as('bob'), 'users/alice/calendarEntries/e3'), entry()));
    await assertSucceeds(
      updateDoc(doc(as('alice'), 'users/alice/calendarEntries/e1'), {
        title: 'Evening training',
        updatedAt: now,
      }),
    );
    await assertFails(updateDoc(doc(as('bob'), 'users/alice/calendarEntries/e1'), { title: 'Hijacked' }));
    await assertSucceeds(deleteDoc(doc(as('alice'), 'users/alice/calendarEntries/e1')));
    await assertFails(deleteDoc(doc(as('bob'), 'users/alice/calendarEntries/e2')));
  });

  it('rejects a bad title, a bad date, and unknown fields', async () => {
    await assertFails(setDoc(doc(as('alice'), 'users/alice/calendarEntries/bad1'), entry({ title: '' })));
    await assertFails(setDoc(doc(as('alice'), 'users/alice/calendarEntries/bad2'), entry({ date: 'soon' })));
    await assertFails(
      setDoc(doc(as('alice'), 'users/alice/calendarEntries/bad3'), entry({ endDate: 'soon' })),
    );
    await assertFails(
      setDoc(doc(as('alice'), 'users/alice/calendarEntries/bad4'), { ...entry(), extra: 'nope' }),
    );
  });
});

describe('membership (Phase 4)', () => {
  const record = (over: Record<string, unknown> = {}) => ({
    uid: 'alice',
    plan: 'starter',
    status: 'free',
    billingPeriod: null,
    trialEndsAt: null,
    interest: null,
    createdAt: now,
    updatedAt: now,
    ...over,
  });
  beforeEach(async () => {
    await env.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), 'memberships/alice'), record());
    });
  });

  it('a member reads their own membership; staff read any; other people read none', async () => {
    await assertSucceeds(getDoc(doc(as('alice'), 'memberships/alice')));
    await assertSucceeds(getDoc(doc(as('staff', { role: 'admin', admin: true }), 'memberships/alice')));
    await assertFails(getDoc(doc(as('bob'), 'memberships/alice')));
    await assertFails(getDoc(doc(anon(), 'memberships/alice')));
  });

  it('nobody can give themselves a plan, extend a trial or write a membership from the browser', async () => {
    await assertFails(
      setDoc(doc(as('alice'), 'memberships/alice'), record({ plan: 'pro', status: 'active' })),
    );
    await assertFails(updateDoc(doc(as('alice'), 'memberships/alice'), { status: 'active' }));
    await assertFails(
      updateDoc(doc(as('alice'), 'memberships/alice'), { trialEndsAt: '2030-01-01T00:00:00.000Z' }),
    );
    await assertFails(deleteDoc(doc(as('alice'), 'memberships/alice')));
    // Staff cannot either: only the server may.
    const staff = as('staff', { role: 'admin', admin: true });
    await assertFails(updateDoc(doc(staff, 'memberships/alice'), { plan: 'pro' }));
    await assertFails(setDoc(doc(as('bob'), 'memberships/bob'), record({ uid: 'bob', plan: 'pro' })));
  });
});

describe('message threads (Phase 5a)', () => {
  const thread = (over: Record<string, unknown> = {}) => ({
    id: 'connection_bob_alice',
    kind: 'connection',
    sourceId: 'bob_alice',
    status: 'open',
    closedReason: null,
    subject: 'A B and A B',
    participants: [
      { uid: 'bob', displayName: 'A B', role: 'coach' },
      { uid: 'alice', displayName: 'A B', role: 'athlete' },
    ],
    participantUids: ['bob', 'alice'],
    writerUids: ['bob', 'alice'],
    guardianUids: [],
    hasMinor: false,
    lastMessageAt: null,
    lastMessagePreview: null,
    lastMessageBy: null,
    createdAt: now,
    updatedAt: now,
    ...over,
  });
  const entry = {
    id: 'm1',
    threadId: 'connection_bob_alice',
    senderUid: 'bob',
    senderName: 'A B',
    onBehalfOfUid: null,
    body: 'Hello',
    sentAt: now,
  };

  beforeEach(async () => {
    await env.withSecurityRulesDisabled(async (ctx) => {
      const db = ctx.firestore();
      await setDoc(doc(db, 'messageThreads/connection_bob_alice'), thread());
      await setDoc(doc(db, 'messageThreads/connection_bob_alice/entries/m1'), entry);
      // A child's thread, with the parent listed as a participant.
      await setDoc(
        doc(db, 'messageThreads/connection_bob_teen'),
        thread({
          id: 'connection_bob_teen',
          sourceId: 'bob_teen',
          participantUids: ['bob', 'teen', 'mum'],
          writerUids: ['bob', 'teen', 'mum'],
          guardianUids: ['mum'],
          hasMinor: true,
        }),
      );
      await setDoc(doc(db, 'messageThreads/connection_bob_teen/entries/m2'), {
        ...entry,
        id: 'm2',
        threadId: 'connection_bob_teen',
      });
    });
  });

  it('lets the two people in a thread read it, and keeps everyone else out', async () => {
    await assertSucceeds(getDoc(doc(as('bob'), 'messageThreads/connection_bob_alice')));
    await assertSucceeds(getDoc(doc(as('alice'), 'messageThreads/connection_bob_alice')));
    await assertFails(getDoc(doc(as('carol'), 'messageThreads/connection_bob_alice')));
    await assertFails(getDoc(doc(anon(), 'messageThreads/connection_bob_alice')));
  });

  it('lets a parent read their child’s thread and every message in it', async () => {
    await assertSucceeds(getDoc(doc(as('mum'), 'messageThreads/connection_bob_teen')));
    await assertSucceeds(getDoc(doc(as('mum'), 'messageThreads/connection_bob_teen/entries/m2')));
    // But not a thread they are not part of.
    await assertFails(getDoc(doc(as('mum'), 'messageThreads/connection_bob_alice')));
  });

  it('decides message access from the thread, so an outsider cannot read a message directly', async () => {
    await assertSucceeds(getDoc(doc(as('alice'), 'messageThreads/connection_bob_alice/entries/m1')));
    await assertFails(getDoc(doc(as('carol'), 'messageThreads/connection_bob_alice/entries/m1')));
    await assertFails(getDoc(doc(anon(), 'messageThreads/connection_bob_alice/entries/m1')));
  });

  it('lets staff read any conversation', async () => {
    const staff = as('staff', { role: 'admin', admin: true });
    await assertSucceeds(getDoc(doc(staff, 'messageThreads/connection_bob_alice')));
    await assertSucceeds(getDoc(doc(staff, 'messageThreads/connection_bob_alice/entries/m1')));
  });

  it('never lets anyone write a message or change a thread from the browser', async () => {
    // Not a participant writing a message...
    await assertFails(
      setDoc(doc(as('alice'), 'messageThreads/connection_bob_alice/entries/m9'), {
        ...entry,
        id: 'm9',
        senderUid: 'alice',
      }),
    );
    // ...not editing somebody else's words...
    await assertFails(
      updateDoc(doc(as('bob'), 'messageThreads/connection_bob_alice/entries/m1'), { body: 'changed' }),
    );
    await assertFails(deleteDoc(doc(as('bob'), 'messageThreads/connection_bob_alice/entries/m1')));
    // ...not re-opening a closed thread or adding themselves to one...
    await assertFails(
      updateDoc(doc(as('alice'), 'messageThreads/connection_bob_alice'), { status: 'closed' }),
    );
    await assertFails(
      updateDoc(doc(as('carol'), 'messageThreads/connection_bob_alice'), {
        participantUids: ['bob', 'alice', 'carol'],
      }),
    );
    // ...and not staff either.
    const staff = as('staff', { role: 'admin', admin: true });
    await assertFails(updateDoc(doc(staff, 'messageThreads/connection_bob_alice'), { status: 'closed' }));
  });

  it('lets someone list only the threads they are in', async () => {
    const mine = query(
      collection(as('alice'), 'messageThreads'),
      where('participantUids', 'array-contains', 'alice'),
    );
    await assertSucceeds(getDocs(mine));
    // Asking for everything, or for somebody else's threads, is refused.
    await assertFails(getDocs(query(collection(as('alice'), 'messageThreads'))));
    await assertFails(
      getDocs(
        query(collection(as('alice'), 'messageThreads'), where('participantUids', 'array-contains', 'bob')),
      ),
    );
  });
});

describe('coach credential verification (Phase 5b)', () => {
  const record = {
    uid: 'bob',
    displayName: 'A B',
    status: 'submitted',
    decisionNote: null,
    submittedAt: now,
    decidedAt: null,
    decidedByUid: null,
    docCount: 1,
    createdAt: now,
    updatedAt: now,
  };
  const credential = {
    id: 'doc1',
    qualificationId: null,
    fileName: 'cert.pdf',
    contentType: 'application/pdf',
    sizeBytes: 1024,
    storagePath: 'coachCredentials/bob/doc1',
    uploadedAt: now,
  };

  beforeEach(async () => {
    await env.withSecurityRulesDisabled(async (ctx) => {
      const db = ctx.firestore();
      await setDoc(doc(db, 'coachVerifications/bob'), record);
      await setDoc(doc(db, 'coachVerificationNotes/bob'), {
        uid: 'bob',
        internalNote: 'Looks like a photocopy.',
        decidedByUid: 'staff',
        decidedAt: now,
      });
      await setDoc(doc(db, 'coachProfiles/bob/credentialDocs/doc1'), credential);
    });
  });

  it('lets a coach read their own verification and documents; nobody else can', async () => {
    await assertSucceeds(getDoc(doc(as('bob'), 'coachVerifications/bob')));
    await assertSucceeds(getDoc(doc(as('bob'), 'coachProfiles/bob/credentialDocs/doc1')));
    await assertFails(getDoc(doc(as('alice'), 'coachVerifications/bob')));
    await assertFails(getDoc(doc(as('alice'), 'coachProfiles/bob/credentialDocs/doc1')));
    await assertFails(getDoc(doc(anon(), 'coachProfiles/bob/credentialDocs/doc1')));
  });

  it('keeps the staff-only note away from the coach it is about', async () => {
    await assertFails(getDoc(doc(as('bob'), 'coachVerificationNotes/bob')));
    await assertSucceeds(
      getDoc(doc(as('staff', { role: 'admin', admin: true }), 'coachVerificationNotes/bob')),
    );
  });

  it('lets staff read a coach’s verification and documents', async () => {
    const staff = as('staff', { role: 'admin', admin: true });
    await assertSucceeds(getDoc(doc(staff, 'coachVerifications/bob')));
    await assertSucceeds(getDoc(doc(staff, 'coachProfiles/bob/credentialDocs/doc1')));
  });

  it('never lets a coach verify themselves or forge a document record', async () => {
    await assertFails(updateDoc(doc(as('bob'), 'coachVerifications/bob'), { status: 'verified' }));
    await assertFails(setDoc(doc(as('bob'), 'coachVerifications/bob'), { ...record, status: 'verified' }));
    await assertFails(deleteDoc(doc(as('bob'), 'coachVerifications/bob')));
    await assertFails(
      setDoc(doc(as('bob'), 'coachProfiles/bob/credentialDocs/doc2'), { ...credential, id: 'doc2' }),
    );
    await assertFails(deleteDoc(doc(as('bob'), 'coachProfiles/bob/credentialDocs/doc1')));
    // Staff cannot write these either — only the server.
    const staff = as('staff', { role: 'admin', admin: true });
    await assertFails(updateDoc(doc(staff, 'coachVerifications/bob'), { status: 'verified' }));
  });
});

describe('email preferences (Phase 6)', () => {
  const prefs = { activity: true, messages: false };

  beforeEach(async () => {
    await env.withSecurityRulesDisabled(async (ctx) => {
      const db = ctx.firestore();
      await setDoc(doc(db, 'users/bob/emailPreferences/self'), prefs);
      await setDoc(doc(db, 'emailThrottle/bob__t1'), {
        uid: 'bob',
        threadId: 't1',
        at: now,
      });
    });
  });

  it('lets someone read and change their own, and nobody else’s', async () => {
    await assertSucceeds(getDoc(doc(as('bob'), 'users/bob/emailPreferences/self')));
    await assertSucceeds(setDoc(doc(as('bob'), 'users/bob/emailPreferences/self'), prefs));
    await assertFails(getDoc(doc(as('alice'), 'users/bob/emailPreferences/self')));
    await assertFails(setDoc(doc(as('alice'), 'users/bob/emailPreferences/self'), prefs));
    await assertFails(getDoc(doc(anon(), 'users/bob/emailPreferences/self')));
  });

  it('refuses a shape that is not two booleans', async () => {
    await assertFails(setDoc(doc(as('bob'), 'users/bob/emailPreferences/self'), { activity: 'yes', messages: true }));
    await assertFails(setDoc(doc(as('bob'), 'users/bob/emailPreferences/self'), { activity: true }));
    await assertFails(
      setDoc(doc(as('bob'), 'users/bob/emailPreferences/self'), { ...prefs, admin: true }),
    );
    // One document per person, not a pile of them.
    await assertFails(setDoc(doc(as('bob'), 'users/bob/emailPreferences/other'), prefs));
  });

  it('keeps the send log away from everyone, because it says who is talking to whom', async () => {
    await assertFails(getDoc(doc(as('bob'), 'emailThrottle/bob__t1')));
    await assertFails(setDoc(doc(as('bob'), 'emailThrottle/bob__t1'), { uid: 'bob', threadId: 't1', at: now }));
    await assertFails(getDoc(doc(as('staff', { role: 'admin', admin: true }), 'emailThrottle/bob__t1')));
  });
});
