import { useState } from 'react';
import { saveErrorMessage } from '../athlete/fieldErrors';
import type { Feedback } from '../directory/listingFeedback';

interface Props<T extends Record<string, boolean>> {
  rows: { key: keyof T & string; label: string }[];
  value: T;
  /** Return feedback to show after saving; the choice itself is already saved and is kept. */
  save: (next: T, changedKey: keyof T & string) => Promise<void | Feedback>;
  note?: string;
}

/** Privacy switches that save immediately, reverting if the save fails. */
export function PrivacySwitches<T extends Record<string, boolean>>({ rows, value, save, note }: Props<T>) {
  const [p, setP] = useState<T>(value);
  const [status, setStatus] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  async function toggle(key: keyof T & string) {
    const next = { ...p, [key]: !p[key] } as T;
    setP(next);
    setBusy(true);
    setStatus(null);
    try {
      const feedback = await save(next, key);
      setStatus(feedback ?? { kind: 'ok', text: 'Saved.' });
    } catch (err) {
      setP(p);
      setStatus({ kind: 'err', text: saveErrorMessage(err) });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <h3 style={{ fontSize: 14.5, marginBottom: 5 }}>Privacy &amp; visibility</h3>
      {note && (
        <p className="sb-field-hint" style={{ marginBottom: 8 }}>
          {note}
        </p>
      )}
      {rows.map((r) => (
        <div className="sb-switch-row" key={r.key}>
          <span id={`pv-${r.key}`}>{r.label}</span>
          <button
            type="button"
            role="switch"
            aria-checked={p[r.key]}
            aria-labelledby={`pv-${r.key}`}
            className={`sb-switch${p[r.key] ? ' on' : ''}`}
            disabled={busy}
            onClick={() => void toggle(r.key)}
          />
        </div>
      ))}
      {status && (
        <p
          className={`sb-form-status ${status.kind}`}
          role={status.kind === 'err' ? 'alert' : 'status'}
          style={{ marginTop: 10 }}
        >
          {status.text}
        </p>
      )}
    </div>
  );
}
