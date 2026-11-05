import { Router, type Request } from 'express';
import rateLimit from 'express-rate-limit';
import type { AuthPort } from '../services/ports.js';
import {
  answerConnection,
  endConnection,
  requestConnection,
  syncOwnEntry,
  type DirectoryCaller,
  type DirectoryRepoPort,
} from '../services/directory.js';
import { requireAuth } from '../middleware/auth.js';
import { HttpError } from '../middleware/errors.js';

export function directoryRouter(deps: { auth: AuthPort; directory: DirectoryRepoPort }) {
  const r = Router();
  const limiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 100,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
  });
  const caller = (req: Request): DirectoryCaller => {
    const t = req.auth! as unknown as { uid: string; role?: string; email_verified?: boolean };
    return { uid: t.uid, role: t.role, emailVerified: t.email_verified === true };
  };
  const connId = (id: string | undefined) => {
    if (!id || !/^[A-Za-z0-9]{1,128}_[A-Za-z0-9]{1,128}$/.test(id))
      throw new HttpError(400, 'BAD_CONNECTION_ID', 'Invalid request');
    return id;
  };

  r.post('/directory/sync', limiter, requireAuth(deps.auth), async (req, res, next) => {
    try {
      res.json(await syncOwnEntry(deps.directory, caller(req)));
    } catch (err) {
      next(err);
    }
  });
  r.post('/connections', limiter, requireAuth(deps.auth), async (req, res, next) => {
    try {
      res.status(201).json(await requestConnection(deps.directory, caller(req), req.body));
    } catch (err) {
      next(err);
    }
  });
  for (const [path, accept] of [
    ['accept', true],
    ['decline', false],
  ] as const) {
    r.post(`/connections/:id/${path}`, limiter, requireAuth(deps.auth), async (req, res, next) => {
      try {
        await answerConnection(deps.directory, caller(req), connId(req.params.id), accept);
        res.json({ ok: true });
      } catch (err) {
        next(err);
      }
    });
  }
  r.post('/connections/:id/end', limiter, requireAuth(deps.auth), async (req, res, next) => {
    try {
      await endConnection(deps.directory, caller(req), connId(req.params.id));
      res.json({ ok: true });
    } catch (err) {
      next(err);
    }
  });
  return r;
}
