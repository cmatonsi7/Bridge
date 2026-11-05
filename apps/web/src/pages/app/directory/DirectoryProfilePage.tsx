import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { MapPin } from 'lucide-react';
import { connectionId } from '@sportbridge/shared';
import { useSignedInUser } from '../../../features/account/useSignedInUser';
import {
  useCoachConnections,
  useDirectoryEntry,
  requestConnection,
} from '../../../features/directory/directoryService';
import { ApiError } from '../../../lib/apiClient';
import { BootScreen } from '../../../app/guards';

const ROLE_LABEL = { athlete: 'Athlete', coach: 'Coach', organisation: 'Organisation' } as const;

/** A listed person's public profile. No contact details and no date of birth are ever shown here. */
export default function DirectoryProfilePage() {
  const { uid } = useParams();
  const navigate = useNavigate();
  const me = useSignedInUser();
  const entry = useDirectoryEntry(uid);
  const myConnections = useCoachConnections(me?.user.role === 'coach' ? me.uid : undefined);
  const [message, setMessage] = useState('');
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [sent, setSent] = useState(false);

  if (entry.status === 'loading') return <BootScreen label="Loading…" />;
  if (entry.status === 'error' || !entry.data) {
    return (
      <div className="sb-card sb-empty" role="alert">
        This profile isn’t listed.{' '}
        <button type="button" className="auth-link" onClick={() => navigate('/app/directory')}>
          Back to the directory
        </button>
      </div>
    );
  }
  const e = entry.data;
  const existing =
    myConnections.status === 'ready'
      ? myConnections.data.find((c) => c.id === connectionId(me?.uid ?? '', e.uid))
      : undefined;
  const canConnect = me?.user.role === 'coach' && e.role === 'athlete' && e.uid !== me.uid;
  const live = existing && ['pending', 'accepted'].includes(existing.status);

  async function send() {
    setBusy(true);
    setError('');
    try {
      await requestConnection({ athleteUid: e.uid, message });
      setSent(true);
      setOpen(false);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Something went wrong. Try again.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="sb-page active" id="sb-page-directory-profile">
      <div className="sb-page-head">
        <div>
          <div className="sb-kicker">{ROLE_LABEL[e.role].toUpperCase()}</div>
          <h1>{e.displayName}</h1>
          {e.headline && <p>{e.headline}</p>}
        </div>
        <button type="button" className="sb-btn" onClick={() => navigate('/app/directory')}>
          Back
        </button>
      </div>
      <div className="sb-card" style={{ padding: 20 }}>
        <p className="sb-meta">
          <MapPin className="icon" aria-hidden="true" />{' '}
          {[e.city, e.province].filter(Boolean).join(', ') || 'Location not added'}
        </p>
        {e.sports.length > 0 && (
          <>
            <h4 style={{ marginTop: 14 }}>Sports</h4>
            <div className="sb-pill-row">
              {e.sports.map((s) => (
                <span className="sb-pill" key={s}>
                  {s}
                </span>
              ))}
            </div>
          </>
        )}
        {e.tags.length > 0 && (
          <>
            <h4 style={{ marginTop: 14 }}>
              {e.role === 'athlete' ? 'Skills' : e.role === 'coach' ? 'Specialisations' : 'What they offer'}
            </h4>
            <div className="sb-pill-row">
              {e.tags.map((t) => (
                <span className="sb-pill" key={t}>
                  {t}
                </span>
              ))}
            </div>
          </>
        )}
        <p className="sb-field-hint" style={{ marginTop: 16 }}>
          SportBridge never shows contact details in the directory. Connect through SportBridge to get in
          touch.
        </p>

        {canConnect && (
          <div style={{ marginTop: 16 }}>
            {sent || live ? (
              <p className="sb-form-status ok" role="status">
                {existing?.status === 'accepted'
                  ? 'You are connected.'
                  : 'Request sent. You’ll be notified when it’s answered.'}
              </p>
            ) : !open ? (
              <button type="button" className="sb-btn primary" onClick={() => setOpen(true)}>
                Ask to connect
              </button>
            ) : (
              <div>
                <div className="sb-field full">
                  <label htmlFor="conn-msg">Message (optional)</label>
                  <input
                    id="conn-msg"
                    maxLength={300}
                    value={message}
                    onChange={(ev) => setMessage(ev.target.value)}
                    placeholder="Introduce yourself and why you'd like to connect."
                  />
                </div>
                <p className="sb-field-hint">
                  If this athlete is under 18, their parent or guardian decides, not the athlete.
                </p>
                {error && (
                  <p className="sb-form-status err" role="alert">
                    {error}
                  </p>
                )}
                <div className="sb-form-actions" style={{ justifyContent: 'flex-start' }}>
                  <button type="button" className="sb-btn" onClick={() => setOpen(false)} disabled={busy}>
                    Cancel
                  </button>
                  <button
                    type="button"
                    className="sb-btn primary"
                    onClick={() => void send()}
                    disabled={busy}
                  >
                    {busy ? 'Sending…' : 'Send request'}
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </section>
  );
}
