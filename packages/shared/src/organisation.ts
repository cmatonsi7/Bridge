import { z } from 'zod';
import { ORGANISATION_TYPES, type OrganisationType } from './roles.js';
import { PROVINCES, SPORTS } from './athlete.js';
import { AGE_GROUPS } from './coach.js';

/** Fixed lists for organisation profiles. Firestore rules repeat these, so change both together. */
export const ORG_OFFERINGS = [
  'Teams & Leagues',
  'Academy Programmes',
  'Holiday Camps',
  'Trials',
  'Coaching Clinics',
  'Scholarships & Bursaries',
  'Sports Science',
  'Facility Hire',
] as const;
export type OrgOffering = (typeof ORG_OFFERINGS)[number];

export const ORG_FACILITIES = [
  'Grass Field',
  'Artificial Turf',
  'Indoor Hall',
  'Swimming Pool',
  'Athletics Track',
  'Gym',
  'Courts',
  'Changing Rooms',
] as const;
export type OrgFacility = (typeof ORG_FACILITIES)[number];

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

/** Editable organisation fields (organisations/{orgId}). ownerUid and verified are server-only. */
export const organisationProfileSchema = z.object({
  name: z.string().trim().min(2, 'Enter the organisation name').max(120),
  type: z.enum(ORGANISATION_TYPES),
  description: optionalText(1000),
  contactEmail: z
    .string()
    .trim()
    .toLowerCase()
    .max(120)
    .transform((v) => (v === '' ? null : v))
    .nullable()
    .refine((v) => v === null || /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(v), 'Enter a valid email address'),
  contactPhone: z
    .string()
    .trim()
    .transform((v) => v.replace(/[\s()-]/g, ''))
    .transform((v) => (v === '' ? null : v))
    .nullable()
    .refine((v) => v === null || /^\+?\d{9,15}$/.test(v), 'Enter a valid phone number'),
  website: z
    .string()
    .trim()
    .max(200)
    .transform((v) => (v === '' ? null : v))
    .nullable()
    .refine(
      (v) => v === null || /^https?:\/\/[^\s]+\.[^\s]+$/.test(v),
      'Enter a full web address, starting with https://',
    ),
  city: optionalText(60),
  province: z.enum(PROVINCES).nullable(),
  sports: uniqueList(SPORTS, 10, 'sports'),
  ageGroups: uniqueList(AGE_GROUPS, AGE_GROUPS.length, 'age groups'),
  offerings: uniqueList(ORG_OFFERINGS, ORG_OFFERINGS.length, 'offerings'),
  facilities: uniqueList(ORG_FACILITIES, ORG_FACILITIES.length, 'facilities'),
});
export type OrganisationProfileInput = z.input<typeof organisationProfileSchema>;
export type OrganisationProfileFields = z.output<typeof organisationProfileSchema>;

export const orgPrivacySchema = z.object({
  listed: z.boolean(),
  showContactDetails: z.boolean(),
  acceptEnquiries: z.boolean(),
});
export type OrgPrivacy = z.infer<typeof orgPrivacySchema>;
export const DEFAULT_ORG_PRIVACY: OrgPrivacy = {
  listed: false,
  showContactDetails: false,
  acceptEnquiries: false,
};

/** Full organisations/{orgId} document as stored. */
export interface OrganisationFullDoc extends Partial<Omit<OrganisationProfileFields, 'name' | 'type'>> {
  name: string;
  type: OrganisationType;
  /** null while a staff-added organisation is unclaimed. */
  ownerUid: string | null;
  verified: boolean;
  /** When staff last verified the organisation; null if it is not verified. */
  verifiedAt?: string | null;
  privacy?: OrgPrivacy;
  /** Absent on organisations created at sign-up (treated as claimed, self-registered). */
  claimStatus?: 'unclaimed' | 'claimed';
  source?: 'staff_import' | 'self_registered';
  schoolNumber?: string | null;
  sourceNote?: string;
  importedBy?: string;
  claimedAt?: string | null;
  createdAt: string;
  updatedAt: string;
}

/** Organisation profile completion, computed from real data. */
export function organisationCompletion(org: Partial<OrganisationFullDoc> | null | undefined) {
  const o = org ?? {};
  const items = [
    { key: 'basics', label: 'Sports and province added', done: (o.sports?.length ?? 0) > 0 && !!o.province },
    { key: 'about', label: 'Description written', done: !!(o.description && o.description.length >= 40) },
    { key: 'contact', label: 'Contact email or phone added', done: !!(o.contactEmail || o.contactPhone) },
    { key: 'offerings', label: 'What you offer selected', done: (o.offerings?.length ?? 0) > 0 },
    { key: 'ageGroups', label: 'Age groups selected', done: (o.ageGroups?.length ?? 0) > 0 },
    { key: 'facilities', label: 'Facilities selected', done: (o.facilities?.length ?? 0) > 0 },
  ];
  const percent = Math.round((items.filter((i) => i.done).length / items.length) * 100);
  return { percent, items };
}
