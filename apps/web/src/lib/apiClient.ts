import { requireAuth } from './firebase';

export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
    public fields?: Record<string, string[] | undefined>,
  ) {
    super(message);
  }
}

/** Calls the SportBridge API with the signed-in user's Firebase ID token. */
export async function apiFetch<T>(path: string, init: RequestInit & { json?: unknown } = {}): Promise<T> {
  const user = requireAuth().currentUser;
  const headers = new Headers(init.headers);
  if (user) headers.set('Authorization', `Bearer ${await user.getIdToken()}`);
  let body = init.body;
  if (init.json !== undefined) {
    headers.set('Content-Type', 'application/json');
    body = JSON.stringify(init.json);
  }
  let res: Response;
  try {
    res = await fetch(`/api${path}`, { ...init, headers, body });
  } catch {
    throw new ApiError(0, 'NETWORK', 'Could not reach SportBridge. Check your connection and try again.');
  }
  const data = await res.json().catch(() => null);
  if (!res.ok) {
    const e = data?.error ?? {};
    throw new ApiError(
      res.status,
      e.code ?? 'UNKNOWN',
      e.message ?? 'Something went wrong. Try again.',
      e.fields,
    );
  }
  return data as T;
}
