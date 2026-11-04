import { useNavigate } from 'react-router-dom';
import { athleteCompletion } from '@sportbridge/shared';
import { useAchievements, useAthleteProfile } from '../athlete/athleteService';
import type { LinkWithId } from './guardianService';

const initialsOf = (name: string) =>
  name
    .split(' ')
    .map((p) => p[0])
    .filter(Boolean)
    .slice(0, 2)
    .join('')
    .toUpperCase();

/** One confirmed child, as in the prototype's "My Children" grid. */
export function ChildCard({ link }: { link: LinkWithId }) {
  const navigate = useNavigate();
  const profile = useAthleteProfile(link.athleteUid);
  const achievements = useAchievements(link.athleteUid);
  const p = profile.status === 'ready' ? profile.data : null;
  const name = p?.displayName ?? link.athleteName ?? 'Your child';
  const done =
    profile.status === 'ready' && achievements.status === 'ready'
      ? athleteCompletion(profile.data, achievements.data.length).percent
      : null;

  return (
    <div className="sb-card" style={{ padding: 16 }}>
      <div
        className="sb-avatar"
        aria-hidden="true"
        style={{
          display: 'grid',
          placeItems: 'center',
          background: '#006B35',
          color: '#fff',
          fontWeight: 800,
        }}
      >
        {initialsOf(name)}
      </div>
      <h3>{name}</h3>
      <p className="sb-meta">
        {[p?.sport, p?.position].filter(Boolean).join(' · ') || 'Sport not added yet'}
        {done !== null ? ` · Profile ${done}% complete` : ''}
      </p>
      <span className="v-badge ok">Guardian verified</span>
      <div style={{ marginTop: 12 }}>
        <button
          type="button"
          className="sb-btn primary"
          onClick={() => navigate(`/app/children/${link.athleteUid}`)}
        >
          View Child Profile
        </button>
      </div>
    </div>
  );
}
