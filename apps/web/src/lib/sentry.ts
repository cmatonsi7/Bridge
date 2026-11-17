import * as Sentry from '@sentry/react';

/**
 * Error monitoring for the browser. With no VITE_SENTRY_DSN set this is a complete no-op —
 * nothing initialises, nothing is ever sent. Get a DSN from a free Sentry project (sentry.io)
 * and set VITE_SENTRY_DSN to turn this on. Catches uncaught errors and unhandled promise
 * rejections automatically; nothing else to wire up for that.
 */
export function initSentry(): void {
  const dsn = import.meta.env.VITE_SENTRY_DSN;
  if (!dsn) return;
  Sentry.init({
    dsn,
    environment: import.meta.env.MODE,
    // Error capture only — no performance tracing, no session replay. Keeps this within the
    // free tier's event quota and doesn't add anything to think about beyond "did it crash".
    tracesSampleRate: 0,
  });
}
