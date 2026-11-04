import { ZodError } from 'zod';

export type Errors = Record<string, string | undefined>;

export function zodErrors(err: unknown): Errors | null {
  if (!(err instanceof ZodError)) return null;
  const out: Errors = {};
  for (const i of err.issues) {
    const k = String(i.path[0] ?? 'form');
    out[k] ??= i.message;
  }
  return out;
}

/** Firestore permission errors mean the server rejected the data; show a plain message. */
export function saveErrorMessage(err: unknown): string {
  const code = (err as { code?: string })?.code ?? '';
  if (code === 'permission-denied')
    return 'That change wasn’t allowed. Check the highlighted fields and try again.';
  if (code === 'unavailable') return 'You appear to be offline. Your change will save when you reconnect.';
  return 'Something went wrong while saving. Try again.';
}
