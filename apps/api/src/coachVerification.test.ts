import { beforeEach, describe, expect, it } from 'vitest';
import request from 'supertest';
import type { DecodedIdToken } from 'firebase-admin/auth';
import {
  credentialStoragePath,
  CREDENTIAL_MAX_DOCS,
  type CoachVerificationDoc,
  type CredentialDocRecord,
} from '@sportbridge/shared';
import { createApp, type AppDeps } from './app.js';
import {
  submitForReview,
  type CoachVerificationRepoPort,
  type Outbox,
} from './services/coachVerification.js';

const NAMES: Record<string, string> = { coach: 'Coach Carter', coach2: 'Coach Two' };

function fakeStore() {
  const records = new Map<string, CoachVerificationDoc>();
  const docs = new Map<string, CredentialDocRecord[]>();
  const qualifications = new Map<string, number>();
  const internalNotes = new Map<string, string | null>();
  const deletedFiles: string[] = [];
  const sent: Outbox = [];
  const audits: Record<string, unknown>[] = [];
  let n = 0;
  const repo: CoachVerificationRepoPort = {
    newDocId: () => `doc${++n}`,
    async getCoach(uid) {
      return NAMES[uid] ? { uid, displayName: NAMES[uid], role: 'coach' } : null;
    },
    async get(uid) {
      const v = records.get(uid);
      return v ? { ...v } : null;
    },
    async create(uid, doc) {
      const existing = records.get(uid);
      if (existing) return { ...existing };
      records.set(uid, doc);
      return { ...doc };
    },
    async update(uid, changes, outbox, audit) {
      records.set(uid, { ...records.get(uid)!, ...changes });
      sent.push(...outbox);
      audits.push(audit);
    },
    async putInternalNote(uid, note) {
      internalNotes.set(uid, note.internalNote);
    },
    async countQualifications(uid) {
      return qualifications.get(uid) ?? 0;
    },
    async listDocs(uid) {
      return [...(docs.get(uid) ?? [])];
    },
    async addDoc(uid, doc, audit) {
      docs.set(uid, [...(docs.get(uid) ?? []), doc]);
      records.set(uid, { ...records.get(uid)!, docCount: (docs.get(uid) ?? []).length });
      audits.push(audit);
    },
    async removeDoc(uid, docId, audit) {
      const list = docs.get(uid) ?? [];
      const found = list.find((d) => d.id === docId) ?? null;
      docs.set(
        uid,
        list.filter((d) => d.id !== docId),
      );
      audits.push(audit);
      return found;
    },
    async queue() {
      return [...records.values()].filter((v) => v.status !== 'draft').map((v) => ({ ...v }));
    },
    async signedUrlFor(path) {
      return `https://signed.example/${path}`;
    },
    async deleteFile(path) {
      deletedFiles.push(path);
    },
  };
  return { records, docs, qualifications, internalNotes, deletedFiles, sent, audits, repo };
}

type Token = Partial<DecodedIdToken> & { uid: string; role?: string; admin?: boolean };
const TOKENS: Record<string, Token> = {
  coach: { uid: 'coach', role: 'coach', email_verified: true },
  coach2: { uid: 'coach2', role: 'coach', email_verified: true },
  athlete: { uid: 'athlete', role: 'athlete', email_verified: true },
  admin: { uid: 'admin', role: 'admin', admin: true, email_verified: true },
};

