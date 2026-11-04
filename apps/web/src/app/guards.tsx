import type { ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { effectiveRole, useAuth } from '../features/auth/AuthProvider';
import { canAccess, type AppSection } from '../config/navigation';
import type { Role } from '@sportbridge/shared';

export function BootScreen({ label = 'Loading SportBridge…' }: { label?: string }) {
  return (
    <div className="boot-screen" role="status">
      {label}
    </div>
  );
}

/**
 * Gate for the signed-in app: signed in → profile completed → email verified.
 * These guards shape the experience only; Firestore rules and the API enforce access.
 */
export function RequireAccount({ children }: { children: ReactNode }) {
  const { state, configured } = useAuth();
  const location = useLocation();
  if (!configured) return <Navigate to="/sign-in" replace />;
  if (state.status === 'loading') return <BootScreen />;
  if (state.status === 'signedOut') {
    return <Navigate to={`/sign-in?next=${encodeURIComponent(location.pathname)}`} replace />;
  }
  if (state.profile === 'loading') return <BootScreen />;
  if (state.profile === 'error')
    return <BootScreen label="We couldn’t load your account. Refresh the page to try again." />;
  if (state.profile === 'missing') {
    // Admins are provisioned by staff and may not have a full profile document.
    if (!state.claims.admin) return <Navigate to="/register/finish" replace />;
  }
  if (!state.user.emailVerified) return <Navigate to="/verify-email" replace />;
  if (!effectiveRole(state.claims)) return <BootScreen label="Finishing account setup…" />;
  return <>{children}</>;
}

/** For /sign-in and /register: people who already have a finished account go to the app. */
export function GuestOnly({ children }: { children: ReactNode }) {
  const { state } = useAuth();
  if (state.status === 'loading') return <BootScreen />;
  if (state.status === 'signedIn' && typeof state.profile === 'object') return <Navigate to="/app" replace />;
  return <>{children}</>;
}

/** /verify-email and /register/finish need a signed-in account. */
export function SignedInOnly({ children }: { children: ReactNode }) {
  const { state } = useAuth();
  if (state.status === 'loading') return <BootScreen />;
  if (state.status === 'signedOut') return <Navigate to="/sign-in" replace />;
  return <>{children}</>;
}

export function RequireSection({ section, children }: { section: AppSection; children: ReactNode }) {
  const { state } = useAuth();
  const role = state.status === 'signedIn' ? effectiveRole(state.claims) : undefined;
  if (!canAccess(role, section)) return <Navigate to="/app" replace />;
  return <>{children}</>;
}

export function RequireRole({ role, children }: { role: Role; children: ReactNode }) {
  const { state } = useAuth();
  const r = state.status === 'signedIn' ? effectiveRole(state.claims) : undefined;
  if (r !== role) return <Navigate to="/app" replace />;
  return <>{children}</>;
}
