import { z } from 'zod';
import type { Province, Sport } from './athlete.js';

export const CONNECTION_STATUSES = ['pending', 'accepted', 'declined', 'ended'] as const;
export type ConnectionStatus = (typeof CONNECTION_STATUSES)[number];

export const DIRECTORY_ROLES = ['athlete', 'coach', 'organisation'] as const;
export type DirectoryRole = (typeof DIRECTORY_ROLES)[number];

/**
 * directoryProfiles/{uid} — the only publicly searchable copy of a profile.
 * Written by the server. It deliberately holds no contact details and no date of birth,
 * and under-18 athletes never get one at all.
 */
/** Why someone is not in the directory. Shown to them, so it must be plain and kind. */
export const LISTING_REASONS = [
  'UNDER_18',
  'NOT_ACTIVE',
  'SWITCH_OFF',
  'NO_PROFILE',
  'NOT_LISTABLE',
] as const;
export type ListingReason = (typeof LISTING_REASONS)[number];
export const LISTING_REASON_MESSAGES: Record<ListingReason, string> = {
  UNDER_18: 'for safety, athletes under 18 are never listed in the Talent Directory.',
  NOT_ACTIVE:
    'your account isn’t active yet. Finish setting it up (and have a parent confirm it, if you’re under 18).',
  SWITCH_OFF: 'the directory switch is off.',
  NO_PROFILE: 'your profile isn’t set up yet. Save your profile and try again.',
  NOT_LISTABLE: 'this type of account isn’t listed in the directory.',
};

export interface DirectoryEntryDoc {
  uid: string;
  role: DirectoryRole;
  displayName: string;
  sports: string[];
  province: Province | null;
  city: string | null;
  headline: string | null;
  tags: string[];
  orgId?: string;
  orgType?: string;
  verified?: boolean;
  updatedAt: string;
}

export interface DirectoryFilters {
  query?: string;
  role?: DirectoryRole | '';
  sport?: Sport | '';
  province?: Province | '';
}

export function filterDirectory<T extends DirectoryEntryDoc>(items: T[], f: DirectoryFilters): T[] {
  const q = (f.query ?? '').trim().toLowerCase();
  return items
    .filter((e) => !f.role || e.role === f.role)
    .filter((e) => !f.sport || e.sports.includes(f.sport))
    .filter((e) => !f.province || e.province === f.province)
    .filter(
      (e) =>
        !q ||
        [e.displayName, e.city, e.headline ?? '', ...e.sports, ...e.tags].join(' ').toLowerCase().includes(q),
    )
    .sort((a, b) => a.displayName.localeCompare(b.displayName));
}

export const connectRequestSchema = z.object({
  athleteUid: z.string().min(1).max(128),
  message: z
    .string()
    .trim()
    .max(300, 'Keep your message under 300 characters')
    .transform((v) => (v === '' ? null : v))
    .nullable()
    .optional()
    .transform((v) => v ?? null),
});
export type ConnectRequestInput = z.input<typeof connectRequestSchema>;

/** connections/{coachUid}_{athleteUid}. Server-written only. */
export interface ConnectionDoc {
  coachUid: string;
  coachName: string;
  athleteUid: string;
  athleteName: string;
  athleteIsMinor: boolean;
  /** Set when a child's parent answers, so everyone can see who approved it. */
  decidedByUid: string | null;
  decidedByRole: 'athlete' | 'guardian' | null;
  status: ConnectionStatus;
  message: string | null;
  createdAt: string;
  updatedAt: string;
}

export const connectionId = (coachUid: string, athleteUid: string) => `${coachUid}_${athleteUid}`;

/** A connection can be answered only while pending, and ended only once accepted. */
export const isAnswerable = (s: ConnectionStatus) => s === 'pending';
export const isEndable = (s: ConnectionStatus) => s === 'accepted';