describe('coach credential verification', () => {
  let s: ReturnType<typeof fakeStore>;
  let app: ReturnType<typeof createApp>;
  const as = (who: keyof typeof TOKENS) => ({ Authorization: `Bearer ${who}` });
  const view = (who: keyof typeof TOKENS) => request(app).get('/api/coach/credentials').set(as(who));
  const addDoc = (who: keyof typeof TOKENS, body: unknown) =>
    request(app).post('/api/coach/credentials/documents').set(as(who)).send(body);
  const submit = (who: keyof typeof TOKENS) =>
    request(app).post('/api/coach/credentials/submit').set(as(who)).send({});
  const decide = (who: keyof typeof TOKENS, uid: string, body: unknown) =>
    request(app).post(`/api/admin/coach-verifications/${uid}/decide`).set(as(who)).send(body);

  const goodDoc = (id = 'doc1') => ({
    qualificationId: 'q1',
    fileName: 'level-2.pdf',
    contentType: 'application/pdf',
    sizeBytes: 2048,
    storagePath: credentialStoragePath('coach', id),
  });

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
    app = createApp({ auth, coachVerification: s.repo } as unknown as AppDeps);
  });

  it('starts a coach as an unsubmitted draft with nothing uploaded', async () => {
    const res = await view('coach');
    expect(res.status).toBe(200);
    expect(res.body.verification).toMatchObject({ status: 'draft', submittedAt: null, decidedAt: null });
    expect(res.body.documents).toEqual([]);
    expect(res.body.canSubmit).toBe(false);
  });

  it('is only for coaches', async () => {
    const res = await view('athlete');
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('NOT_COACH');
  });

  it('records an uploaded document and refuses one pointed at somebody else’s folder', async () => {
    await view('coach');
    const ok = await addDoc('coach', goodDoc());
    expect(ok.status).toBe(201);
    expect(ok.body).toMatchObject({ fileName: 'level-2.pdf', storagePath: 'coachCredentials/coach/doc1' });

    // A caller cannot claim a file that lives under another coach's uid.
    const stolen = await addDoc('coach', {
      ...goodDoc(),
      storagePath: 'coachCredentials/coach2/doc9',
    });
    expect(stolen.status).toBe(400);
    expect(stolen.body.error.code).toBe('BAD_PATH');
  });

  it('refuses a file type nobody can read and a file over 5 MB', async () => {
    await view('coach');
    expect((await addDoc('coach', { ...goodDoc(), contentType: 'application/zip' })).status).toBe(400);
    expect((await addDoc('coach', { ...goodDoc('doc2'), sizeBytes: 6_000_000 })).status).toBe(400);
  });

  it('will not take a submission with nothing to review', async () => {
    await view('coach');
    const res = await submit('coach');
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('NOTHING_TO_REVIEW');
  });

  it('takes no submission while uploads are switched off, so staff never get an empty review', async () => {
    s.qualifications.set('coach', 1);
    await view('coach');
    await addDoc('coach', goodDoc());
    expect((await view('coach')).body.canSubmit).toBe(false);

    const res = await submit('coach');
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('NOTHING_TO_REVIEW');
    expect(res.body.error.message).toBe('Credential reviews are not open yet');
    expect(s.records.get('coach')!.status).toBe('draft');
  });

  it('accepts a submission once uploads are on and there is a qualification and a document', async () => {
    // Exercised directly, because the switch is off in this build. This is the path that comes back
    // the day Firebase Storage exists, so it stays covered rather than untested until then.
    s.qualifications.set('coach', 1);
    await view('coach');
    await addDoc('coach', goodDoc());

    const caller = { uid: 'coach', role: 'coach', admin: false, emailVerified: true };
    await submitForReview(s.repo, caller, new Date(), true);
    expect(s.records.get('coach')).toMatchObject({ status: 'submitted', docCount: 1 });

    // Nothing may change while staff are reading it.
    await expect(submitForReview(s.repo, caller, new Date(), true)).rejects.toThrow();
    expect((await addDoc('coach', goodDoc('doc2'))).status).toBe(409);
    expect(
      (await request(app).delete('/api/coach/credentials/documents/doc1').set(as('coach'))).status,
    ).toBe(409);
  });

  it('caps how many documents one coach can pile up', async () => {
    s.qualifications.set('coach', 1);
    await view('coach');
    for (let i = 1; i <= CREDENTIAL_MAX_DOCS; i++) {
      expect((await addDoc('coach', goodDoc(`doc${i}`))).status).toBe(201);
    }
    const res = await addDoc('coach', goodDoc(`doc${CREDENTIAL_MAX_DOCS + 1}`));
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('TOO_MANY_DOCS');
  });

  it('removes a document and tidies the file away with it', async () => {
    await view('coach');
    await addDoc('coach', goodDoc());
    const res = await request(app).delete('/api/coach/credentials/documents/doc1').set(as('coach'));
    expect(res.status).toBe(200);
    expect(s.deletedFiles).toEqual(['coachCredentials/coach/doc1']);
    expect((await view('coach')).body.documents).toEqual([]);
  });

  describe('staff review', () => {
    beforeEach(async () => {
      // Seeded rather than submitted: submission is switched off in this build, but staff still have a
      // queue to work the moment it is turned on, and this is exactly the state they would see.
      s.qualifications.set('coach', 1);
      await view('coach');
      await addDoc('coach', goodDoc());
      s.records.set('coach', {
        ...s.records.get('coach')!,
        status: 'submitted',
        submittedAt: '2026-11-12T00:00:00.000Z',
        docCount: 1,
      });
    });

    it('is staff-only, both to read and to decide', async () => {
      expect((await request(app).get('/api/admin/coach-verifications').set(as('coach'))).status).toBe(403);
      expect((await decide('coach', 'coach', { verified: true })).status).toBe(403);
    });

    it('shows staff the queue with a short-lived link per document', async () => {
      const res = await request(app).get('/api/admin/coach-verifications').set(as('admin'));
      expect(res.status).toBe(200);
      expect(res.body.items).toHaveLength(1);
      expect(res.body.items[0]).toMatchObject({ uid: 'coach', status: 'submitted' });
      expect(res.body.items[0].documents[0].url).toBe('https://signed.example/coachCredentials/coach/doc1');
    });

    it('verifies a coach and tells them so', async () => {
      expect((await decide('admin', 'coach', { verified: true })).status).toBe(200);
      expect(s.records.get('coach')).toMatchObject({ status: 'verified', decidedByUid: 'admin' });
      expect(s.sent.at(-1)).toMatchObject({ uid: 'coach' });
      expect(s.sent.at(-1)!.notification.type).toBe('coach.verification');
      expect(s.audits.at(-1)).toMatchObject({ type: 'coach.verified' });
    });

    it('will not let staff say no without saying why', async () => {
      const res = await decide('admin', 'coach', { verified: false });
      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('NOTE_REQUIRED');
      expect(s.records.get('coach')!.status).toBe('submitted');
    });

    it('rejects with a reason the coach can act on, and keeps the staff note private', async () => {
      const res = await decide('admin', 'coach', {
        verified: false,
        decisionNote: 'The certificate was cut off at the bottom.',
        internalNote: 'Second attempt from this coach.',
      });
      expect(res.status).toBe(200);
      const stored = s.records.get('coach')!;
      expect(stored).toMatchObject({ status: 'rejected' });
      // The staff note is kept out of the record the coach can read, and lives on its own.
      expect(stored).not.toHaveProperty('internalNote');
      expect((await view('coach')).body.verification).not.toHaveProperty('internalNote');
      expect(s.internalNotes.get('coach')).toBe('Second attempt from this coach.');
      // What the coach is told is the decision note, never the internal one.
      expect(s.sent.at(-1)!.notification.body).toBe('The certificate was cut off at the bottom.');
    });

    it('lets a rejected coach fix things and send them in again (once uploads are on)', async () => {
      await decide('admin', 'coach', { verified: false, decisionNote: 'Unreadable scan.' });
      expect((await addDoc('coach', goodDoc('doc2'))).status).toBe(201);
      await submitForReview(
        s.repo,
        { uid: 'coach', role: 'coach', admin: false, emailVerified: true },
        new Date(),
        true,
      );
      expect(s.records.get('coach')).toMatchObject({ status: 'submitted', decisionNote: null });
    });

    it('404s on a coach who has never submitted anything', async () => {
      expect((await decide('admin', 'coach2', { verified: true })).status).toBe(404);
    });
  });

  it('answers 401 when nobody is signed in', async () => {
    expect((await request(app).get('/api/coach/credentials')).status).toBe(401);
  });
});
