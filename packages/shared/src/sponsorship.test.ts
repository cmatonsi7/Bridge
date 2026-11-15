import { describe, expect, it } from 'vitest';
import {
  CHILD_SPONSORSHIP_ENABLED,
  ageBand,
  isLiveRequest,
  sponsorshipOfferSchema,
  sponsorshipRequestSchema,
} from './sponsorship.js';

const valid = {
  title: 'Boots for the season',
  story: 'My boots split and I need new ones for league games.',
  category: 'Kit & equipment',
  amountZar: '900',
  sport: 'Football',
  province: 'Gauteng',
};

describe('sponsorship', () => {
  it('accepts a sensible request and turns the amount into a whole number of rand', () => {
    const r = sponsorshipRequestSchema.parse(valid);
    expect(r.amountZar).toBe(900);
    expect(r.forChildUid).toBeNull();
  });
  it('refuses tiny, huge or fractional amounts and empty stories', () => {
    for (const amountZar of [10, 200000, 99.5])
      expect(sponsorshipRequestSchema.safeParse({ ...valid, amountZar }).success).toBe(false);
    expect(sponsorshipRequestSchema.safeParse({ ...valid, story: 'help' }).success).toBe(false);
  });
  it('needs a real message to offer help', () => {
    expect(sponsorshipOfferSchema.safeParse({ message: 'hi' }).success).toBe(false);
    expect(sponsorshipOfferSchema.safeParse({ message: 'I can cover the boots.' }).success).toBe(true);
  });
  it('groups ages without revealing an exact age', () => {
    expect([12, 13, 15, 16, 17, 18, 40].map(ageBand)).toEqual([
      'Under 13',
      '13–15',
      '13–15',
      '16–18',
      '16–18',
      'Adult',
      'Adult',
    ]);
  });
  it('treats a request as live only while open and before it expires', () => {
    const now = new Date('2026-11-16T10:00:00Z');
    expect(isLiveRequest({ status: 'open', expiresAt: '2026-12-01T00:00:00Z' }, now)).toBe(true);
    expect(isLiveRequest({ status: 'open', expiresAt: '2026-11-01T00:00:00Z' }, now)).toBe(false);
    expect(isLiveRequest({ status: 'pending_review', expiresAt: '2026-12-01T00:00:00Z' }, now)).toBe(false);
  });
  it('keeps requests for children switched off until the legal question is answered', () => {
    expect(CHILD_SPONSORSHIP_ENABLED).toBe(false);
  });
});
