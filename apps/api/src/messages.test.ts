import { beforeEach, describe, expect, it } from 'vitest';
import request from 'supertest';
import type { DecodedIdToken } from 'firebase-admin/auth';
import {
  membership as threadMembership,
  threadIdFor,
  type ApplicationDoc,
  type ConnectionDoc,
  type MessageDoc,
  type ThreadDoc,
} from '@sportbridge/shared';
import { createApp, type AppDeps } from './app.js';
import type { MessagesRepoPort, MessagePerson, Outbox } from './services/messages.js';

const PEOPLE: Record<string, MessagePerson> = {
  coach: { uid: 'coach', displayName: 'Coach Carter', role: 'coach', isMinor: false, guardianUids: [] },
  adult: { uid: 'adult', displayName: 'Adult Athlete', role: 'athlete', isMinor: false, guardianUids: [] },
  kid: { uid: 'kid', displayName: 'Young Athlete', role: 'athlete', isMinor: true, guardianUids: ['mum'] },
  mum: { uid: 'mum', displayName: 'Mum Parent', role: 'guardian', isMinor: false, guardianUids: [] },
  org: { uid: 'org', displayName: 'Test FC', role: 'organisation', isMinor: false, guardianUids: [] },
  stranger: { uid: 'stranger', displayName: 'Nosy Person', role: 'coach', isMinor: false, guardianUids: [] },
};

function fakeStore() {
  const threads = new Map<string, ThreadDoc>();
  const entries = new Map<string, MessageDoc[]>();
  const connections = new Map<string, ConnectionDoc>();
  const applications = new Map<string, ApplicationDoc>();
  const sent: Outbox = [];
  const audits: Record<string, unknown>[] = [];
  let n = 0;
  const repo: MessagesRepoPort = {
    newMessageId: () => `m${++n}`,
    async getPerson(uid) {
      return PEOPLE[uid] ? { ...PEOPLE[uid] } : null;
    },
    async getThread(id) {
      const t = threads.get(id);
      return t ? structuredClone(t) : null;
    },
    async threadsFor(uid) {
      return [...threads.values()].filter((t) => t.participantUids.includes(uid)).map((t) => structuredClone(t));
    },
    async entries(threadId, limit) {
      return (entries.get(threadId) ?? []).slice(0, limit);
    },
    async ensureThread(id, build) {
      const existing = threads.get(id);
      if (existing) return structuredClone(existing);
      const doc = build();
      threads.set(id, doc);
      return structuredClone(doc);
    },
    async appendMessage(threadId, message, changes, outbox, audit) {
      entries.set(threadId, [...(entries.get(threadId) ?? []), message]);
      threads.set(threadId, { ...threads.get(threadId)!, ...changes });
      sent.push(...outbox);
      audits.push(audit);
    },
    async updateThread(id, changes, audit) {
      threads.set(id, { ...threads.get(id)!, ...changes });
      audits.push(audit);
    },
    async getConnection(id) {
      return connections.get(id) ?? null;
    },
    async getApplication(id) {
      return applications.get(id) ?? null;
    },
    async childrenOf(uid) {
      return [...Object.entries(PEOPLE)]
        .filter(([, p]) => p.guardianUids.includes(uid))
        .map(([id]) => id);
    },
    async acceptedConnectionIds(uids) {
      return [...connections.entries()]
        .filter(
          ([, c]) => c.status === 'accepted' && (uids.includes(c.coachUid) || uids.includes(c.athleteUid)),
        )
        .map(([id]) => id);
    },
    async liveApplicationIds(uids) {
      return [...applications.entries()]
        .filter(
          ([, a]) =>
            ['shortlisted', 'accepted'].includes(a.status) &&
            (uids.includes(a.applicantUid) || uids.includes(a.ownerUid)),
        )
        .map(([id]) => id);
    },
  };
  return { threads, entries, connections, applications, sent, audits, repo };
}

const connection = (over: Partial<ConnectionDoc> = {}): ConnectionDoc => ({
  coachUid: 'coach',
  coachName: 'Coach Carter',
  athleteUid: 'adult',
  athleteName: 'Adult Athlete',
  athleteIsMinor: false,
  decidedByUid: null,
  decidedByRole: null,
  status: 'accepted',
  message: null,
  createdAt: 't',
  updatedAt: 't',
  ...over,
});

