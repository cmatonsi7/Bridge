import { useAuth } from '../auth/AuthProvider';

/** The signed-in user's identity and profile, for pages inside the app (any role). */
export function useSignedInUser() {
  const { state } = useAuth();
  if (state.status !== 'signedIn' || typeof state.profile !== 'object') return null;
  return { uid: state.user.uid, email: state.user.email ?? '', user: state.profile };
}
