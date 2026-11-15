import { z } from 'zod';
import { PROVINCES, SPORTS } from './athlete.js';

/**
 * Sponsorship (Phase 3d): an athlete asks for help with a sporting cost, someone offers help, and SportBridge
 * introduces them once the athlete accepts. SportBridge never handles money.
 */

/**
 * Requests made by a parent for their child stay switched off until the client's legal adviser answers
 * legal question 6 (may a child's financial need be published at all?). The server enforces this.
 */
export const CHILD_SPONSORSHIP_ENABLED = false;

/** A request is listed for this many days, then expires. */
export const SPONSORSHIP_DAYS = 30;

export const SPONSORSHIP_CATEGORIES = [
  'Kit & equipment',
  'Transport',
  'Fees',
  'Tournament or travel',
  'Coaching',
  'Other',
] as const;
export type SponsorshipCategory = (typeof SPONSORSHIP_CATEGORIES)[number];

export const SPONSORSHIP_STATUSES = ['pending_review', 'open', 'closed', 'rejected'] as const;
export type SponsorshipStatus = (typeof SPONSORSHIP_STATUSES)[number];

export const OFFER_STATUSES = ['pending', 'accepted', 'declined', 'withdrawn'] as const;
export type OfferStatus = (typeof OFFER_STATUSES)[number];

/** Roles that may offer help. Parents and children never do. Adult athletes only (checked on the server). */
export const OFFERING_ROLES = ['athlete', 'coach', 'organisation'] as const;

export const SPONSOR_AGE_BANDS = ['Under 13', '13–15', '16–18', 'Adult'] as const;
export type AgeBand = (typeof SPONSOR_AGE_BANDS)[number];
export const ageBand = (age: number): AgeBand =>
  age < 13 ? 'Under 13' : age < 16 ? '13–15' : age < 18 ? '16–18' : 'Adult';

const text = (min: number, max: number, what: string) =>
  z
    .string()
    .trim()
    .min(min, `Write at least ${min} characters for the ${what}`)
    .max(max, `Keep the ${what} under ${max} characters`);

export const sponsorshipRequestSchema = z.object({
  /** Set only by a parent asking on behalf of a child they are confirmed for. */
  forChildUid: z
    .string()
    .regex(/^[A-Za-z0-9]{1,128}$/)
    .nullable()
    .optional()
    .transform((v) => v ?? null),
  title: text(5, 80, 'title'),
  story: text(20, 600, 'description'),
  category: z.enum(SPONSORSHIP_CATEGORIES),
  amountZar: z.coerce
    .number()
    .int('Use a whole number of rand')
    .min(50, 'The amount must be at least R50')
    .max(100000, 'The amount must be R100 000 or less'),
  sport: z.enum(SPORTS),
  province: z.enum(PROVINCES),
});
export type SponsorshipRequestInput = z.input<typeof sponsorshipRequestSchema>;

export const sponsorshipOfferSchema = z.object({ message: text(10, 400, 'message') });
export const offerResponseSchema = z.object({ accept: z.boolean() });
export const sponsorshipReviewSchema = z.object({
  approve: z.boolean(),
  note: z
    .string()
    .trim()
    .max(300, 'Keep the note under 300 characters')
    .optional()
    .transform((v) => v || null),
});
export const sponsorshipReportSchema = z.object({ reason: text(5, 300, 'reason') });

/** sponsorshipRequests/{id}. Written only by the server. */
export interface SponsorshipRequestDoc {
  requesterUid: string; // the adult athlete, or the parent asking for a child
  athleteUid: string; // who the help is for
  forChild: boolean;
  /** Adults: first name and surname initial. Children: null, so a child is never named. */
  displayName: string | null;
  ageBand: AgeBand;
  title: string;
  story: string;
  category: SponsorshipCategory;
  amountZar: number;
  sport: string;
  province: string;
  status: SponsorshipStatus;
  offerCount: number;
  reportCount: number;
  reviewNote: string | null;
  createdAt: string;
  updatedAt: string;
  expiresAt: string;
}

/** sponsorshipOffers/{requestId}_{offererUid}. Written only by the server. */
export interface SponsorshipOfferDoc {
  requestId: string;
  requestTitle: string;
  requesterUid: string;
  offererUid: string;
  offererName: string;
  offererRole: (typeof OFFERING_ROLES)[number];
  message: string;
  status: OfferStatus;
  /** Filled in only when the athlete (or parent) accepts: each side then sees the other's email. */
  contacts: { requesterEmail: string; offererEmail: string } | null;
  createdAt: string;
  updatedAt: string;
}

export const offerId = (requestId: string, offererUid: string) => `${requestId}_${offererUid}`;

/** Open and not yet past its expiry date. */
export const isLiveRequest = (r: Pick<SponsorshipRequestDoc, 'status' | 'expiresAt'>, now = new Date()) =>
  r.status === 'open' && r.expiresAt > now.toISOString();

export const SPONSORSHIP_STATUS_LABELS: Record<SponsorshipStatus, string> = {
  pending_review: 'Waiting for SportBridge to check it',
  open: 'Open',
  closed: 'Closed',
  rejected: 'Not approved',
};
