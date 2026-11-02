/**
 * Firestore and Storage security-rules tests. Requires Java and the Firebase emulators:
 *   npm run test:rules
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { afterAll, beforeAll, beforeEach, describe, it } from 'vitest';
import {
  assertFails, assertSucceeds, initializeTestEnvironment, type RulesTestEnvironment,
} from '@firebase/rules-unit-testing';
import { doc, getDoc, setDoc, updateDoc, deleteDoc, collection, getDocs } from 'firebase/firestore';
import { ref, uploadString } from 'firebase/storage';

let env: RulesTestEnvironment;

const now = '2026-11-02T00:00:00.000Z';
const user = (uid: string, extra: Record<string, unknown> = {}) => ({
  uid, email: `${uid}@example.com`, firstName: 'A', surname: 'B', displayName: 'A B', role: 'athlete',
  status: 'active', isMinor: false, onboardingComplete: true, termsVersion: 'v', termsAcceptedAt: now,
  createdAt: now, updatedAt: now, ...extra,
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
    await setDoc(doc(db, 'athleteProfiles/alice'), { uid: 'alice', displayName: 'A B', visibility: 'members', createdAt: now });
    await setDoc(doc(db, 'athleteProfiles/teen'), { uid: 'teen', displayName: 'T', visibility: 'private', createdAt: now });
    await setDoc(doc(db, 'organisations/org1'), { name: 'Soweto FC', type: 'club', ownerUid: 'bob', verified: false, createdAt: now });
    await setDoc(doc(db, 'guardianLinks/l1'), { athleteUid: 'teen', guardianEmail: 'mom@example.com', guardianUid: null, status: 'pending' });
    await setDoc(doc(db, 'auditLogs/a1'), { type: 'x' });
  });
});

const as = (uid: string, claims: Record<string, unknown> = {}) => env.authenticatedContext(uid, claims).firestore();
const anon = () => env.unauthenticatedContext().firestore();

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
    await assertSucceeds(updateDoc(doc(db, 'users/alice'), { firstName: 'Ali', displayName: 'Ali B', updatedAt: now }));
    await assertFails(updateDoc(doc(db, 'users/alice'), { role: 'organisation' }));
    await assertFails(updateDoc(doc(db, 'users/alice'), { status: 'active' }));
    await assertFails(updateDoc(doc(as('teen', { role: 'athlete' }), 'users/teen'), { isMinor: false }));
    await assertFails(updateDoc(doc(db, 'users/alice'), { firstName: '' }));
  });
  it('nobody can delete a user doc from the client', async () => {
    await assertFails(deleteDoc(doc(as('alice', { role: 'athlete' }), 'users/alice')));
  });
  it('private details are owner/admin read-only', async () => {
    await assertSucceeds(getDoc(doc(as('alice'), 'users/alice/private/details')));
    await assertFails(getDoc(doc(as('bob'), 'users/alice/private/details')));
    await assertFails(setDoc(doc(as('alice'), 'users/alice/private/details'), { dateOfBirth: '2015-01-01', mobile: '1' }));
  });
});

describe('role profiles', () => {
  it('adult can change visibility; minor cannot', async () => {
    await assertSucceeds(updateDoc(doc(as('alice'), 'athleteProfiles/alice'), { visibility: 'public' }));
    await assertFails(updateDoc(doc(as('teen'), 'athleteProfiles/teen'), { visibility: 'public' }));
  });
  it('cannot write another user\'s profile or change uid', async () => {
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
  it('denies all uploads in Phase 1', async () => {
    const s = env.authenticatedContext('alice').storage();
    await assertFails(uploadString(ref(s, 'users/alice/avatar.png'), 'x'));
  });
});
