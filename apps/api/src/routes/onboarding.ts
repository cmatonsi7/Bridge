import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { onboardingSchema } from '@sportbridge/shared';
import type { AuthPort, UserRepoPort } from '../services/ports.js';
import { completeOnboarding } from '../services/onboarding.js';
import { requireAuth } from '../middleware/auth.js';

export function onboardingRouter(deps: { auth: AuthPort; users: UserRepoPort }) {
  const r = Router();
  const limiter = rateLimit({
    windowMs: 60 * 60 * 1000,
    limit: 20,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
  });

  // Email verification is NOT required here: the profile is saved straight after sign-up,
  // while the dashboard itself stays locked until the email is verified.
  r.post('/onboarding', limiter, requireAuth(deps.auth), async (req, res, next) => {
    try {
      const input = onboardingSchema.parse(req.body);
      const { user, created } = await completeOnboarding(
        deps,
        {
          uid: req.auth!.uid,
          email: req.auth!.email,
          claims: req.auth! as unknown as Record<string, unknown>,
        },
        input,
      );
      res.status(created ? 201 : 200).json({ user, claimsUpdated: true });
    } catch (err) {
      next(err);
    }
  });
  return r;
}
