import { describe, expect, it } from 'vitest';
import {
  PLAN_LIMITS,
  effectiveStatus,
  limitsFor,
  startingPlan,
  trialDaysLeft,
  upgradeInterestSchema,
  type MembershipDoc,
} from './membership.js';

const now = new Date('2026-11-16T12:00:00.000Z');
const m = (over: Partial<MembershipDoc> = {}): MembershipDoc => ({
  uid: 'u1',
  plan: 'starter',
  status: 'free',
  billingPeriod: null,
  trialEndsAt: null,
  interest: null,
  createdAt: now.toISOString(),
  updatedAt: now.toISOString(),
  ...over,
});

describe('membership plans', () => {
  it('starts organisations on a trial and everyone else free', () => {
    expect(startingPlan('organisation')).toEqual({ plan: 'organisation', status: 'trialing' });
    for (const role of ['athlete', 'coach', 'guardian', undefined])
      expect(startingPlan(role)).toEqual({ plan: 'starter', status: 'free' });
  });

  it('treats a trial that has run out as lapsed, whatever the stored status says', () => {
    const live = m({ plan: 'organisation', status: 'trialing', trialEndsAt: '2026-12-01T00:00:00.000Z' });
    const over = m({ plan: 'organisation', status: 'trialing', trialEndsAt: '2026-11-01T00:00:00.000Z' });
    expect(effectiveStatus(live, now)).toBe('trialing');
    expect(effectiveStatus(over, now)).toBe('lapsed');
  });

  it('gives an organisation everything during the trial and one live listing after it', () => {
    const live = m({ plan: 'organisation', status: 'trialing', trialEndsAt: '2026-12-01T00:00:00.000Z' });
    const over = m({ plan: 'organisation', status: 'trialing', trialEndsAt: '2026-11-01T00:00:00.000Z' });
    expect(limitsFor(live, now)).toBe(PLAN_LIMITS.organisation);
    expect(limitsFor(over, now)).toBe(PLAN_LIMITS.organisationLapsed);
    expect(limitsFor(over, now).liveListings).toBe(1);
  });

  it('caps a Starter account and frees a paid Pro one', () => {
    expect(limitsFor(m(), now).activeApplications).toBe(3);
    expect(limitsFor(m({ plan: 'pro', status: 'active' }), now).activeApplications).toBeNull();
    // Pro without an active subscription is still only Starter: nothing is unlocked before payment.
    expect(limitsFor(m({ plan: 'pro', status: 'free' }), now).activeApplications).toBe(3);
  });

  it('counts whole trial days left and never goes negative', () => {
    expect(trialDaysLeft({ trialEndsAt: '2026-11-26T12:00:00.000Z' }, now)).toBe(10);
    expect(trialDaysLeft({ trialEndsAt: '2026-11-01T00:00:00.000Z' }, now)).toBe(0);
    expect(trialDaysLeft({ trialEndsAt: null }, now)).toBe(0);
  });

  it('accepts an upgrade choice and refuses a nonsense one', () => {
    expect(upgradeInterestSchema.parse({ plan: 'pro', billingPeriod: 'annual' })).toEqual({
      plan: 'pro',
      billingPeriod: 'annual',
    });
    expect(() => upgradeInterestSchema.parse({ plan: 'starter', billingPeriod: 'annual' })).toThrow();
    expect(() => upgradeInterestSchema.parse({ plan: 'pro', billingPeriod: 'weekly' })).toThrow();
  });
});
