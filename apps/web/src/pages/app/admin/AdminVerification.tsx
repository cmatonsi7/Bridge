import { useState } from 'react';
import { ORGANISATION_TYPE_LABELS } from '@sportbridge/shared';
import { ApiError } from '../../../lib/apiClient';
import { useToast } from '../../../components/Toast';
import {
  removeVerification,
  useVerificationQueue,
  verifyOrganisation,
  type QueueItem,
} from '../../../features/admin/adminService';
import { BootScreen } from '../../../app/guards';

const date = (iso?: string | null) => (iso ? new Date(iso).toLocaleDateString('en-ZA') : '—');

/** One organisation, with an expandable confirmation so a verification is never a single accidental click. */
function OrganisationCard({ org: o, verified }: { org: QueueItem; verified: boolean }) {
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function confirm() {
    setBusy(true);
    setError('');
    try {
      await (verified ? removeVerification(o.id, note) : verifyOrganisation(o.id, note));
      toast(verified ? `Verification removed from ${o.name}` : `${o.name} is now verified`);
      setOpen(false);
      setNote('');
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
          <h3 style={{ margin: 0 }}>{o.name}</h3>
          <p className="sb-meta">
            {ORGANISATION_TYPE_LABELS[o.type]} ·{' '}
            {[o.city, o.province].filter(Boolean).join(', ') || 'Location not added'}
            {o.schoolNumber ? ` · School no. ${o.schoolNumber}` : ''}
          </p>
        </div>
        <span className={`v-badge ${verified ? 'ok' : 'pending'}`}>
          {verified ? `Verified ${date(o.verifiedAt)}` : 'Awaiting verification'}
        </span>
      </div>

      <dl className="sb-facts">
        <div>
          <dt>Contact</dt>
          <dd>{[o.contactEmail, o.contactPhone].filter(Boolean).join(' · ') || 'None given'}</dd>
        </div>
        <div>
          <dt>Website</dt>
          <dd>{o.website || 'None given'}</dd>
        </div>
        <div>
          <dt>How it joined</dt>
          <dd>
            {o.source === 'staff_import'
              ? `Added by SportBridge, claimed ${date(o.claimedAt)}`
              : `Registered itself ${date(o.createdAt)}`}
          </dd>
        </div>
        <div>
          <dt>Listings</dt>
          <dd>{o.listingCount}</dd>
        </div>
      </dl>

      {!open ? (
        <button type="button" className={`sb-btn${verified ? '' : ' primary'}`} onClick={() => setOpen(true)}>
          {verified ? 'Remove verification…' : 'Verify…'}
        </button>
      ) : (
        <div className="sb-form-card" style={{ marginTop: 8 }}>
          <p className="sb-meta" style={{ lineHeight: 1.6 }}>
            {verified
              ? 'This removes the Verified badge from the organisation, all its listings and its directory entry. They are told.'
              : 'This shows the Verified badge on the organisation, all its listings and its directory entry, and tells the organisation. Families rely on this badge, so only confirm once your checks are done.'}
          </p>
          <div className="sb-field full">
            <label htmlFor={`vn-${o.id}`}>Internal note (optional, staff only)</label>
            <textarea
              id={`vn-${o.id}`}
              value={note}
              maxLength={300}
              onChange={(e) => setNote(e.target.value)}
              placeholder={
                verified
                  ? 'Why is verification being removed?'
                  : 'What did you check? e.g. phoned the school; school number matches the list.'
              }
            />
          </div>
          {error && (
            <p className="sb-form-status err" role="alert">
              {error}
            </p>
          )}
          <div className="sb-form-actions" style={{ justifyContent: 'flex-start' }}>
            <button
              type="button"
              className={`sb-btn${verified ? '' : ' primary'}`}
              disabled={busy}
              onClick={() => void confirm()}
            >
              {busy ? 'Saving…' : verified ? 'Confirm removal' : 'Confirm verification'}
            </button>
            <button
              type="button"
              className="sb-btn"
              disabled={busy}
              onClick={() => {
                setOpen(false);
                setError('');
              }}
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

/** Staff decide which organisations carry the Verified badge. */
export default function AdminVerification() {
  const q = useVerificationQueue();
  if (q.status === 'loading') return <BootScreen label="Loading organisations…" />;
  if (q.status === 'error')
    return (
      <div className="sb-card sb-empty" role="alert">
        {q.message}
      </div>
    );
  const { awaiting, verified } = q.data;

  return (
    <>
      <div className="sb-member-notice" role="note" style={{ marginBottom: 16 }}>
        <div>
          <strong>What “verified” promises</strong>
          <span>
            A Verified badge tells families that SportBridge has checked the organisation is real and that
            this account represents it. Do your checks before you verify. Organisations nobody has claimed yet
            are not listed here.
          </span>
        </div>
      </div>

      <div className="sb-section-title">
        <h2>Awaiting verification ({awaiting.length})</h2>
      </div>
      {awaiting.length === 0 ? (
        <div className="sb-card sb-empty">
          Nothing is waiting. New organisations appear here as they register or are claimed.
        </div>
      ) : (
        <div style={{ display: 'grid', gap: 12 }}>
          {awaiting.map((o) => (
            <OrganisationCard key={o.id} org={o} verified={false} />
          ))}
        </div>
      )}

      <div className="sb-section-title" style={{ margin: '28px 0 12px' }}>
        <h2>Verified ({verified.length})</h2>
      </div>
      {verified.length === 0 ? (
        <div className="sb-card sb-empty">No organisation is verified yet.</div>
      ) : (
        <div style={{ display: 'grid', gap: 12 }}>
          {verified.map((o) => (
            <OrganisationCard key={o.id} org={o} verified />
          ))}
        </div>
      )}
    </>
  );
}
