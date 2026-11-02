export const AGE_OF_MAJORITY = 18;
/** Minimum age to hold an account at all (younger children are added by a guardian in Phase 2). */
export const MINIMUM_SELF_REGISTRATION_AGE = 13;

/** Parses YYYY-MM-DD strictly and returns a UTC date, or null when invalid. */
export function parseIsoDate(value: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!m) return null;
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const date = new Date(Date.UTC(y, mo - 1, d));
  if (date.getUTCFullYear() !== y || date.getUTCMonth() !== mo - 1 || date.getUTCDate() !== d) return null;
  return date;
}

/** Whole years between dob and `now`, using calendar dates (birthday not yet reached counts as previous year). */
export function ageOn(dob: Date, now: Date): number {
  let age = now.getUTCFullYear() - dob.getUTCFullYear();
  const beforeBirthday =
    now.getUTCMonth() < dob.getUTCMonth() ||
    (now.getUTCMonth() === dob.getUTCMonth() && now.getUTCDate() < dob.getUTCDate());
  if (beforeBirthday) age -= 1;
  return age;
}

export function isMinor(dob: Date, now: Date): boolean {
  return ageOn(dob, now) < AGE_OF_MAJORITY;
}