const application = (over: Partial<ApplicationDoc> = {}): ApplicationDoc =>
  ({
    listingId: 'l1',
    listingTitle: 'Provincial trials',
    listingKind: 'opportunity',
    orgId: 'o1',
    orgName: 'Test FC',
    ownerUid: 'org',
    applicantUid: 'adult',
    applicantIsMinor: false,
    status: 'shortlisted',
    note: null,
    orgMessage: null,
    snapshot: {},
    history: [],
    createdAt: 't',
    updatedAt: 't',
    ...over,
  }) as ApplicationDoc;

/** A ready-made open thread between two adults. */
const openThread = (over: Partial<ThreadDoc> = {}): ThreadDoc => ({
  id: 'connection_coach_adult',
  kind: 'connection',
  sourceId: 'coach_adult',
  status: 'open',
  closedReason: null,
  subject: 'Coach Carter and Adult Athlete',
  ...threadMembership(
    [
      { uid: 'coach', displayName: 'Coach Carter', role: 'coach' },
      { uid: 'adult', displayName: 'Adult Athlete', role: 'athlete' },
    ],
    [],
    false,
  ),
  lastMessageAt: null,
  lastMessagePreview: null,
  lastMessageBy: null,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
  ...over,
});

type Token = Partial<DecodedIdToken> & { uid: string; role?: string; admin?: boolean };
const TOKENS: Record<string, Token> = {
  coach: { uid: 'coach', role: 'coach', email_verified: true },
  adult: { uid: 'adult', role: 'athlete', email_verified: true },
  kid: { uid: 'kid', role: 'athlete', email_verified: true },
  mum: { uid: 'mum', role: 'guardian', email_verified: true },
  org: { uid: 'org', role: 'organisation', email_verified: true },
  stranger: { uid: 'stranger', role: 'coach', email_verified: true },
  admin: { uid: 'admin', role: 'admin', admin: true, email_verified: true },
  unverified: { uid: 'coach', role: 'coach', email_verified: false },
};

