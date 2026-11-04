import { useState, type FormEvent } from 'react';
import { saveErrorMessage } from '../athlete/fieldErrors';

/** First name / surname form; the caller decides where the name is saved. */
export function NameForm({
  firstName,
  surname,
  save,
}: {
  firstName: string;
  surname: string;
  save: (firstName: string, surname: string) => Promise<void>;
}) {
  const [f, setF] = useState({ firstName, surname });
  const [msg, setMsg] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMsg(null);
    try {
      await save(f.firstName, f.surname);
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
          <label htmlFor="nm-first">Your first name</label>
          <input
            id="nm-first"
            value={f.firstName}
            maxLength={60}
            onChange={(e) => setF({ ...f, firstName: e.target.value })}
          />
        </div>
        <div className="sb-field">
          <label htmlFor="nm-surname">Your surname</label>
          <input
            id="nm-surname"
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
          className="sb-btn"
          disabled={busy || (f.firstName === firstName && f.surname === surname)}
        >
          {busy ? 'Saving…' : 'Update your name'}
        </button>
      </div>
    </form>
  );
}
