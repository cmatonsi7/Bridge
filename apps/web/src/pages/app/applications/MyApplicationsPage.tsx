import { useNavigate } from 'react-router-dom';
import { useSignedInUser } from '../../../features/account/useSignedInUser';
import { useApplicationsBy } from '../../../features/applications/applicationsService';
import { ApplicationRow } from '../../../features/applications/ApplicationRow';
import { BootScreen } from '../../../app/guards';

/** Athlete: every application they've made, with status and withdraw. */
export default function MyApplicationsPage() {
  const navigate = useNavigate();
  const me = useSignedInUser();
  const apps = useApplicationsBy(me?.uid);
  if (apps.status === 'loading') return <BootScreen label="Loading your applications…" />;
  if (apps.status === 'error')
    return (
      <div className="sb-card sb-empty" role="alert">
        {apps.message}
      </div>
    );
  const live = apps.data.filter((a) => a.status !== 'withdrawn');
  return (
    <section className="sb-page active" id="sb-page-applications">
      <div className="sb-page-head">
        <div>
          <div className="sb-kicker">YOUR SUBMISSIONS</div>
          <h1>My Applications</h1>
          <p>Track applications, deadlines and status updates in one place.</p>
          {apps.data.length > 0 && (
            <div className="dashboard-context">
              {live.length} active · {apps.data.filter((a) => a.status === 'accepted').length} accepted
            </div>
          )}
        </div>
      </div>
      {apps.data.length === 0 ? (
        <div className="sb-card sb-empty">
          You haven’t applied to anything yet.{' '}
          <button type="button" className="auth-link" onClick={() => navigate('/app/opportunities')}>
            Browse opportunities
          </button>
        </div>
      ) : (
        <div style={{ display: 'grid', gap: 12 }}>
          {apps.data.map((a) => (
            <ApplicationRow key={a.id} app={a} />
          ))}
        </div>
      )}
    </section>
  );
}
