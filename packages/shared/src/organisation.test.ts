import { describe, expect, it } from 'vitest';
import { organisationCompletion, organisationProfileSchema } from './organisation.js';

const base = {
  name: 'Soweto FC',
  type: 'club' as const,
  description: '',
  contactEmail: '',
  contactPhone: '',
  website: '',
  city: '',
  province: null,
  sports: [],
  ageGroups: [],
  offerings: [],
  facilities: [],
};

describe('organisationProfileSchema', () => {
  it('accepts a full profile and normalises contact details', () => {
    const r = organisationProfileSchema.parse({
      ...base,
      contactEmail: 'Info@SowetoFC.co.za',
      contactPhone: '011 123 4567',
      website: 'https://sowetofc.co.za',
      province: 'Gauteng',
      sports: ['Football'],
      ageGroups: ['Under 16'],
      offerings: ['Trials'],
      facilities: ['Grass Field'],
    });
    expect(r.contactEmail).toBe('info@sowetofc.co.za');
    expect(r.contactPhone).toBe('0111234567');
  });
  it('turns blank optional fields into null', () => {
    const r = organisationProfileSchema.parse(base);
    expect(r.contactEmail).toBeNull();
    expect(r.website).toBeNull();
  });
  it('rejects bad contact details, unknown values and an empty name', () => {
    expect(organisationProfileSchema.safeParse({ ...base, contactEmail: 'not-an-email' }).success).toBe(
      false,
    );
    expect(organisationProfileSchema.safeParse({ ...base, website: 'sowetofc' }).success).toBe(false);
    expect(organisationProfileSchema.safeParse({ ...base, facilities: ['Helipad'] }).success).toBe(false);
    expect(organisationProfileSchema.safeParse({ ...base, type: 'cartel' }).success).toBe(false);
    expect(organisationProfileSchema.safeParse({ ...base, name: ' ' }).success).toBe(false);
  });
});

describe('organisationCompletion', () => {
  it('is 0% for a new organisation and 100% when complete', () => {
    expect(organisationCompletion({ name: 'X' }).percent).toBe(0);
    expect(
      organisationCompletion({
        sports: ['Football'],
        province: 'Gauteng',
        description: 'A community football club developing young players in Soweto.',
        contactEmail: 'info@x.co.za',
        offerings: ['Trials'],
        ageGroups: ['Under 16'],
        facilities: ['Grass Field'],
      }).percent,
    ).toBe(100);
  });
});
