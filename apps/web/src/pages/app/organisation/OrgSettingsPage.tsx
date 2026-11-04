import { useState } from 'react';
import { useMyOrganisation } from '../../../features/organisation/useMyOrganisation';
import { usePrivateDetails } from '../../../features/athlete/athleteService';
import { saveOwnerName } from '../../../features/organisation/orgService';
import { OrgProfileForm } from '../../../features/organisation/OrgProfileForm';
import { OrgPrivacyForm } from '../../../features/organisation/OrgPrivacyForm';
import { OrgUnavailable } from '../../../features/organisation/OrgUnavailable';
import { ContactDetails } from '../../../features/account/ContactDetails';
import { NameForm } from '../../../features/account/NameForm';
import { BootScreen } from '../../../app/guards';

const TABS = ['Account', 'Organisation', 'Privacy', 'Team', 'Membership'] as const;
type Tab = (typeof TABS)[number];

export default function OrgSettingsPage() {
  const { me, orgId, org } = useMyOrganisation();
  const priv = usePrivateDetails(me?.uid);
  const [tab, setTab] = useState<Tab>('Account');
  if (!me) return null;
  if (!orgId) return <OrgUnavailable />;
  if (org.status === 'loading' || priv.status === 'loading') return <BootScreen label="Loading settings…" />;
  if (org.status === 'error' || priv.status === 'error') {
    return (
      <div className="sb-card sb-empty" role="alert">
        We couldn’t load your settings. Check your connection and refresh.
      </div>
    );
  }
  if (!org.data) return <OrgUnavailable />;

  return (
    <section className="sb-page active" id="sb-page-settings">
      <div className="sb-page-head">
        <div>
          <div className="sb-kicker">ACCOUNT</div>
          <h1>Settings</h1>
          <p>Manage your account, your organisation, privacy and membership.</p>
        </div>
      </div>
      <div className="sb-settings">
        <aside className="sb-card sb-settings-nav" aria-label="Settings sections">
          {TABS.map((t) => (
            <button
              key={t}
              type="button"
              className={tab === t ? 'active' : ''}
              aria-current={tab === t ? 'page' : undefined}
              onClick={() => setTab(t)}
            >
              {t}
            </button>
          ))}
        </aside>
        <div className="sb-card sb-form-card">
          {tab === 'Account' && (
            <>
              <h2 style={{ fontSize: 15, margin: '0 0 4px' }}>Your account</h2>
              <p style={{ fontSize: 9, color: 'var(--sb-muted)', margin: '0 0 18px' }}>
                You are the owner of {org.data.name} on SportBridge.
              </p>
              <ContactDetails uid={me.uid} email={me.email} mobile={priv.data?.mobile ?? ''} />
              <NameForm
                firstName={me.user.firstName}
                surname={me.user.surname}
                save={(f, s) => saveOwnerName(me.uid, f, s)}
              />
            </>
          )}
          {tab === 'Organisation' && <OrgProfileForm orgId={orgId} org={org.data} />}
          {tab === 'Privacy' && <OrgPrivacyForm orgId={orgId} value={org.data.privacy} />}
          {tab === 'Team' && (
            <div className="sb-empty">
              Each organisation has one owner for now. Adding team members with their own permissions is
              planned for a later release.
            </div>
          )}
          {tab === 'Membership' && (
            <div className="sb-empty">Membership settings are coming in an upcoming release.</div>
          )}
        </div>
      </div>
    </section>
  );
}
