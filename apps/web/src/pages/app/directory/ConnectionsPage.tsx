import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { ConnectionStatus } from '@sportbridge/shared';
import { useSignedInUser } from '../../../features/account/useSignedInUser';
import { useMyChildren } from '../../../features/guardian/guardianService';
import {
  acceptConnection,
  declineConnection,
  endConnection,
  useAthleteConnections,
  useCoachConnections,
  type ConnectionWithId,
} from '../../../features/directory/directoryService';
import { ApiError } from '../../../lib/apiClient';
import { BootScreen } from '../../../app/guards';

const BADGE: Record<ConnectionStatus, { label: string; cls: string }> = {
  pending: { label: 'Awaiting a decision', cls: 'pending' },
  accepted: { label: 'Connected', cls: 'ok' },
  declined: { label: 'Declined', cls: 'pending' },
  ended: { label: 'Ended', cls: 'pending' },
};

function Row({
  c,
  side,
  canAnswer,
}: {
  c: ConnectionWithId;
  side: 'coach' | 'athlete' | 'guardian';
  canAnswer: boolean;
}) {
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const who = side === 'coach' ? c.athleteName : c.coachName;
  const run = async (what: 'accept' | 'decline' | 'end') => {
    if (what === 'end' && !window.confirm(`End the connection with ${who}?`)) return;
    setBusy(what);
    setError('');
    try {
      await (what === 'accept'
        ? acceptConnection(c.id)
        : what === 'decline'
          ? declineConnection(c.id)
          : endConnection(c.id));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Something went wrong. Try again.');
    } finally {
      setBusy('');
    }
  };
  return (
    <div className="sb-card" style={{ padding: 16 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' }}>
        <div>
          <h3 style={{ margin: 0 }}>{who}</h3>
          <p className="sb-meta">
            {side === 'coach' ? 'Athlete' : 'Coach'}
            {side === 'guardian' ? ` · for ${c.athleteName}` : ''}
            {c.athleteIsMinor && side === 'coach' ? ' · Under 18' : ''}
          </p>
        </div>
        <span className={`v-badge ${BADGE[c.status].cls}`}>{BADGE[c.status].label}</span>
      </div>
      {c.message && (
        <p className="sb-meta" style={{ marginTop: 8 }}>
          “{c.message}”
        </p>
      )}
      {c.status === 'pending' && !canAnswer && side === 'athlete' && c.athleteIsMinor && (
        <p className="sb-field-hint" style={{ marginTop: 8 }}>
          Your parent or guardian will decide on this request.
        </p>
      )}
      {error && (
        <p className="sb-form-status err" role="alert">
          {error}
        </p>
      )}
      <div className="sb-form-actions" style={{ justifyContent: 'flex-start' }}>
        {c.status === 'pending' && canAnswer && (
          <>
            <button
              type="button"
              className="sb-btn primary"
              disabled={!!busy}
              onClick={() => void run('accept')}
            >
              {busy === 'accept' ? 'Accepting…' : 'Accept'}
            </button>
            <button type="button" className="sb-btn" disabled={!!busy} onClick={() => void run('decline')}>
              {busy === 'decline' ? 'Declining…' : 'Decline'}
            </button>
          </>
        )}
        {c.status === 'accepted' && (
          <button type="button" className="sb-btn" disabled={!!busy} onClick={() => void run('end')}>
            {busy === 'end' ? 'Ending…' : 'End connection'}
          </button>
        )}
      </div>
    </div>
  );
}

/** Connections, shown from the signed-in person's side: coach, athlete, or parent acting for a child. */
export default function ConnectionsPage() {
  const navigate = useNavigate();
  const me = useSignedInUser();
  const role = me?.user.role;
  const coach = useCoachConnections(role === 'coach' ? me?.uid : undefined);
  const athlete = useAthleteConnections(role === 'athlete' ? me?.uid : undefined);
  const children = useMyChildren(role === 'guardian' ? me?.uid : undefined);
  const firstChild = children.status === 'ready' ? children.data[0] : undefined;
  const childConnections = useAthleteConnections(firstChild?.athleteUid);

  if (!me) return null;
  if (role === 'coach') {
    if (coach.status === 'loading') return <BootScreen label="Loading connections…" />;
    if (coach.status === 'error')
      return (
        <div className="sb-card sb-empty" role="alert">
          {coach.message}
        </div>
      );
    const live = coach.data.filter((c) => c.status === 'accepted');
    return (
      <section className="sb-page active" id="sb-page-connections">
        <div className="sb-page-head">
          <div>
            <div className="sb-kicker">YOUR ATHLETES</div>
            <h1>My Athletes</h1>
            <p>Athletes you are connected to, and requests you have sent.</p>
            <div className="dashboard-context">
              {live.length} connected · {coach.data.filter((c) => c.status === 'pending').length} awaiting a
              decision
            </div>
          </div>
          <button type="button" className="sb-btn primary" onClick={() => navigate('/app/directory')}>
            Find athletes
          </button>
        </div>
        {coach.data.length === 0 ? (
          <div className="sb-card sb-empty">
            You haven’t sent any connection requests yet.{' '}
            <button type="button" className="auth-link" onClick={() => navigate('/app/directory')}>
              Search the directory
            </button>
          </div>
        ) : (
          <div style={{ display: 'grid', gap: 12 }}>
            {coach.data.map((c) => (
              <Row key={c.id} c={c} side="coach" canAnswer={false} />
            ))}
          </div>
        )}
      </section>
    );
  }

  const isGuardian = role === 'guardian';
  const state = isGuardian ? childConnections : athlete;
  const title = isGuardian ? 'Coach requests for your children' : 'Coaches';
  if ((isGuardian && children.status === 'loading') || state.status === 'loading')
    return <BootScreen label="Loading connections…" />;
  if (state.status === 'error')
    return (
      <div className="sb-card sb-empty" role="alert">
        {state.message}
      </div>
    );

  return (
    <section className="sb-page active" id="sb-page-connections">
      <div className="sb-page-head">
        <div>
          <div className="sb-kicker">CONNECTIONS</div>
          <h1>{title}</h1>
          <p>
            {isGuardian
              ? 'Coaches who have asked to connect with your children. You decide, not your child.'
              : 'Coaches who have asked to connect with you.'}
          </p>
        </div>
      </div>
      {isGuardian && children.status === 'ready' && children.data.length > 1 && (
        <p className="sb-field-hint" style={{ marginBottom: 12 }}>
          Showing requests for {firstChild?.athleteName}. Open each child’s page to see theirs.
        </p>
      )}
      {state.data.length === 0 ? (
        <div className="sb-card sb-empty">No coach requests yet.</div>
      ) : (
        <div style={{ display: 'grid', gap: 12 }}>
          {state.data.map((c) => (
            <Row
              key={c.id}
              c={c}
              side={isGuardian ? 'guardian' : 'athlete'}
              canAnswer={isGuardian ? true : !c.athleteIsMinor}
            />
          ))}
        </div>
      )}
    </section>
  );
}
