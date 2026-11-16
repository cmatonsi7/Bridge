import type { EmailSender, OutgoingEmail } from '@sportbridge/shared';

/**
 * The senders. Everything provider-specific lives in this file, and only this file changes when the
 * client picks one.
 *
 * Nothing is connected yet. With no credentials configured the server uses the logging sender, which
 * means the rest of the platform behaves exactly as it will in production, minus the actual email.
 */

/** Writes the email to the server log instead of sending it. Used until a provider is configured. */
export function loggingEmailSender(log: (msg: string) => void = console.log): EmailSender {
  return {
    async send(email: OutgoingEmail) {
      log(`[email] would send to ${email.to}: ${email.subject}`);
    },
  };
}

/** Drops everything. For tests that do not care about email. */
export const nullEmailSender: EmailSender = { async send() {} };

/**
 * Resend (https://resend.com). Chosen as the first adapter because it needs one API key and a verified
 * domain, with no SDK. Swapping it for Postmark or SendGrid is a change to this function alone.
 */
export function resendEmailSender(opts: { apiKey: string; from: string }): EmailSender {
  return {
    async send(email: OutgoingEmail) {
      const res = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${opts.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: opts.from,
          to: [email.to],
          subject: email.subject,
          text: email.text,
          html: email.html,
        }),
      });
      if (!res.ok) {
        // Read the body for the log; deliverEmails swallows this, so it must say enough to diagnose.
        const detail = await res.text().catch(() => '');
        throw new Error(`Resend refused the email (${res.status}): ${detail.slice(0, 200)}`);
      }
    },
  };
}

/**
 * Picks a sender from the environment.
 *
 * EMAIL_PROVIDER=resend with RESEND_API_KEY and EMAIL_FROM sends real email. Anything else logs.
 * Starting without credentials is a supported state, not a misconfiguration.
 */
export function senderFromEnv(env: NodeJS.ProcessEnv = process.env): EmailSender {
  if (env.EMAIL_PROVIDER === 'resend' && env.RESEND_API_KEY && env.EMAIL_FROM) {
    return resendEmailSender({ apiKey: env.RESEND_API_KEY, from: env.EMAIL_FROM });
  }
  if (env.EMAIL_PROVIDER) {
    console.warn(
      `[email] EMAIL_PROVIDER is "${env.EMAIL_PROVIDER}" but its settings are incomplete; falling back to logging.`,
    );
  }
  return loggingEmailSender();
}
