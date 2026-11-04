import { useState } from 'react';
import { ORG_TRANSITIONS, type ApplicationStatus } from '@sportbridge/shared';
import { ApiError } from '../../lib/apiClient';
import { setApplicationStatus, type ApplicationWithId } from './applicationsService';
import { StatusBadge } from './StatusBadge';

const ACTION: Record<'shortlisted' | 'accepted' | 'declined', string> = {
  shortlisted: 'Shortlist',
  accepted: 'Accept',
  declined: 'Decline',
};

/** An applicant as an organisation sees them, with the review actions allowed from the current status. */
export function ApplicantCard({ app }: { app: ApplicationWithId }) {
  const s = app.snapshot;
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState<ApplicationStatus | null>(null);
  const [error, setError] = useState('');
  const next = ORG_TRANSITIONS[app.status] as ('shortlisted' | 'accepted' | 'declined')[];

  async function act(status: 'shortlisted' | 'accepted' | 'declined') {
    if (
      status === 'declined' &&
      !window.confirm(`Decline ${s.displayName}? They will be told the application was not successful.`)
    )
      return;
    setBusy(status);
    setError('');
    try {
      await setApplicationStatus(app.id, { status, message });
      setMessage('');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Something went wrong. Try again.');
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="sb-card" style={{ padding: 16 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' }}>
        <div>
          <h3 style={{ margin: 0 }}>{s.displayName}</h3>
          <p className="sb-meta">
            Age {s.age}
            {[s.sport, s.position].filter(Boolean).length
              ? ` · ${[s.sport, s.position].filter(Boolean).join(' · ')}`
              : ''}
            {[s.city, s.province].filter(Boolean).length
              ? ` · ${[s.city, s.province].filter(Boolean).join(', ')}`
              : ''}
          </p>
          <p className="sb-meta">
            For: {app.listingTitle} · Applied {new Date(app.createdAt).toLocaleDateString('en-ZA')}
          </p>
        </div>
        <div style={{ display: 'flex', gap: 6, alignItems: 'flex-start', flexWrap: 'wrap' }}>
          {s.isMinor && <span className="v-badge pending">Under 18</span>}
          <StatusBadge status={app.status} />
        </div>
      </div>
      {s.bio && <p style={{ marginTop: 10, whiteSpace: 'pre-line' }}>{s.bio}</p>}
      {s.skills.length > 0 && (
        <div className="sb-pill-row" style={{ marginTop: 8 }}>
          {s.skills.map((k) => (
            <span className="sb-pill" key={k}>
              {k}
            </span>
          ))}
        </div>
      )}
      {app.note && (
        <p className="sb-meta" style={{ marginTop: 8 }}>
          <b>Their note:</b> “{app.note}”
        </p>
      )}
      <p className="sb-meta" style={{ marginTop: 8 }}>
        {s.isMinor ? (
          'Contact details are not shared for under-18 applicants. You can reply through SportBridge; their parent or guardian sees every update.'
        ) : (
          <>
            Contact: {s.email}
            {s.phone ? ` · ${s.phone}` : ''}
          </>
        )}
      </p>
      {next.length > 0 && (
        <>
          <div className="sb-field full" style={{ marginTop: 10 }}>
            <label htmlFor={`msg-${app.id}`}>Message to the applicant (optional)</label>
            <input
              id={`msg-${app.id}`}
              maxLength={300}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="e.g. Please arrive at 08:30 with boots and water."
            />
          </div>
          {error && (
            <p className="sb-form-status err" role="alert">
              {error}
            </p>
          )}
          <div className="sb-form-actions" style={{ justifyContent: 'flex-start' }}>
            {next.map((st) => (
              <button
                key={st}
                type="button"
                className={`sb-btn${st === 'accepted' ? ' primary' : ''}`}
                disabled={busy !== null}
                onClick={() => void act(st)}
              >
                {busy === st ? 'Saving…' : ACTION[st]}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
