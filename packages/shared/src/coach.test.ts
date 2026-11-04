import { describe, expect, it } from 'vitest';
import { coachCompletion, coachProfileSchema, qualificationSchema } from './coach.js';

const empty = {
  sports: [],
  coachingLevel: null,
  experienceYears: null,
  organisation: '',
  city: '',
  province: null,
  bio: '',
  specialisations: [],
  services: [],
  ageGroups: [],
};

describe('coachProfileSchema', () => {
  it('accepts a full profile from the fixed lists', () => {
    expect(
      coachProfileSchema.safeParse({
        ...empty,
        sports: ['Football', 'Rugby'],
        coachingLevel: 'Club',
        experienceYears: 8,
        province: 'Gauteng',
        specialisations: ['Youth Development'],
        services: ['Group Sessions'],
        ageGroups: ['Under 16'],
      }).success,
    ).toBe(true);
  });
  it('rejects values outside the lists, too many sports and duplicates', () => {
    expect(coachProfileSchema.safeParse({ ...empty, coachingLevel: 'Galactic' }).success).toBe(false);
    expect(coachProfileSchema.safeParse({ ...empty, services: ['Babysitting'] }).success).toBe(false);
    expect(
      coachProfileSchema.safeParse({
        ...empty,
        sports: ['Football', 'Rugby', 'Cricket', 'Netball', 'Hockey', 'Tennis'],
      }).success,
    ).toBe(false);
    expect(coachProfileSchema.safeParse({ ...empty, ageGroups: ['Adults', 'Adults'] }).success).toBe(false);
  });
});

describe('qualificationSchema', () => {
  it('allows an unknown year', () => {
    expect(
      qualificationSchema.safeParse({ title: 'SAFA C Licence', issuer: 'SAFA', year: null }).success,
    ).toBe(true);
  });
  it('rejects a future year', () => {
    expect(
      qualificationSchema.safeParse({
        title: 'SAFA C Licence',
        issuer: '',
        year: new Date().getFullYear() + 1,
      }).success,
    ).toBe(false);
  });
});

describe('coachCompletion', () => {
  it('is 0% when empty and 100% when complete', () => {
    expect(coachCompletion(null, 0).percent).toBe(0);
    expect(
      coachCompletion(
        {
          sports: ['Football'],
          coachingLevel: 'Club',
          province: 'Gauteng',
          bio: 'Youth coach for ten years in Soweto.',
          experienceYears: 10,
          organisation: 'Soweto FC',
          specialisations: ['Youth Development'],
          services: ['Group Sessions'],
          ageGroups: ['Under 16'],
        },
        1,
      ).percent,
    ).toBe(100);
  });
});
