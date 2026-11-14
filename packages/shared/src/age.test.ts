import { describe, expect, it } from 'vitest';
import { ageOn, isMinor, parseIsoDate } from './age.js';
import { onboardingSchema } from './schemas.js';

const d = (s: string) => parseIsoDate(s)!;

describe('age', () => {
  it('rejects impossible dates', () => {
    expect(parseIsoDate('2010-02-30')).toBeNull();
    expect(parseIsoDate('10/02/2010')).toBeNull();
  });
  it('counts birthdays correctly', () => {
    expect(ageOn(d('2008-11-02'), d('2026-11-02'))).toBe(18);
    expect(ageOn(d('2008-11-03'), d('2026-11-02'))).toBe(17);
    expect(isMinor(d('2008-11-03'), d('2026-11-02'))).toBe(true);
  });
});

const base = {
  firstName: 'Lebo',
  surname: 'Mokoena',
  mobile: '+27 82 123 4567',
  role: 'athlete' as const,
  termsAccepted: true as const,
};
const yearsAgo = (n: number, extraDays = 0) => {
  const now = new Date();
  const x = new Date(Date.UTC(now.getUTCFullYear() - n, now.getUTCMonth(), now.getUTCDate() + extraDays));
  return x.toISOString().slice(0, 10);
};

describe('onboardingSchema', () => {
  it('accepts an adult athlete', () => {
    expect(onboardingSchema.safeParse({ ...base, dateOfBirth: yearsAgo(25) }).success).toBe(true);
  });
  it('requires guardian details for a minor', () => {
    const r = onboardingSchema.safeParse({ ...base, dateOfBirth: yearsAgo(15) });
    expect(r.success).toBe(false);
    const paths = r.success ? [] : r.error.issues.map((i) => i.path.join('.'));
    expect(paths).toEqual(
      expect.arrayContaining(['guardianEmail', 'guardianRelationship', 'guardianConsentAcknowledged']),
    );
  });
  it('accepts a minor with guardian details', () => {
    const r = onboardingSchema.safeParse({
      ...base,
      dateOfBirth: yearsAgo(15),
      guardianEmail: 'Parent@Example.com',
      guardianRelationship: 'parent',
      guardianConsentAcknowledged: true,
    });
    expect(r.success && r.data.guardianEmail).toBe('parent@example.com');
  });
  it('blocks minors from non-athlete roles and under-13 self-registration', () => {
    expect(
      onboardingSchema.safeParse({
        ...base,
        role: 'coach',
        dateOfBirth: yearsAgo(16),
        guardianEmail: 'a@b.co',
        guardianRelationship: 'parent',
        guardianConsentAcknowledged: true,
      }).success,
    ).toBe(false);
    expect(onboardingSchema.safeParse({ ...base, dateOfBirth: yearsAgo(12) }).success).toBe(false);
  });
  it('rejects admin as a self-service role', () => {
    expect(onboardingSchema.safeParse({ ...base, role: 'admin', dateOfBirth: yearsAgo(30) }).success).toBe(
      false,
    );
  });
  it('requires organisation details, and an organisation gives no date of birth', () => {
    const org = { ...base, role: 'organisation', organisationName: 'Soweto FC', organisationType: 'club' };
    // name and type are still required
    expect(onboardingSchema.safeParse({ ...base, role: 'organisation', adultConfirmed: true }).success).toBe(
      false,
    );
    // no date of birth needed, but the adult confirmation is
    expect(onboardingSchema.safeParse(org).success).toBe(false);
    const refused = onboardingSchema.safeParse(org);
    expect(refused.success ? [] : refused.error.issues.map((i) => i.path.join('.'))).toContain(
      'adultConfirmed',
    );
    expect(onboardingSchema.safeParse({ ...org, adultConfirmed: true }).success).toBe(true);
    expect(onboardingSchema.safeParse({ ...org, adultConfirmed: false }).success).toBe(false);
  });

  it('an organisation that still sends a date of birth is accepted, and age rules do not apply to it', () => {
    const org = {
      ...base,
      role: 'organisation',
      organisationName: 'Soweto FC',
      organisationType: 'club',
      adultConfirmed: true,
    };
    expect(onboardingSchema.safeParse({ ...org, dateOfBirth: yearsAgo(30) }).success).toBe(true);
    // an organisation is never treated as a minor: the confirmation is what counts
    expect(onboardingSchema.safeParse({ ...org, dateOfBirth: yearsAgo(14) }).success).toBe(true);
  });

  it('every other role still needs a date of birth, and the adult confirmation does not replace it', () => {
    const { dateOfBirth: _d, ...noDob } = { ...base, dateOfBirth: yearsAgo(25) };
    for (const role of ['athlete', 'guardian', 'coach'] as const) {
      const r = onboardingSchema.safeParse({ ...noDob, role, adultConfirmed: true });
      expect(r.success).toBe(false);
      expect(r.success ? [] : r.error.issues.map((i) => i.path.join('.'))).toContain('dateOfBirth');
    }
  });
});
