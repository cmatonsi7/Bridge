import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import type { AuthPort } from '../services/ports.js';
import {
  confirmLink,
  declineLink,
  revokeLink,
  type GuardianRepoPort,
  type GuardianCaller,
} from '../services/guardian.js';
import { requireAuth } from '../middleware/auth.js';
import { HttpError } from '../middleware/errors.js';

export function guardianRouter(deps: { auth: AuthPort; guardians: GuardianRepoPort }) {
  const r = Router();
  const limiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 60,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
  });

  const caller = (req: Parameters<Parameters<typeof r.post>[1]>[0]): GuardianCaller => {
    const t = req.auth! as unknown as {
      uid: string;
      email?: string;
      email_verified?: boolean;
      role?: string;
    };
    return { uid: t.uid, email: t.email, emailVerified: t.email_verified === true, role: t.role };
  };
  const linkId = (id: string | undefined) => {
    if (!id || !/^[A-Za-z0-9]{1,64}$/.test(id)) throw new HttpError(400, 'BAD_LINK_ID', 'Invalid request id');
    return id;
  };

  const actions = { confirm: confirmLink, decline: declineLink, revoke: revokeLink } as const;
  for (const [name, fn] of Object.entries(actions)) {
    r.post(`/guardian/links/:id/${name}`, limiter, requireAuth(deps.auth), async (req, res, next) => {
      try {
        await fn(deps.guardians, caller(req), linkId(req.params.id));
        res.json({ ok: true });
      } catch (err) {
        next(err);
      }
    });
  }
  return r;
}
