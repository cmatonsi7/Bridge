import { useState, type FormEvent } from 'react';
import {
  LISTING_INCLUSIONS,
  LISTING_TYPES,
  PROVINCES,
  SPORTS,
  listingSchema,
  todayIso,
  type ListingDoc,
  type ListingInclusion,
  type ListingInput,
  type ListingKind,
  type ListingType,
  type Province,
  type Sport,
} from '@sportbridge/shared';
import { ChipPicker } from '../athlete/ChipPicker';
import { saveErrorMessage, zodErrors, type Errors } from '../athlete/fieldErrors';

interface Props {
  kind: ListingKind;
  initial?: ListingDoc;
  onSubmit: (input: ListingInput) => Promise<void>;
  onCancel: () => void;
}

/** Create / edit form for an organisation's opportunity or programme. */
export function ListingForm({ kind, initial, onSubmit, onCancel }: Props) {
  const i = initial;
  const [f, setF] = useState({
    type: (i?.type ?? (kind === 'programme' ? 'Programme' : 'Trial')) as ListingType,
    title: i?.title ?? '',
    description: i?.description ?? '',
    sports: (i?.sports ?? []) as Sport[],
    province: (i?.province ?? '') as Province | '',
    city: i?.city ?? '',
    ageMin: i ? String(i.ageMin) : '',
    ageMax: i ? String(i.ageMax) : '',
    deadline: i?.deadline ?? '',
    startDate: i?.startDate ?? '',
    endDate: i?.endDate ?? '',
    isFree: i?.isFree ?? true,
    priceZar: i?.priceZar != null ? String(i.priceZar) : '',
    inclusions: (i?.inclusions ?? []) as ListingInclusion[],
  });
  const [errors, setErrors] = useState<Errors>({});
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState<'draft' | 'published' | null>(null);
  const set = <K extends keyof typeof f>(k: K, v: (typeof f)[K]) => {
    setF((p) => ({ ...p, [k]: v }));
    setMsg('');
  };
  const num = (v: string) => (v.trim() === '' ? Number.NaN : Number(v));

  async function submit(status: 'draft' | 'published', e?: FormEvent) {
    e?.preventDefault();
    setBusy(status);
    setMsg('');
    try {
      const input: ListingInput = {
        kind,
        type: f.type,
        title: f.title,
        description: f.description,
        sports: f.sports,
        province: (f.province || undefined) as Province,
        city: f.city,
        ageMin: num(f.ageMin),
        ageMax: num(f.ageMax),
        deadline: f.deadline,
        startDate: f.startDate,
        endDate: f.endDate,
        isFree: f.isFree,
        priceZar: f.isFree || f.priceZar.trim() === '' ? null : num(f.priceZar),
        inclusions: f.inclusions,
        status,
      };
      listingSchema.parse(input); // validate here first, so errors show before anything is sent
      await onSubmit(input);
      setErrors({});
    } catch (err) {
      const ze = zodErrors(err);
      if (ze) setErrors(ze);
      setMsg(ze ? 'Check the highlighted fields.' : saveErrorMessage(err));
      setBusy(null);
    }
  }

  const err = (k: string) => errors[k] && <span className="field-error">{errors[k]}</span>;
  const input = (k: 'title' | 'city', label: string, max: number, extra: Record<string, unknown> = {}) => (
    <div className={`sb-field${k === 'title' ? ' full' : ''}`}>
      <label htmlFor={`lf-${k}`}>{label}</label>
      <input
        id={`lf-${k}`}
        value={f[k]}
        maxLength={max}
        aria-invalid={errors[k] ? true : undefined}
        onChange={(e) => set(k, e.target.value)}
        {...extra}
      />
      {err(k)}
    </div>
  );
  const dateField = (k: 'deadline' | 'startDate' | 'endDate', label: string) => (
    <div className="sb-field">
      <label htmlFor={`lf-${k}`}>{label}</label>
      <input
        id={`lf-${k}`}
        type="date"
        value={f[k]}
        min={k === 'deadline' ? todayIso() : undefined}
        aria-invalid={errors[k] ? true : undefined}
        onChange={(e) => set(k, e.target.value)}
      />
      {err(k)}
    </div>
  );
  const ageField = (k: 'ageMin' | 'ageMax', label: string) => (
    <div className="sb-field">
      <label htmlFor={`lf-${k}`}>{label}</label>
      <input
        id={`lf-${k}`}
        type="number"
        inputMode="numeric"
        min={5}
        max={99}
        value={f[k]}
        aria-invalid={errors[k] ? true : undefined}
        onChange={(e) => set(k, e.target.value)}
      />
      {err(k)}
    </div>
  );

  return (
    <form onSubmit={(e) => void submit('published', e)} noValidate>
      <div className="sb-form-grid">
        {input('title', 'Title', 120, {
          placeholder:
            kind === 'programme' ? 'e.g. December Football Holiday Camp' : 'e.g. U17 Provincial Trials',
        })}
        <div className="sb-field">
          <label htmlFor="lf-type">Type</label>
          <select id="lf-type" value={f.type} onChange={(e) => set('type', e.target.value as ListingType)}>
            {LISTING_TYPES.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </div>
        {input('city', 'City / town', 60)}
        <div className="sb-field">
          <label htmlFor="lf-province">Province</label>
          <select
            id="lf-province"
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
        {ageField('ageMin', 'Minimum age')}
        {ageField('ageMax', 'Maximum age')}
        {dateField('deadline', 'Closing date')}
        {dateField('startDate', 'Start date (optional)')}
        {dateField('endDate', 'End date (optional)')}
        <div className="sb-field">
          <label htmlFor="lf-cost">Cost</label>
          <select
            id="lf-cost"
            value={f.isFree ? 'free' : 'paid'}
            onChange={(e) => set('isFree', e.target.value === 'free')}
          >
            <option value="free">Free</option>
            <option value="paid">Paid</option>
          </select>
        </div>
        {!f.isFree && (
          <div className="sb-field">
            <label htmlFor="lf-price">Price (rand)</label>
            <input
              id="lf-price"
              type="number"
              inputMode="numeric"
              min={1}
              value={f.priceZar}
              aria-invalid={errors.priceZar ? true : undefined}
              onChange={(e) => set('priceZar', e.target.value)}
            />
            {err('priceZar')}
          </div>
        )}
        <div className="sb-field full">
          <label htmlFor="lf-description">Description</label>
          <textarea
            id="lf-description"
            value={f.description}
            maxLength={3000}
            aria-invalid={errors.description ? true : undefined}
            placeholder="Who it's for, what's involved, what to bring and how selection works."
            onChange={(e) => set('description', e.target.value)}
          />
          <span className="sb-field-hint">{f.description.length}/3000</span>
          {err('description')}
        </div>
        <ChipPicker
          id="lf-sports"
          label="Sports"
          options={SPORTS}
          value={f.sports}
          onChange={(v) => set('sports', v)}
          max={5}
          error={errors.sports}
        />
        <ChipPicker
          id="lf-incl"
          label="Included (optional)"
          options={LISTING_INCLUSIONS}
          value={f.inclusions}
          onChange={(v) => set('inclusions', v)}
          error={errors.inclusions}
        />
      </div>
      <div className="sb-form-actions">
        {msg && (
          <span className="sb-form-status err" role="alert">
            {msg}
          </span>
        )}
        <button type="button" className="sb-btn" onClick={onCancel} disabled={busy !== null}>
          Cancel
        </button>
        <button
          type="button"
          className="sb-btn"
          onClick={() => void submit('draft')}
          disabled={busy !== null}
        >
          {busy === 'draft' ? 'Saving…' : 'Save as draft'}
        </button>
        <button type="submit" className="sb-btn primary" disabled={busy !== null}>
          {busy === 'published' ? 'Publishing…' : 'Publish'}
        </button>
      </div>
    </form>
  );
}
