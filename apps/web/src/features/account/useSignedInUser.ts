import { effectiveRole, useAuth } from '../auth/AuthProvider';

/** The signed-in user's identity and profile, for pages inside the app (any role). */
export function useSignedInUser() {
  const { state } = useAuth();
  if (state.status !== 'signedIn' || typeof state.profile !== 'object') return null;
  return { uid: state.user.uid, email: state.user.email ?? '', user: state.profile };
}

/**
 * Fast uid + role, available the moment sign-in resolves — unlike `useSignedInUser`, which also
 * waits on the Firestore profile doc. Use this to start role-gated queries earlier on a page
 * that doesn't otherwise need the rest of the profile; fall back to `useSignedInUser` for that.
 */
export function useSignedInRole() {
  const { state } = useAuth();
  if (state.status !== 'signedIn') return { uid: undefined, role: undefined };
  return { uid: state.user.uid, role: effectiveRole(state.claims) };
}
