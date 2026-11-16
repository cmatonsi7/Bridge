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
import {
  closeThreadFor,
  threadForConnection,
  type MessagesRepoPort,
} from '../services/messages.js';

export function directoryRouter(deps: {
  auth: AuthPort;
  directory: DirectoryRepoPort;
  /** Optional so the directory keeps working if messaging is not wired up. */
  messages?: MessagesRepoPort;
}) {
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
        const id = connId(req.params.id);
        await answerConnection(deps.directory, caller(req), id, accept);
        // Accepting is what opens the pair's conversation. A failure here must not undo the acceptance,
        // which has already been written — the thread is created again on the next Messages visit.
        if (accept && deps.messages) {
          await threadForConnection(deps.messages, id).catch(() => undefined);
        }
        res.json({ ok: true });
      } catch (err) {
        next(err);
      }
    });
  }
  r.post('/connections/:id/end', limiter, requireAuth(deps.auth), async (req, res, next) => {
    try {
      const id = connId(req.params.id);
      await endConnection(deps.directory, caller(req), id);
      // The conversation goes read-only with the connection: the history stays, the door shuts.
      if (deps.messages) {
        await closeThreadFor(deps.messages, 'connection', id, 'connection_ended').catch(() => undefined);
      }
      res.json({ ok: true });
    } catch (err) {
      next(err);
    }
  });
  return r;
}
