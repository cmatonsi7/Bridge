import { useState } from 'react';
import { APPLICATION_STATUSES, APPLICATION_STATUS_LABELS, type ApplicationStatus } from '@sportbridge/shared';
import { useSignedInUser } from '../../../features/account/useSignedInUser';
import { useApplicationsTo } from '../../../features/applications/applicationsService';
import { ApplicantCard } from '../../../features/applications/ApplicantCard';
import { BootScreen } from '../../../app/guards';

/** Organisation: applications to its own listings, filterable by listing and status. */
export default function OrgApplicationsPage() {
  const me = useSignedInUser();
  const apps = useApplicationsTo(me?.uid);
  const [listing, setListing] = useState('');
  const [status, setStatus] = useState<ApplicationStatus | ''>('');
  if (apps.status === 'loading') return <BootScreen label="Loading applications…" />;
  if (apps.status === 'error')
    return (
      <div className="sb-card sb-empty" role="alert">
        {apps.message}
      </div>
    );
  const listings = Array.from(new Map(apps.data.map((a) => [a.listingId, a.listingTitle])).entries());
  const shown = apps.data.filter(
    (a) => (!listing || a.listingId === listing) && (!status || a.status === status),
  );
  const waiting = apps.data.filter((a) => a.status === 'submitted').length;

  return (
    <section className="sb-page active" id="sb-page-applications">
      <div className="sb-page-head">
        <div>
          <div className="sb-kicker">APPLICATIONS</div>
          <h1>Applications received</h1>
          <p>Review applicants for your opportunities and programmes.</p>
          {apps.data.length > 0 && (
            <div className="dashboard-context">
              {apps.data.length} total · {waiting} waiting for review
            </div>
          )}
        </div>
      </div>
      {apps.data.length === 0 ? (
        <div className="sb-card sb-empty">
          No applications yet. They’ll appear here when athletes apply to your published listings.
        </div>
      ) : (
        <>
          <div className="sb-filterbar" style={{ gap: 10 }}>
            <label className="sr-only" htmlFor="app-listing">
              Listing
            </label>
            <select
              id="app-listing"
              className="sb-input"
              value={listing}
              onChange={(e) => setListing(e.target.value)}
              style={{ minWidth: 0, flex: '1 1 220px' }}
            >
              <option value="">All listings</option>
              {listings.map(([id, title]) => (
                <option key={id} value={id}>
                  {title}
                </option>
              ))}
            </select>
            <label className="sr-only" htmlFor="app-status">
              Status
            </label>
            <select
              id="app-status"
              className="sb-input"
              value={status}
              onChange={(e) => setStatus(e.target.value as ApplicationStatus | '')}
              style={{ minWidth: 0, flex: '1 1 180px' }}
            >
              <option value="">All statuses</option>
              {APPLICATION_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {APPLICATION_STATUS_LABELS[s]}
                </option>
              ))}
            </select>
          </div>
          {shown.length === 0 ? (
            <div className="sb-card sb-empty">No applications match these filters.</div>
          ) : (
            <div style={{ display: 'grid', gap: 12 }}>
              {shown.map((a) => (
                <ApplicantCard key={a.id} app={a} />
              ))}
            </div>
          )}
        </>
      )}
    </section>
  );
}
