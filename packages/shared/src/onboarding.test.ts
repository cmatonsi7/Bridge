import { describe, expect, it } from 'vitest';
import {
  CLAIM_CODE_ALPHABET,
  formatClaimCode,
  normaliseClaimCode,
  unclaimedEntryId,
  unclaimedOrganisationSchema,
} from './onboarding.js';

const base = {
  name: 'Soweto High School',
  type: 'school' as const,
  description: '',
  contactEmail: 'office@sowetohigh.edu.za',
  contactPhone: '',
  website: '',
  city: 'Soweto',
  province: 'Gauteng' as const,
  sports: ['Football' as const],
  ageGroups: [],
  offerings: [],
  facilities: [],
  sourceNote: 'Gauteng Department of Education school list, 2026',
};

describe('unclaimedOrganisationSchema', () => {
  it('accepts a school with its source, and normalises optional fields', () => {
    const r = unclaimedOrganisationSchema.parse({ ...base, schoolNumber: ' 700123456 ' });
    expect(r.schoolNumber).toBe('700123456');
    expect(r.contactPhone).toBeNull();
    expect(unclaimedOrganisationSchema.parse(base).schoolNumber).toBeNull();
  });
  it('insists on knowing where the information came from', () => {
    expect(unclaimedOrganisationSchema.safeParse({ ...base, sourceNote: '' }).success).toBe(false);
    expect(unclaimedOrganisationSchema.safeParse({ ...base, name: ' ' }).success).toBe(false);
  });
});

describe('claim codes', () => {
  it('accepts a code however it is typed', () => {
    for (const typed of ['SB-7K4M-9XQ2', 'sb7k4m9xq2', '7k4m 9xq2', ' 7K4M-9XQ2 '])
      expect(normaliseClaimCode(typed)).toBe('7K4M9XQ2');
  });
  it('rejects codes of the wrong length or with look-alike characters', () => {
    expect(normaliseClaimCode('7K4M9XQ')).toBeNull();
    expect(normaliseClaimCode('7K4M9XQ22')).toBeNull();
    expect(normaliseClaimCode('0OIL1111')).toBeNull();
    expect(normaliseClaimCode('')).toBeNull();
    for (const ch of '01OIL') expect(CLAIM_CODE_ALPHABET.includes(ch)).toBe(false);
  });
  it('formats for reading aloud and keys unclaimed directory entries separately from people', () => {
    expect(formatClaimCode('7K4M9XQ2')).toBe('SB-7K4M-9XQ2');
    expect(unclaimedEntryId('abc')).toBe('org_abc');
  });
});
