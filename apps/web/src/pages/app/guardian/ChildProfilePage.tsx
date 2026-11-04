import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Goal, MapPin, ShieldCheck } from 'lucide-react';
import { athleteCompletion } from '@sportbridge/shared';
import { useAuth } from '../../../features/auth/AuthProvider';
import { useAchievements, useAthleteProfile } from '../../../features/athlete/athleteService';
import { useMyChildren, withdrawConsent } from '../../../features/guardian/guardianService';
import { ApiError } from '../../../lib/apiClient';
import { BootScreen } from '../../../app/guards';
import { ChildApplications } from '../../../features/applications/ChildApplications';

const Muted = ({ children }: { children: string }) => <span style={{ color: '#8a978f' }}>{children}</span>;

/** A parent's read-only view of a confirmed child, with consent controls. */
export default function ChildProfilePage() {
  const { childUid } = useParams();
  const navigate = useNavigate();
  const { state } = useAuth();
  const uid = state.status === 'signedIn' ? state.user.uid : undefined;
  const children = useMyChildren(uid);
  const link = children.status === 'ready' ? children.data.find((l) => l.athleteUid === childUid) : undefined;
  // Only subscribe to the child once the link confirms access, so rules never see an unauthorised read.
  const profile = useAthleteProfile(link ? childUid : undefined);
  const achievements = useAchievements(link ? childUid : undefined);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  if (children.status === 'loading') return <BootScreen label="Loading…" />;
  if (!link) {
    return (
      <div className="sb-card sb-empty" role="alert">
        This child isn’t connected to your account.{' '}
        <button type="button" className="auth-link" onClick={() => navigate('/app')}>
          Back to dashboard
        </button>
      </div>
    );
  }
  if (profile.status === 'loading' || achievements.status === 'loading')
    return <BootScreen label="Loading profile…" />;
  if (profile.status === 'error' || achievements.status === 'error') {
    return (
      <div className="sb-card sb-empty" role="alert">
        We couldn’t load this profile. Check your connection and refresh.
      </div>
    );
  }

  const p = profile.data;
  const name = p?.displayName ?? link.athleteName ?? 'Your child';
  const { percent } = athleteCompletion(p, achievements.data.length);

  async function withdraw() {
    if (
      !window.confirm(
        `Withdraw consent for ${name}? Their account will be restricted again until a guardian confirms.`,
      )
    )
      return;
    setBusy(true);
    setError('');
    try {
      await withdrawConsent(link!.id);
      navigate('/app');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Something went wrong. Try again.');
      setBusy(false);
    }
  }

  return (
    <section className="sb-page active" id="sb-page-child">
      <div className="sb-page-head">
        <div>
          <div className="sb-kicker">CHILD PROFILE</div>
          <h1>{name}</h1>
          <p>You can see your child’s profile because you confirmed them as their parent or guardian.</p>
        </div>
        <button type="button" className="sb-btn" onClick={() => navigate('/app')}>
          Back to dashboard
        </button>
      </div>
      <div className="sb-grid-2" style={{ marginBottom: 15 }}>
        <div className="sb-card sb-profile-card">
          <p>
            <Goal className="icon" aria-hidden="true" />{' '}
            {[p?.sport, p?.position].filter(Boolean).join(' · ') || <Muted>Sport not added</Muted>}
          </p>
          <p>
            <MapPin className="icon" aria-hidden="true" />{' '}
            {[p?.city, p?.province].filter(Boolean).join(', ') || <Muted>Location not added</Muted>}
          </p>
          <div className="sb-detail" style={{ marginTop: 12 }}>
            <h4>About</h4>
            <p style={{ whiteSpace: 'pre-line' }}>{p?.bio || <Muted>Nothing written yet.</Muted>}</p>
            <h4 style={{ marginTop: 14 }}>Club · School</h4>
            <p>{[p?.club, p?.school].filter(Boolean).join(' · ') || <Muted>—</Muted>}</p>
            {p?.skills?.length ? (
              <>
                <h4 style={{ marginTop: 14 }}>Skills</h4>
                <div className="sb-pill-row">
                  {p.skills.map((s) => (
                    <span className="sb-pill" key={s}>
                      {s}
                    </span>
                  ))}
                </div>
              </>
            ) : null}
          </div>
        </div>
        <div className="sb-card sb-progress-card">
          <div className="sb-section-title" style={{ margin: '0 0 18px' }}>
            <h2>Development</h2>
          </div>
          <div className="sb-progress-row">
            <div
              className="sb-ring"
              role="img"
              aria-label={`Profile ${percent}% complete`}
              style={{
                background: `conic-gradient(var(--sb-green) 0 ${percent}%, #E7ECE8 ${percent}% 100%)`,
              }}
            >
              <span>{percent}%</span>
            </div>
            <div className="sb-checks">
              <div className="sb-check">
                <i aria-hidden="true">✓</i>
                <span>Profile {percent}% complete</span>
              </div>
              <div className="sb-check">
                <i aria-hidden="true">{achievements.data.length ? '✓' : '!'}</i>
                <span>
                  {achievements.data.length} achievement{achievements.data.length === 1 ? '' : 's'}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="sb-section-title">
        <h2>Applications</h2>
      </div>
      <div style={{ marginBottom: 20 }}>
        <ChildApplications childUid={childUid!} childName={name} />
      </div>

      <div className="sb-section-title">
        <h2>Achievements</h2>
      </div>
      {achievements.data.length === 0 ? (
        <div className="sb-card sb-empty">No achievements added yet.</div>
      ) : (
        <div className="sb-grid-3" style={{ marginBottom: 15 }}>
          {achievements.data.map((a) => (
            <div className="sb-card" style={{ padding: 16 }} key={a.id}>
              <span className="sb-tag">{a.year}</span>
              <h3 style={{ fontSize: 14.5, margin: '10px 0 4px' }}>{a.title}</h3>
              <p className="sb-meta">{[a.organisation, a.detail].filter(Boolean).join(' · ')}</p>
            </div>
          ))}
        </div>
      )}

      <div className="sb-card" style={{ padding: 16, marginTop: 15 }}>
        <h3>
          <ShieldCheck className="icon" aria-hidden="true" /> Consent &amp; privacy
        </h3>
        <p className="sb-meta" style={{ lineHeight: 1.6 }}>
          Consent recorded {link.verifiedAt ? new Date(link.verifiedAt).toLocaleDateString('en-ZA') : ''}{' '}
          (terms version {link.consentVersion}). Your child’s profile stays private; who can see it will be
          controlled here when Discovery launches.
        </p>
        {error && (
          <p className="sb-form-status err" role="alert">
            {error}
          </p>
        )}
        <button type="button" className="sb-btn" disabled={busy} onClick={() => void withdraw()}>
          {busy ? 'Withdrawing…' : 'Withdraw consent'}
        </button>
      </div>
    </section>
  );
}
