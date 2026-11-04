import { useState, type FormEvent } from 'react';
import { saveMobile } from '../athlete/athleteService';
import { saveErrorMessage } from '../athlete/fieldErrors';

/** Read-only sign-in email and editable phone number (users/{uid}/private/details). */
export function ContactDetails({ uid, email, mobile }: { uid: string; email: string; mobile: string }) {
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
