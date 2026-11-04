import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { CircleCheck, Goal, MapPin } from 'lucide-react';
import { useAthleteContext } from '../../../features/athlete/useAthleteContext';
import {
  ageFromDob,
  useAchievements,
  useAthleteProfile,
  usePrivateDetails,
} from '../../../features/athlete/athleteService';
import { AthleteProfileForm } from '../../../features/athlete/AthleteProfileForm';
import { PrivacyForm } from '../../../features/athlete/PrivacyForm';
import { BootScreen } from '../../../app/guards';

const TABS = ['Overview', 'About Me', 'Achievements', 'Media & Videos', 'Documents', 'Privacy'] as const;
type Tab = (typeof TABS)[number];

const Muted = ({ children }: { children: string }) => <span style={{ color: '#8a978f' }}>{children}</span>;

export default function AthleteProfilePage() {
  const ctx = useAthleteContext();
  const navigate = useNavigate();
  const profileState = useAthleteProfile(ctx?.uid);
  const achievements = useAchievements(ctx?.uid);
  const priv = usePrivateDetails(ctx?.uid);
  const [tab, setTab] = useState<Tab>('Overview');
  const [editing, setEditing] = useState(false);

  if (!ctx) return null;
  if (profileState.status === 'loading') return <BootScreen label="Loading your profile…" />;
  if (profileState.status === 'error')
    return (
      <div className="sb-card sb-empty" role="alert">
        {profileState.message}
      </div>
    );

  const p = profileState.data;
  const age = priv.status === 'ready' ? ageFromDob(priv.data?.dateOfBirth) : null;
  const initials = `${ctx.user.firstName[0] ?? ''}${ctx.user.surname[0] ?? ''}`.toUpperCase();
  const location = [p?.city, p?.province].filter(Boolean).join(', ');
  const sportLine = [p?.sport, p?.position].filter(Boolean).join(' · ');
  const achievementList = achievements.status === 'ready' ? achievements.data : [];

  const editButton = !editing && (
    <button
      className="sb-btn primary"
      type="button"
      onClick={() => {
        setTab('Overview');
        setEditing(true);
      }}
    >
      Edit Profile
    </button>
  );

  return (
    <section className="sb-page active" id="sb-page-profile">
      <div className="sb-page-head">
        <div>
          <div className="sb-kicker">YOUR IDENTITY</div>
          <h1>My Profile</h1>
          <p>Showcase your sporting journey and keep your information current.</p>
        </div>
        {editButton}
      </div>
      <div className="sb-profile-layout">
        <aside className="sb-card sb-profile-nav" aria-label="Profile sections">
          {TABS.map((t) => (
            <button
              key={t}
              type="button"
              className={tab === t ? 'active' : ''}
              aria-current={tab === t ? 'page' : undefined}
              onClick={() => {
                setTab(t);
                setEditing(false);
              }}
            >
              {t}
            </button>
          ))}
        </aside>
        <div className="sb-card sb-profile-card">
          {editing ? (
            <>
              <h2 style={{ fontSize: 15, margin: '0 0 14px' }}>Edit profile</h2>
              <AthleteProfileForm
                uid={ctx.uid}
                firstName={ctx.user.firstName}
                surname={ctx.user.surname}
                profile={p}
                onSaved={() => setEditing(false)}
                onCancel={() => setEditing(false)}
              />
            </>
          ) : (
            <>
              <div className="sb-profile-top">
                <div
                  className="sb-big-avatar"
                  aria-hidden="true"
                  style={{
                    display: 'grid',
                    placeItems: 'center',
                    background: '#006B35',
                    color: '#fff',
                    fontWeight: 900,
                    fontSize: 26,
                  }}
                >
                  {initials}
                </div>
                <div>
                  <h2>{ctx.user.displayName}</h2>
                  <div className="sb-verified">
                    <CircleCheck className="icon" aria-hidden="true" /> Athlete profile
                  </div>
                  <p>
                    <Goal className="icon" aria-hidden="true" />{' '}
                    {sportLine || <Muted>Sport and position not added</Muted>}
                  </p>
                  <p>
                    <MapPin className="icon" aria-hidden="true" />{' '}
                    {location || <Muted>Location not added</Muted>}
                    {age !== null ? ` · Age ${age}` : ''}
                  </p>
                </div>
              </div>

              {tab === 'Overview' && (
                <div className="sb-detail-grid">
                  <div className="sb-detail">
                    <h4>About Me</h4>
                    <p>
                      {p?.bio || <Muted>Tell coaches and clubs about yourself — select Edit Profile.</Muted>}
                    </p>
                    <div style={{ marginTop: 11, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 9 }}>
                      {(
                        [
                          ['Favourite Position', p?.position],
                          ['Current Club', p?.club],
                          ['School', p?.school],
                          [
                            'Experience',
                            p?.experienceYears != null
                              ? `${p.experienceYears} year${p.experienceYears === 1 ? '' : 's'}`
                              : null,
                          ],
                        ] as const
                      ).map(([label, v]) => (
                        <div key={label}>
                          <b style={{ fontSize: 8 }}>{label}</b>
                          <p>{v || <Muted>—</Muted>}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div className="sb-detail">
                    <h4>Skills</h4>
                    {p?.skills?.length ? (
                      <div className="sb-pill-row">
                        {p.skills.map((s) => (
                          <span className="sb-pill" key={s}>
                            {s}
                          </span>
                        ))}
                      </div>
                    ) : (
                      <p>
                        <Muted>No skills selected yet.</Muted>
                      </p>
                    )}
                    <h4 style={{ marginTop: 18 }}>Sporting Interests</h4>
                    {p?.interests?.length ? (
                      <div className="sb-pill-row">
                        {p.interests.map((s) => (
                          <span className="sb-pill" key={s}>
                            {s}
                          </span>
                        ))}
                      </div>
                    ) : (
                      <p>
                        <Muted>No interests selected yet.</Muted>
                      </p>
                    )}
                  </div>
                </div>
              )}

              {tab === 'About Me' && (
                <div className="sb-detail">
                  <h4>About Me</h4>
                  <p style={{ whiteSpace: 'pre-line' }}>{p?.bio || <Muted>Nothing written yet.</Muted>}</p>
                </div>
              )}

              {tab === 'Achievements' &&
                (achievementList.length === 0 ? (
                  <div className="sb-empty">
                    No achievements yet.{' '}
                    <button type="button" className="auth-link" onClick={() => navigate('/app/progress')}>
                      Add one in My Progress
                    </button>
                  </div>
                ) : (
                  <div className="sb-grid-3">
                    {achievementList.map((a) => (
                      <div className="sb-card" style={{ padding: 16 }} key={a.id}>
                        <span className="sb-tag">{a.year}</span>
                        <h3 style={{ fontSize: 12, margin: '10px 0 4px' }}>{a.title}</h3>
                        <p className="sb-meta">{[a.organisation, a.detail].filter(Boolean).join(' · ')}</p>
                      </div>
                    ))}
                  </div>
                ))}

              {(tab === 'Media & Videos' || tab === 'Documents') && (
                <div className="sb-empty">
                  {tab === 'Documents'
                    ? 'Uploading certificates and supporting documents'
                    : 'Uploading photos and highlight videos'}{' '}
                  is coming in an upcoming release.
                </div>
              )}

              {tab === 'Privacy' && (
                <PrivacyForm uid={ctx.uid} value={p?.privacy} isMinor={ctx.user.isMinor} />
              )}
            </>
          )}
        </div>
      </div>
    </section>
  );
}
