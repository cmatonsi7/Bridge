import { useState } from 'react';
import { athleteCompletion } from '@sportbridge/shared';
import { useAthleteContext } from '../../../features/athlete/useAthleteContext';
import { useAchievements, useAthleteProfile } from '../../../features/athlete/athleteService';
import { AchievementsManager } from '../../../features/athlete/AchievementsManager';
import { BootScreen } from '../../../app/guards';

export default function AthleteProgressPage() {
  const ctx = useAthleteContext();
  const profile = useAthleteProfile(ctx?.uid);
  const achievements = useAchievements(ctx?.uid);
  const [adding, setAdding] = useState(false);

  if (!ctx) return null;
  if (profile.status === 'loading' || achievements.status === 'loading')
    return <BootScreen label="Loading your progress…" />;
  if (profile.status === 'error' || achievements.status === 'error') {
    return (
      <div className="sb-card sb-empty" role="alert">
        We couldn’t load your progress. Check your connection and refresh.
      </div>
    );
  }

  const { percent, items } = athleteCompletion(profile.data, achievements.data.length);

  return (
    <section className="sb-page active" id="sb-page-progress">
      <div className="sb-page-head">
        <div>
          <div className="sb-kicker">DEVELOPMENT</div>
          <h1>My Progress</h1>
          <p>Track profile completion, achievements and development milestones.</p>
        </div>
        {!adding && (
          <button className="sb-btn primary" type="button" onClick={() => setAdding(true)}>
            ＋ Add Achievement
          </button>
        )}
      </div>
      <div className="sb-grid-2">
        <div className="sb-card sb-progress-card">
          <div className="sb-section-title" style={{ margin: '0 0 18px' }}>
            <h2>Profile completion</h2>
            <span className="sb-tag">{percent}%</span>
          </div>
          <div className="sb-progress-row">
            <div
              className="sb-ring"
              role="img"
              aria-label={`Profile ${percent}% complete`}
              style={{
                background: `conic-gradient(var(--sb-green) 0 ${percent}%, #E7ECE8 ${percent}% 100%)`,
              }}
            >
              <span>{percent}%</span>
            </div>
            <div className="sb-checks">
              {items.map((i) => (
                <div className="sb-check" key={i.key}>
                  <i aria-hidden="true">{i.done ? '✓' : '!'}</i>
                  <span>
                    {i.label}
                    <span className="sr-only">{i.done ? ' (done)' : ' (to do)'}</span>
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
        <div className="sb-card sb-progress-card">
          <div className="sb-section-title" style={{ margin: '0 0 18px' }}>
            <h2>Development focus</h2>
          </div>
          <p className="sb-meta" style={{ lineHeight: 1.7 }}>
            Development focus areas, such as technical skills, fitness and leadership, are set with your
            coach. They will appear here once you are connected to a coach on SportBridge.
          </p>
        </div>
      </div>
      <div className="sb-section-title">
        <h2>Achievements</h2>
      </div>
      <AchievementsManager uid={ctx.uid} items={achievements.data} adding={adding} setAdding={setAdding} />
    </section>
  );
}
