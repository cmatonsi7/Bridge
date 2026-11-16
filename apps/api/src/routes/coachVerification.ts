import { Router, type Request } from 'express';
import rateLimit from 'express-rate-limit';
import type { AuthPort } from '../services/ports.js';
import {
  credentialsView,
  decideCredentials,
  nextUploadTarget,
  registerDocument,
  removeDocument,
  reviewQueue,
  submitForReview,
  type Caller,
  type CoachVerificationRepoPort,
} from '../services/coachVerification.js';
import { requireAuth } from '../middleware/auth.js';
import { HttpError } from '../middleware/errors.js';

export function coachVerificationRouter(deps: { auth: AuthPort; coachVerification: CoachVerificationRepoPort }) {
  const r = Router();
  const limiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 100,
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
  const id = (v: string | undefined, what: string) => {
    if (!v || !/^[A-Za-z0-9_-]{1,128}$/.test(v)) throw new HttpError(400, 'BAD_ID', `Invalid ${what}`);
    return v;
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
  const v = deps.coachVerification;
  const auth = requireAuth(deps.auth);

  // ---- The coach's own credentials
  r.get(
    '/coach/credentials',
    limiter,
    auth,
    run(async (q) => credentialsView(v, caller(q))),
  );
  /** Reserves the id and path the browser must upload to, before it uploads. */
  r.post(
    '/coach/credentials/upload-target',
    limiter,
    auth,
    run(async (q) => nextUploadTarget(v, caller(q)), 201),
  );
  r.post(
    '/coach/credentials/documents',
    limiter,
    auth,
    run(async (q) => registerDocument(v, caller(q), q.body), 201),
  );
  r.delete(
    '/coach/credentials/documents/:docId',
    limiter,
    auth,
    run(async (q) => {
      await removeDocument(v, caller(q), id(q.params.docId, 'document'));
    }),
  );
  r.post(
    '/coach/credentials/submit',
    limiter,
    auth,
    run(async (q) => {
      await submitForReview(v, caller(q));
    }),
  );

  // ---- Staff review
  r.get(
    '/admin/coach-verifications',
    limiter,
    auth,
    run(async (q) => ({ items: await reviewQueue(v, caller(q)) })),
  );
  r.post(
    '/admin/coach-verifications/:uid/decide',
    limiter,
    auth,
    run(async (q) => {
      await decideCredentials(v, caller(q), id(q.params.uid, 'coach'), q.body);
    }),
  );
  return r;
}
