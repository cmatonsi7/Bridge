import { useNavigate } from 'react-router-dom';
import { coachCompletion } from '@sportbridge/shared';
import { useCoachProfile, useQualifications } from './coachService';

/** Coach dashboard (prototype "Your athlete roster"), with real completion and an honest roster state. */
export function CoachDashboard({ uid, firstName }: { uid: string; firstName: string }) {
  const navigate = useNavigate();
  const profile = useCoachProfile(uid);
  const quals = useQualifications(uid);
  const ready = profile.status === 'ready' && quals.status === 'ready';
  const { percent, items } = coachCompletion(
    profile.status === 'ready' ? profile.data : null,
    quals.status === 'ready' ? quals.data.length : 0,
  );
  const next = items.find((i) => !i.done);

  return (
    <section className="sb-page role-dashboard-page active" id="sb-page-dashboard">
      <div className="sb-page-head">
        <div>
          <div className="sb-kicker">COACH DASHBOARD</div>
          <h1>Welcome, {firstName}</h1>
          <p>Build your coaching profile so athletes and parents can find you when discovery launches.</p>
          <div className="dashboard-context">
            <b>Coach account</b> · 0 connected athletes · Credentials self-declared
          </div>
        </div>
      </div>

      {(profile.status === 'error' || quals.status === 'error') && (
        <div className="sb-card sb-empty" role="alert">
          We couldn’t load your dashboard. Check your connection and refresh.
        </div>
      )}

      {ready && (
        <div className="sb-grid-2" style={{ marginBottom: 15 }}>
          <div className="sb-card sb-progress-card">
            <div className="sb-section-title" style={{ margin: '0 0 18px' }}>
              <h2>Your Profile</h2>
              <button type="button" className="auth-link" onClick={() => navigate('/app/profile')}>
                View profile
              </button>
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
                    <span>{i.label}</span>
                  </div>
                ))}
                {next && (
                  <button
                    type="button"
                    className="sb-btn primary"
                    style={{ marginTop: 8, justifySelf: 'start' }}
                    onClick={() => navigate('/app/profile')}
                  >
                    {percent === 0 ? 'Start your profile' : 'Complete your profile'}
                  </button>
                )}
              </div>
            </div>
          </div>
          <div className="sb-card" style={{ padding: 18 }}>
            <div className="sb-section-title" style={{ margin: '0 0 12px' }}>
              <h2>My Athletes</h2>
            </div>
            <p className="sb-meta" style={{ lineHeight: 1.7 }}>
              Athletes will be able to find you and send connection requests once discovery launches. Accepted
              athletes will appear here with their development progress. For athletes under 18, a confirmed
              parent or guardian will be part of every connection.
            </p>
          </div>
        </div>
      )}
    </section>
  );
}
