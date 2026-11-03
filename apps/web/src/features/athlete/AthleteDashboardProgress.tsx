import { useNavigate } from 'react-router-dom';
import { athleteCompletion } from '@sportbridge/shared';
import { useAchievements, useAthleteProfile } from './athleteService';

/** Dashboard card: real profile completion plus the next thing to do. */
export function AthleteDashboardProgress({ uid }: { uid: string }) {
  const navigate = useNavigate();
  const profile = useAthleteProfile(uid);
  const achievements = useAchievements(uid);
  if (profile.status !== 'ready' || achievements.status !== 'ready') return null;
  const { percent, items } = athleteCompletion(profile.data, achievements.data.length);
  const next = items.find((i) => !i.done);

  return (
    <div className="sb-card sb-progress-card" style={{ marginTop: 18 }}>
      <div className="sb-section-title" style={{ margin: '0 0 18px' }}>
        <h2>Your Progress</h2>
        <button type="button" className="auth-link" onClick={() => navigate('/app/progress')}>
          View progress
        </button>
      </div>
      <div className="sb-progress-row">
        <div
          className="sb-ring"
          role="img"
          aria-label={`Profile ${percent}% complete`}
          style={{ background: `conic-gradient(var(--sb-green) 0 ${percent}%, #E7ECE8 ${percent}% 100%)` }}
        >
          <span>{percent}%</span>
        </div>
        <div className="sb-checks">
          {items.slice(0, 4).map((i) => (
            <div className="sb-check" key={i.key}>
              <i aria-hidden="true">{i.done ? '✓' : '!'}</i>
              <span>{i.label}</span>
            </div>
          ))}
          {next && (
            <button
              type="button"
              className="sb-btn primary"
              style={{ marginTop: 8, justifySelf: 'start' }}
              onClick={() => navigate(next.key === 'achievements' ? '/app/progress' : '/app/profile')}
            >
              {percent === 0 ? 'Start your profile' : 'Complete your profile'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
