import { Router, type Request } from 'express';
import rateLimit from 'express-rate-limit';
import { claimRequestSchema } from '@sportbridge/shared';
import type { AuthPort } from '../services/ports.js';
import {
  claimOrganisation,
  createUnclaimedOrganisation,
  regenerateClaimCode,
  removeUnclaimedOrganisation,
  type OnboardingCaller,
  type OrgOnboardingRepoPort,
} from '../services/orgOnboarding.js';
import { syncOwnEntry, type DirectoryRepoPort } from '../services/directory.js';
import { requireAdmin, requireAuth } from '../middleware/auth.js';
import { HttpError } from '../middleware/errors.js';

export function orgOnboardingRouter(deps: {
  auth: AuthPort;
  orgOnboarding: OrgOnboardingRepoPort;
  directory: DirectoryRepoPort;
}) {
  const r = Router();
  const adminLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 200,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
  });
  // Codes are random and long, but guessing is still capped hard.
  const claimLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 10,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
  });

  const caller = (req: Request): OnboardingCaller => {
    const t = req.auth! as unknown as { uid: string; role?: string; email_verified?: boolean };
    return { uid: t.uid, role: t.role, emailVerified: t.email_verified === true };
  };
  const orgId = (id: string | undefined) => {
    if (!id || !/^[A-Za-z0-9]{1,64}$/.test(id))
      throw new HttpError(400, 'BAD_ORGANISATION_ID', 'Invalid organisation');
    return id;
  };

  r.post(
    '/admin/organisations',
    adminLimiter,
    requireAuth(deps.auth),
    requireAdmin(),
    async (req, res, next) => {
      try {
        res.status(201).json(await createUnclaimedOrganisation(deps.orgOnboarding, caller(req), req.body));
      } catch (err) {
        next(err);
      }
    },
  );
  r.post(
    '/admin/organisations/:id/claim-code',
    adminLimiter,
    requireAuth(deps.auth),
    requireAdmin(),
    async (req, res, next) => {
      try {
        res.json(await regenerateClaimCode(deps.orgOnboarding, caller(req), orgId(req.params.id)));
      } catch (err) {
        next(err);
      }
    },
  );
  r.post(
    '/admin/organisations/:id/remove',
    adminLimiter,
    requireAuth(deps.auth),
    requireAdmin(),
    async (req, res, next) => {
      try {
        await removeUnclaimedOrganisation(deps.orgOnboarding, caller(req), orgId(req.params.id));
        res.json({ ok: true });
      } catch (err) {
        next(err);
      }
    },
  );
  r.post('/organisations/claim', claimLimiter, requireAuth(deps.auth), async (req, res, next) => {
    try {
      const { code } = claimRequestSchema.parse(req.body);
      const c = caller(req);
      const result = await claimOrganisation(deps.orgOnboarding, c, code);
      // The new owner's listing now comes from the claimed organisation.
      await syncOwnEntry(deps.directory, c).catch(() => undefined);
      res.json(result);
    } catch (err) {
      next(err);
    }
  });
  return r;
}
