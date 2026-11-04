import { useSignedInUser } from '../../../features/account/useSignedInUser';
import { useMyChildren } from '../../../features/guardian/guardianService';
import { ChildApplications } from '../../../features/applications/ChildApplications';
import { BootScreen } from '../../../app/guards';

/** Parent: applications made by each of their confirmed children. */
export default function GuardianApplicationsPage() {
  const me = useSignedInUser();
  const children = useMyChildren(me?.uid);
  if (children.status === 'loading') return <BootScreen label="Loading…" />;
  if (children.status === 'error')
    return (
      <div className="sb-card sb-empty" role="alert">
        {children.message}
      </div>
    );
  return (
    <section className="sb-page active" id="sb-page-applications">
      <div className="sb-page-head">
        <div>
          <div className="sb-kicker">FAMILY</div>
          <h1>Children’s applications</h1>
          <p>See what your children have applied to, and withdraw an application if you need to.</p>
        </div>
      </div>
      {children.data.length === 0 ? (
        <div className="sb-card sb-empty">No children are connected to your account yet.</div>
      ) : (
        children.data.map((c) => (
          <div key={c.id} style={{ marginBottom: 20 }}>
            <div className="sb-section-title">
              <h2>{c.athleteName ?? 'Your child'}</h2>
            </div>
            <ChildApplications childUid={c.athleteUid} childName={c.athleteName ?? 'Your child'} />
          </div>
        ))
      )}
    </section>
  );
}
