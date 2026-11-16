import { z } from 'zod';

const isoDatePattern = /^\d{4}-\d{2}-\d{2}$/;
const isoDate = (label: string) => z.string().regex(isoDatePattern, `Enter a valid ${label}`);

/** A member's own personal entry (apps/web: Calendar). Automatic entries from applications and
 * listings are derived on the fly from data that already exists, and are never stored here. */
export const calendarEntrySchema = z
  .object({
    title: z.string().trim().min(2, 'Add a title').max(80, 'Keep the title under 80 characters'),
    date: isoDate('date'),
    endDate: isoDate('end date')
      .nullable()
      .optional()
      .transform((v) => v ?? null),
    note: z
      .string()
      .trim()
      .max(300, 'Keep the note under 300 characters')
      .nullable()
      .optional()
      .transform((v) => v || null),
  })
  .refine((v) => !v.endDate || v.endDate >= v.date, {
    message: 'End date must be on or after the start date',
    path: ['endDate'],
  });
export type CalendarEntryInput = z.input<typeof calendarEntrySchema>;
export type CalendarEntryFields = z.output<typeof calendarEntrySchema>;

/** users/{uid}/calendarEntries/{id} as stored. Ownership is implicit in the path. */
export interface CalendarEntryDoc extends CalendarEntryFields {
  createdAt: string;
  updatedAt: string;
}
