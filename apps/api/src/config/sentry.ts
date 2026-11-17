import * as Sentry from '@sentry/node';

/**
 * Error monitoring. With no SENTRY_DSN set this is a complete no-op, the same shape the email
 * provider takes with no credentials (see emailSenders.ts) — nothing to configure, nothing sent,
 * everything else behaves exactly as it will once a DSN is added. Get a DSN from a free Sentry
 * project (sentry.io) and set SENTRY_DSN to turn this on.
 */
export function initSentry(env: NodeJS.ProcessEnv = process.env): void {
  const dsn = env.SENTRY_DSN;
  if (!dsn) return;
  Sentry.init({
    dsn,
    environment: env.NODE_ENV ?? 'development',
    // Error capture only — no performance tracing, no session data. Keeps this within the free
    // tier's event quota and doesn't add anything to think about beyond "did it crash".
    tracesSampleRate: 0,
  });
}

/** Reports an error to Sentry if it's configured; otherwise does nothing. */
export function reportError(err: unknown): void {
  if (!Sentry.isInitialized()) return;
  Sentry.captureException(err);
}