describe('messaging', () => {
  let s: ReturnType<typeof fakeStore>;
  let app: ReturnType<typeof createApp>;
  const as = (who: keyof typeof TOKENS) => ({ Authorization: `Bearer ${who}` });
  const send = (who: keyof typeof TOKENS, id: string, body: unknown) =>
    request(app).post(`/api/messages/threads/${id}/send`).set(as(who)).send(body);
  const read = (who: keyof typeof TOKENS, id: string) =>
    request(app).get(`/api/messages/threads/${id}`).set(as(who));
  const open = (who: keyof typeof TOKENS, body: unknown) =>
    request(app).post('/api/messages/threads/open').set(as(who)).send(body);

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
    app = createApp({ auth, messages: s.repo } as unknown as AppDeps);
  });

  it('opens a thread for an accepted connection and lets both sides talk', async () => {
    s.connections.set('coach_adult', connection());
    const opened = await open('coach', { kind: 'connection', sourceId: 'coach_adult' });
    expect(opened.status).toBe(201);
    const id = threadIdFor('connection', 'coach_adult');
    expect(opened.body.thread.id).toBe(id);

    expect((await send('coach', id, { body: 'Great session today' })).status).toBe(201);
    expect((await send('adult', id, { body: 'Thanks coach' })).status).toBe(201);
    const res = await read('adult', id);
    expect(res.body.messages.map((m: MessageDoc) => m.body)).toEqual([
      'Great session today',
      'Thanks coach',
    ]);
    // The other side gets told; the sender does not get told about their own message.
    expect(s.sent.map((o) => o.uid)).toEqual(['adult', 'coach']);
    expect(s.sent[0].notification.type).toBe('message.received');
  });

  it('refuses to open a thread for a connection nobody has accepted', async () => {
    s.connections.set('coach_adult', connection({ status: 'pending' }));
    expect((await open('coach', { kind: 'connection', sourceId: 'coach_adult' })).status).toBe(404);
  });

  it('opens an application thread only once the organisation has shown interest', async () => {
    s.applications.set('l1_adult', application({ status: 'submitted' }));
    expect((await open('org', { kind: 'application', sourceId: 'l1_adult' })).status).toBe(404);

    s.applications.set('l1_adult', application({ status: 'shortlisted' }));
    const res = await open('org', { kind: 'application', sourceId: 'l1_adult' });
    expect(res.status).toBe(201);
    expect(res.body.thread.subject).toBe('Provincial trials');
  });

  it('never creates the same thread twice', async () => {
    s.connections.set('coach_adult', connection());
    await open('coach', { kind: 'connection', sourceId: 'coach_adult' });
    await open('adult', { kind: 'connection', sourceId: 'coach_adult' });
    expect(s.threads.size).toBe(1);
  });

  describe("a child's conversation", () => {
    beforeEach(() => {
      s.connections.set('coach_kid', connection({ athleteUid: 'kid', athleteName: 'Young Athlete', athleteIsMinor: true }));
    });

    it('puts the parent in the thread as a reader and a writer, and leaves the child able to speak', async () => {
      const res = await open('coach', { kind: 'connection', sourceId: 'coach_kid' });
      const t: ThreadDoc = res.body.thread;
      expect(t.hasMinor).toBe(true);
      expect(t.guardianUids).toEqual(['mum']);
      expect(t.participantUids.sort()).toEqual(['coach', 'kid', 'mum']);
      expect(t.writerUids).toContain('kid');
      expect(t.writerUids).toContain('mum');
    });

    it('lets the parent read every word the coach sends the child', async () => {
      await open('coach', { kind: 'connection', sourceId: 'coach_kid' });
      const id = threadIdFor('connection', 'coach_kid');
      await send('coach', id, { body: 'Training moves to Thursday' });
      const asMum = await read('mum', id);
      expect(asMum.status).toBe(200);
      expect(asMum.body.messages[0].body).toBe('Training moves to Thursday');
      // The parent is notified too, not only the child.
      expect(s.sent.map((o) => o.uid).sort()).toEqual(['kid', 'mum']);
    });

    it("names the parent plainly when they write, so the coach knows who is talking", async () => {
      await open('coach', { kind: 'connection', sourceId: 'coach_kid' });
      const id = threadIdFor('connection', 'coach_kid');
      await send('mum', id, { body: 'She cannot make Thursday' });
      const res = await read('coach', id);
      expect(res.body.messages[0]).toMatchObject({
        senderUid: 'mum',
        senderName: 'Mum Parent',
        onBehalfOfUid: 'kid',
      });
    });
  });

  describe('who is kept out', () => {
    beforeEach(() => {
      s.threads.set('connection_coach_adult', openThread());
    });

    it('tells a stranger the thread does not exist, rather than that they are not allowed in', async () => {
      expect((await read('stranger', 'connection_coach_adult')).status).toBe(404);
      expect((await send('stranger', 'connection_coach_adult', { body: 'hi' })).status).toBe(404);
    });

    it('lets staff read a thread but never write into it', async () => {
      expect((await read('admin', 'connection_coach_adult')).status).toBe(200);
      const res = await send('admin', 'connection_coach_adult', { body: 'staff here' });
      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe('NOT_ALLOWED');
    });

    it('makes someone verify their email before they can message anyone', async () => {
      const res = await send('unverified', 'connection_coach_adult', { body: 'hello' });
      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe('EMAIL_NOT_VERIFIED');
    });

    it('refuses an empty message and one that is far too long', async () => {
      expect((await send('coach', 'connection_coach_adult', { body: '   ' })).status).toBe(400);
      expect((await send('coach', 'connection_coach_adult', { body: 'x'.repeat(2001) })).status).toBe(400);
    });

    it('answers 401 when nobody is signed in', async () => {
      expect((await request(app).get('/api/messages/threads')).status).toBe(401);
    });
  });

  describe('a closed conversation', () => {
    it('keeps the history readable but takes the pen away', async () => {
      s.threads.set(
        'connection_coach_adult',
        openThread({ status: 'closed', closedReason: 'connection_ended' }),
      );
      s.entries.set('connection_coach_adult', [
        {
          id: 'm0',
          threadId: 'connection_coach_adult',
          senderUid: 'coach',
          senderName: 'Coach Carter',
          onBehalfOfUid: null,
          body: 'Earlier message',
          sentAt: '2026-01-01T00:00:00.000Z',
        },
      ]);
      const res = await read('adult', 'connection_coach_adult');
      expect(res.status).toBe(200);
      expect(res.body.messages).toHaveLength(1);
      expect(res.body.thread.closedReason).toBe('connection_ended');

      const blocked = await send('adult', 'connection_coach_adult', { body: 'one more thing' });
      expect(blocked.status).toBe(409);
      expect(blocked.body.error.code).toBe('THREAD_CLOSED');
    });
  });

  describe('the thread list', () => {
    it('shows only this person’s threads, newest activity first', async () => {
      s.threads.set('connection_coach_adult', openThread({ lastMessageAt: '2026-05-01T00:00:00.000Z' }));
      s.threads.set(
        'application_l1_adult',
        openThread({
          id: 'application_l1_adult',
          kind: 'application',
          sourceId: 'l1_adult',
          subject: 'Provincial trials',
          lastMessageAt: '2026-06-01T00:00:00.000Z',
        }),
      );
      s.threads.set(
        'connection_other',
        openThread({
          id: 'connection_other',
          ...threadMembership(
            [
              { uid: 'stranger', displayName: 'Nosy Person', role: 'coach' },
              { uid: 'org', displayName: 'Test FC', role: 'organisation' },
            ],
            [],
            false,
          ),
        }),
      );
      const res = await request(app).get('/api/messages/threads').set(as('adult'));
      expect(res.status).toBe(200);
      expect(res.body.threads.map((t: ThreadDoc) => t.id)).toEqual([
        'application_l1_adult',
        'connection_coach_adult',
      ]);
    });
  });

  describe('conversations that should already exist', () => {
    it('opens a thread for a connection accepted before messaging existed', async () => {
      // The relationship is there; no thread was ever created for it.
      s.connections.set('coach_adult', connection());
      expect(s.threads.size).toBe(0);

      const res = await request(app).get('/api/messages/threads').set(as('coach'));
      expect(res.status).toBe(200);
      expect(res.body.threads.map((t: ThreadDoc) => t.id)).toEqual([
        threadIdFor('connection', 'coach_adult'),
      ]);
    });

    it('opens one for an application shortlisted before messaging existed', async () => {
      s.applications.set('l1_adult', application({ status: 'shortlisted' }));
      const res = await request(app).get('/api/messages/threads').set(as('org'));
      expect(res.body.threads).toHaveLength(1);
      expect(res.body.threads[0].subject).toBe('Provincial trials');
    });

    it("lets a parent reach their child's conversation, which names neither of them on it", async () => {
      // The guardian's uid is on neither the connection nor the application, so they are found
      // through their child. A parent who cannot reach this is the whole point of the design failing.
      s.connections.set(
        'coach_kid',
        connection({ athleteUid: 'kid', athleteName: 'Young Athlete', athleteIsMinor: true }),
      );
      const res = await request(app).get('/api/messages/threads').set(as('mum'));
      expect(res.status).toBe(200);
      expect(res.body.threads).toHaveLength(1);
      expect(res.body.threads[0].participantUids).toContain('mum');
      expect(res.body.threads[0].hasMinor).toBe(true);
    });

    it('leaves relationships that have not earned a conversation alone', async () => {
      s.connections.set('coach_adult', connection({ status: 'pending' }));
      s.applications.set('l1_adult', application({ status: 'submitted' }));
      const res = await request(app).get('/api/messages/threads').set(as('coach'));
      expect(res.body.threads).toEqual([]);
      expect(s.threads.size).toBe(0);
    });

    it('creates nothing on a second visit, and never duplicates a thread', async () => {
      s.connections.set('coach_adult', connection());
      await request(app).get('/api/messages/threads').set(as('coach'));
      const after = s.threads.size;
      await request(app).get('/api/messages/threads').set(as('coach'));
      await request(app).get('/api/messages/threads').set(as('adult'));
      expect(s.threads.size).toBe(after);
      expect(after).toBe(1);
    });

    it('still shows what it has when the repair itself fails', async () => {
      s.threads.set('connection_coach_adult', openThread());
      s.repo.acceptedConnectionIds = async () => {
        throw new Error('firestore down');
      };
      const res = await request(app).get('/api/messages/threads').set(as('coach'));
      expect(res.status).toBe(200);
      expect(res.body.threads).toHaveLength(1);
    });
  });
});
