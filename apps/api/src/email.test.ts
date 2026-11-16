import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  DEFAULT_EMAIL_PREFERENCES,
  MESSAGE_EMAIL_QUIET_MS,
  type EmailPreferences,
  type NotificationDoc,
  type OutgoingEmail,
} from '@sportbridge/shared';
import { buildEmail, deliverEmails, threadIdFromLink, type EmailRepoPort } from './services/email.js';
import { dispatchNotifications, setNotificationDispatcher } from './services/notifier.js';
import { loggingEmailSender, nullEmailSender, senderFromEnv } from './services/emailSenders.js';

const APP = 'https://sportbridge.example';

const note = (over: Partial<NotificationDoc> = {}): NotificationDoc => ({
  type: 'connection.request',
  title: 'A coach asked to connect',
  body: 'Coach Carter would like to connect.',
  link: '/app/connections',
  read: false,
  createdAt: '2026-11-16T10:00:00.000Z',
  ...over,
});

function fakeRepo(over: { email?: string; preferences?: EmailPreferences } = {}) {
  const throttle = new Map<string, string>();
  const prefs = new Map<string, EmailPreferences>();
  const repo: EmailRepoPort = {
    async getRecipient(uid) {
      if (uid === 'nobody') return null;
      return {
        uid,
        email: over.email ?? `${uid}@example.com`,
        displayName: uid === 'mum' ? 'Thandi Mokoena' : 'Sam Smith',
        preferences: prefs.get(uid) ?? over.preferences ?? { ...DEFAULT_EMAIL_PREFERENCES },
      };
    },
    async lastMessageEmailAt(uid, threadId) {
      return throttle.get(`${uid}:${threadId}`) ?? null;
    },
    async markMessageEmailSent(uid, threadId, at) {
      throttle.set(`${uid}:${threadId}`, at);
    },
    async getPreferences(uid) {
      return prefs.get(uid) ?? { ...DEFAULT_EMAIL_PREFERENCES };
    },
    async setPreferences(uid, p) {
      prefs.set(uid, p);
    },
  };
  return { repo, throttle, prefs };
}

function fakeSender() {
  const sent: OutgoingEmail[] = [];
  return { sent, sender: { async send(e: OutgoingEmail) { sent.push(e); } } };
}

describe('building the email', () => {
  it('uses an inbox-worthy subject rather than the title from the bell', () => {
    const e = buildEmail(
      { uid: 'mum', email: 'mum@example.com', displayName: 'Thandi Mokoena', preferences: DEFAULT_EMAIL_PREFERENCES },
      note(),
      APP,
    );
    expect(e.subject).toBe('A coach would like to connect');
    expect(e.to).toBe('mum@example.com');
  });

  it('turns the in-app link into a full one somebody can click from their inbox', () => {
    const e = buildEmail(
      { uid: 'u', email: 'u@example.com', displayName: 'Sam', preferences: DEFAULT_EMAIL_PREFERENCES },
      note({ link: '/app/connections' }),
      'https://sportbridge.example/',
    );
    // Trailing slash on the base must not produce a double slash.
    expect(e.text).toContain('https://sportbridge.example/app/connections');
    expect(e.text).not.toContain('example//app');
  });

  it('tells a parent why they are being written to', () => {
    const e = buildEmail(
      { uid: 'mum', email: 'm@example.com', displayName: 'Thandi', preferences: DEFAULT_EMAIL_PREFERENCES },
      note({ type: 'connection.request' }),
      APP,
    );
    expect(e.text).toContain('confirmed parent or guardian');
  });

  it('tells someone how to stop message emails, in the message email itself', () => {
    const e = buildEmail(
      { uid: 'u', email: 'u@example.com', displayName: 'Sam', preferences: DEFAULT_EMAIL_PREFERENCES },
      note({ type: 'message.received', link: '/app/messages' }),
      APP,
    );
    expect(e.text).toContain('turn message emails off');
  });
});

describe('deciding whether to send', () => {
  let sender: ReturnType<typeof fakeSender>;
  beforeEach(() => {
    sender = fakeSender();
  });

  it('emails each recipient of a notification', async () => {
    const { repo } = fakeRepo();
    const sent = await deliverEmails({ repo, sender: sender.sender, appUrl: APP }, [
      { uid: 'mum', notification: note() },
      { uid: 'kid', notification: note() },
    ]);
    expect(sent).toBe(2);
    expect(sender.sent.map((e) => e.to).sort()).toEqual(['kid@example.com', 'mum@example.com']);
  });

  it('skips someone with no account or no address', async () => {
    const { repo } = fakeRepo();
    await deliverEmails({ repo, sender: sender.sender, appUrl: APP }, [{ uid: 'nobody', notification: note() }]);
    expect(sender.sent).toHaveLength(0);
  });

  it('honours a switched-off preference', async () => {
    const { repo } = fakeRepo({ preferences: { activity: true, messages: false } });
    await deliverEmails({ repo, sender: sender.sender, appUrl: APP }, [
      { uid: 'u', notification: note({ type: 'message.received', link: '/app/messages' }) },
    ]);
    expect(sender.sent).toHaveLength(0);
  });

  it('ignores the preference for anything about the safety of an account', async () => {
    const { repo } = fakeRepo({ preferences: { activity: false, messages: false } });
    await deliverEmails({ repo, sender: sender.sender, appUrl: APP }, [
      { uid: 'mum', notification: note({ type: 'connection.request' }) },
    ]);
    expect(sender.sent).toHaveLength(1);
  });

  it('never lets a broken provider fail the thing that triggered it', async () => {
    const { repo } = fakeRepo();
    const exploding = { async send() { throw new Error('provider down'); } };
    await expect(
      deliverEmails({ repo, sender: exploding, appUrl: APP }, [{ uid: 'u', notification: note() }]),
    ).resolves.toBe(0);
  });
});

