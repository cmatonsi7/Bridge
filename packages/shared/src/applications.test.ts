import { describe, expect, it } from 'vitest';
import {
  ORG_TRANSITIONS,
  WITHDRAWABLE,
  applicationId,
  applySchema,
  statusChangeSchema,
} from './applications.js';

describe('applications', () => {
  it('builds a deterministic id so one person applies once per listing', () => {
    expect(applicationId('L1', 'u1')).toBe('L1_u1');
  });
  it('normalises an empty note and rejects bad listing ids', () => {
    expect(applySchema.parse({ listingId: 'abc123', note: '  ' }).note).toBeNull();
    expect(applySchema.parse({ listingId: 'abc123' }).note).toBeNull();
    expect(applySchema.safeParse({ listingId: '../x' }).success).toBe(false);
    expect(applySchema.safeParse({ listingId: 'abc', note: 'x'.repeat(501) }).success).toBe(false);
  });
  it('only lets organisations set review statuses', () => {
    expect(statusChangeSchema.safeParse({ status: 'accepted' }).success).toBe(true);
    expect(statusChangeSchema.safeParse({ status: 'withdrawn' }).success).toBe(false);
    expect(statusChangeSchema.safeParse({ status: 'submitted' }).success).toBe(false);
  });
  it('has final states with no way back', () => {
    expect(ORG_TRANSITIONS.accepted).toEqual([]);
    expect(ORG_TRANSITIONS.declined).toEqual([]);
    expect(ORG_TRANSITIONS.withdrawn).toEqual([]);
    expect(WITHDRAWABLE).not.toContain('declined');
  });
});
