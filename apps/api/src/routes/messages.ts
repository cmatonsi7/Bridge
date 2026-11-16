import { Router, type Request } from 'express';
import rateLimit from 'express-rate-limit';
import type { AuthPort } from '../services/ports.js';
import {
  listThreads,
  readThread,
  sendMessage,
  threadForApplication,
  threadForConnection,
  type Caller,
  type MessagesRepoPort,
} from '../services/messages.js';
import { requireAuth } from '../middleware/auth.js';
import { HttpError } from '../middleware/errors.js';

export function messagesRouter(deps: { auth: AuthPort; messages: MessagesRepoPort }) {
  const r = Router();
  const limiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 200,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
  });
  /** Sending is limited harder than reading: a message is a notification on somebody else's phone. */
  const sendLimiter = rateLimit({
    windowMs: 60 * 1000,
    limit: 20,
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
  const threadId = (id: string | undefined) => {
    if (!id || !/^[A-Za-z0-9_]{1,300}$/.test(id))
      throw new HttpError(400, 'BAD_THREAD_ID', 'Invalid conversation');
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
  const m = deps.messages;
  const auth = requireAuth(deps.auth);

  r.get(
    '/messages/threads',
    limiter,
    auth,
    run(async (q) => ({ threads: await listThreads(m, caller(q)) })),
  );
  r.get(
    '/messages/threads/:id',
    limiter,
    auth,
    run(async (q) => readThread(m, caller(q), threadId(q.params.id))),
  );
  r.post(
    '/messages/threads/:id/send',
    sendLimiter,
    auth,
    run(async (q) => sendMessage(m, caller(q), threadId(q.params.id), q.body), 201),
  );

  /**
   * Opens (or finds) the thread behind a relationship the caller already has. The relationship itself
   * is what grants access — this cannot conjure a conversation with somebody you have no tie to.
   * It exists so relationships formed before messaging shipped still get their thread.
   */
  r.post(
    '/messages/threads/open',
    limiter,
    auth,
    run(async (q) => {
      const c = caller(q);
      const { kind, sourceId } = (q.body ?? {}) as { kind?: string; sourceId?: string };
      if (!sourceId || typeof sourceId !== 'string') {
        throw new HttpError(400, 'BAD_SOURCE', 'Invalid request');
      }
      const thread =
        kind === 'connection'
          ? await threadForConnection(m, sourceId)
          : kind === 'application'
            ? await threadForApplication(m, sourceId)
            : (() => {
                throw new HttpError(400, 'BAD_KIND', 'Invalid request');
              })();
      if (!thread) {
        throw new HttpError(404, 'NO_THREAD', 'There is no conversation for this yet');
      }
      // Built from the relationship, so re-check that the caller is actually in it.
      if (!thread.participantUids.includes(c.uid) && !c.admin) {
        throw new HttpError(404, 'NO_THREAD', 'There is no conversation for this yet');
      }
      return { thread };
    }, 201),
  );
  return r;
}
