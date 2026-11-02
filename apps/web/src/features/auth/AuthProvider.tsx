import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { onIdTokenChanged, signOut as fbSignOut, type User } from 'firebase/auth';
import { doc, onSnapshot } from 'firebase/firestore';
import { COLLECTIONS, type Role, type UserDoc } from '@sportbridge/shared';
import { firebaseConfigured, requireAuth, requireDb } from '../../lib/firebase';

export interface Claims {
  role?: Role;
  admin?: boolean;
}

export type AuthState =
  | { status: 'loading' }
  | { status: 'signedOut' }
  | {
      status: 'signedIn';
      user: User;
      claims: Claims;
      /** users/{uid}; 'missing' means the account exists but onboarding was never completed. */
      profile: UserDoc | 'missing' | 'loading' | 'error';
    };

interface AuthContextValue {
  state: AuthState;
  configured: boolean;
  /** Re-reads the ID token so new custom claims (role) and email verification apply immediately. */
  refresh: () => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>(
    firebaseConfigured ? { status: 'loading' } : { status: 'signedOut' },
  );

  useEffect(() => {
    if (!firebaseConfigured) return;
    const auth = requireAuth();
    let unsubProfile: (() => void) | undefined;

    const unsub = onIdTokenChanged(auth, async (user) => {
      unsubProfile?.();
      unsubProfile = undefined;
      if (!user) {
        setState({ status: 'signedOut' });
        return;
      }
      const token = await user.getIdTokenResult();
      const claims: Claims = {
        role: token.claims.role as Role | undefined,
        admin: token.claims.admin === true,
      };
      setState({ status: 'signedIn', user, claims, profile: 'loading' });
      unsubProfile = onSnapshot(
        doc(requireDb(), COLLECTIONS.users, user.uid),
        (snap) =>
          setState((s) =>
            s.status === 'signedIn' && s.user.uid === user.uid
              ? { ...s, profile: snap.exists() ? (snap.data() as UserDoc) : 'missing' }
              : s,
          ),
        () => setState((s) => (s.status === 'signedIn' ? { ...s, profile: 'error' } : s)),
      );
    });
    return () => {
      unsub();
      unsubProfile?.();
    };
  }, []);

  const refresh = useCallback(async () => {
    const user = requireAuth().currentUser;
    if (!user) return;
    await user.reload();
    await user.getIdToken(true); // triggers onIdTokenChanged with fresh claims
  }, []);

  const signOut = useCallback(async () => {
    if (firebaseConfigured) await fbSignOut(requireAuth());
  }, []);

  const value = useMemo(
    () => ({ state, configured: firebaseConfigured, refresh, signOut }),
    [state, refresh, signOut],
  );
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>');
  return ctx;
}

/** Role from the verified token claim — the only source the UI trusts for routing. */
export function effectiveRole(claims: Claims): Role | undefined {
  return claims.admin ? 'admin' : claims.role;
}
