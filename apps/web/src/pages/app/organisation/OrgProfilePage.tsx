import { useState } from 'react';
import { Globe, Mail, MapPin, Phone } from 'lucide-react';
import { ORGANISATION_TYPE_LABELS } from '@sportbridge/shared';
import { useMyOrganisation } from '../../../features/organisation/useMyOrganisation';
import { OrgProfileForm } from '../../../features/organisation/OrgProfileForm';
import { OrgPrivacyForm } from '../../../features/organisation/OrgPrivacyForm';
import { OrgUnavailable } from '../../../features/organisation/OrgUnavailable';
import { BootScreen } from '../../../app/guards';

const TABS = ['Overview', 'Contact', 'Privacy'] as const;
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

export default function OrgProfilePage() {
  const { me, orgId, org } = useMyOrganisation();
  const [tab, setTab] = useState<Tab>('Overview');
  const [editing, setEditing] = useState(false);
  if (!me) return null;
  if (!orgId) return <OrgUnavailable />;
  if (org.status === 'loading') return <BootScreen label="Loading your organisation…" />;
  if (org.status === 'error')
    return (
      <div className="sb-card sb-empty" role="alert">
        {org.message}
      </div>
    );
  if (!org.data) return <OrgUnavailable />;
  const o = org.data;
  const initials = o.name
    .split(' ')
    .map((p) => p[0])
    .filter(Boolean)
    .slice(0, 2)
    .join('')
    .toUpperCase();

  return (
    <section className="sb-page active" id="sb-page-profile">
      <div className="sb-page-head">
        <div>
          <div className="sb-kicker">ORGANISATION PROFILE</div>
          <h1>{o.name}</h1>
          <p>Show athletes, parents and coaches who you are and what you offer.</p>
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
              <h2 style={{ fontSize: 16.5, margin: '0 0 14px' }}>Edit organisation</h2>
              <OrgProfileForm
                orgId={orgId}
                org={o}
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
                  <h2>{o.name}</h2>
                  <span className={`v-badge ${o.verified ? 'ok' : 'pending'}`}>
                    {o.verified ? 'Organisation verified' : 'Not yet verified'}
                  </span>
                  <p>
                    {ORGANISATION_TYPE_LABELS[o.type]}
                    {o.sports?.length ? ` · ${o.sports.join(', ')}` : ''}
                  </p>
                  <p>
                    <MapPin className="icon" aria-hidden="true" />{' '}
                    {[o.city, o.province].filter(Boolean).join(', ') || <Muted>Location not added</Muted>}
                  </p>
                </div>
              </div>
              {tab === 'Overview' && (
                <div className="sb-detail-grid">
                  <div className="sb-detail">
                    <h4>About</h4>
                    <p style={{ whiteSpace: 'pre-line' }}>
                      {o.description || <Muted>Describe your organisation — select Edit Profile.</Muted>}
                    </p>
                    <h4 style={{ marginTop: 18 }}>Age groups</h4>
                    <Pills items={o.ageGroups} empty="None selected yet." />
                  </div>
                  <div className="sb-detail">
                    <h4>What we offer</h4>
                    <Pills items={o.offerings} empty="None selected yet." />
                    <h4 style={{ marginTop: 18 }}>Facilities</h4>
                    <Pills items={o.facilities} empty="None selected yet." />
                  </div>
                </div>
              )}
              {tab === 'Contact' && (
                <div className="sb-detail">
                  <p>
                    <Mail className="icon" aria-hidden="true" />{' '}
                    {o.contactEmail || <Muted>No contact email</Muted>}
                  </p>
                  <p>
                    <Phone className="icon" aria-hidden="true" />{' '}
                    {o.contactPhone || <Muted>No contact phone</Muted>}
                  </p>
                  <p>
                    <Globe className="icon" aria-hidden="true" />{' '}
                    {o.website ? (
                      <a href={o.website} target="_blank" rel="noopener noreferrer">
                        {o.website}
                      </a>
                    ) : (
                      <Muted>No website</Muted>
                    )}
                  </p>
                </div>
              )}
              {tab === 'Privacy' && <OrgPrivacyForm orgId={orgId} value={o.privacy} />}
            </>
          )}
        </div>
      </div>
    </section>
  );
}
