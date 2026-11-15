import { Router, type Request } from 'express';
import rateLimit from 'express-rate-limit';
import type { AuthPort } from '../services/ports.js';
import { previewImport, runImport, undoImport, type OrgImportRepoPort } from '../services/orgImport.js';
import type { OnboardingCaller } from '../services/orgOnboarding.js';
import { requireAdmin, requireAuth } from '../middleware/auth.js';
import { HttpError } from '../middleware/errors.js';

export function orgImportRouter(deps: { auth: AuthPort; orgImport: OrgImportRepoPort }) {
  const r = Router();
  const limiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 40,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
  });
  const caller = (req: Request): OnboardingCaller => {
    const t = req.auth! as unknown as { uid: string; role?: string; email_verified?: boolean };
    return { uid: t.uid, role: t.role, emailVerified: t.email_verified === true };
  };
  const guard = [limiter, requireAuth(deps.auth), requireAdmin()] as const;

  r.post('/admin/imports/preview', ...guard, async (req, res, next) => {
    try {
      res.json(await previewImport(deps.orgImport, caller(req), req.body));
    } catch (err) {
      next(err);
    }
  });
  r.post('/admin/imports', ...guard, async (req, res, next) => {
    try {
      res.status(201).json(await runImport(deps.orgImport, caller(req), req.body));
    } catch (err) {
      next(err);
    }
  });
  r.post('/admin/imports/:id/undo', ...guard, async (req, res, next) => {
    try {
      const id = req.params.id;
      if (!id || !/^[A-Za-z0-9]{1,64}$/.test(id)) throw new HttpError(400, 'BAD_BATCH_ID', 'Invalid import');
      res.json(await undoImport(deps.orgImport, caller(req), id));
    } catch (err) {
      next(err);
    }
  });
  return r;
}
