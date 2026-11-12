import type { NextFunction, Request, Response } from 'express';
import type { DecodedIdToken } from 'firebase-admin/auth';
import type { Role } from '@sportbridge/shared';
import type { AuthPort } from '../services/ports.js';
import { HttpError } from './errors.js';

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      auth?: DecodedIdToken;
    }
  }
}

/** Verifies the Firebase ID token in `Authorization: Bearer <token>`. Roles come only from verified claims. */
export function requireAuth(auth: AuthPort) {
  return async (req: Request, _res: Response, next: NextFunction) => {
    const header = req.header('authorization') ?? '';
    const token = header.startsWith('Bearer ') ? header.slice(7).trim() : '';
    if (!token) return next(new HttpError(401, 'UNAUTHENTICATED', 'Sign in to continue'));
    try {
      req.auth = await auth.verifyIdToken(token);
      next();
    } catch {
      next(new HttpError(401, 'INVALID_TOKEN', 'Your session has expired. Sign in again.'));
    }
  };
}

export function requireRole(...roles: Role[]) {
  return (req: Request, _res: Response, next: NextFunction) => {
    const claims = req.auth as (DecodedIdToken & { role?: Role; admin?: boolean }) | undefined;
    const isAdmin = claims?.admin === true;
    if (isAdmin && roles.includes('admin')) return next();
    if (claims?.role && roles.includes(claims.role)) return next();
    next(new HttpError(403, 'FORBIDDEN', 'You do not have access to this action'));
  };
}

export function requireVerifiedEmail(req: Request, _res: Response, next: NextFunction) {
  if (req.auth?.email_verified) return next();
  next(new HttpError(403, 'EMAIL_NOT_VERIFIED', 'Verify your email address to continue'));
}

/** Staff only: the verified token must carry the administrator claim (set by the grant-admin script, never by a user). */
export function requireAdmin() {
  return (req: Request, _res: Response, next: NextFunction) => {
    const claims = req.auth as (DecodedIdToken & { admin?: boolean }) | undefined;
    if (claims?.admin === true) return next();
    next(new HttpError(403, 'FORBIDDEN', 'You do not have access to this action'));
  };
}
