import { describeActivity, useActivity } from '../../../features/admin/adminService';
import { BootScreen } from '../../../app/guards';

const when = (iso: string) =>
  iso ? new Date(iso).toLocaleString('en-ZA', { dateStyle: 'medium', timeStyle: 'short' }) : 'Unknown time';

/** Read-only record of onboarding actions: who added, re-coded, removed or claimed which organisation, and when. */
export default function AdminActivity() {
  const a = useActivity();
  if (a.status === 'loading') return <BootScreen label="Loading the activity log…" />;
  if (a.status === 'error')
    return (
      <div className="sb-card sb-empty" role="alert">
        {a.message}
      </div>
    );
  if (a.data.length === 0) {
    return (
      <div className="sb-card sb-empty">
        Nothing yet. Actions like adding a school or issuing a claim code appear here.
      </div>
    );
  }
  return (
    <div className="sb-card" style={{ padding: 0 }}>
      <ul className="sb-activity" aria-label="Activity log">
        {a.data.map((e) => (
          <li key={e.id}>
            <span>{describeActivity(e)}</span>
            <time dateTime={e.at}>{when(e.at)}</time>
          </li>
        ))}
      </ul>
      <p className="sb-meta" style={{ padding: '10px 16px' }}>
        Showing the most recent onboarding actions. Each one is recorded permanently.
      </p>
    </div>
  );
}
