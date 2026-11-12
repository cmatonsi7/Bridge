import { describe, expect, it } from 'vitest';
import {
  connectRequestSchema,
  connectionId,
  filterDirectory,
  isAnswerable,
  isEndable,
  type DirectoryEntryDoc,
} from './directory.js';

const e = (over: Partial<DirectoryEntryDoc>): DirectoryEntryDoc => ({
  uid: 'u',
  role: 'athlete',
  displayName: 'Thabo M',
  sports: ['Football'],
  province: 'Gauteng',
  city: 'Soweto',
  headline: null,
  tags: [],
  updatedAt: '',
  ...over,
});

describe('filterDirectory', () => {
  const items = [
    e({ uid: '1', displayName: 'Thabo M' }),
    e({
      uid: '2',
      displayName: 'Anna K',
      role: 'coach',
      sports: ['Netball'],
      province: 'Western Cape',
      city: 'Cape Town',
    }),
    e({ uid: '3', displayName: 'Soweto FC', role: 'organisation' }),
  ];
  it('sorts by name and filters by role, sport, province and text', () => {
    expect(filterDirectory(items, {}).map((x) => x.displayName)).toEqual(['Anna K', 'Soweto FC', 'Thabo M']);
    expect(filterDirectory(items, { role: 'coach' }).map((x) => x.uid)).toEqual(['2']);
    expect(filterDirectory(items, { sport: 'Netball' }).map((x) => x.uid)).toEqual(['2']);
    expect(filterDirectory(items, { province: 'Gauteng' }).map((x) => x.uid)).toEqual(['3', '1']);
    expect(filterDirectory(items, { query: 'cape' }).map((x) => x.uid)).toEqual(['2']);
  });
});

describe('connections', () => {
  it('builds a stable id and normalises an empty message', () => {
    expect(connectionId('c1', 'a1')).toBe('c1_a1');
    expect(connectRequestSchema.parse({ athleteUid: 'a1', message: '  ' }).message).toBeNull();
    expect(connectRequestSchema.safeParse({ athleteUid: 'a1', message: 'x'.repeat(301) }).success).toBe(
      false,
    );
  });
  it('can only be answered while pending and ended once accepted', () => {
    expect(isAnswerable('pending')).toBe(true);
    expect(isAnswerable('accepted')).toBe(false);
    expect(isEndable('accepted')).toBe(true);
    expect(isEndable('declined')).toBe(false);
  });
});
