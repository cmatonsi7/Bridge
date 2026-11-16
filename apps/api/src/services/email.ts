import {
  renderEmail,
  wantsEmail,
  DEFAULT_EMAIL_PREFERENCES,
  MESSAGE_EMAIL_QUIET_MS,
  type EmailPreferences,
  type EmailSender,
  type NotificationDoc,
  type OutgoingEmail,
} from '@sportbridge/shared';

/**
 * Turning in-app notifications into emails.
 *
 * Every notification the server already writes becomes a candidate email. This module decides whether
 * to send one, what it says, and keeps a lid on how often. It knows nothing about any provider.
 */

export interface EmailRecipient {
  uid: string;
  email: string;
  displayName: string;
  preferences: EmailPreferences;
}

export interface EmailRepoPort {
  getRecipient(uid: string): Promise<EmailRecipient | null>;
  /** When we last emailed this person about this thread, so a conversation is not a mailstorm. */
  lastMessageEmailAt(uid: string, threadId: string): Promise<string | null>;
  markMessageEmailSent(uid: string, threadId: string, at: string): Promise<void>;
  getPreferences(uid: string): Promise<EmailPreferences>;
  setPreferences(uid: string, prefs: EmailPreferences): Promise<void>;
}

/** Subject lines. The notification's own title is written for a bell, not an inbox. */
const SUBJECTS: Partial<Record<NotificationDoc['type'], string>> = {
  'application.received': 'A new application on SportBridge',
  'application.child_applied': 'Your child has applied for something',
  'application.status': 'An update on your application',
  'application.withdrawn': 'An application was withdrawn',
  'organisation.verification': 'Your organisation on SportBridge',
  'sponsorship.offer': 'Someone would like to sponsor',
  'sponsorship.response': 'A response to your sponsorship offer',
  'sponsorship.reviewed': 'Your sponsorship request has been reviewed',
  'message.received': 'You have a new message on SportBridge',
  'coach.verification': 'Your coaching credentials',
  'connection.request': 'A coach would like to connect',
  'connection.answer': 'An update on a connection',
};

const ACTIONS: Partial<Record<NotificationDoc['type'], string>> = {
  'message.received': 'Read the message',
  'connection.request': 'Review the request',
  'connection.answer': 'See your connections',
  'application.child_applied': 'Review it',
};

/**
 * The extra line under the body. A child's parent should be reminded, every time, why they are being
 * written to and what they are able to do about it.
 */
const FOOTERS: Partial<Record<NotificationDoc['type'], string>> = {
  'application.child_applied':
    'You receive this because you are the confirmed parent or guardian of this athlete. You can change what happens next in SportBridge.',
  'connection.request':
    'You receive this because you are the confirmed parent or guardian of this athlete, and nothing happens until you decide.',
  'message.received':
    'You can turn message emails off in your settings. Notifications about your account will still reach you.',
};

export function buildEmail(
  recipient: EmailRecipient,
  notification: NotificationDoc,
  appUrl: string,
): OutgoingEmail {
  const subject = SUBJECTS[notification.type] ?? notification.title;
  const { text, html } = renderEmail({
    toName: recipient.displayName,
    title: notification.title,
    body: notification.body,
    actionLabel: ACTIONS[notification.type] ?? 'Open SportBridge',
    actionUrl: `${appUrl.replace(/\/$/, '')}${notification.link}`,
    footerNote: FOOTERS[notification.type],
  });
  return { to: recipient.email, toName: recipient.displayName, subject, text, html };
}

/** Pulled out of the notification's link so repeated messages in one conversation can be grouped. */
export const threadIdFromLink = (link: string): string | null => {
  const m = /\/app\/messages\/?([A-Za-z0-9_]+)?/.exec(link);
  return m?.[1] ?? (link.startsWith('/app/messages') ? 'messages' : null);
};

export interface EmailDeps {
  repo: EmailRepoPort;
  sender: EmailSender;
  appUrl: string;
}

/**
 * Sends the emails for one batch of notifications.
 *
 * Called after the database write has committed, never inside it: a transaction can be retried, and an
 * email cannot be unsent. Every failure is swallowed on purpose — a provider outage must not turn a
 * successful application into a failed request. The in-app notification is already safely written.
 */
export async function deliverEmails(
  deps: EmailDeps,
  outbox: { uid: string; notification: NotificationDoc }[],
  now = new Date(),
): Promise<number> {
  let sent = 0;
  await Promise.all(
    outbox.map(async (entry) => {
      try {
        const recipient = await deps.repo.getRecipient(entry.uid);
        if (!recipient?.email) return;
        if (!wantsEmail(entry.notification.type, recipient.preferences)) return;

        // A conversation gets one email every half hour, not one per message.
        if (entry.notification.type === 'message.received') {
          const threadId = threadIdFromLink(entry.notification.link) ?? 'messages';
          const last = await deps.repo.lastMessageEmailAt(entry.uid, threadId);
          if (last && now.getTime() - new Date(last).getTime() < MESSAGE_EMAIL_QUIET_MS) return;
          await deps.repo.markMessageEmailSent(entry.uid, threadId, now.toISOString());
        }

        await deps.sender.send(buildEmail(recipient, entry.notification, deps.appUrl));
        sent += 1;
      } catch {
        // Deliberately silent: see the note above.
      }
    }),
  );
  return sent;
}

export const defaultPreferences = (): EmailPreferences => ({ ...DEFAULT_EMAIL_PREFERENCES });
