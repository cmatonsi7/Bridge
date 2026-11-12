import { useState } from 'react';
import { DEFAULT_ATHLETE_PRIVACY, type AthletePrivacy } from '@sportbridge/shared';
import { savePrivacy } from './athleteService';
import { syncDirectory } from '../directory/directoryService';
import { SYNC_FAILED, listingFeedback } from '../directory/listingFeedback';
import { saveErrorMessage } from './fieldErrors';

const ROWS: { key: keyof AthletePrivacy; label: string }[] = [
  { key: 'discoverable', label: 'List me in the Talent Directory' },
  { key: 'showAchievements', label: 'Show achievements publicly' },
  { key: 'allowEnquiries', label: 'Allow programme enquiries' },
];

/** Athlete privacy switches. For under-18s the directory switch is unavailable, not silently ignored. */
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
      if (key === 'discoverable') {
        // The directory entry is rebuilt on the server; tell the person what happened.
        try {
          setStatus(listingFeedback(await syncDirectory(), next.discoverable));
        } catch {
          setStatus(SYNC_FAILED);
        }
      } else {
        setStatus({ kind: 'ok', text: 'Saved.' });
      }
    } catch (err) {
      setP(p);
      setStatus({ kind: 'err', text: saveErrorMessage(err) });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <h3 style={{ fontSize: 14, marginBottom: 6 }}>Privacy &amp; visibility</h3>
      {isMinor && (
        <p className="sb-field-hint" style={{ marginBottom: 8 }}>
          Because you are under 18, SportBridge never lists you in the Talent Directory and never shows your
          contact details. Coaches can still ask to connect, and your parent or guardian decides.
        </p>
      )}
      {ROWS.map((r) => {
        const locked = isMinor && r.key === 'discoverable';
        return (
          <div className="sb-switch-row" key={r.key}>
            <span id={`pv-${r.key}`}>
              {r.label}
              {locked && (
                <em style={{ display: 'block', color: '#6b7a71', fontStyle: 'normal', fontSize: 12 }}>
                  Not available for under-18 accounts
                </em>
              )}
            </span>
            <button
              type="button"
              role="switch"
              aria-checked={locked ? false : p[r.key]}
              aria-labelledby={`pv-${r.key}`}
              aria-disabled={locked || undefined}
              className={`sb-switch${!locked && p[r.key] ? ' on' : ''}`}
              disabled={busy || locked}
              onClick={() => void toggle(r.key)}
            />
          </div>
        );
      })}
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
