import { refreshDirectoryQuietly } from '../directory/useDirectoryReconcile';
import { useState, type FormEvent } from 'react';
import {
  AGE_GROUPS,
  ORGANISATION_TYPES,
  ORGANISATION_TYPE_LABELS,
  ORG_FACILITIES,
  ORG_OFFERINGS,
  PROVINCES,
  SPORTS,
  type AgeGroup,
  type OrgFacility,
  type OrgOffering,
  type OrganisationFullDoc,
  type OrganisationType,
  type Province,
  type Sport,
} from '@sportbridge/shared';
import { ChipPicker } from '../athlete/ChipPicker';
import { saveErrorMessage, zodErrors, type Errors } from '../athlete/fieldErrors';
import { saveOrganisation } from './orgService';

interface Props {
  orgId: string;
  org: OrganisationFullDoc;
  onSaved?: () => void;
  onCancel?: () => void;
}

/** Organisation profile form (owner only). */
export function OrgProfileForm({ orgId, org, onSaved, onCancel }: Props) {
  const [f, setF] = useState({
    name: org.name,
    type: org.type as OrganisationType,
    description: org.description ?? '',
    contactEmail: org.contactEmail ?? '',
    contactPhone: org.contactPhone ?? '',
    website: org.website ?? '',
    city: org.city ?? '',
    province: (org.province ?? '') as Province | '',
    sports: (org.sports ?? []) as Sport[],
    ageGroups: (org.ageGroups ?? []) as AgeGroup[],
    offerings: (org.offerings ?? []) as OrgOffering[],
    facilities: (org.facilities ?? []) as OrgFacility[],
  });
  const [errors, setErrors] = useState<Errors>({});
  const [status, setStatus] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const set = <K extends keyof typeof f>(k: K, v: (typeof f)[K]) => {
    setF((prev) => ({ ...prev, [k]: v }));
    setStatus(null);
  };

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setStatus(null);
    try {
      await saveOrganisation(orgId, { ...f, province: f.province || null });
      refreshDirectoryQuietly();
      setErrors({});
      setStatus({ kind: 'ok', text: 'Organisation saved.' });
      onSaved?.();
    } catch (err) {
      const ze = zodErrors(err);
      if (ze) setErrors(ze);
      setStatus({ kind: 'err', text: ze ? 'Check the highlighted fields.' : saveErrorMessage(err) });
    } finally {
      setBusy(false);
    }
  }

  const text = (
    key: 'name' | 'contactEmail' | 'contactPhone' | 'website' | 'city',
    label: string,
    max: number,
    extra: Record<string, unknown> = {},
  ) => (
    <div className="sb-field">
      <label htmlFor={`op-${key}`}>{label}</label>
      <input
        id={`op-${key}`}
        value={f[key]}
        maxLength={max}
        aria-invalid={errors[key] ? true : undefined}
        onChange={(e) => set(key, e.target.value)}
        {...extra}
      />
      {errors[key] && <span className="field-error">{errors[key]}</span>}
    </div>
  );

  return (
    <form onSubmit={submit} noValidate>
      <div className="sb-form-grid">
        {text('name', 'Organisation name', 120)}
        <div className="sb-field">
          <label htmlFor="op-type">Organisation type</label>
          <select
            id="op-type"
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
        {text('contactEmail', 'Contact email', 120, { type: 'email', placeholder: 'info@yourclub.co.za' })}
        {text('contactPhone', 'Contact phone', 20, { type: 'tel' })}
        {text('website', 'Website', 200, { type: 'url', placeholder: 'https://' })}
        {text('city', 'City / town', 60)}
        <div className="sb-field">
          <label htmlFor="op-province">Province</label>
          <select
            id="op-province"
            value={f.province}
            onChange={(e) => set('province', e.target.value as Province | '')}
          >
            <option value="">Select province</option>
            {PROVINCES.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </select>
        </div>
        <div className="sb-field full">
          <label htmlFor="op-description">About the organisation</label>
          <textarea
            id="op-description"
            value={f.description}
            maxLength={1000}
            placeholder="What your organisation does, who it serves and what makes it different."
            aria-invalid={errors.description ? true : undefined}
            onChange={(e) => set('description', e.target.value)}
          />
          <span className="sb-field-hint">{f.description.length}/1000</span>
          {errors.description && <span className="field-error">{errors.description}</span>}
        </div>
        <ChipPicker
          id="op-sports"
          label="Sports offered"
          options={SPORTS}
          value={f.sports}
          onChange={(v) => set('sports', v)}
          max={10}
          error={errors.sports}
        />
        <ChipPicker
          id="op-offerings"
          label="What you offer"
          options={ORG_OFFERINGS}
          value={f.offerings}
          onChange={(v) => set('offerings', v)}
          error={errors.offerings}
        />
        <ChipPicker
          id="op-ages"
          label="Age groups"
          options={AGE_GROUPS}
          value={f.ageGroups}
          onChange={(v) => set('ageGroups', v)}
          error={errors.ageGroups}
        />
        <ChipPicker
          id="op-facilities"
          label="Facilities"
          options={ORG_FACILITIES}
          value={f.facilities}
          onChange={(v) => set('facilities', v)}
          error={errors.facilities}
        />
      </div>
      <div className="sb-form-actions">
        {status && (
          <span className={`sb-form-status ${status.kind}`} role={status.kind === 'err' ? 'alert' : 'status'}>
            {status.text}
          </span>
        )}
        {onCancel && (
          <button type="button" className="sb-btn" onClick={onCancel} disabled={busy}>
            Cancel
          </button>
        )}
        <button type="submit" className="sb-btn primary" disabled={busy}>
          {busy ? 'Saving…' : 'Save Changes'}
        </button>
      </div>
    </form>
  );
}
