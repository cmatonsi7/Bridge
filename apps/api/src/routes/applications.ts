import { Router, type Request } from 'express';
import rateLimit from 'express-rate-limit';
import type { AuthPort } from '../services/ports.js';
import {
  apply,
  changeStatus,
  withdraw,
  type ApplicationsRepoPort,
  type Caller,
} from '../services/applications.js';
import { requireAuth } from '../middleware/auth.js';
import { HttpError } from '../middleware/errors.js';
import { closeThreadFor, threadForApplication, type MessagesRepoPort } from '../services/messages.js';

export function applicationsRouter(deps: {
  auth: AuthPort;
  applications: ApplicationsRepoPort;
  /** Optional so applications keep working if messaging is not wired up. */
  messages?: MessagesRepoPort;
}) {
  const r = Router();
  const limiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 60,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
  });
  const caller = (req: Request): Caller => {
    const t = req.auth! as unknown as { uid: string; role?: string; email_verified?: boolean };
    return { uid: t.uid, role: t.role, emailVerified: t.email_verified === true };
  };
  const appId = (id: string | undefined) => {
    if (!id || !/^[A-Za-z0-9]{1,64}_[A-Za-z0-9]{1,128}$/.test(id))
      throw new HttpError(400, 'BAD_APPLICATION_ID', 'Invalid application');
    return id;
  };

  r.post('/applications', limiter, requireAuth(deps.auth), async (req, res, next) => {
    try {
      res.status(201).json(await apply(deps.applications, caller(req), req.body));
    } catch (err) {
      next(err);
    }
  });
  r.post('/applications/:id/status', limiter, requireAuth(deps.auth), async (req, res, next) => {
    try {
      const id = appId(req.params.id);
      await changeStatus(deps.applications, caller(req), id, req.body);
      if (deps.messages) {
        const status = (req.body ?? {}).status;
        // Shortlisting or accepting is what earns the applicant a conversation; declining ends it.
        if (status === 'shortlisted' || status === 'accepted') {
          await threadForApplication(deps.messages, id).catch(() => undefined);
        } else if (status === 'declined') {
          await closeThreadFor(deps.messages, 'application', id, 'application_finished').catch(
            () => undefined,
          );
        }
      }
      res.json({ ok: true });
    } catch (err) {
      next(err);
    }
  });
  r.post('/applications/:id/withdraw', limiter, requireAuth(deps.auth), async (req, res, next) => {
    try {
      const id = appId(req.params.id);
      await withdraw(deps.applications, caller(req), id);
      if (deps.messages) {
        await closeThreadFor(deps.messages, 'application', id, 'application_finished').catch(
          () => undefined,
        );
      }
      res.json({ ok: true });
    } catch (err) {
      next(err);
    }
  });
  return r;
}
