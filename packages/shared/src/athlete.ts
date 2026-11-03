import { z } from 'zod';

/** Fixed lists keep profiles consistent and searchable (Discovery, Phase 3). Change here only. */
export const SPORTS = [
  'Football',
  'Rugby',
  'Cricket',
  'Netball',
  'Athletics',
  'Swimming',
  'Hockey',
  'Basketball',
  'Tennis',
  'Golf',
  'Boxing',
  'Volleyball',
  'Gymnastics',
  'Cycling',
  'Rowing',
  'Squash',
] as const;
export type Sport = (typeof SPORTS)[number];

export const SKILLS = [
  'Teamwork',
  'Leadership',
  'Discipline',
  'Communication',
  'Technical Ability',
  'Game Intelligence',
  'Fitness & Conditioning',
  'Coachability',
  'Resilience',
  'Time Management',
] as const;
export type Skill = (typeof SKILLS)[number];

export const ADJACENT_INTERESTS = [
  'Strength & Conditioning',
  'Sports Science',
  'Coaching',
  'Sports Media',
  'Event Management',
] as const;
/** Sporting interests = any sport or any adjacent interest. */
export const INTERESTS = [...SPORTS, ...ADJACENT_INTERESTS] as const;
export type Interest = (typeof INTERESTS)[number];

export const PROVINCES = [
  'Eastern Cape',
  'Free State',
  'Gauteng',
  'KwaZulu-Natal',
  'Limpopo',
  'Mpumalanga',
  'Northern Cape',
  'North West',
  'Western Cape',
] as const;
export type Province = (typeof PROVINCES)[number];

export const PROFILE_VISIBILITY = ['private', 'members', 'public'] as const;
export type ProfileVisibility = (typeof PROFILE_VISIBILITY)[number];

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max, `Keep this under ${max} characters`)
    .transform((v) => (v === '' ? null : v))
    .nullable();

/** Editable athlete profile fields (athleteProfiles/{uid}). Validated on client and by Firestore rules. */
export const athleteProfileSchema = z.object({
  sport: z.enum(SPORTS).nullable(),
  position: optionalText(40),
  city: optionalText(60),
  province: z.enum(PROVINCES).nullable(),
  club: optionalText(80),
  school: optionalText(80),
  experienceYears: z
    .number({ invalid_type_error: 'Enter a number' })
    .int('Whole years only')
    .min(0)
    .max(40)
    .nullable(),
  bio: optionalText(600),
  skills: z
    .array(z.enum(SKILLS))
    .max(SKILLS.length)
    .refine((a) => new Set(a).size === a.length, 'Duplicate skill'),
  interests: z
    .array(z.enum(INTERESTS))
    .max(12, 'Choose up to 12 interests')
    .refine((a) => new Set(a).size === a.length, 'Duplicate interest'),
});
export type AthleteProfileInput = z.input<typeof athleteProfileSchema>;
export type AthleteProfileFields = z.output<typeof athleteProfileSchema>;

/** Privacy preferences shown in Settings → Privacy. Enforced by Discovery in Phase 3. */
export const athletePrivacySchema = z.object({
  discoverable: z.boolean(),
  showAchievements: z.boolean(),
  allowEnquiries: z.boolean(),
});
export type AthletePrivacy = z.infer<typeof athletePrivacySchema>;

export const DEFAULT_ATHLETE_PRIVACY: AthletePrivacy = {
  discoverable: false,
  showAchievements: false,
  allowEnquiries: false,
};

/** Full athleteProfiles/{uid} document. */
export interface AthleteProfileDoc extends Partial<AthleteProfileFields> {
  uid: string;
  displayName: string;
  visibility: ProfileVisibility;
  privacy?: AthletePrivacy;
  photoUrl?: string | null; // set once Storage uploads exist
  createdAt: string;
  updatedAt: string;
}

const thisYear = () => new Date().getFullYear();

/** athleteProfiles/{uid}/achievements/{id} */
export const achievementSchema = z.object({
  title: z.string().trim().min(2, 'Add a title').max(100),
  year: z
    .number({ invalid_type_error: 'Enter a year' })
    .int()
    .min(1950, 'Enter a valid year')
    .refine((y) => y <= thisYear(), 'Year cannot be in the future'),
  organisation: optionalText(80),
  detail: optionalText(200),
});
export type AchievementInput = z.input<typeof achievementSchema>;
export type AchievementFields = z.output<typeof achievementSchema>;
export interface AchievementDoc extends AchievementFields {
  createdAt: string;
  updatedAt: string;
}

export interface CompletionItem {
  key: string;
  label: string;
  done: boolean;
}

/**
 * Profile completion, computed from real data (the prototype hardcoded 75%).
 * Optional media is listed but does not count until uploads exist.
 */
export function athleteCompletion(
  profile: Partial<AthleteProfileDoc> | null | undefined,
  achievementCount: number,
): { percent: number; items: CompletionItem[] } {
  const p = profile ?? {};
  const items: CompletionItem[] = [
    {
      key: 'basics',
      label: 'Sport, position and location added',
      done: !!(p.sport && p.position && p.province),
    },
    { key: 'about', label: 'About me written', done: !!(p.bio && p.bio.length >= 20) },
    { key: 'background', label: 'Club or school added', done: !!(p.club || p.school) },
    { key: 'skills', label: 'Skills selected', done: (p.skills?.length ?? 0) > 0 },
    { key: 'interests', label: 'Sporting interests selected', done: (p.interests?.length ?? 0) > 0 },
    { key: 'achievements', label: 'At least one achievement added', done: achievementCount > 0 },
  ];
  const percent = Math.round((items.filter((i) => i.done).length / items.length) * 100);
  return { percent, items };
}
