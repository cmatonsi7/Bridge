import { refreshDirectoryQuietly } from '../directory/useDirectoryReconcile';
import { useState, type FormEvent } from 'react';
import {
  AGE_GROUPS,
  COACHING_LEVELS,
  COACH_SERVICES,
  COACH_SPECIALISATIONS,
  PROVINCES,
  SPORTS,
  type AgeGroup,
  type CoachProfileDoc,
  type CoachService,
  type CoachSpecialisation,
  type CoachingLevel,
  type Province,
  type Sport,
} from '@sportbridge/shared';
import { ChipPicker } from '../athlete/ChipPicker';
import { saveErrorMessage, zodErrors, type Errors } from '../athlete/fieldErrors';
import { saveCoachName, saveCoachProfile } from './coachService';

interface Props {
  uid: string;
  firstName: string;
  surname: string;
  profile: CoachProfileDoc | null;
  onSaved?: () => void;
  onCancel?: () => void;
}

/** Coach profile form. Used on My Profile (edit mode) and Settings → Account. */
export function CoachProfileForm({ uid, firstName, surname, profile, onSaved, onCancel }: Props) {
  const p = profile ?? ({} as Partial<CoachProfileDoc>);
  const [f, setF] = useState({
    firstName,
    surname,
    sports: (p.sports ?? []) as Sport[],
    coachingLevel: (p.coachingLevel ?? '') as CoachingLevel | '',
    experienceYears: p.experienceYears == null ? '' : String(p.experienceYears),
    organisation: p.organisation ?? '',
    city: p.city ?? '',
    province: (p.province ?? '') as Province | '',
    bio: p.bio ?? '',
    specialisations: (p.specialisations ?? []) as CoachSpecialisation[],
    services: (p.services ?? []) as CoachService[],
    ageGroups: (p.ageGroups ?? []) as AgeGroup[],
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
      const nameErrors: Errors = {};
      if (!f.firstName.trim()) nameErrors.firstName = 'Required';
      if (!f.surname.trim()) nameErrors.surname = 'Required';
      if (Object.keys(nameErrors).length) {
        setErrors(nameErrors);
        throw new Error('NAME');
      }
      await saveCoachProfile(uid, {
        sports: f.sports,
        coachingLevel: f.coachingLevel || null,
        experienceYears: f.experienceYears.trim() === '' ? null : Number(f.experienceYears),
        organisation: f.organisation,
        city: f.city,
        province: f.province || null,
        bio: f.bio,
        specialisations: f.specialisations,
        services: f.services,
        ageGroups: f.ageGroups,
      });
      refreshDirectoryQuietly();
      if (f.firstName.trim() !== firstName || f.surname.trim() !== surname)
        await saveCoachName(uid, f.firstName, f.surname);
      setErrors({});
      setStatus({ kind: 'ok', text: 'Profile saved.' });
      onSaved?.();
    } catch (err) {
      const ze = zodErrors(err);
      if (ze) setErrors(ze);
      setStatus({
        kind: 'err',
        text:
          ze || (err as Error).message === 'NAME' ? 'Check the highlighted fields.' : saveErrorMessage(err),
      });
    } finally {
      setBusy(false);
    }
  }

  const text = (
    key: 'firstName' | 'surname' | 'organisation' | 'city',
    label: string,
    max: number,
    placeholder = '',
  ) => (
    <div className="sb-field">
      <label htmlFor={`cp-${key}`}>{label}</label>
      <input
        id={`cp-${key}`}
        value={f[key]}
        maxLength={max}
        placeholder={placeholder}
        aria-invalid={errors[key] ? true : undefined}
        onChange={(e) => set(key, e.target.value)}
      />
      {errors[key] && <span className="field-error">{errors[key]}</span>}
    </div>
  );

  return (
    <form onSubmit={submit} noValidate>
      <div className="sb-form-grid">
        {text('firstName', 'First name', 60)}
        {text('surname', 'Surname', 60)}
        <div className="sb-field">
          <label htmlFor="cp-level">Coaching level</label>
          <select
            id="cp-level"
            value={f.coachingLevel}
            onChange={(e) => set('coachingLevel', e.target.value as CoachingLevel | '')}
          >
            <option value="">Select level</option>
            {COACHING_LEVELS.map((l) => (
              <option key={l} value={l}>
                {l}
              </option>
            ))}
          </select>
        </div>
        <div className="sb-field">
          <label htmlFor="cp-exp">Years of coaching experience</label>
          <input
            id="cp-exp"
            type="number"
            inputMode="numeric"
            min={0}
            max={60}
            value={f.experienceYears}
            aria-invalid={errors.experienceYears ? true : undefined}
            onChange={(e) => set('experienceYears', e.target.value)}
          />
          {errors.experienceYears && <span className="field-error">{errors.experienceYears}</span>}
        </div>
        {text('organisation', 'Club, school or academy', 80, 'e.g. Soweto FC Academy')}
        {text('city', 'City / town', 60)}
        <div className="sb-field">
          <label htmlFor="cp-province">Province</label>
          <select
            id="cp-province"
            value={f.province}
            onChange={(e) => set('province', e.target.value as Province | '')}
          >
            <option value="">Select province</option>
            {PROVINCES.map((pr) => (
              <option key={pr} value={pr}>
                {pr}
              </option>
            ))}
          </select>
        </div>
        <div className="sb-field full">
          <label htmlFor="cp-bio">About me</label>
          <textarea
            id="cp-bio"
            value={f.bio}
            maxLength={800}
            placeholder="Your coaching philosophy, experience and the athletes you work with."
            aria-invalid={errors.bio ? true : undefined}
            onChange={(e) => set('bio', e.target.value)}
          />
          <span className="sb-field-hint">{f.bio.length}/800</span>
          {errors.bio && <span className="field-error">{errors.bio}</span>}
        </div>
        <ChipPicker
          id="cp-sports"
          label="Sports coached"
          options={SPORTS}
          value={f.sports}
          onChange={(v) => set('sports', v)}
          max={5}
          error={errors.sports}
        />
        <ChipPicker
          id="cp-spec"
          label="Specialisations"
          options={COACH_SPECIALISATIONS}
          value={f.specialisations}
          onChange={(v) => set('specialisations', v)}
          error={errors.specialisations}
        />
        <ChipPicker
          id="cp-services"
          label="Services offered"
          options={COACH_SERVICES}
          value={f.services}
          onChange={(v) => set('services', v)}
          error={errors.services}
        />
        <ChipPicker
          id="cp-ages"
          label="Age groups coached"
          options={AGE_GROUPS}
          value={f.ageGroups}
          onChange={(v) => set('ageGroups', v)}
          error={errors.ageGroups}
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
