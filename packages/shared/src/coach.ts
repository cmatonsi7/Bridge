import { z } from 'zod';
import { PROVINCES, SPORTS } from './athlete.js';

/** Fixed lists for coach profiles. Firestore rules repeat these, so change both together. */
export const COACHING_LEVELS = [
  'Community',
  'School',
  'Club',
  'Academy',
  'Provincial',
  'National',
  'Professional',
] as const;
export type CoachingLevel = (typeof COACHING_LEVELS)[number];

export const COACH_SPECIALISATIONS = [
  'Technical Skills',
  'Tactical Development',
  'Strength & Conditioning',
  'Speed & Agility',
  'Goalkeeping',
  'Mental Performance',
  'Injury Prevention',
  'Youth Development',
  'Talent Identification',
] as const;
export type CoachSpecialisation = (typeof COACH_SPECIALISATIONS)[number];

export const COACH_SERVICES = [
  'One-on-One Coaching',
  'Group Sessions',
  'Team Coaching',
  'Holiday Camps',
  'Online Coaching',
  'Trials Preparation',
] as const;
export type CoachService = (typeof COACH_SERVICES)[number];

export const AGE_GROUPS = ['Under 10', 'Under 13', 'Under 16', 'Under 19', 'Adults'] as const;
export type AgeGroup = (typeof AGE_GROUPS)[number];

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max, `Keep this under ${max} characters`)
    .transform((v) => (v === '' ? null : v))
    .nullable();

const uniqueList = <T extends readonly [string, ...string[]]>(values: T, max: number, label: string) =>
  z
    .array(z.enum(values))
    .max(max, `Choose up to ${max} ${label}`)
    .refine((a) => new Set(a).size === a.length, `Duplicate ${label}`);

/** Editable coach profile fields (coachProfiles/{uid}). */
export const coachProfileSchema = z.object({
  sports: uniqueList(SPORTS, 5, 'sports'),
  coachingLevel: z.enum(COACHING_LEVELS).nullable(),
  experienceYears: z
    .number({ invalid_type_error: 'Enter a number' })
    .int('Whole years only')
    .min(0)
    .max(60)
    .nullable(),
  organisation: optionalText(80),
  city: optionalText(60),
  province: z.enum(PROVINCES).nullable(),
  bio: optionalText(800),
  specialisations: uniqueList(COACH_SPECIALISATIONS, COACH_SPECIALISATIONS.length, 'specialisations'),
  services: uniqueList(COACH_SERVICES, COACH_SERVICES.length, 'services'),
  ageGroups: uniqueList(AGE_GROUPS, AGE_GROUPS.length, 'age groups'),
});
export type CoachProfileInput = z.input<typeof coachProfileSchema>;
export type CoachProfileFields = z.output<typeof coachProfileSchema>;

export const coachPrivacySchema = z.object({
  discoverable: z.boolean(),
  showQualifications: z.boolean(),
  allowEnquiries: z.boolean(),
});
export type CoachPrivacy = z.infer<typeof coachPrivacySchema>;
export const DEFAULT_COACH_PRIVACY: CoachPrivacy = {
  discoverable: false,
  showQualifications: false,
  allowEnquiries: false,
};

export interface CoachProfileDoc extends Partial<CoachProfileFields> {
  uid: string;
  displayName: string;
  visibility: 'private' | 'members' | 'public';
  privacy?: CoachPrivacy;
  createdAt: string;
  updatedAt: string;
}

const thisYear = () => new Date().getFullYear();

/** coachProfiles/{uid}/qualifications/{id}. Self-declared until staff verification (Phase 5). */
export const qualificationSchema = z.object({
  title: z.string().trim().min(2, 'Add a title').max(100),
  issuer: optionalText(80),
  year: z
    .number({ invalid_type_error: 'Enter a year' })
    .int()
    .min(1950, 'Enter a valid year')
    .refine((y) => y <= thisYear(), 'Year cannot be in the future')
    .nullable(),
});
export type QualificationInput = z.input<typeof qualificationSchema>;
export type QualificationFields = z.output<typeof qualificationSchema>;
export interface QualificationDoc extends QualificationFields {
  createdAt: string;
  updatedAt: string;
}

/** Coach profile completion, computed from real data. */
export function coachCompletion(
  profile: Partial<CoachProfileDoc> | null | undefined,
  qualificationCount: number,
) {
  const p = profile ?? {};
  const items = [
    {
      key: 'basics',
      label: 'Sports, coaching level and province added',
      done: !!((p.sports?.length ?? 0) > 0 && p.coachingLevel && p.province),
    },
    { key: 'about', label: 'About me written', done: !!(p.bio && p.bio.length >= 20) },
    {
      key: 'experience',
      label: 'Experience and organisation added',
      done: p.experienceYears != null && !!p.organisation,
    },
    { key: 'specialisations', label: 'Specialisations selected', done: (p.specialisations?.length ?? 0) > 0 },
    {
      key: 'services',
      label: 'Services and age groups selected',
      done: (p.services?.length ?? 0) > 0 && (p.ageGroups?.length ?? 0) > 0,
    },
    { key: 'qualifications', label: 'At least one qualification added', done: qualificationCount > 0 },
  ];
  const percent = Math.round((items.filter((i) => i.done).length / items.length) * 100);
  return { percent, items };
}
