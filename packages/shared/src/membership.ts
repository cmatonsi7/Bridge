import { z } from 'zod';

/**
 * Membership (Phase 4). SportBridge charges nothing yet: the client has confirmed the prices but has not
 * chosen a payment provider, so this file carries the plans, the limits and the trial rules, and the server
 * owns every membership record. "Upgrade" records interest; it never takes money. When the provider is
 * chosen, only the interest route changes.
 */

/** Prices confirmed by the client on 2026-11-11. Annual is two months free, so ten times the monthly price. */
export const PLANS = {
  starter: { monthly: 'R0', annual: 'R0' },
  pro: { monthly: 'R149', annual: 'R1 490' },
  organisation: { monthly: 'R499', annual: 'R4 990' },
} as const;

export const PLAN_IDS = ['starter', 'pro', 'organisation'] as const;
export type PlanId = (typeof PLAN_IDS)[number];

export const BILLING_PERIODS = ['monthly', 'annual'] as const;
export type BillingPeriod = (typeof BILLING_PERIODS)[number];

/**
 * `trialing` — an organisation inside its free 30 days.
 * `active`   — a paid subscription (nothing can reach this state until a payment provider is connected).
 * `lapsed`   — the trial ran out and nobody subscribed. Never charged: the client asked for no automatic
 *              billing, so the account simply returns to the free limits.
 * `free`     — the ordinary state of a Starter account.
 */
export const MEMBERSHIP_STATUSES = ['free', 'trialing', 'active', 'lapsed'] as const;
export type MembershipStatus = (typeof MEMBERSHIP_STATUSES)[number];

/** An organisation's free run before it has to decide. */
export const TRIAL_DAYS = 30;

/**
 * What each plan allows. These are the client's to set — change the numbers here and nothing else.
 * `null` means no limit.
 *
 * Defaults chosen on 2026-11-16 while waiting for the client to confirm the split; the application cap was
 * already the plan of record ("membership limits on applications (Phase 4)").
 *
 * `activeApplications` is **enforced on the server** (applications are created through the API).
 * `liveListings` and `savedListings` are **not enforced yet**: both are written straight from the browser
 * under Firestore rules, which cannot count documents, so enforcing them means moving listing creation and
 * saving to the API first. Until that happens the app must not claim either one is in force.
 */
export const PLAN_LIMITS = {
  /** Free individual accounts: athletes, parents and coaches. */
  starter: { activeApplications: 3, savedListings: 10, liveListings: 0 },
  /** Paid individual accounts. */
  pro: { activeApplications: null, savedListings: null, liveListings: 0 },
  /** Organisations, while paying or inside the trial. */
  organisation: { activeApplications: null, savedListings: null, liveListings: null },
  /** An organisation whose trial ran out without a subscription. */
  organisationLapsed: { activeApplications: null, savedListings: null, liveListings: 1 },
} as const;

export type PlanLimits = (typeof PLAN_LIMITS)[keyof typeof PLAN_LIMITS];

/** memberships/{uid}. Written only by the server. */
export interface MembershipDoc {
  uid: string;
  plan: PlanId;
  status: MembershipStatus;
  /** Set once a subscription exists; null while free, trialing or lapsed. */
  billingPeriod: BillingPeriod | null;
  /** End of the organisation trial, as an ISO date-time. Null for accounts that never had one. */
  trialEndsAt: string | null;
  /** The last plan the member asked to move to, recorded while there is no payment provider. */
  interest: { plan: PlanId; billingPeriod: BillingPeriod; at: string } | null;
  createdAt: string;
  updatedAt: string;
}

export const upgradeInterestSchema = z.object({
  plan: z.enum(['pro', 'organisation']),
  billingPeriod: z.enum(BILLING_PERIODS),
});
export type UpgradeInterestInput = z.input<typeof upgradeInterestSchema>;

/** Organisations start on the organisation plan inside a trial; everyone else starts free on Starter. */
export const startingPlan = (role: string | undefined): { plan: PlanId; status: MembershipStatus } =>
  role === 'organisation'
    ? { plan: 'organisation', status: 'trialing' }
    : { plan: 'starter', status: 'free' };

/** A trial that has run out is `lapsed` from that moment, whatever the stored status says. */
export function effectiveStatus(m: Pick<MembershipDoc, 'status' | 'trialEndsAt'>, now = new Date()) {
  if (m.status === 'trialing' && m.trialEndsAt && m.trialEndsAt <= now.toISOString()) return 'lapsed';
  return m.status;
}

/** What this member may do right now, after any trial has been allowed to run out. */
export function limitsFor(m: Pick<MembershipDoc, 'plan' | 'status' | 'trialEndsAt'>, now = new Date()) {
  const status = effectiveStatus(m, now);
  if (m.plan === 'organisation')
    return status === 'lapsed' ? PLAN_LIMITS.organisationLapsed : PLAN_LIMITS.organisation;
  return m.plan === 'pro' && status === 'active' ? PLAN_LIMITS.pro : PLAN_LIMITS.starter;
}

/** Whole days left in the trial, never negative. 0 means it ends today or has ended. */
export function trialDaysLeft(m: Pick<MembershipDoc, 'trialEndsAt'>, now = new Date()) {
  if (!m.trialEndsAt) return 0;
  const ms = new Date(m.trialEndsAt).getTime() - now.getTime();
  return ms <= 0 ? 0 : Math.ceil(ms / 86_400_000);
}

export const PLAN_LABELS: Record<PlanId, string> = {
  starter: 'Starter',
  pro: 'Pro',
  organisation: 'Organisation',
};

export const STATUS_LABELS: Record<MembershipStatus, string> = {
  free: 'Free',
  trialing: 'Free trial',
  active: 'Active',
  lapsed: 'Trial ended',
};
