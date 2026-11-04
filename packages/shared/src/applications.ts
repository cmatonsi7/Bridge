import { z } from 'zod';
import type { ListingKind } from './listings.js';

export const APPLICATION_STATUSES = [
  'submitted',
  'shortlisted',
  'accepted',
  'declined',
  'withdrawn',
] as const;
export type ApplicationStatus = (typeof APPLICATION_STATUSES)[number];

export const APPLICATION_STATUS_LABELS: Record<ApplicationStatus, string> = {
  submitted: 'Submitted',
  shortlisted: 'Shortlisted',
  accepted: 'Accepted',
  declined: 'Not successful',
  withdrawn: 'Withdrawn',
};

/** Statuses an organisation may move an application to, from each current status. */
export const ORG_TRANSITIONS: Record<ApplicationStatus, readonly ApplicationStatus[]> = {
  submitted: ['shortlisted', 'accepted', 'declined'],
  shortlisted: ['accepted', 'declined'],
  accepted: [],
  declined: [],
  withdrawn: [],
};

/** The applicant (or their parent) may withdraw while the application is still live. */
export const WITHDRAWABLE: readonly ApplicationStatus[] = ['submitted', 'shortlisted', 'accepted'];

export const applySchema = z.object({
  listingId: z.string().regex(/^[A-Za-z0-9]{1,64}$/, 'Invalid listing'),
  note: z
    .string()
    .trim()
    .max(500, 'Keep your note under 500 characters')
    .transform((v) => (v === '' ? null : v))
    .nullable()
    .optional()
    .transform((v) => v ?? null),
});
export type ApplyInput = z.input<typeof applySchema>;

export const statusChangeSchema = z.object({
  status: z.enum(['shortlisted', 'accepted', 'declined']),
  message: z
    .string()
    .trim()
    .max(300, 'Keep your message under 300 characters')
    .transform((v) => (v === '' ? null : v))
    .nullable()
    .optional()
    .transform((v) => v ?? null),
});
export type StatusChangeInput = z.input<typeof statusChangeSchema>;

/**
 * What an organisation sees about an applicant. Built on the server from the athlete's real records.
 * Contact details are included for adults only; children are reached through SportBridge.
 */
export interface ApplicantSnapshot {
  displayName: string;
  age: number;
  isMinor: boolean;
  sport: string | null;
  position: string | null;
  city: string | null;
  province: string | null;
  bio: string | null;
  skills: string[];
  email: string | null; // adults only
  phone: string | null; // adults only
}

export interface ApplicationHistoryEntry {
  status: ApplicationStatus;
  at: string;
  by: 'applicant' | 'organisation' | 'guardian';
}

/** applications/{listingId}_{applicantUid}. Written only by the server. */
export interface ApplicationDoc {
  listingId: string;
  listingTitle: string;
  listingKind: ListingKind;
  orgId: string;
  orgName: string;
  ownerUid: string; // organisation owner who may review it
  applicantUid: string;
  applicantIsMinor: boolean;
  status: ApplicationStatus;
  note: string | null;
  orgMessage: string | null;
  snapshot: ApplicantSnapshot;
  history: ApplicationHistoryEntry[];
  createdAt: string;
  updatedAt: string;
}

export const applicationId = (listingId: string, applicantUid: string) => `${listingId}_${applicantUid}`;

export type NotificationType =
  | 'application.received'
  | 'application.child_applied'
  | 'application.status'
  | 'application.withdrawn';

/** users/{uid}/notifications/{id}. Written by the server; the owner may only mark it read or delete it. */
export interface NotificationDoc {
  type: NotificationType;
  title: string;
  body: string;
  link: string;
  read: boolean;
  createdAt: string;
}
