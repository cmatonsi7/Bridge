import {
  TRIAL_DAYS,
  effectiveStatus,
  limitsFor,
  startingPlan,
  upgradeInterestSchema,
  type MembershipDoc,
} from '@sportbridge/shared';
import { HttpError } from '../middleware/errors.js';

type Audit = Record<string, unknown>;

export interface MembershipRepoPort {
  get(uid: string): Promise<MembershipDoc | null>;
  /** Creates the record if it is not there yet and returns whatever is stored afterwards. */
  create(doc: MembershipDoc, audit: Audit): Promise<MembershipDoc>;
  update(uid: string, changes: Partial<MembershipDoc>, audit?: Audit): Promise<void>;
}

export interface Caller {
  uid: string;
  role?: string;
  admin?: boolean;
}

const audit = (type: string, c: Caller, extra: Audit = {}): Audit => ({
  type,
  actorUid: c.uid,
  at: new Date().toISOString(),
  ...extra,
});

/**
 * The caller's membership, created on first sight. An organisation's free 30 days start here, which is also
 * what gives every organisation that signed up before Phase 4 its trial.
 */
export async function getMembership(
  repo: MembershipRepoPort,
  c: Caller,
  now = new Date(),
): Promise<MembershipDoc> {
  const existing = await repo.get(c.uid);
  if (existing) return settle(repo, existing, now);

  const ts = now.toISOString();
  const { plan, status } = startingPlan(c.role);
  const doc: MembershipDoc = {
    uid: c.uid,
    plan,
    status,
    billingPeriod: null,
    trialEndsAt:
      status === 'trialing' ? new Date(now.getTime() + TRIAL_DAYS * 86_400_000).toISOString() : null,
    interest: null,
    createdAt: ts,
    updatedAt: ts,
  };
  return repo.create(doc, audit('membership.started', c, { plan, status }));
}

/**
 * Writes down a trial that has run out, so the stored record says the same thing the app shows. Nothing is
 * charged and nothing is cancelled: the account simply goes back to the free limits.
 */
async function settle(repo: MembershipRepoPort, m: MembershipDoc, now: Date): Promise<MembershipDoc> {
  const status = effectiveStatus(m, now);
  if (status === m.status) return m;
  const changes = { status, updatedAt: now.toISOString() };
  await repo.update(m.uid, changes, {
    type: 'membership.trial_ended',
    actorUid: m.uid,
    at: changes.updatedAt,
  });
  return { ...m, ...changes };
}

/**
 * Records that someone wants a paid plan. There is no payment provider yet, so this takes no money and
 * grants nothing — it is the seam the real checkout will replace.
 */
export async function recordUpgradeInterest(
  repo: MembershipRepoPort,
  c: Caller,
  raw: unknown,
  now = new Date(),
): Promise<MembershipDoc> {
  const input = upgradeInterestSchema.parse(raw);
  if (input.plan === 'organisation' && c.role !== 'organisation')
    throw new HttpError(403, 'NOT_ORGANISATION', 'The Organisation plan is for organisation accounts');
  if (input.plan === 'pro' && c.role === 'organisation')
    throw new HttpError(403, 'ORGANISATION_ACCOUNT', 'Organisations use the Organisation plan');

  const current = await getMembership(repo, c, now);
  const ts = now.toISOString();
  const interest = { plan: input.plan, billingPeriod: input.billingPeriod, at: ts };
  await repo.update(
    c.uid,
    { interest, updatedAt: ts },
    audit('membership.interest', c, { plan: input.plan, billingPeriod: input.billingPeriod }),
  );
  return { ...current, interest, updatedAt: ts };
}

/**
 * Stops an application that would go past the member's plan. `pending` is how many of their applications are
 * still waiting on somebody else; finished ones never hold a slot.
 */
export function assertWithinApplicationLimit(
  membership: MembershipDoc | null,
  pending: number,
  now = new Date(),
) {
  if (!membership) return; // No record yet means nothing has been charged for: let them through.
  const limit = limitsFor(membership, now).activeApplications;
  if (limit !== null && pending >= limit)
    throw new HttpError(
      403,
      'PLAN_LIMIT_REACHED',
      `Your plan allows ${limit} applications at a time. Withdraw one, or wait for an answer, before applying again.`,
    );
}
