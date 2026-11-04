import { useState, type FormEvent } from 'react';
import {
  addAchievement,
  deleteAchievement,
  updateAchievement,
  type AchievementWithId,
} from './athleteService';
import { saveErrorMessage, zodErrors, type Errors } from './fieldErrors';

interface Draft {
  title: string;
  year: string;
  organisation: string;
  detail: string;
}
const blank = (): Draft => ({
  title: '',
  year: String(new Date().getFullYear()),
  organisation: '',
  detail: '',
});

function AchievementForm({
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
    <div className={`sb-field${k === 'detail' ? ' full' : ''}`}>
      <label htmlFor={`ach-${k}`}>{label}</label>
      <input
        id={`ach-${k}`}
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
        {field('title', 'Achievement', { maxLength: 100, placeholder: 'e.g. District Football Champions' })}
        {field('year', 'Year', {
          type: 'number',
          inputMode: 'numeric',
          min: 1950,
          max: new Date().getFullYear(),
        })}
        {field('organisation', 'Club, school or event', { maxLength: 80 })}
        {field('detail', 'Details (optional)', { maxLength: 200, placeholder: 'e.g. Midfielder, captain' })}
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
          {busy ? 'Saving…' : 'Save Achievement'}
        </button>
      </div>
    </form>
  );
}

const toInput = (d: Draft) => ({
  title: d.title,
  year: d.year.trim() === '' ? Number.NaN : Number(d.year),
  organisation: d.organisation,
  detail: d.detail,
});

/** Achievements list with add / edit / delete, in the prototype's card grid. */
export function AchievementsManager({
  uid,
  items,
  adding,
  setAdding,
}: {
  uid: string;
  items: AchievementWithId[];
  adding: boolean;
  setAdding: (v: boolean) => void;
}) {
  const [editing, setEditing] = useState<string | null>(null);
  const [error, setError] = useState('');

  async function remove(a: AchievementWithId) {
    if (!window.confirm(`Delete “${a.title}”?`)) return;
    setError('');
    try {
      await deleteAchievement(uid, a.id);
    } catch (err) {
      setError(saveErrorMessage(err));
    }
  }

  return (
    <>
      {adding && (
        <AchievementForm
          initial={blank()}
          onCancel={() => setAdding(false)}
          onSubmit={async (d) => {
            await addAchievement(uid, toInput(d));
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
        <div className="sb-card sb-empty">
          No achievements yet. Add trophies, selections, awards or milestones so coaches and clubs can see
          your progress.
        </div>
      ) : (
        <div className="sb-grid-3">
          {items.map((a) =>
            editing === a.id ? (
              <div key={a.id} style={{ gridColumn: '1 / -1' }}>
                <AchievementForm
                  initial={{
                    title: a.title,
                    year: String(a.year),
                    organisation: a.organisation ?? '',
                    detail: a.detail ?? '',
                  }}
                  onCancel={() => setEditing(null)}
                  onSubmit={async (d) => {
                    await updateAchievement(uid, a.id, a.createdAt, toInput(d));
                    setEditing(null);
                  }}
                />
              </div>
            ) : (
              <div className="sb-card" style={{ padding: 16 }} key={a.id}>
                <span className="sb-tag">{a.year}</span>
                <h3 style={{ fontSize: 14.5, margin: '10px 0 4px' }}>{a.title}</h3>
                <p className="sb-meta">
                  {[a.organisation, a.detail].filter(Boolean).join(' · ') || '\u00a0'}
                </p>
                <div className="sb-achievement-actions">
                  <button type="button" className="sb-btn" onClick={() => setEditing(a.id)}>
                    Edit
                  </button>
                  <button type="button" className="sb-btn" onClick={() => void remove(a)}>
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
