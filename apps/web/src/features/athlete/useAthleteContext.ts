import { useAuth } from '../auth/AuthProvider';

/** The signed-in athlete's identity, for pages inside the athlete area. */
export function useAthleteContext() {
  const { state } = useAuth();
  if (state.status !== 'signedIn' || typeof state.profile !== 'object') return null;
  return { uid: state.user.uid, email: state.user.email ?? '', user: state.profile };
}
