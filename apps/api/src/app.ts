import express from 'express';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import fs from 'node:fs';
import path from 'node:path';
import type { AuthPort, UserRepoPort } from './services/ports.js';
import { onboardingRouter } from './routes/onboarding.js';
import { guardianRouter } from './routes/guardian.js';
import type { GuardianRepoPort } from './services/guardian.js';
import { errorHandler, notFound } from './middleware/errors.js';

export interface AppDeps {
  auth: AuthPort;
  users: UserRepoPort;
  guardians: GuardianRepoPort;
  webDistDir?: string;
  trustProxyHops?: number;
}

export function createApp(deps: AppDeps) {
  const app = express();
  app.disable('x-powered-by');
  app.set('trust proxy', deps.trustProxyHops ?? 1);

  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          // Firebase Auth loads https://apis.google.com/js/api.js itself (for its reCAPTCHA /
          // abuse-protection check on sign-up) and can render a reCAPTCHA challenge from
          // https://www.gstatic.com and https://www.google.com. Without these, the browser
          // silently blocks the script and Firebase Auth throws "n is not a function" the first
          // time getAuth()/sign-up actually needs it — this is not optional for email/password
          // auth even though we never call Google Sign-In ourselves.
          scriptSrc: ["'self'", 'https://apis.google.com', 'https://www.gstatic.com'],
          styleSrc: ["'self'", "'unsafe-inline'", 'https://www.gstatic.com'],
          imgSrc: ["'self'", 'data:', 'blob:', 'https://firebasestorage.googleapis.com'],
          fontSrc: ["'self'", 'data:'],
          connectSrc: [
            "'self'",
            'https://*.googleapis.com',
            'https://apis.google.com',
            'https://*.firebaseio.com',
            'wss://*.firebaseio.com',
            'https://*.firebaseapp.com',
          ],
          frameSrc: [
            'https://*.firebaseapp.com',
            'https://apis.google.com',
            'https://www.google.com',
            'https://www.gstatic.com',
          ],
          objectSrc: ["'none'"],
          baseUri: ["'self'"],
          formAction: ["'self'"],
          frameAncestors: ["'none'"],
        },
      },
      crossOriginEmbedderPolicy: false,
    }),
  );

  // ---- API ----
  const api = express.Router();
  api.use(express.json({ limit: '50kb' }));
  api.use(
    rateLimit({ windowMs: 15 * 60 * 1000, limit: 300, standardHeaders: 'draft-7', legacyHeaders: false }),
  );
  api.get('/health', (_req, res) => res.json({ status: 'ok', time: new Date().toISOString() }));
  api.use(onboardingRouter(deps));
  api.use(guardianRouter(deps));
  api.use(notFound);
  app.use('/api', api);

  // ---- Web app (single Railway service) ----
  const dist = deps.webDistDir;
  if (dist && fs.existsSync(path.join(dist, 'index.html'))) {
    // Hashed build assets, cached hard since their names change on every build.
    app.use(
      '/assets',
      express.static(path.join(dist, 'assets'), { immutable: true, maxAge: '1y', fallthrough: true }),
    );
    // Other static files (images, favicon).
    app.use(express.static(dist, { index: false, maxAge: '1h', fallthrough: true }));
    // Anything that still looks like a file gets a real 404 rather than the SPA shell below.
    // This matters after a redeploy: a browser holding a stale index.html asks for chunk
    // filenames that no longer exist. Falling through would answer with index.html at status 200,
    // so the browser would execute HTML as JavaScript — the cause of a "n is not a function"
    // crash on every page until a hard refresh. Failing loudly here keeps that impossible.
    app.get(/\.[a-zA-Z0-9]+$/, (_req, res) => {
      res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Not found' } });
    });
    // Real SPA routes: always serve the current index.html, never cached.
    app.get('*', (_req, res) => {
      res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
      res.sendFile(path.join(dist, 'index.html'));
    });
  }

  app.use(errorHandler);
  return app;
}
