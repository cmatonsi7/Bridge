import { Router, type Request } from 'express';
import rateLimit from 'express-rate-limit';
import { limitsFor, effectiveStatus, trialDaysLeft } from '@sportbridge/shared';
import type { AuthPort } from '../services/ports.js';
import {
  getMembership,
  recordUpgradeInterest,
  type Caller,
  type MembershipRepoPort,
} from '../services/membership.js';
import { requireAuth } from '../middleware/auth.js';

export function membershipRouter(deps: { auth: AuthPort; membership: MembershipRepoPort }) {
  const r = Router();
  const limiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 60,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
  });
  const caller = (req: Request): Caller => {
    const t = req.auth! as unknown as { uid: string; role?: string; admin?: boolean };
    return { uid: t.uid, role: t.role, admin: t.admin === true };
  };
  /** What the app needs to draw the page: the record, plus the two things it would otherwise work out itself. */
  const withView = (m: Awaited<ReturnType<typeof getMembership>>) => ({
    membership: m,
    status: effectiveStatus(m),
    limits: limitsFor(m),
    trialDaysLeft: trialDaysLeft(m),
  });
  const run =
    (fn: (req: Request) => Promise<unknown>, status = 200) =>
    async (req: Request, res: import('express').Response, next: import('express').NextFunction) => {
      try {
        res.status(status).json((await fn(req)) ?? { ok: true });
      } catch (err) {
        next(err);
      }
    };
  const m = deps.membership;
  const auth = requireAuth(deps.auth);

  r.get(
    '/membership',
    limiter,
    auth,
    run(async (q) => withView(await getMembership(m, caller(q)))),
  );
  r.post(
    '/membership/interest',
    limiter,
    auth,
    run(async (q) => withView(await recordUpgradeInterest(m, caller(q), q.body))),
  );
  return r;
}
