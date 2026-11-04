import { CircleCheck } from 'lucide-react';
import { useMyChildren, usePendingRequests } from './guardianService';
import { ChildCard } from './ChildCard';
import { PendingRequest } from './PendingRequest';

/** Parent dashboard: pending consent requests and confirmed children (prototype "Family Sporting Hub"). */
export function GuardianDashboard({
  uid,
  email,
  firstName,
}: {
  uid: string;
  email: string;
  firstName: string;
}) {
  const pending = usePendingRequests(email);
  const children = useMyChildren(uid);
  const kids = children.status === 'ready' ? children.data : [];
  const requests = pending.status === 'ready' ? pending.data : [];
  const loadError = pending.status === 'error' || children.status === 'error';

  return (
    <section className="sb-page active" id="sb-page-dashboard">
      <div className="sb-page-head">
        <div>
          <div className="sb-kicker">PARENT DASHBOARD</div>
          <h1>{kids.length > 1 ? 'Family Sporting Hub' : `Welcome, ${firstName}`}</h1>
          <p>Manage your child's sporting journey, connections and consent from one place.</p>
          <div className="dashboard-context">
            <b>Parent account</b> · {kids.length} {kids.length === 1 ? 'child' : 'children'} connected
            {requests.length ? ` · ${requests.length} awaiting your consent` : ''}
          </div>
        </div>
        <span className="risk-pill">
          <CircleCheck className="icon" aria-hidden="true" /> Email verified
        </span>
      </div>

      {loadError && (
        <div className="sb-card sb-empty" role="alert">
          We couldn’t load your children. Check your connection and refresh.
        </div>
      )}

      {requests.length > 0 && (
        <div className="sb-card" style={{ padding: 15, marginBottom: 15 }}>
          <div className="sb-section-title" style={{ margin: '0 0 10px' }}>
            <h2>Attention required</h2>
          </div>
          <div className="sb-grid-2">
            {requests.map((l) => (
              <PendingRequest key={l.id} link={l} />
            ))}
          </div>
        </div>
      )}

      <div className="sb-card" style={{ padding: 15, marginBottom: 15 }}>
        <div className="sb-section-title" style={{ margin: '0 0 10px' }}>
          <h2>My Children</h2>
        </div>
        {children.status === 'loading' ? (
          <p className="sb-empty">Loading…</p>
        ) : kids.length === 0 ? (
          <div className="sb-empty" style={{ textAlign: 'left' }}>
            <b>No children connected yet.</b>
            <p style={{ marginTop: 6, lineHeight: 1.6 }}>
              To connect your child, ask them to create their SportBridge athlete account and enter{' '}
              <b>{email}</b> as their parent / guardian email. Their request will appear here for you to
              confirm.
            </p>
          </div>
        ) : (
          <div className="sb-grid-3">
            {kids.map((l) => (
              <ChildCard key={l.id} link={l} />
            ))}
          </div>
        )}
      </div>

      {kids.length > 0 && (
        <div className="sb-card" style={{ padding: 15 }}>
          <h3>Adding another child</h3>
          <p className="sb-meta" style={{ lineHeight: 1.6 }}>
            Ask them to sign up as an athlete and enter <b>{email}</b> as their parent / guardian email.
          </p>
        </div>
      )}
    </section>
  );
}
