import { refreshDirectoryQuietly } from '../directory/useDirectoryReconcile';
import { useState, type FormEvent } from 'react';
import {
  INTERESTS,
  PROVINCES,
  SKILLS,
  SPORTS,
  type AthleteProfileDoc,
  type Interest,
  type Province,
  type Skill,
  type Sport,
} from '@sportbridge/shared';
import { ChipPicker } from './ChipPicker';
import { saveAthleteProfile, saveName } from './athleteService';
import { saveErrorMessage, zodErrors, type Errors } from './fieldErrors';

interface Props {
  uid: string;
  firstName: string;
  surname: string;
  profile: AthleteProfileDoc | null;
  onSaved?: () => void;
  onCancel?: () => void;
}

/** Edit form for the athlete profile. Used on My Profile (edit mode) and Settings → Account. */
export function AthleteProfileForm({ uid, firstName, surname, profile, onSaved, onCancel }: Props) {
  const p = profile ?? ({} as Partial<AthleteProfileDoc>);
  const [f, setF] = useState({
    firstName,
    surname,
    sport: (p.sport ?? '') as Sport | '',
    position: p.position ?? '',
    city: p.city ?? '',
    province: (p.province ?? '') as Province | '',
    club: p.club ?? '',
    school: p.school ?? '',
    experienceYears: p.experienceYears == null ? '' : String(p.experienceYears),
    bio: p.bio ?? '',
    skills: (p.skills ?? []) as Skill[],
    interests: (p.interests ?? []) as Interest[],
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
    const nameErrors: Errors = {};
    if (!f.firstName.trim()) nameErrors.firstName = 'Required';
    if (!f.surname.trim()) nameErrors.surname = 'Required';
    const years = f.experienceYears.trim() === '' ? null : Number(f.experienceYears);
    const payload = {
      sport: f.sport || null,
      position: f.position,
      city: f.city,
      province: f.province || null,
      club: f.club,
      school: f.school,
      experienceYears: years,
      bio: f.bio,
      skills: f.skills,
      interests: f.interests,
    };
    setBusy(true);
    setStatus(null);
    try {
      if (Object.keys(nameErrors).length) {
        setErrors(nameErrors);
        throw new Error('NAME');
      }
      await saveAthleteProfile(uid, payload);
      refreshDirectoryQuietly();
      if (f.firstName.trim() !== firstName || f.surname.trim() !== surname) {
        await saveName(uid, f.firstName, f.surname);
      }
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
    key: 'firstName' | 'surname' | 'position' | 'city' | 'club' | 'school',
    label: string,
    max: number,
    placeholder = '',
  ) => (
    <div className="sb-field">
      <label htmlFor={`ap-${key}`}>{label}</label>
      <input
        id={`ap-${key}`}
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
          <label htmlFor="ap-sport">Sport</label>
          <select id="ap-sport" value={f.sport} onChange={(e) => set('sport', e.target.value as Sport | '')}>
            <option value="">Select your main sport</option>
            {SPORTS.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
          {errors.sport && <span className="field-error">{errors.sport}</span>}
        </div>
        {text('position', 'Position', 40, 'e.g. Midfielder, Wing, Sprinter')}
        {text('city', 'City / town', 60, 'e.g. Johannesburg')}
        <div className="sb-field">
          <label htmlFor="ap-province">Province</label>
          <select
            id="ap-province"
            value={f.province}
            onChange={(e) => set('province', e.target.value as Province | '')}
          >
            <option value="">Select province</option>
            {PROVINCES.map((p2) => (
              <option key={p2} value={p2}>
                {p2}
              </option>
            ))}
          </select>
        </div>
        {text('club', 'Current club', 80)}
        {text('school', 'School', 80)}
        <div className="sb-field">
          <label htmlFor="ap-exp">Years of experience</label>
          <input
            id="ap-exp"
            type="number"
            inputMode="numeric"
            min={0}
            max={40}
            value={f.experienceYears}
            aria-invalid={errors.experienceYears ? true : undefined}
            onChange={(e) => set('experienceYears', e.target.value)}
          />
          {errors.experienceYears && <span className="field-error">{errors.experienceYears}</span>}
        </div>
        <div className="sb-field full">
          <label htmlFor="ap-bio">About me</label>
          <textarea
            id="ap-bio"
            value={f.bio}
            maxLength={600}
            placeholder="Tell coaches and clubs about yourself, your goals and what drives you."
            aria-invalid={errors.bio ? true : undefined}
            onChange={(e) => set('bio', e.target.value)}
          />
          <span className="sb-field-hint">{f.bio.length}/600</span>
          {errors.bio && <span className="field-error">{errors.bio}</span>}
        </div>
        <ChipPicker
          id="ap-skills"
          label="Skills"
          options={SKILLS}
          value={f.skills}
          onChange={(v) => set('skills', v)}
          error={errors.skills}
        />
        <ChipPicker
          id="ap-interests"
          label="Sporting interests"
          options={INTERESTS}
          value={f.interests}
          onChange={(v) => set('interests', v)}
          max={12}
          error={errors.interests}
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
