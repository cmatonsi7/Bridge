import { useState, type FormEvent } from 'react';
import { useAuth } from '../../../features/auth/AuthProvider';
import { usePrivateDetails } from '../../../features/athlete/athleteService';
import { saveErrorMessage } from '../../../features/athlete/fieldErrors';
import { ContactDetails } from '../../../features/account/ContactDetails';
import { saveGuardianName } from '../../../features/guardian/guardianService';
import { BootScreen } from '../../../app/guards';

function NameForm({ uid, firstName, surname }: { uid: string; firstName: string; surname: string }) {
  const [f, setF] = useState({ firstName, surname });
  const [msg, setMsg] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMsg(null);
    try {
      await saveGuardianName(uid, f.firstName, f.surname);
      setMsg({ kind: 'ok', text: 'Name saved.' });
    } catch (err) {
      setMsg({
        kind: 'err',
        text:
          (err as Error).message === 'INVALID_NAME'
            ? 'Enter your first name and surname.'
            : saveErrorMessage(err),
      });
    } finally {
      setBusy(false);
    }
  }
  return (
    <form onSubmit={submit} noValidate>
      <div className="sb-form-grid">
        <div className="sb-field">
          <label htmlFor="g-first">First name</label>
          <input
            id="g-first"
            value={f.firstName}
            maxLength={60}
            onChange={(e) => setF({ ...f, firstName: e.target.value })}
          />
        </div>
        <div className="sb-field">
          <label htmlFor="g-surname">Surname</label>
          <input
            id="g-surname"
            value={f.surname}
            maxLength={60}
            onChange={(e) => setF({ ...f, surname: e.target.value })}
          />
        </div>
      </div>
      <div className="sb-form-actions">
        {msg && (
          <span className={`sb-form-status ${msg.kind}`} role={msg.kind === 'err' ? 'alert' : 'status'}>
            {msg.text}
          </span>
        )}
        <button
          type="submit"
          className="sb-btn primary"
          disabled={busy || (f.firstName === firstName && f.surname === surname)}
        >
          {busy ? 'Saving…' : 'Save Changes'}
        </button>
      </div>
    </form>
  );
}

/** Parent account settings (used for both My Profile and Settings for guardians). */
export default function GuardianSettingsPage() {
  const { state } = useAuth();
  const uid = state.status === 'signedIn' ? state.user.uid : undefined;
  const priv = usePrivateDetails(uid);
  if (state.status !== 'signedIn' || typeof state.profile !== 'object') return null;
  if (priv.status === 'loading') return <BootScreen label="Loading settings…" />;
  const u = state.profile;
  return (
    <section className="sb-page active" id="sb-page-settings">
      <div className="sb-page-head">
        <div>
          <div className="sb-kicker">ACCOUNT</div>
          <h1>Account Settings</h1>
          <p>Manage your parent account details.</p>
        </div>
      </div>
      <div className="sb-card sb-form-card">
        <ContactDetails
          uid={u.uid}
          email={state.user.email ?? ''}
          mobile={priv.status === 'ready' ? (priv.data?.mobile ?? '') : ''}
        />
        <NameForm uid={u.uid} firstName={u.firstName} surname={u.surname} />
      </div>
    </section>
  );
}
