import { Router, type Request } from 'express';
import rateLimit from 'express-rate-limit';
import type { AuthPort } from '../services/ports.js';
import {
  closeRequest,
  createRequest,
  makeOffer,
  reportRequest,
  respondToOffer,
  reviewRequest,
  withdrawOffer,
  type Caller,
  type SponsorshipRepoPort,
} from '../services/sponsorship.js';
import { requireAdmin, requireAuth } from '../middleware/auth.js';
import { HttpError } from '../middleware/errors.js';

export function sponsorshipRouter(deps: { auth: AuthPort; sponsorship: SponsorshipRepoPort }) {
  const r = Router();
  const limiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 60,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
  });
  const caller = (req: Request): Caller => {
    const t = req.auth! as unknown as {
      uid: string;
      role?: string;
      admin?: boolean;
      email_verified?: boolean;
    };
    return { uid: t.uid, role: t.role, admin: t.admin === true, emailVerified: t.email_verified === true };
  };
  const reqId = (id: string | undefined) => {
    if (!id || !/^[A-Za-z0-9]{1,64}$/.test(id)) throw new HttpError(400, 'BAD_REQUEST_ID', 'Invalid request');
    return id;
  };
  const offId = (id: string | undefined) => {
    if (!id || !/^[A-Za-z0-9]{1,64}_[A-Za-z0-9]{1,128}$/.test(id))
      throw new HttpError(400, 'BAD_OFFER_ID', 'Invalid offer');
    return id;
  };
  const run =
    (fn: (req: Request) => Promise<unknown>, status = 200) =>
    async (req: Request, res: import('express').Response, next: import('express').NextFunction) => {
      try {
        res.status(status).json((await fn(req)) ?? { ok: true });
      } catch (err) {
        next(err);
      }
    };
  const s = deps.sponsorship;
  const auth = requireAuth(deps.auth);

  r.post(
    '/sponsorship/requests',
    limiter,
    auth,
    run((q) => createRequest(s, caller(q), q.body), 201),
  );
  r.post(
    '/sponsorship/requests/:id/close',
    limiter,
    auth,
    run((q) => closeRequest(s, caller(q), reqId(q.params.id))),
  );
  r.post(
    '/sponsorship/requests/:id/report',
    limiter,
    auth,
    run((q) => reportRequest(s, caller(q), reqId(q.params.id), q.body)),
  );
  r.post(
    '/sponsorship/requests/:id/offers',
    limiter,
    auth,
    run((q) => makeOffer(s, caller(q), reqId(q.params.id), q.body), 201),
  );
  r.post(
    '/sponsorship/offers/:id/respond',
    limiter,
    auth,
    run((q) => respondToOffer(s, caller(q), offId(q.params.id), q.body)),
  );
  r.post(
    '/sponsorship/offers/:id/withdraw',
    limiter,
    auth,
    run((q) => withdrawOffer(s, caller(q), offId(q.params.id))),
  );
  r.post(
    '/admin/sponsorship/requests/:id/review',
    limiter,
    auth,
    requireAdmin(),
    run((q) => reviewRequest(s, caller(q), reqId(q.params.id), q.body)),
  );
  return r;
}
