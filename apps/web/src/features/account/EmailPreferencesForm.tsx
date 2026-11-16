import { useEffect, useState } from 'react';
import { DEFAULT_EMAIL_PREFERENCES, type EmailPreferences } from '@sportbridge/shared';
import { apiFetch, ApiError } from '../../lib/apiClient';

/**
 * Which emails this person wants.
 *
 * Two switches rather than one per notification, because a longer list invites people to turn
 * everything off. What cannot be switched off is stated plainly instead of being hidden: an account
 * holder should know which emails will reach them regardless.
 */
export function EmailPreferencesForm() {
  const [prefs, setPrefs] = useState<EmailPreferences | null>(null);
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    let live = true;
    apiFetch<{ preferences: EmailPreferences }>('/email-preferences')
      .then((r) => {
        if (!live) return;
        setPrefs(r.preferences);
        setStatus('ready');
      })
      .catch(() => live && setStatus('error'));
    return () => {
      live = false;
    };
  }, []);

  async function save(next: EmailPreferences) {
    const previous = prefs;
    setPrefs(next);
    setSaving(true);
    setError('');
    setNotice('');
    try {
      await apiFetch('/email-preferences', { method: 'PUT', json: next });
      setNotice('Saved.');
    } catch (err) {
      // Put the switch back where it was, so the screen never claims something it did not save.
      setPrefs(previous);
      setError(err instanceof ApiError ? err.message : 'We couldn’t save that. Try again.');
    } finally {
      setSaving(false);
    }
  }

  if (status === 'loading') return <p className="sb-meta">Loading your notification settings…</p>;
  if (status === 'error' || !prefs) {
    return (
      <p className="sb-form-status err" role="alert">
        We couldn’t load your notification settings. Check your connection and refresh.
      </p>
    );
  }

  const row = (key: keyof EmailPreferences, label: string, hint: string) => (
    <div className="sb-doc-row" style={{ alignItems: 'flex-start' }}>
      <div style={{ minWidth: 0 }}>
        <strong style={{ display: 'block' }}>{label}</strong>
        <span className="sb-meta">{hint}</span>
      </div>
      <label style={{ display: 'flex', alignItems: 'center', gap: 8, whiteSpace: 'nowrap' }}>
        <input
          type="checkbox"
          checked={prefs[key]}
          disabled={saving}
          onChange={(e) => void save({ ...prefs, [key]: e.target.checked })}
        />
        <span>Email me</span>
      </label>
    </div>
  );

  return (
    <>
      <h2 style={{ fontSize: 16.5, margin: '0 0 4px' }}>Email notifications</h2>
      <p style={{ fontSize: 11, color: 'var(--sb-muted)', margin: '0 0 18px' }}>
        SportBridge will always show these in the app. This is about what also reaches your inbox.
      </p>

      <div style={{ display: 'grid', gap: 8 }}>
        {row(
          'activity',
          'Activity on your account',
          'Applications, connections and sponsorship updates.',
        )}
        {row('messages', 'Messages', 'When somebody sends you a message. At most one email per conversation every half hour.')}
      </div>

      <p className="sb-field-hint" style={{ marginTop: 14 }}>
        Some emails are sent whatever you choose here, because they concern the safety or the standing of
        your account: a coach asking to connect with your child, a decision about your organisation or
        your coaching credentials, and anything a parent needs to act on.
      </p>

      {notice && (
        <p className="sb-form-status" role="status">
          {notice}
        </p>
      )}
      {error && (
        <p className="sb-form-status err" role="alert">
          {error}
        </p>
      )}
    </>
  );
}

export const defaultEmailPreferences = DEFAULT_EMAIL_PREFERENCES;
