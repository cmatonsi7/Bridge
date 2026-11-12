import { useState, type FormEvent } from 'react';
import {
  ORGANISATION_TYPES,
  ORGANISATION_TYPE_LABELS,
  PROVINCES,
  SPORTS,
  unclaimedOrganisationSchema,
  type OrganisationType,
  type Province,
  type Sport,
} from '@sportbridge/shared';
import { ChipPicker } from '../../../features/athlete/ChipPicker';
import { zodErrors, type Errors } from '../../../features/athlete/fieldErrors';
import { ApiError } from '../../../lib/apiClient';
import {
  addOrganisation,
  newClaimCode,
  removeOrganisation,
  useImportedOrganisations,
  type ImportedOrganisation,
} from '../../../features/onboarding/onboardingService';
import { BootScreen } from '../../../app/guards';

interface Reveal {
  name: string;
  code: string;
  expiresAt: string;
}

const blank = () => ({
  name: '',
  type: 'school' as OrganisationType,
  description: '',
  contactEmail: '',
  contactPhone: '',
  website: '',
  city: '',
  province: '' as Province | '',
  sports: [] as Sport[],
  schoolNumber: '',
  sourceNote: '',
});

/** Staff: add schools and organisations on their behalf and hand out claim codes. */
/** Admin dashboard section: add schools and organisations on their behalf and hand out claim codes. */
export default function AdminSchoolsSection() {
  const list = useImportedOrganisations();
  const [f, setF] = useState(blank());
  const [errors, setErrors] = useState<Errors>({});
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [reveal, setReveal] = useState<Reveal | null>(null);
  const [copied, setCopied] = useState(false);
  async function copy(code: string) {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
    } catch {
      setCopied(false); // clipboard blocked: the code is on screen to copy by hand
    }
  }
  const set = <K extends keyof ReturnType<typeof blank>>(k: K, v: ReturnType<typeof blank>[K]) =>
    setF((p) => ({ ...p, [k]: v }));

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMessage('');
    try {
      const input = {
        ...f,
        province: (f.province || undefined) as Province,
        ageGroups: [],
        offerings: [],
        facilities: [],
      };
      unclaimedOrganisationSchema.parse(input); // show problems here before anything is sent
      const r = await addOrganisation(input);
      setReveal({ name: f.name, code: r.claimCode, expiresAt: r.expiresAt });
      setF(blank());
      setErrors({});
    } catch (err) {
      const ze = zodErrors(err);
      if (ze) setErrors(ze);
      setMessage(
        ze
          ? 'Check the highlighted fields.'
          : err instanceof ApiError
            ? err.message
            : 'Something went wrong. Try again.',
      );
    } finally {
      setBusy(false);
    }
  }

  async function recode(o: ImportedOrganisation) {
    if (!window.confirm(`Create a new claim code for ${o.name}? The old code will stop working.`)) return;
    try {
      const r = await newClaimCode(o.id);
      setReveal({ name: o.name, code: r.claimCode, expiresAt: r.expiresAt });
    } catch (err) {
      setMessage(err instanceof ApiError ? err.message : 'Something went wrong. Try again.');
    }
  }
  async function remove(o: ImportedOrganisation) {
    if (!window.confirm(`Remove ${o.name}? It will disappear from the directory. This can’t be undone.`))
      return;
    try {
      await removeOrganisation(o.id);
    } catch (err) {
      setMessage(err instanceof ApiError ? err.message : 'Something went wrong. Try again.');
    }
  }

  const text = (
    key: 'name' | 'city' | 'contactEmail' | 'contactPhone' | 'website' | 'schoolNumber' | 'sourceNote',
    label: string,
    extra: Record<string, unknown> = {},
  ) => (
    <div className={`sb-field${key === 'sourceNote' ? ' full' : ''}`}>
      <label htmlFor={`ad-${key}`}>{label}</label>
      <input
        id={`ad-${key}`}
        value={f[key]}
        aria-invalid={errors[key] ? true : undefined}
        onChange={(e) => set(key, e.target.value)}
        {...extra}
      />
      {errors[key] && <span className="field-error">{errors[key]}</span>}
    </div>
  );

  return (
    <>
      {reveal && (
        <div className="sb-member-notice" role="status" style={{ marginBottom: 15 }}>
          <div>
            <strong>Claim code for {reveal.name}</strong>
            <span style={{ display: 'block', fontSize: 22, letterSpacing: 2, margin: '6px 0' }}>
              <code data-testid="claim-code">{reveal.code}</code>
            </span>
            <span>
              Give this code to the school. <b>It is shown only now</b> and can’t be looked up later; you can
              create a new one at any time. It expires on{' '}
              {new Date(reveal.expiresAt).toLocaleDateString('en-ZA')}.
            </span>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 10 }}>
              <button type="button" className="sb-btn" onClick={() => void copy(reveal.code)}>
                {copied ? 'Copied ✓' : 'Copy code'}
              </button>
              <button
                type="button"
                className="sb-btn"
                onClick={() => {
                  setReveal(null);
                  setCopied(false);
                }}
              >
                I’ve copied it
              </button>
            </div>
          </div>
        </div>
      )}

      <form className="sb-card sb-form-card" onSubmit={submit} noValidate style={{ marginBottom: 20 }}>
        <div className="sb-form-grid">
          {text('name', 'Name')}
          <div className="sb-field">
            <label htmlFor="ad-type">Type</label>
            <select
              id="ad-type"
              value={f.type}
              onChange={(e) => set('type', e.target.value as OrganisationType)}
            >
              {ORGANISATION_TYPES.map((t) => (
                <option key={t} value={t}>
                  {ORGANISATION_TYPE_LABELS[t]}
                </option>
              ))}
            </select>
          </div>
          {text('city', 'City / town')}
          <div className="sb-field">
            <label htmlFor="ad-province">Province</label>
            <select
              id="ad-province"
              value={f.province}
              aria-invalid={errors.province ? true : undefined}
              onChange={(e) => set('province', e.target.value as Province | '')}
            >
              <option value="">Select province</option>
              {PROVINCES.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>
            {errors.province && <span className="field-error">Select a province</span>}
          </div>
          {text('schoolNumber', 'School number (optional)')}
          {text('contactEmail', 'Official email (optional)', { type: 'email' })}
          {text('contactPhone', 'Phone (optional)', { type: 'tel' })}
          {text('website', 'Website (optional)', { type: 'url', placeholder: 'https://' })}
          <div className="sb-field full">
            <label htmlFor="ad-description">Description (optional)</label>
            <textarea
              id="ad-description"
              value={f.description}
              maxLength={1000}
              onChange={(e) => set('description', e.target.value)}
            />
          </div>
          <ChipPicker
            id="ad-sports"
            label="Sports offered"
            options={SPORTS}
            value={f.sports}
            onChange={(v) => set('sports', v)}
            max={10}
            error={errors.sports}
          />
          {text('sourceNote', 'Where did this information come from?', {
            placeholder: 'e.g. Gauteng Department of Education school list, 2026',
          })}
        </div>
        <div className="sb-form-actions">
          {message && (
            <span className="sb-form-status err" role="alert">
              {message}
            </span>
          )}
          <button type="submit" className="sb-btn primary" disabled={busy}>
            {busy ? 'Adding…' : 'Add and create claim code'}
          </button>
        </div>
      </form>

      <div className="sb-section-title">
        <h2>Added by SportBridge</h2>
      </div>
      {list.status === 'loading' ? (
        <BootScreen label="Loading…" />
      ) : list.status === 'error' ? (
        <div className="sb-card sb-empty" role="alert">
          {list.message}
        </div>
      ) : list.data.length === 0 ? (
        <div className="sb-card sb-empty">Nothing added yet.</div>
      ) : (
        <div className="sb-card" style={{ padding: 0, overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                <th style={{ textAlign: 'left', padding: 12 }}>Organisation</th>
                <th style={{ textAlign: 'left', padding: 12 }}>Status</th>
                <th style={{ textAlign: 'right', padding: 12 }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {list.data.map((o) => {
                const unclaimed = o.claimStatus === 'unclaimed';
                return (
                  <tr key={o.id} style={{ borderTop: '1px solid #edf0ee' }}>
                    <td style={{ padding: 12 }}>
                      <b>{o.name}</b>
                      <div className="sb-meta">
                        {ORGANISATION_TYPE_LABELS[o.type]} · {[o.city, o.province].filter(Boolean).join(', ')}
                        {o.schoolNumber ? ` · No. ${o.schoolNumber}` : ''}
                      </div>
                    </td>
                    <td style={{ padding: 12 }}>
                      <span className={`v-badge ${unclaimed ? 'pending' : 'ok'}`}>
                        {unclaimed ? 'Unclaimed' : 'Claimed'}
                      </span>
                    </td>
                    <td style={{ padding: 12, textAlign: 'right', whiteSpace: 'nowrap' }}>
                      {unclaimed ? (
                        <>
                          <button type="button" className="sb-btn" onClick={() => void recode(o)}>
                            New claim code
                          </button>{' '}
                          <button type="button" className="sb-btn" onClick={() => void remove(o)}>
                            Remove
                          </button>
                        </>
                      ) : (
                        <span className="sb-meta">Managed by its owner</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
