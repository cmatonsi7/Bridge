import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { WITHDRAWABLE } from '@sportbridge/shared';
import { ApiError } from '../../lib/apiClient';
import { withdrawApplication, type ApplicationWithId } from './applicationsService';
import { StatusBadge } from './StatusBadge';

/** One application, from the applicant's (or parent's) side, with withdraw. */
export function ApplicationRow({ app, who = 'you' }: { app: ApplicationWithId; who?: 'you' | 'parent' }) {
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const canWithdraw = WITHDRAWABLE.includes(app.status);

  async function withdraw() {
    const whose = who === 'parent' ? `${app.snapshot.displayName}'s application` : 'your application';
    if (!window.confirm(`Withdraw ${whose} to “${app.listingTitle}”? This can’t be undone.`)) return;
    setBusy(true);
    setError('');
    try {
      await withdrawApplication(app.id);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Something went wrong. Try again.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="sb-card" style={{ padding: 16 }}>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          gap: 12,
          flexWrap: 'wrap',
          alignItems: 'flex-start',
        }}
      >
        <div>
          <button
            type="button"
            className="auth-link"
            onClick={() => navigate(`/app/listings/${app.listingId}`)}
          >
            {app.listingTitle}
          </button>
          <p className="sb-meta">
            {app.orgName} · Applied {new Date(app.createdAt).toLocaleDateString('en-ZA')}
          </p>
        </div>
        <StatusBadge status={app.status} />
      </div>
      {app.orgMessage && (
        <p className="sb-meta" style={{ marginTop: 8 }}>
          <b>Message from {app.orgName}:</b> “{app.orgMessage}”
        </p>
      )}
      {app.status === 'accepted' && app.applicantIsMinor && (
        <p className="sb-field-hint" style={{ marginTop: 6 }}>
          {app.orgName} will contact your parent or guardian through SportBridge about next steps.
        </p>
      )}
      {error && (
        <p className="sb-form-status err" role="alert">
          {error}
        </p>
      )}
      {canWithdraw && (
        <button
          type="button"
          className="sb-btn"
          style={{ marginTop: 10 }}
          disabled={busy}
          onClick={() => void withdraw()}
        >
          {busy ? 'Withdrawing…' : 'Withdraw'}
        </button>
      )}
    </div>
  );
}
