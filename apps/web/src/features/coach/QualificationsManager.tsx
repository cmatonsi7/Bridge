import { useState, type FormEvent } from 'react';
import { saveErrorMessage, zodErrors, type Errors } from '../athlete/fieldErrors';
import {
  addQualification,
  deleteQualification,
  updateQualification,
  type QualificationWithId,
} from './coachService';

interface Draft {
  title: string;
  issuer: string;
  year: string;
}
const blank = (): Draft => ({ title: '', issuer: '', year: '' });
const toInput = (d: Draft) => ({
  title: d.title,
  issuer: d.issuer,
  year: d.year.trim() === '' ? null : Number(d.year),
});

function QualificationForm({
  initial,
  onSubmit,
  onCancel,
}: {
  initial: Draft;
  onSubmit: (d: Draft) => Promise<void>;
  onCancel: () => void;
}) {
  const [d, setD] = useState(initial);
  const [errors, setErrors] = useState<Errors>({});
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMsg('');
    try {
      await onSubmit(d);
    } catch (err) {
      const ze = zodErrors(err);
      if (ze) setErrors(ze);
      setMsg(ze ? 'Check the highlighted fields.' : saveErrorMessage(err));
      setBusy(false);
    }
  }

  const field = (k: keyof Draft, label: string, extra: Record<string, unknown> = {}) => (
    <div className="sb-field">
      <label htmlFor={`q-${k}`}>{label}</label>
      <input
        id={`q-${k}`}
        value={d[k]}
        aria-invalid={errors[k] ? true : undefined}
        onChange={(e) => setD({ ...d, [k]: e.target.value })}
        {...extra}
      />
      {errors[k] && <span className="field-error">{errors[k]}</span>}
    </div>
  );

  return (
    <form className="sb-card sb-form-card" onSubmit={submit} noValidate style={{ marginBottom: 15 }}>
      <div className="sb-form-grid">
        {field('title', 'Qualification', { maxLength: 100, placeholder: 'e.g. SAFA C Licence' })}
        {field('issuer', 'Issued by (optional)', { maxLength: 80, placeholder: 'e.g. SAFA' })}
        {field('year', 'Year (optional)', {
          type: 'number',
          inputMode: 'numeric',
          min: 1950,
          max: new Date().getFullYear(),
        })}
      </div>
      <div className="sb-form-actions">
        {msg && (
          <span className="sb-form-status err" role="alert">
            {msg}
          </span>
        )}
        <button type="button" className="sb-btn" onClick={onCancel} disabled={busy}>
          Cancel
        </button>
        <button type="submit" className="sb-btn primary" disabled={busy}>
          {busy ? 'Saving…' : 'Save Qualification'}
        </button>
      </div>
    </form>
  );
}

/** Self-declared qualifications with add / edit / delete. */
export function QualificationsManager({ uid, items }: { uid: string; items: QualificationWithId[] }) {
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState<string | null>(null);
  const [error, setError] = useState('');

  async function remove(q: QualificationWithId) {
    if (!window.confirm(`Delete “${q.title}”?`)) return;
    setError('');
    try {
      await deleteQualification(uid, q.id);
    } catch (err) {
      setError(saveErrorMessage(err));
    }
  }

  return (
    <>
      <p className="sb-field-hint" style={{ marginBottom: 12 }}>
        Qualifications are self-declared and shown as such. SportBridge will add credential checks in a later
        release.
      </p>
      {!adding && (
        <button
          type="button"
          className="sb-btn primary"
          style={{ marginBottom: 15 }}
          onClick={() => setAdding(true)}
        >
          ＋ Add Qualification
        </button>
      )}
      {adding && (
        <QualificationForm
          initial={blank()}
          onCancel={() => setAdding(false)}
          onSubmit={async (d) => {
            await addQualification(uid, toInput(d));
            setAdding(false);
          }}
        />
      )}
      {error && (
        <p className="sb-form-status err" role="alert">
          {error}
        </p>
      )}
      {items.length === 0 && !adding ? (
        <div className="sb-empty">
          No qualifications added yet. Add coaching licences, certificates or courses you have completed.
        </div>
      ) : (
        <div className="sb-grid-3">
          {items.map((q) =>
            editing === q.id ? (
              <div key={q.id} style={{ gridColumn: '1 / -1' }}>
                <QualificationForm
                  initial={{
                    title: q.title,
                    issuer: q.issuer ?? '',
                    year: q.year == null ? '' : String(q.year),
                  }}
                  onCancel={() => setEditing(null)}
                  onSubmit={async (d) => {
                    await updateQualification(uid, q.id, q.createdAt, toInput(d));
                    setEditing(null);
                  }}
                />
              </div>
            ) : (
              <div className="sb-card" style={{ padding: 16 }} key={q.id}>
                <span className="v-badge pending">Self-declared</span>
                <h3 style={{ fontSize: 12, margin: '10px 0 4px' }}>{q.title}</h3>
                <p className="sb-meta">{[q.issuer, q.year].filter(Boolean).join(' · ') || '\u00a0'}</p>
                <div className="sb-achievement-actions">
                  <button type="button" className="sb-btn" onClick={() => setEditing(q.id)}>
                    Edit
                  </button>
                  <button type="button" className="sb-btn" onClick={() => void remove(q)}>
                    Delete
                  </button>
                </div>
              </div>
            ),
          )}
        </div>
      )}
    </>
  );
}
