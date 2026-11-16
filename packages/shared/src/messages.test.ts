import { describe, expect, it } from 'vitest';
import {
  canRead,
  canWrite,
  membership,
  previewOf,
  sendMessageSchema,
  sortThreads,
  threadIdFor,
  MESSAGE_MAX,
} from './messages.js';

const adults = [
  { uid: 'coach1', displayName: 'Coach One', role: 'coach' },
  { uid: 'athlete1', displayName: 'Athlete One', role: 'athlete' },
];

describe('thread identity', () => {
  it('derives the id from the relationship, so a thread cannot be created twice', () => {
    expect(threadIdFor('connection', 'coach1_athlete1')).toBe('connection_coach1_athlete1');
    expect(threadIdFor('application', 'app123')).toBe('application_app123');
  });
});

describe('who is in a thread', () => {
  it('puts only the two sides in an adult thread', () => {
    const m = membership(adults, [], false);
    expect(m.participantUids.sort()).toEqual(['athlete1', 'coach1']);
    expect(m.writerUids.sort()).toEqual(['athlete1', 'coach1']);
    expect(m.guardianUids).toEqual([]);
    expect(m.hasMinor).toBe(false);
  });

  it("adds a child's guardians as readers AND writers, and leaves the child able to speak", () => {
    const m = membership(adults, ['mum', 'dad'], true);
    expect(m.participantUids.sort()).toEqual(['athlete1', 'coach1', 'dad', 'mum']);
    // Option (a): the child keeps their own voice, with a parent reading everything.
    expect(m.writerUids).toContain('athlete1');
    expect(m.writerUids).toContain('mum');
    expect(m.guardianUids.sort()).toEqual(['dad', 'mum']);
    expect(m.hasMinor).toBe(true);
  });

  it('ignores guardians on an adult thread even if some are passed in', () => {
    expect(membership(adults, ['mum'], false).participantUids).not.toContain('mum');
  });

  it('never lists anyone twice', () => {
    const m = membership(adults, ['coach1', 'mum', 'mum'], true);
    expect(m.participantUids.filter((u) => u === 'coach1')).toHaveLength(1);
    expect(m.participantUids.filter((u) => u === 'mum')).toHaveLength(1);
  });
});

describe('reading and writing', () => {
  const open = { participantUids: ['a', 'b', 'mum'], writerUids: ['a', 'b', 'mum'], status: 'open' as const };

  it('lets a participant read and write an open thread', () => {
    expect(canRead(open, 'a')).toBe(true);
    expect(canWrite(open, 'mum')).toBe(true);
  });

  it('keeps a stranger out entirely', () => {
    expect(canRead(open, 'nosy')).toBe(false);
    expect(canWrite(open, 'nosy')).toBe(false);
  });

  it('still lets everyone read a closed thread, but nobody write to it', () => {
    const closed = { ...open, status: 'closed' as const };
    expect(canRead(closed, 'a')).toBe(true);
    expect(canWrite(closed, 'a')).toBe(false);
  });
});

describe('presentation helpers', () => {
  it('leaves a short message alone and cuts a long one', () => {
    expect(previewOf('hello')).toBe('hello');
    const long = 'x'.repeat(200);
    expect(previewOf(long)).toHaveLength(120);
    expect(previewOf(long).endsWith('…')).toBe(true);
  });

  it('puts the thread with the newest message first, and falls back to when it was created', () => {
    const sorted = sortThreads([
      { lastMessageAt: null, createdAt: '2026-01-02T00:00:00.000Z' },
      { lastMessageAt: '2026-03-01T00:00:00.000Z', createdAt: '2026-01-01T00:00:00.000Z' },
      { lastMessageAt: null, createdAt: '2026-02-01T00:00:00.000Z' },
    ]);
    expect(sorted.map((t) => t.lastMessageAt ?? t.createdAt)).toEqual([
      '2026-03-01T00:00:00.000Z',
      '2026-02-01T00:00:00.000Z',
      '2026-01-02T00:00:00.000Z',
    ]);
  });
});

describe('the message itself', () => {
  it('rejects an empty or whitespace-only message', () => {
    expect(sendMessageSchema.safeParse({ body: '   ' }).success).toBe(false);
  });

  it('rejects a message past the limit and trims the rest', () => {
    expect(sendMessageSchema.safeParse({ body: 'x'.repeat(MESSAGE_MAX + 1) }).success).toBe(false);
    expect(sendMessageSchema.parse({ body: '  hi  ' }).body).toBe('hi');
  });
});
