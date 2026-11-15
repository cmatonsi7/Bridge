import { useState } from 'react';
import {
  closeSponsorshipRequest,
  rand,
  reviewSponsorshipRequest,
  useOpenRequests,
  usePendingRequests,
  type RequestWithId,
} from '../../../features/sponsorship/sponsorshipService';

const errorText = (e: unknown) => (e instanceof Error ? e.message : 'Something went wrong. Try again.');

/** Staff: approve requests made for children, and look at requests people have reported. */
export default function AdminSponsorship() {
  const pending = usePendingRequests();
  const open = useOpenRequests();
  const reported = open.status === 'ready' ? open.data.filter((r) => r.reportCount > 0) : [];
  return (
    <div style={{ display: 'grid', gap: 14 }}>
      <div className="sb-member-notice" role="note">
        Requests made by a parent for a child wait here until staff approve them (these are switched off until
        the legal question about children is answered). Adult athletes’ requests go live at once; any that
        members report appear below.
      </div>
      <div className="sb-section-title">
        <h2>Waiting for review</h2>
      </div>
      {pending.status === 'error' ? (
        <div className="sb-card sb-empty" role="alert">
          {pending.message}
        </div>
      ) : pending.status === 'loading' ? (
        <div className="sb-card sb-empty">Loading…</div>
      ) : pending.data.length === 0 ? (
        <div className="sb-card sb-empty">No requests are waiting for review.</div>
      ) : (
        pending.data.map((r) => <Row key={r.id} r={r} review />)
      )}
      <div className="sb-section-title">
        <h2>Reported by members</h2>
      </div>
      {reported.length === 0 ? (
        <div className="sb-card sb-empty">Nobody has reported a request.</div>
      ) : (
        reported.map((r) => <Row key={r.id} r={r} />)
      )}
    </div>
  );
}

function Row({ r, review = false }: { r: RequestWithId; review?: boolean }) {
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const run = async (fn: () => Promise<unknown>) => {
    setBusy(true);
    setError(null);
    try {
      await fn();
    } catch (e) {
      setError(errorText(e));
    }
    setBusy(false);
  };
  return (
    <div className="sb-card" style={{ padding: 16 }}>
      <h3 style={{ margin: 0 }}>{r.title}</h3>
      <p className="sb-meta">
        {r.forChild ? 'For a child' : (r.displayName ?? '')} · {r.ageBand} · {r.sport} · {r.province} ·{' '}
        {rand(r.amountZar)} · {r.category}
        {r.reportCount > 0 && ` · reported ${r.reportCount} time${r.reportCount === 1 ? '' : 's'}`}
      </p>
      <p style={{ lineHeight: 1.6 }}>{r.story}</p>
      {review && (
        <div className="sb-field full">
          <label htmlFor={`rn-${r.id}`}>Note to the parent (optional)</label>
          <textarea
            id={`rn-${r.id}`}
            rows={2}
            maxLength={300}
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />
        </div>
      )}
      {error && (
        <p className="sb-form-status err" role="alert">
          {error}
        </p>
      )}
      <div className="sb-form-actions" style={{ justifyContent: 'flex-start' }}>
        {review ? (
          <>
            <button
              type="button"
              className="sb-btn primary"
              disabled={busy}
              onClick={() => void run(() => reviewSponsorshipRequest(r.id, true, note))}
            >
              Approve and list it
            </button>
            <button
              type="button"
              className="sb-btn"
              disabled={busy}
              onClick={() => void run(() => reviewSponsorshipRequest(r.id, false, note))}
            >
              Don’t approve
            </button>
          </>
        ) : (
          <button
            type="button"
            className="sb-btn"
            disabled={busy}
            onClick={() => void run(() => closeSponsorshipRequest(r.id))}
          >
            Take it down
          </button>
        )}
      </div>
    </div>
  );
}
