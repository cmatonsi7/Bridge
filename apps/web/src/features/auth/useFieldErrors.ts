import { useState } from 'react';
import type { ZodError } from 'zod';

export type FieldErrors = Record<string, string | undefined>;

export function useFieldErrors() {
  const [errors, setErrors] = useState<FieldErrors>({});
  const fromZod = (err: ZodError) => {
    const next: FieldErrors = {};
    for (const issue of err.issues) {
      const key = String(issue.path[0] ?? 'form');
      if (!next[key]) next[key] = issue.message;
    }
    setErrors(next);
    return next;
  };
  const fromApi = (fields?: Record<string, string[] | undefined>) => {
    const next: FieldErrors = {};
    for (const [k, v] of Object.entries(fields ?? {})) if (v?.[0]) next[k] = v[0];
    setErrors(next);
  };
  return { errors, setErrors, fromZod, fromApi, clear: () => setErrors({}) };
}
