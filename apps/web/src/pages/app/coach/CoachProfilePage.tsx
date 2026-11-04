import { useState } from 'react';
import { Award, Goal, MapPin } from 'lucide-react';
import { useSignedInUser } from '../../../features/account/useSignedInUser';
import { useCoachProfile, useQualifications } from '../../../features/coach/coachService';
import { CoachProfileForm } from '../../../features/coach/CoachProfileForm';
import { QualificationsManager } from '../../../features/coach/QualificationsManager';
import { CoachPrivacyForm } from '../../../features/coach/CoachPrivacyForm';
import { BootScreen } from '../../../app/guards';

const TABS = ['Overview', 'Qualifications', 'Privacy'] as const;
type Tab = (typeof TABS)[number];
const Muted = ({ children }: { children: string }) => <span style={{ color: '#8a978f' }}>{children}</span>;
const Pills = ({ items, empty }: { items?: string[]; empty: string }) =>
  items?.length ? (
    <div className="sb-pill-row">
      {items.map((s) => (
        <span className="sb-pill" key={s}>
          {s}
        </span>
      ))}
    </div>
  ) : (
    <p>
      <Muted>{empty}</Muted>
    </p>
  );

export default function CoachProfilePage() {
  const ctx = useSignedInUser();
  const profile = useCoachProfile(ctx?.uid);
  const quals = useQualifications(ctx?.uid);
  const [tab, setTab] = useState<Tab>('Overview');
  const [editing, setEditing] = useState(false);

  if (!ctx) return null;
  if (profile.status === 'loading' || quals.status === 'loading')
    return <BootScreen label="Loading your profile…" />;
  if (profile.status === 'error' || quals.status === 'error') {
    return (
      <div className="sb-card sb-empty" role="alert">
        We couldn’t load your profile. Check your connection and refresh.
      </div>
    );
  }
  const p = profile.data;
  const initials = `${ctx.user.firstName[0] ?? ''}${ctx.user.surname[0] ?? ''}`.toUpperCase();

  return (
    <section className="sb-page active" id="sb-page-profile">
      <div className="sb-page-head">
        <div>
          <div className="sb-kicker">COACH PROFILE</div>
          <h1>My Profile</h1>
          <p>Show athletes and parents your experience, specialisations and the support you offer.</p>
        </div>
        {!editing && (
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
        )}
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
              <h2 style={{ fontSize: 16.5, margin: '0 0 14px' }}>Edit profile</h2>
              <CoachProfileForm
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
                  <span className="v-badge pending">Credentials self-declared</span>
                  <p>
                    <Goal className="icon" aria-hidden="true" />{' '}
                    {[p?.sports?.join(', '), p?.coachingLevel && `${p.coachingLevel} level`]
                      .filter(Boolean)
                      .join(' · ') || <Muted>Sports and level not added</Muted>}
                  </p>
                  <p>
                    <MapPin className="icon" aria-hidden="true" />{' '}
                    {[p?.city, p?.province].filter(Boolean).join(', ') || <Muted>Location not added</Muted>}
                  </p>
                </div>
              </div>
              {tab === 'Overview' && (
                <div className="sb-detail-grid">
                  <div className="sb-detail">
                    <h4>About Me</h4>
                    <p style={{ whiteSpace: 'pre-line' }}>
                      {p?.bio || <Muted>Tell athletes about your coaching — select Edit Profile.</Muted>}
                    </p>
                    <div style={{ marginTop: 11, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 9 }}>
                      <div>
                        <b style={{ fontSize: 9.5 }}>Organisation</b>
                        <p>{p?.organisation || <Muted>—</Muted>}</p>
                      </div>
                      <div>
                        <b style={{ fontSize: 9.5 }}>Experience</b>
                        <p>
                          {p?.experienceYears != null ? (
                            `${p.experienceYears} year${p.experienceYears === 1 ? '' : 's'}`
                          ) : (
                            <Muted>—</Muted>
                          )}
                        </p>
                      </div>
                    </div>
                  </div>
                  <div className="sb-detail">
                    <h4>Specialisations</h4>
                    <Pills items={p?.specialisations} empty="None selected yet." />
                    <h4 style={{ marginTop: 18 }}>Services</h4>
                    <Pills items={p?.services} empty="None selected yet." />
                    <h4 style={{ marginTop: 18 }}>Age groups</h4>
                    <Pills items={p?.ageGroups} empty="None selected yet." />
                    <h4 style={{ marginTop: 18 }}>
                      <Award className="icon" aria-hidden="true" /> Qualifications
                    </h4>
                    <p>
                      {quals.data.length ? (
                        `${quals.data.length} self-declared`
                      ) : (
                        <Muted>None added yet.</Muted>
                      )}
                    </p>
                  </div>
                </div>
              )}
              {tab === 'Qualifications' && <QualificationsManager uid={ctx.uid} items={quals.data} />}
              {tab === 'Privacy' && <CoachPrivacyForm uid={ctx.uid} value={p?.privacy} />}
            </>
          )}
        </div>
      </div>
    </section>
  );
}
