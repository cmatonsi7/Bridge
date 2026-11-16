import { describe, expect, it } from 'vitest';
import { calendarEntrySchema } from './calendar.js';

describe('calendarEntrySchema', () => {
  it('accepts a simple one-day entry', () => {
    const r = calendarEntrySchema.parse({ title: 'Morning training', date: '2026-12-01' });
    expect(r).toEqual({ title: 'Morning training', date: '2026-12-01', endDate: null, note: null });
  });

  it('accepts a date range with a note', () => {
    const r = calendarEntrySchema.parse({
      title: 'Provincial trials',
      date: '2026-12-01',
      endDate: '2026-12-03',
      note: 'Bring boots and a water bottle',
    });
    expect(r.endDate).toBe('2026-12-03');
    expect(r.note).toBe('Bring boots and a water bottle');
  });

  it('rejects an end date before the start date', () => {
    expect(() =>
      calendarEntrySchema.parse({ title: 'Trials', date: '2026-12-03', endDate: '2026-12-01' }),
    ).toThrow();
  });

  it('rejects a missing or too-short title, and a bad date', () => {
    expect(() => calendarEntrySchema.parse({ title: 'A', date: '2026-12-01' })).toThrow();
    expect(() => calendarEntrySchema.parse({ title: 'Training', date: 'not-a-date' })).toThrow();
  });

  it('treats an empty note as none', () => {
    const r = calendarEntrySchema.parse({ title: 'Training', date: '2026-12-01', note: '   ' });
    expect(r.note).toBeNull();
  });
});
