import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { isOpen } from '@sportbridge/shared';
import type { ListingWithId } from '../listings/listingsService';
import { ApiError } from '../../lib/apiClient';
import { applyTo, useApplicationsBy } from './applicationsService';
import { StatusBadge } from './StatusBadge';

/**
 * Apply / express interest on a listing, for athletes. Says exactly what the organisation will see.
 * The server re-checks everything (parent confirmation, age range, open listing, one application each).
 */
export function ApplyPanel({
  listing: l,
  uid,
  isMinor,
  restricted,
}: {
  listing: ListingWithId;
  uid: string;
  isMinor: boolean;
  restricted: boolean;
}) {
  const navigate = useNavigate();
  const mine = useApplicationsBy(uid);
  const [open, setOpen] = useState(false);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const verb = l.kind === 'programme' ? 'Express interest' : 'Apply';
  const existing = mine.status === 'ready' ? mine.data.find((a) => a.listingId === l.id) : undefined;

  if (mine.status === 'loading') return null;
  if (existing) {
    return (
      <div style={{ width: '100%' }}>
        <p className="sb-meta">
          You applied on {new Date(existing.createdAt).toLocaleDateString('en-ZA')} ·{' '}
          <StatusBadge status={existing.status} />
        </p>
        <button type="button" className="sb-btn" onClick={() => navigate('/app/applications')}>
          View my applications
        </button>
      </div>
    );
  }
  if (!isOpen(l)) return <p className="sb-field-hint">This listing is closed.</p>;
  if (restricted) {
    return (
      <p className="sb-field-hint">
        A parent or guardian needs to confirm your account before you can {verb.toLowerCase()}. You can save
        this listing for now.
      </p>
    );
  }
  if (!open) {
    return (
      <button type="button" className="sb-btn primary" onClick={() => setOpen(true)}>
        {verb}
      </button>
    );
  }

  async function submit() {
    setBusy(true);
    setError('');
    try {
      await applyTo(l.id, note);
      setOpen(false);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Something went wrong. Try again.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="sb-card sb-form-card" style={{ width: '100%', marginTop: 4 }}>
      <h3 style={{ marginTop: 0 }}>
        {verb}: {l.title}
      </h3>
      <div className="sb-field full">
        <label htmlFor="apply-note">Note to {l.orgName} (optional)</label>
        <textarea
          id="apply-note"
          maxLength={500}
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Anything they should know: experience, availability, questions."
        />
        <span className="sb-field-hint">{note.length}/500</span>
      </div>
      <p className="sb-field-hint" style={{ lineHeight: 1.6 }}>
        {l.orgName} will see your name, age, sport, position, location, bio and skills
        {isMinor
          ? '. Because you are under 18, they will not see your email or phone number, and your parent or guardian can see this application.'
          : ', plus your email and phone number so they can contact you.'}
      </p>
      {error && (
        <p className="sb-form-status err" role="alert">
          {error}
        </p>
      )}
      <div className="sb-form-actions">
        <button type="button" className="sb-btn" onClick={() => setOpen(false)} disabled={busy}>
          Cancel
        </button>
        <button type="button" className="sb-btn primary" onClick={() => void submit()} disabled={busy}>
          {busy ? 'Sending…' : `Send ${l.kind === 'programme' ? 'interest' : 'application'}`}
        </button>
      </div>
    </div>
  );
}
