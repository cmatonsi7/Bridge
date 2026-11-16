import { z } from 'zod';
import type { NotificationType } from './applications.js';

/**
 * Email (Phase 6).
 *
 * Until now every notification lived inside the app, which meant a parent who did not happen to log in
 * never learned that a coach had asked to connect with their child, or that somebody had messaged them.
 * For a platform whose child-safety design rests on a parent paying attention, that was a hole.
 *
 * No provider is connected yet. Everything below is provider-agnostic: the client picks a sender and a
 * domain, and the only change is credentials and one adapter. Same approach as the payment gateway.
 */

/** Which emails a person wants. Service emails about their own account are not optional. */
export interface EmailPreferences {
  /** A coach asks to connect, a parent is asked to confirm, an application changes. */
  activity: boolean;
  /** Somebody sends a message. Separate because it is the noisiest. */
  messages: boolean;
}

export const DEFAULT_EMAIL_PREFERENCES: EmailPreferences = { activity: true, messages: true };

export const emailPreferencesSchema = z.object({
  activity: z.boolean(),
  messages: z.boolean(),
});
export type EmailPreferencesInput = z.input<typeof emailPreferencesSchema>;

/**
 * Which preference governs each kind of notification.
 *
 * `null` means the email is sent whatever the person has chosen, because it concerns the safety or the
 * standing of their own account. A parent cannot switch off being told that their child was asked to
 * apply somewhere; that is the point of the account.
 */
export const EMAIL_CATEGORY: Record<NotificationType, keyof EmailPreferences | null> = {
  'application.received': 'activity',
  'application.child_applied': null,
  'application.status': 'activity',
  'application.withdrawn': 'activity',
  'organisation.verification': null,
  'sponsorship.offer': 'activity',
  'sponsorship.response': 'activity',
  'sponsorship.reviewed': null,
  'message.received': 'messages',
  'coach.verification': null,
  'connection.request': null,
  'connection.answer': 'activity',
};

export function wantsEmail(type: NotificationType, prefs: EmailPreferences): boolean {
  const category = EMAIL_CATEGORY[type];
  if (category === null) return true;
  return prefs[category] !== false;
}

/**
 * How long to wait before emailing the same person about the same conversation again.
 *
 * A back-and-forth should not put ten emails in somebody's inbox. The notification inside the app is
 * still written every time; only the email is held back.
 */
export const MESSAGE_EMAIL_QUIET_MS = 30 * 60 * 1000;

export interface OutgoingEmail {
  to: string;
  toName: string;
  subject: string;
  text: string;
  html: string;
}

/** What a sender has to do. Everything else about email is this one method. */
export interface EmailSender {
  send(email: OutgoingEmail): Promise<void>;
}

const esc = (s: string) =>
  s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

/**
 * One plain template for every email. Deliberately plain: these go to parents on old phones and school
 * office accounts, and a layout that survives anywhere beats one that looks good in a preview.
 */
export function renderEmail(args: {
  toName: string;
  title: string;
  body: string;
  actionLabel: string;
  actionUrl: string;
  footerNote?: string;
}): { text: string; html: string } {
  const { toName, title, body, actionLabel, actionUrl, footerNote } = args;
  const firstName = toName.split(' ')[0] || toName;
  const text = [
    `Hi ${firstName}`,
    '',
    body,
    '',
    `${actionLabel}: ${actionUrl}`,
    '',
    footerNote ?? '',
    '',
    'SportBridge',
  ]
    .filter((line, i, all) => !(line === '' && all[i - 1] === ''))
    .join('\n');

  const html = `<!doctype html>
<html><body style="margin:0;padding:24px;background:#f6f9f7;font-family:-apple-system,Segoe UI,Roboto,Arial,sans-serif;color:#1b2420">
<div style="max-width:520px;margin:0 auto;background:#ffffff;border:1px solid #e4eae6;border-radius:12px;padding:24px">
<p style="margin:0 0 4px;font-size:12px;letter-spacing:.08em;color:#006b35;font-weight:700">SPORTBRIDGE</p>
<h1 style="margin:0 0 16px;font-size:20px;line-height:1.3">${esc(title)}</h1>
<p style="margin:0 0 12px">Hi ${esc(firstName)}</p>
<p style="margin:0 0 20px;line-height:1.5">${esc(body)}</p>
<p style="margin:0 0 20px"><a href="${esc(actionUrl)}" style="display:inline-block;background:#006b35;color:#ffffff;text-decoration:none;padding:10px 18px;border-radius:8px;font-weight:600">${esc(actionLabel)}</a></p>
${footerNote ? `<p style="margin:0;font-size:13px;color:#66736c;line-height:1.5">${esc(footerNote)}</p>` : ''}
</div>
<p style="max-width:520px;margin:12px auto 0;font-size:12px;color:#8a948e">SportBridge</p>
</body></html>`;
  return { text, html };
}
