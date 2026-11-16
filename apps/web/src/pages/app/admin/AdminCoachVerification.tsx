import { useState } from 'react';
import {
  CREDENTIAL_STATUS_LABELS,
  credentialTypeLabel,
  type CoachVerificationDoc,
} from '@sportbridge/shared';
import { ApiError } from '../../../lib/apiClient';
import { useToast } from '../../../components/Toast';
import {
  decideCoachCredentials,
  useCoachVerifications,
  type CoachQueueItem,
} from '../../../features/admin/adminService';
import { BootScreen } from '../../../app/guards';

const date = (iso?: string | null) => (iso ? new Date(iso).toLocaleDateString('en-ZA') : '—');
const kb = (bytes: number) => `${Math.max(1, Math.round(bytes / 1024))} KB`;

const STATUS_CLASS: Record<CoachVerificationDoc['status'], string> = {
  draft: 'closed',
  submitted: 'review',
  verified: 'live',
  rejected: 'closed',
};

/**
 * Staff review of coach credentials (Phase 5b).
 *
 * Verifying a coach is what lets them contact athletes, so this screen is built to be read carefully:
 * the documents open in a new tab through short-lived links, and saying no requires a reason the coach
 * will actually receive.
 */
export default function AdminCoachVerification() {
  const { state, reload } = useCoachVerifications();
  if (state.status === 'loading') return <BootScreen label="Loading coach verifications…" />;
  if (state.status === 'error')
    return (
      <div className="sb-card sb-empty" role="alert">
        {state.message}
      </div>
    );

  const awaiting = state.data.filter((c) => c.status === 'submitted');
  const decided = state.data.filter((c) => c.status !== 'submitted');
  return (
    <div style={{ display: 'grid', gap: 18 }}>
      <section>
        <h2 style={{ marginTop: 0 }}>Awaiting review ({awaiting.length})</h2>
        {awaiting.length === 0 ? (
          <div className="sb-card sb-empty">
            <p style={{ margin: 0 }}>No coaches are waiting for review.</p>
          </div>
        ) : (
          <div style={{ display: 'grid', gap: 12 }}>
            {awaiting.map((c) => (
              <CoachCard key={c.uid} coach={c} onDone={reload} />
            ))}
          </div>
        )}
      </section>

      <section>
        <h2>Already decided ({decided.length})</h2>
        {decided.length === 0 ? (
          <div className="sb-card sb-empty">
            <p style={{ margin: 0 }}>Nothing decided yet.</p>
          </div>
        ) : (
          <div style={{ display: 'grid', gap: 12 }}>
            {decided.map((c) => (
              <CoachCard key={c.uid} coach={c} onDone={reload} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function CoachCard({ coach: c, onDone }: { coach: CoachQueueItem; onDone: () => void }) {
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [decisionNote, setDecisionNote] = useState('');
  const [internalNote, setInternalNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function decide(verified: boolean) {
    if (!verified && decisionNote.trim() === '') {
      setError('Tell the coach why, so they know what to send again.');
      return;
    }
    setBusy(true);
    setError('');
    try {
      await decideCoachCredentials(c.uid, verified, decisionNote.trim(), internalNote.trim());
      toast(verified ? `${c.displayName} is now verified` : `${c.displayName} was not verified`);
      setOpen(false);
      setDecisionNote('');
      setInternalNote('');
      onDone();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Something went wrong. Try again.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="sb-card" style={{ padding: 16 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' }}>
        <div>
          <h3 style={{ margin: 0 }}>{c.displayName}</h3>
          <p className="sb-meta">
            {c.docCount} {c.docCount === 1 ? 'document' : 'documents'} · sent {date(c.submittedAt)}
            {c.decidedAt ? ` · decided ${date(c.decidedAt)}` : ''}
          </p>
        </div>
        <span className={`sb-status ${STATUS_CLASS[c.status]}`}>{CREDENTIAL_STATUS_LABELS[c.status]}</span>
      </div>

      {c.documents.length === 0 ? (
        <p className="sb-meta" style={{ marginTop: 10 }}>
          No documents uploaded.
        </p>
      ) : (
        <ul className="sb-doc-list" style={{ marginTop: 10 }}>
          {c.documents.map((d) => (
            <li key={d.id} className="sb-doc-row">
              <div style={{ minWidth: 0 }}>
                <strong style={{ display: 'block', overflowWrap: 'anywhere' }}>{d.fileName}</strong>
                <span className="sb-meta">
                  {credentialTypeLabel(d.contentType)} · {kb(d.sizeBytes)} · uploaded {date(d.uploadedAt)}
                </span>
              </div>
              {d.url ? (
                <a className="sb-btn" href={d.url} target="_blank" rel="noopener noreferrer">
                  Open
                </a>
              ) : (
                <span className="sb-meta">Link unavailable</span>
              )}
            </li>
          ))}
        </ul>
      )}

      {!open ? (
        <div className="sb-form-actions" style={{ marginTop: 12 }}>
          <button type="button" className="sb-btn primary" onClick={() => setOpen(true)}>
            {c.status === 'verified' ? 'Change decision' : 'Review'}
          </button>
        </div>
      ) : (
        <div style={{ display: 'grid', gap: 8, marginTop: 12 }}>
          <label htmlFor={`note-${c.uid}`}>Note to the coach (required if not verifying)</label>
          <textarea
            id={`note-${c.uid}`}
            rows={2}
            maxLength={500}
            value={decisionNote}
            onChange={(e) => setDecisionNote(e.target.value)}
            placeholder="What the coach needs to fix or send again"
          />
          <label htmlFor={`internal-${c.uid}`}>Internal note (staff only — the coach never sees this)</label>
          <textarea
            id={`internal-${c.uid}`}
            rows={2}
            maxLength={500}
            value={internalNote}
            onChange={(e) => setInternalNote(e.target.value)}
          />
          {error && (
            <p className="sb-form-status err" role="alert">
              {error}
            </p>
          )}
          <div className="sb-form-actions">
            <button type="button" className="sb-btn" disabled={busy} onClick={() => setOpen(false)}>
              Cancel
            </button>
            <button type="button" className="sb-btn" disabled={busy} onClick={() => void decide(false)}>
              Not verified
            </button>
            <button
              type="button"
              className="sb-btn primary"
              disabled={busy}
              onClick={() => void decide(true)}
            >
              {busy ? 'Saving…' : 'Verify coach'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
