import { useState } from 'react';
import { useSignedInUser } from '../../../features/account/useSignedInUser';
import { usePrivateDetails } from '../../../features/athlete/athleteService';
import { useCoachProfile } from '../../../features/coach/coachService';
import { CoachProfileForm } from '../../../features/coach/CoachProfileForm';
import { CoachPrivacyForm } from '../../../features/coach/CoachPrivacyForm';
import { ContactDetails } from '../../../features/account/ContactDetails';
import { BootScreen } from '../../../app/guards';

const TABS = ['Account', 'Privacy', 'Notifications', 'Membership'] as const;
type Tab = (typeof TABS)[number];

export default function CoachSettingsPage() {
  const ctx = useSignedInUser();
  const profile = useCoachProfile(ctx?.uid);
  const priv = usePrivateDetails(ctx?.uid);
  const [tab, setTab] = useState<Tab>('Account');
  if (!ctx) return null;
  if (profile.status === 'loading' || priv.status === 'loading')
    return <BootScreen label="Loading settings…" />;
  if (profile.status === 'error' || priv.status === 'error') {
    return (
      <div className="sb-card sb-empty" role="alert">
        We couldn’t load your settings. Check your connection and refresh.
      </div>
    );
  }
  return (
    <section className="sb-page active" id="sb-page-settings">
      <div className="sb-page-head">
        <div>
          <div className="sb-kicker">ACCOUNT</div>
          <h1>Settings</h1>
          <p>Manage your account, privacy, notifications and membership preferences.</p>
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
              <h2 style={{ fontSize: 15, margin: '0 0 18px' }}>Account Settings</h2>
              <ContactDetails uid={ctx.uid} email={ctx.email} mobile={priv.data?.mobile ?? ''} />
              <CoachProfileForm
                uid={ctx.uid}
                firstName={ctx.user.firstName}
                surname={ctx.user.surname}
                profile={profile.data}
              />
            </>
          )}
          {tab === 'Privacy' && <CoachPrivacyForm uid={ctx.uid} value={profile.data?.privacy} />}
          {(tab === 'Notifications' || tab === 'Membership') && (
            <div className="sb-empty">{tab} settings are coming in an upcoming release.</div>
          )}
        </div>
      </div>
    </section>
  );
}
