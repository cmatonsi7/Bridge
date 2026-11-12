import { z } from 'zod';
import { organisationProfileSchema } from './organisation.js';

/** Where an organisation record came from. Imported ones start unclaimed and are never "verified". */
export const ORG_SOURCES = ['self_registered', 'staff_import'] as const;
export type OrgSource = (typeof ORG_SOURCES)[number];
export const CLAIM_STATUSES = ['unclaimed', 'claimed'] as const;
export type ClaimStatus = (typeof CLAIM_STATUSES)[number];

/** Fields staff enter for a school or organisation they add on its behalf. */
export const unclaimedOrganisationSchema = organisationProfileSchema.extend({
  schoolNumber: z
    .string()
    .trim()
    .max(20, 'Keep this under 20 characters')
    .transform((v) => (v === '' ? null : v))
    .nullable()
    .optional()
    .transform((v) => v ?? null),
  /** Where the information came from (a list, a website, a phone call), for accountability. */
  sourceNote: z.string().trim().min(3, 'Say where this information came from').max(200),
});
export type UnclaimedOrganisationInput = z.input<typeof unclaimedOrganisationSchema>;
export type UnclaimedOrganisationFields = z.output<typeof unclaimedOrganisationSchema>;

/** organisationClaims/{orgId}: server-only. Holds a hash of the claim code, never the code itself. */
export interface ClaimDoc {
  orgId: string;
  codeHash: string;
  createdAt: string;
  createdBy: string;
  expiresAt: string;
}

/** Claim codes look like SB-7K4M-9XQ2. They avoid look-alike characters (0/O, 1/I/L). */
export const CLAIM_CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
export const CLAIM_CODE_LENGTH = 8;
export const CLAIM_CODE_VALID_DAYS = 60;

/** Normalises what a person typed (any case, spaces or dashes, optional "SB" prefix) or returns null. */
export function normaliseClaimCode(input: string): string | null {
  let c = input.toUpperCase().replace(/[\s-]/g, '');
  if (c.startsWith('SB') && c.length === CLAIM_CODE_LENGTH + 2) c = c.slice(2);
  if (c.length !== CLAIM_CODE_LENGTH) return null;
  for (const ch of c) if (!CLAIM_CODE_ALPHABET.includes(ch)) return null;
  return c;
}

/** "7K4M9XQ2" -> "SB-7K4M-9XQ2". */
export const formatClaimCode = (code: string) => `SB-${code.slice(0, 4)}-${code.slice(4)}`;

export const claimRequestSchema = z.object({
  code: z.string().trim().min(1, 'Enter your claim code').max(40),
});

/** Directory key for an organisation nobody owns yet. */
export const unclaimedEntryId = (orgId: string) => `org_${orgId}`;
