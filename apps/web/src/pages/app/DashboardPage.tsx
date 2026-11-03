import { useNavigate } from 'react-router-dom';
import { Hand } from 'lucide-react';
import { ROLE_LABELS } from '@sportbridge/shared';
import { effectiveRole, useAuth } from '../../features/auth/AuthProvider';
import { AthleteDashboardProgress } from '../../features/athlete/AthleteDashboardProgress';

const COPY = {
  athlete:
    'Keep pushing. Opportunities are out there. Discover programmes, connect with coaches and keep your sporting profile up to date.',
  guardian:
    "Follow your children's sporting journeys, manage consent and stay on top of upcoming activities.",
  coach: 'Support your athletes’ development, manage sessions and keep your coaching profile up to date.',
  organisation: 'Manage your organisation profile, programmes, opportunities and connected users.',
  admin: 'Oversee SportBridge users, opportunities, programmes and moderation.',
} as const;

/** Phase 1 dashboard: real identity and account state inside the prototype's hero. Role dashboards arrive in Phase 2. */
export default function DashboardPage() {
  const { state } = useAuth();
  const navigate = useNavigate();
  if (state.status !== 'signedIn') return null;
  const role = effectiveRole(state.claims) ?? 'athlete';
  const profile = typeof state.profile === 'object' ? state.profile : null;
  const firstName = profile?.firstName ?? state.user.displayName?.split(' ')[0] ?? '';
  const restricted = profile?.status === 'restricted';

  return (
    <section className="sb-page active" id="sb-page-dashboard">
      <div className="sb-hero">
        <div>
          <div className="sb-kicker" style={{ color: '#F5B900' }}>
            YOUR SPORTING JOURNEY
          </div>
          <h2>
            Welcome, {firstName} <Hand className="icon" aria-hidden="true" />
          </h2>
          <p>{COPY[role]}</p>
          <div className="sb-hero-actions">
            <button className="sb-btn gold" type="button" onClick={() => navigate('/opportunities')}>
              Explore Opportunities
            </button>
            <button className="sb-btn" type="button" onClick={() => navigate('/app/profile')}>
              View Profile
            </button>
          </div>
        </div>
        <div className="sb-mini-card">
          <b>{ROLE_LABELS[role]}</b>
          <span>{restricted ? 'Awaiting guardian' : 'Account active'}</span>
        </div>
      </div>

      {restricted && (
        <div className="sb-member-notice" style={{ marginTop: 18 }} role="status">
          <div>
            <strong>Waiting for your parent or guardian</strong>
            <span>
              Because you are under 18, a parent or guardian must confirm your account before your profile can
              be seen by others or you can connect with coaches and organisations. You can still explore
              opportunities.
            </span>
          </div>
        </div>
      )}

      {role === 'athlete' ? (
        <AthleteDashboardProgress uid={state.user.uid} />
      ) : (
        <div className="sb-card role-dashboard-shortcut" style={{ marginTop: 18 }}>
          <div className="role-dashboard-shortcut-main">
            <div>
              <div className="sb-kicker">YOUR DASHBOARD</div>
              <h3>{ROLE_LABELS[role]} dashboard</h3>
              <p className="sb-meta">
                Your account is set up. Your full {ROLE_LABELS[role].toLowerCase()} dashboard, with your
                profile, connections and activity, is being added next.
              </p>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
