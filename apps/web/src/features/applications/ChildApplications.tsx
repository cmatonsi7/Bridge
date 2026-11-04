import { useApplicationsBy } from './applicationsService';
import { ApplicationRow } from './ApplicationRow';

/** A verified parent's view of one child's applications (read via the parent's guardian access). */
export function ChildApplications({ childUid, childName }: { childUid: string; childName: string }) {
  const apps = useApplicationsBy(childUid);
  if (apps.status === 'loading') return <p className="sb-meta">Loading applications…</p>;
  if (apps.status === 'error')
    return (
      <p className="sb-meta" role="alert">
        {apps.message}
      </p>
    );
  if (apps.data.length === 0)
    return <div className="sb-card sb-empty">{childName} hasn’t applied to anything yet.</div>;
  return (
    <div style={{ display: 'grid', gap: 12 }}>
      {apps.data.map((a) => (
        <ApplicationRow key={a.id} app={a} who="parent" />
      ))}
    </div>
  );
}
