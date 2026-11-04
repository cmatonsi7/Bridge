import { useState } from 'react';
import { CURRENT_TERMS_VERSION, GUARDIAN_RELATIONSHIP_LABELS } from '@sportbridge/shared';
import { ApiError } from '../../lib/apiClient';
import { confirmRequest, declineRequest, type LinkWithId } from './guardianService';

/** A child's request for this parent to confirm the relationship and give consent. */
export function PendingRequest({ link }: { link: LinkWithId }) {
  const [agreed, setAgreed] = useState(false);
  const [busy, setBusy] = useState<'confirm' | 'decline' | null>(null);
  const [error, setError] = useState('');
  const name = link.athleteName ?? 'A SportBridge athlete';

  async function act(kind: 'confirm' | 'decline') {
    if (
      kind === 'decline' &&
      !window.confirm(`Decline ${name}'s request? Their account will stay restricted.`)
    )
      return;
    setBusy(kind);
    setError('');
    try {
      await (kind === 'confirm' ? confirmRequest(link.id) : declineRequest(link.id));
      // The request disappears from the live list once the server records the answer.
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Something went wrong. Try again.');
      setBusy(null);
    }
  }

  return (
    <div className="sb-card" style={{ padding: 16 }}>
      <span className="v-badge pending">Consent requested</span>
      <h3 style={{ margin: '10px 0 4px' }}>{name}</h3>
      <p className="sb-meta">
        Listed you as their {GUARDIAN_RELATIONSHIP_LABELS[link.relationship].toLowerCase()} when they joined
        SportBridge.
      </p>
      <label className="auth-consent" style={{ marginTop: 10 }}>
        <input type="checkbox" checked={agreed} onChange={(e) => setAgreed(e.target.checked)} />
        <span>
          I am {name}'s parent or legal guardian, and I consent to SportBridge processing their information so
          they can use the platform (terms version {CURRENT_TERMS_VERSION}).
        </span>
      </label>
      {error && (
        <p className="sb-form-status err" role="alert">
          {error}
        </p>
      )}
      <div className="sb-form-actions" style={{ justifyContent: 'flex-start' }}>
        <button
          type="button"
          className="sb-btn primary"
          disabled={!agreed || busy !== null}
          onClick={() => void act('confirm')}
        >
          {busy === 'confirm' ? 'Confirming…' : 'Confirm & give consent'}
        </button>
        <button type="button" className="sb-btn" disabled={busy !== null} onClick={() => void act('decline')}>
          {busy === 'decline' ? 'Declining…' : 'This is not my child'}
        </button>
      </div>
    </div>
  );
}
