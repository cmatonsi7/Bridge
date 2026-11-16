import { Router, type Request } from 'express';
import rateLimit from 'express-rate-limit';
import { emailPreferencesSchema } from '@sportbridge/shared';
import type { AuthPort } from '../services/ports.js';
import type { EmailRepoPort } from '../services/email.js';
import { requireAuth } from '../middleware/auth.js';

/** Reading and changing which emails a person wants. Their own settings and nobody else's. */
export function emailPreferencesRouter(deps: { auth: AuthPort; email: EmailRepoPort }) {
  const r = Router();
  const limiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: 60, standardHeaders: 'draft-7', legacyHeaders: false });
  const uidOf = (req: Request) => (req.auth! as unknown as { uid: string }).uid;
  const auth = requireAuth(deps.auth);

  r.get('/email-preferences', limiter, auth, async (req, res, next) => {
    try {
      res.json({ preferences: await deps.email.getPreferences(uidOf(req)) });
    } catch (err) {
      next(err);
    }
  });

  r.put('/email-preferences', limiter, auth, async (req, res, next) => {
    try {
      const prefs = emailPreferencesSchema.parse(req.body ?? {});
      await deps.email.setPreferences(uidOf(req), prefs);
      res.json({ preferences: prefs });
    } catch (err) {
      next(err);
    }
  });

  return r;
}
