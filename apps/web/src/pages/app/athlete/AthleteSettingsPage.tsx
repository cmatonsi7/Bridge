import { useState, type FormEvent } from 'react';
import { useAthleteContext } from '../../../features/athlete/useAthleteContext';
import { saveMobile, useAthleteProfile, usePrivateDetails } from '../../../features/athlete/athleteService';
import { AthleteProfileForm } from '../../../features/athlete/AthleteProfileForm';
import { PrivacyForm } from '../../../features/athlete/PrivacyForm';
import { saveErrorMessage } from '../../../features/athlete/fieldErrors';
import { BootScreen } from '../../../app/guards';

const TABS = ['Account', 'Privacy', 'Notifications', 'Membership', 'Connected Accounts'] as const;
type Tab = (typeof TABS)[number];

function ContactDetails({ uid, email, mobile }: { uid: string; email: string; mobile: string }) {
  const [value, setValue] = useState(mobile);
  const [msg, setMsg] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMsg(null);
    try {
      await saveMobile(uid, value);
      setMsg({ kind: 'ok', text: 'Phone number saved.' });
    } catch (err) {
      setMsg({
        kind: 'err',
        text:
          (err as Error).message === 'INVALID_MOBILE'
            ? 'Enter a valid mobile number.'
            : saveErrorMessage(err),
      });
    } finally {
      setBusy(false);
    }
  }
  return (
    <form onSubmit={submit} noValidate style={{ marginBottom: 22 }}>
      <div className="sb-form-grid">
        <div className="sb-field">
          <label htmlFor="st-email">Email address</label>
          <input id="st-email" value={email} readOnly />
          <span className="sb-field-hint">Your sign-in email. Contact support to change it.</span>
        </div>
        <div className="sb-field">
          <label htmlFor="st-mobile">Phone number</label>
          <input
            id="st-mobile"
            type="tel"
            value={value}
            aria-invalid={msg?.kind === 'err' ? true : undefined}
            onChange={(e) => {
              setValue(e.target.value);
              setMsg(null);
            }}
          />
        </div>
      </div>
      <div className="sb-form-actions">
        {msg && (
          <span className={`sb-form-status ${msg.kind}`} role={msg.kind === 'err' ? 'alert' : 'status'}>
            {msg.text}
          </span>
        )}
        <button type="submit" className="sb-btn" disabled={busy || value === mobile}>
          {busy ? 'Saving…' : 'Update phone number'}
        </button>
      </div>
    </form>
  );
}

export default function AthleteSettingsPage() {
  const ctx = useAthleteContext();
  const profile = useAthleteProfile(ctx?.uid);
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
              <h2 style={{ fontSize: 15, margin: '0 0 4px' }}>Account Settings</h2>
              <p style={{ fontSize: 9, color: 'var(--sb-muted)', margin: '0 0 18px' }}>
                Update your personal information.
              </p>
              <ContactDetails uid={ctx.uid} email={ctx.email} mobile={priv.data?.mobile ?? ''} />
              <AthleteProfileForm
                uid={ctx.uid}
                firstName={ctx.user.firstName}
                surname={ctx.user.surname}
                profile={profile.data}
              />
            </>
          )}
          {tab === 'Privacy' && (
            <PrivacyForm uid={ctx.uid} value={profile.data?.privacy} isMinor={ctx.user.isMinor} />
          )}
          {tab !== 'Account' && tab !== 'Privacy' && (
            <div className="sb-empty">{tab} settings are coming in an upcoming release.</div>
          )}
        </div>
      </div>
    </section>
  );
}
