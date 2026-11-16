import type { NotificationDoc } from '@sportbridge/shared';

/**
 * The seam between writing a notification and emailing it.
 *
 * Notifications are written inside Firestore transactions, spread across several repositories. Email
 * must happen *after* those commit: a transaction can be retried, and an email cannot be unsent. Rather
 * than thread an email port through every repository, each one hands its delivered notifications here
 * once its write has succeeded, and this module forwards them to whatever was configured at startup.
 *
 * Nothing is configured in tests unless a test configures it, so this is inert by default.
 */

export type DeliveredNotifications = { uid: string; notification: NotificationDoc }[];
type Dispatcher = (outbox: DeliveredNotifications) => void;

let dispatcher: Dispatcher | null = null;

export function setNotificationDispatcher(fn: Dispatcher | null) {
  dispatcher = fn;
}

/**
 * Fire and forget, on purpose. The caller has already committed its write and returned a result to the
 * user; whether an email goes out must never change that outcome, or delay it.
 */
export function dispatchNotifications(outbox: DeliveredNotifications) {
  if (!dispatcher || outbox.length === 0) return;
  try {
    dispatcher(outbox);
  } catch {
    // A broken dispatcher must not break the request that triggered it.
  }
}
