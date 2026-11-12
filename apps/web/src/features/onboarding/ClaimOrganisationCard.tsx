import { useState } from 'react';
import { ApiError } from '../../lib/apiClient';
import { useToast } from '../../components/Toast';
import { claimOrganisation } from './onboardingService';

/**
 * For a school or club representative who signed up themselves: if SportBridge already added their
 * organisation, they enter the claim code they were given and take over that record.
 */
export function ClaimOrganisationCard() {
  const toast = useToast();
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function submit() {
    setBusy(true);
    setError('');
    try {
      const r = await claimOrganisation(code);
      toast(`You now manage ${r.name}`);
      setCode('');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Something went wrong. Try again.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="sb-card" style={{ padding: 18, marginTop: 15 }}>
      <h3 style={{ marginTop: 0 }}>Is your school or club already on SportBridge?</h3>
      <p className="sb-meta" style={{ lineHeight: 1.6 }}>
        SportBridge may have added your organisation already. If we gave you a claim code, enter it to take
        over that profile. This replaces the empty profile you have now.
      </p>
      <div className="sb-field" style={{ maxWidth: 320 }}>
        <label htmlFor="claim-code">Claim code</label>
        <input
          id="claim-code"
          value={code}
          maxLength={20}
          autoComplete="off"
          placeholder="SB-XXXX-XXXX"
          aria-invalid={error ? true : undefined}
          onChange={(e) => {
            setCode(e.target.value);
            setError('');
          }}
        />
      </div>
      {error && (
        <p className="sb-form-status err" role="alert">
          {error}
        </p>
      )}
      <button
        type="button"
        className="sb-btn primary"
        disabled={busy || code.trim() === ''}
        onClick={() => void submit()}
      >
        {busy ? 'Checking…' : 'Claim my organisation'}
      </button>
    </div>
  );
}