describe('not flooding somebody about one conversation', () => {
  it('sends the first message email and holds the next one back', async () => {
    const { repo } = fakeRepo();
    const sender = fakeSender();
    const msg = { uid: 'u', notification: note({ type: 'message.received', link: '/app/messages' }) };
    const t0 = new Date('2026-11-16T10:00:00.000Z');

    await deliverEmails({ repo, sender: sender.sender, appUrl: APP }, [msg], t0);
    expect(sender.sent).toHaveLength(1);

    const soon = new Date(t0.getTime() + MESSAGE_EMAIL_QUIET_MS - 1000);
    await deliverEmails({ repo, sender: sender.sender, appUrl: APP }, [msg], soon);
    expect(sender.sent).toHaveLength(1);

    const later = new Date(t0.getTime() + MESSAGE_EMAIL_QUIET_MS + 1000);
    await deliverEmails({ repo, sender: sender.sender, appUrl: APP }, [msg], later);
    expect(sender.sent).toHaveLength(2);
  });

  it('does not hold back anything other than messages', async () => {
    const { repo } = fakeRepo();
    const sender = fakeSender();
    const entry = { uid: 'u', notification: note({ type: 'application.status' }) };
    const t0 = new Date('2026-11-16T10:00:00.000Z');
    await deliverEmails({ repo, sender: sender.sender, appUrl: APP }, [entry], t0);
    await deliverEmails({ repo, sender: sender.sender, appUrl: APP }, [entry], t0);
    expect(sender.sent).toHaveLength(2);
  });

  it('reads the conversation out of the link', () => {
    expect(threadIdFromLink('/app/messages/connection_a_b')).toBe('connection_a_b');
    expect(threadIdFromLink('/app/messages')).toBe('messages');
    expect(threadIdFromLink('/app/connections')).toBeNull();
  });
});

describe('the notifier seam', () => {
  beforeEach(() => setNotificationDispatcher(null));

  it('does nothing at all until something is wired up', () => {
    expect(() => dispatchNotifications([{ uid: 'u', notification: note() }])).not.toThrow();
  });

  it('hands notifications to whatever was wired up', () => {
    const seen: string[] = [];
    setNotificationDispatcher((outbox) => seen.push(...outbox.map((o) => o.uid)));
    dispatchNotifications([{ uid: 'mum', notification: note() }]);
    expect(seen).toEqual(['mum']);
  });

  it('does not call out on an empty batch', () => {
    const spy = vi.fn();
    setNotificationDispatcher(spy);
    dispatchNotifications([]);
    expect(spy).not.toHaveBeenCalled();
  });

  it('survives a dispatcher that throws, because a request must not fail over email', () => {
    setNotificationDispatcher(() => {
      throw new Error('boom');
    });
    expect(() => dispatchNotifications([{ uid: 'u', notification: note() }])).not.toThrow();
  });
});

describe('choosing a sender', () => {
  it('logs instead of sending when nothing is configured', async () => {
    const lines: string[] = [];
    const s = loggingEmailSender((m) => lines.push(m));
    await s.send({ to: 'a@b.co', toName: 'A', subject: 'Hello', text: 't', html: '<p>t</p>' });
    expect(lines[0]).toContain('a@b.co');
    expect(senderFromEnv({} as NodeJS.ProcessEnv)).toBeTruthy();
  });

  it('falls back to logging when a provider is named but half-configured', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const s = senderFromEnv({ EMAIL_PROVIDER: 'resend' } as NodeJS.ProcessEnv);
    expect(s).toBeTruthy();
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });

  it('uses the provider once it has everything it needs', () => {
    const s = senderFromEnv({
      EMAIL_PROVIDER: 'resend',
      RESEND_API_KEY: 'k',
      EMAIL_FROM: 'SportBridge <no-reply@example.com>',
    } as NodeJS.ProcessEnv);
    // Different object from the logging fallback.
    expect(s).not.toBe(nullEmailSender);
    expect(typeof s.send).toBe('function');
  });
});
