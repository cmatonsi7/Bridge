import { describe, expect, it } from 'vitest';
import {
  filterListings,
  formatDate,
  formatPrice,
  isOpen,
  listingSchema,
  type ListingDoc,
} from './listings.js';

const future = (days: number) => new Date(Date.now() + days * 86400000).toISOString().slice(0, 10);
const valid = {
  kind: 'opportunity' as const,
  type: 'Trial' as const,
  title: 'U17 Provincial Trials',
  description: 'Open trials for the provincial U17 squad.',
  sports: ['Football' as const],
  province: 'Gauteng' as const,
  city: 'Soweto',
  ageMin: 14,
  ageMax: 17,
  deadline: future(10),
  startDate: '',
  endDate: '',
  isFree: true,
  priceZar: null,
  inclusions: [],
  status: 'published' as const,
};

describe('listingSchema', () => {
  it('accepts a valid free listing and normalises empty dates', () => {
    const r = listingSchema.parse(valid);
    expect(r.startDate).toBeNull();
    expect(r.priceZar).toBeNull();
  });
  it('requires a price for paid listings and drops it for free ones', () => {
    expect(listingSchema.safeParse({ ...valid, isFree: false, priceZar: null }).success).toBe(false);
    expect(listingSchema.parse({ ...valid, isFree: true, priceZar: 500 }).priceZar).toBeNull();
    expect(listingSchema.parse({ ...valid, isFree: false, priceZar: 850 }).priceZar).toBe(850);
  });
  it('rejects an inverted age range, bad dates and a past deadline when publishing', () => {
    expect(listingSchema.safeParse({ ...valid, ageMin: 18, ageMax: 14 }).success).toBe(false);
    expect(listingSchema.safeParse({ ...valid, deadline: '2026-02-30' }).success).toBe(false);
    expect(listingSchema.safeParse({ ...valid, deadline: '2020-01-01' }).success).toBe(false);
    expect(listingSchema.safeParse({ ...valid, deadline: '2020-01-01', status: 'draft' }).success).toBe(true);
    expect(listingSchema.safeParse({ ...valid, startDate: future(20), endDate: future(15) }).success).toBe(
      false,
    );
  });
  it('rejects values outside the fixed lists', () => {
    expect(listingSchema.safeParse({ ...valid, type: 'Raffle' }).success).toBe(false);
    expect(listingSchema.safeParse({ ...valid, sports: [] }).success).toBe(false);
  });
});

const doc = (over: Partial<ListingDoc>): ListingDoc => ({
  ...(listingSchema.parse(valid) as ListingDoc),
  status: 'published',
  orgId: 'o',
  ownerUid: 'u',
  orgName: 'Soweto FC',
  orgVerified: false,
  createdAt: '',
  updatedAt: '',
  publishedAt: null,
  ...over,
});

describe('filterListings', () => {
  const today = '2026-11-04';
  const items = [
    doc({
      title: 'Netball Camp',
      sports: ['Netball'],
      deadline: '2026-12-01',
      isFree: false,
      priceZar: 850,
      ageMin: 10,
      ageMax: 13,
    }),
    doc({ title: 'Football Trials', sports: ['Football'], deadline: '2026-11-20' }),
    doc({ title: 'Old Trial', deadline: '2026-10-01' }),
    doc({ title: 'Draft', status: 'draft', deadline: '2026-12-31' }),
  ];
  it('hides closed and unpublished listings and sorts by closing date', () => {
    expect(filterListings(items, {}, today).map((l) => l.title)).toEqual(['Football Trials', 'Netball Camp']);
  });
  it('filters by sport, cost, age band and text', () => {
    expect(filterListings(items, { sport: 'Netball' }, today).map((l) => l.title)).toEqual(['Netball Camp']);
    expect(filterListings(items, { cost: 'free' }, today).map((l) => l.title)).toEqual(['Football Trials']);
    expect(filterListings(items, { ageBand: 'u13' }, today).map((l) => l.title)).toEqual(['Netball Camp']);
    expect(filterListings(items, { query: 'soweto' }, today)).toHaveLength(2);
  });
  it('knows when a listing is open', () => {
    expect(isOpen({ status: 'published', deadline: '2026-11-04' }, today)).toBe(true);
    expect(isOpen({ status: 'closed', deadline: '2026-12-01' }, today)).toBe(false);
  });
});

describe('formatting', () => {
  it('formats dates and prices', () => {
    expect(formatDate('2026-12-16')).toBe('16 Dec 2026');
    expect(formatPrice({ isFree: false, priceZar: 1200 })).toMatch(/^R1.200$/);
    expect(formatPrice({ isFree: true, priceZar: null })).toBe('Free');
  });
});
