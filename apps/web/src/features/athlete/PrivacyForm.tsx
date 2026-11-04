import { useState } from 'react';
import { DEFAULT_ATHLETE_PRIVACY, type AthletePrivacy } from '@sportbridge/shared';
import { savePrivacy } from './athleteService';
import { saveErrorMessage } from './fieldErrors';

const ROWS: { key: keyof AthletePrivacy; label: string }[] = [
  { key: 'discoverable', label: 'Make my profile discoverable to coaches and clubs' },
  { key: 'showAchievements', label: 'Show achievements publicly' },
  { key: 'allowEnquiries', label: 'Allow programme enquiries' },
];

/** Privacy toggles from the prototype's Settings page, saved for real. */
export function PrivacyForm({
  uid,
  value,
  isMinor,
}: {
  uid: string;
  value?: AthletePrivacy;
  isMinor: boolean;
}) {
  const [p, setP] = useState<AthletePrivacy>(value ?? DEFAULT_ATHLETE_PRIVACY);
  const [status, setStatus] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  async function toggle(key: keyof AthletePrivacy) {
    const next = { ...p, [key]: !p[key] };
    setP(next);
    setBusy(true);
    setStatus(null);
    try {
      await savePrivacy(uid, next);
      setStatus({ kind: 'ok', text: 'Saved.' });
    } catch (err) {
      setP(p);
      setStatus({ kind: 'err', text: saveErrorMessage(err) });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <h3 style={{ fontSize: 12, marginBottom: 5 }}>Privacy &amp; visibility</h3>
      {isMinor && (
        <p className="sb-field-hint" style={{ marginBottom: 8 }}>
          Your profile stays private until a parent or guardian confirms your account. These preferences will
          apply once they do.
        </p>
      )}
      {ROWS.map((r) => (
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
