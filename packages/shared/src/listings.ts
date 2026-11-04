import { z } from 'zod';
import { PROVINCES, SPORTS, type Province, type Sport } from './athlete.js';

/** Opportunities and programmes share one structure, distinguished by `kind`. */
export const LISTING_KINDS = ['opportunity', 'programme'] as const;
export type ListingKind = (typeof LISTING_KINDS)[number];

export const LISTING_TYPES = [
  'Trial',
  'Scholarship',
  'Bursary',
  'Programme',
  'Talent ID',
  'High Performance',
  'Event',
] as const;
export type ListingType = (typeof LISTING_TYPES)[number];

export const LISTING_INCLUSIONS = [
  'Meals',
  'Equipment',
  'Transport',
  'Accommodation',
  'Kit',
  'Certificate',
] as const;
export type ListingInclusion = (typeof LISTING_INCLUSIONS)[number];

export const LISTING_STATUSES = ['draft', 'published', 'closed'] as const;
export type ListingStatus = (typeof LISTING_STATUSES)[number];

/** Age bands used by the browse filter (inclusive). */
export const AGE_BANDS = [
  { key: 'u13', label: 'Under 13', min: 0, max: 12 },
  { key: '13-15', label: '13–15', min: 13, max: 15 },
  { key: '16-18', label: '16–18', min: 16, max: 18 },
  { key: 'adult', label: '19+', min: 19, max: 99 },
] as const;

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const isRealDate = (v: string) => {
  if (!ISO_DATE.test(v)) return false;
  const d = new Date(`${v}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === v;
};
const date = (label: string) => z.string().refine(isRealDate, `Enter a valid ${label}`);
const optionalDate = (label: string) =>
  z
    .string()
    .transform((v) => (v === '' ? null : v))
    .nullable()
    .refine((v) => v === null || isRealDate(v), `Enter a valid ${label}`);

export const todayIso = (now = new Date()) => now.toISOString().slice(0, 10);

/** Fields an organisation edits (listings/{id}). Ownership and org details are added by the service. */
export const listingSchema = z
  .object({
    kind: z.enum(LISTING_KINDS),
    type: z.enum(LISTING_TYPES),
    title: z.string().trim().min(3, 'Add a title').max(120),
    description: z.string().trim().min(20, 'Describe the listing in at least 20 characters').max(3000),
    sports: z
      .array(z.enum(SPORTS))
      .min(1, 'Choose at least one sport')
      .max(5, 'Choose up to 5 sports')
      .refine((a) => new Set(a).size === a.length, 'Duplicate sport'),
    province: z.enum(PROVINCES),
    city: z.string().trim().min(2, 'Add a city or town').max(60),
    ageMin: z.number({ invalid_type_error: 'Enter an age' }).int().min(5).max(99),
    ageMax: z.number({ invalid_type_error: 'Enter an age' }).int().min(5).max(99),
    deadline: date('closing date'),
    startDate: optionalDate('start date'),
    endDate: optionalDate('end date'),
    isFree: z.boolean(),
    priceZar: z
      .number({ invalid_type_error: 'Enter a price' })
      .int('Whole rands only')
      .min(1, 'Enter a price above R0')
      .max(1_000_000)
      .nullable(),
    inclusions: z
      .array(z.enum(LISTING_INCLUSIONS))
      .refine((a) => new Set(a).size === a.length, 'Duplicate inclusion'),
    status: z.enum(['draft', 'published'] as const),
  })
  .superRefine((v, ctx) => {
    if (v.ageMin > v.ageMax)
      ctx.addIssue({ code: 'custom', path: ['ageMax'], message: 'Maximum age must be at least the minimum' });
    if (!v.isFree && v.priceZar === null)
      ctx.addIssue({ code: 'custom', path: ['priceZar'], message: 'Enter a price, or mark it as free' });
    if (v.startDate && v.endDate && v.endDate < v.startDate)
      ctx.addIssue({ code: 'custom', path: ['endDate'], message: 'End date must be after the start date' });
    if (v.status === 'published' && v.deadline < todayIso()) {
      ctx.addIssue({
        code: 'custom',
        path: ['deadline'],
        message: 'The closing date has passed; choose a future date to publish',
      });
    }
  })
  .transform((v) => ({ ...v, priceZar: v.isFree ? null : v.priceZar }));
export type ListingInput = z.input<typeof listingSchema>;
export type ListingFields = z.output<typeof listingSchema>;

/** listings/{id} as stored. */
export interface ListingDoc extends Omit<ListingFields, 'status'> {
  status: ListingStatus;
  orgId: string;
  ownerUid: string;
  orgName: string;
  orgVerified: boolean;
  createdAt: string;
  updatedAt: string;
  publishedAt: string | null;
}

/** users/{uid}/saved/{listingId} — a member's shortlist. */
export interface SavedListingDoc {
  listingId: string;
  kind: ListingKind;
  title: string;
  savedAt: string;
}

export interface ListingFilters {
  query?: string;
  sport?: Sport | '';
  type?: ListingType | '';
  province?: Province | '';
  ageBand?: string;
  cost?: '' | 'free' | 'paid';
  includeClosed?: boolean;
}

/** True if the listing can still be applied to / enrolled in. */
export const isOpen = (l: Pick<ListingDoc, 'status' | 'deadline'>, today = todayIso()) =>
  l.status === 'published' && l.deadline >= today;

/**
 * Client-side filtering and sorting (soonest closing first).
 * Firestore has no free-text search, so the query matches title, organisation, sports and city.
 */
export function filterListings<T extends ListingDoc>(items: T[], f: ListingFilters, today = todayIso()): T[] {
  const q = (f.query ?? '').trim().toLowerCase();
  const band = AGE_BANDS.find((b) => b.key === f.ageBand);
  return items
    .filter((l) => f.includeClosed || isOpen(l, today))
    .filter((l) => !f.sport || l.sports.includes(f.sport))
    .filter((l) => !f.type || l.type === f.type)
    .filter((l) => !f.province || l.province === f.province)
    .filter((l) => !band || (l.ageMin <= band.max && l.ageMax >= band.min))
    .filter((l) => !f.cost || (f.cost === 'free' ? l.isFree : !l.isFree))
    .filter((l) => !q || [l.title, l.orgName, l.city, ...l.sports].join(' ').toLowerCase().includes(q))
    .sort((a, b) => a.deadline.localeCompare(b.deadline));
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
/** "16 Dec 2026" from "2026-12-16". */
export function formatDate(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number);
  return `${d} ${MONTHS[(m ?? 1) - 1]} ${y}`;
}
/** "R850" / "Free". */
export const formatPrice = (l: Pick<ListingDoc, 'isFree' | 'priceZar'>) =>
  l.isFree || l.priceZar == null ? 'Free' : `R${l.priceZar.toLocaleString('en-ZA')}`;
