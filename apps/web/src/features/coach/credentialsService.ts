import { useCallback, useEffect, useState } from 'react';
import {
  CREDENTIAL_MAX_BYTES,
  CREDENTIAL_MIME_TYPES,
  type CoachVerificationDoc,
  type CredentialDocRecord,
} from '@sportbridge/shared';
import { apiFetch } from '../../lib/apiClient';
import { requireStorage } from '../../lib/firebase';
import type { Loadable } from '../athlete/athleteService';

const LOAD_ERROR = 'We couldn’t load your credentials. Check your connection and refresh.';

export interface CredentialsView {
  verification: CoachVerificationDoc;
  documents: CredentialDocRecord[];
  qualificationCount: number;
  canSubmit: boolean;
}

/** `null` means nobody is signed in, or this account is not a coach. */
export function useCredentials(uid: string | undefined, isCoach: boolean) {
  const [state, setState] = useState<Loadable<CredentialsView | null>>({ status: 'loading' });
  const load = useCallback(async () => {
    try {
      setState({ status: 'ready', data: await apiFetch<CredentialsView>('/coach/credentials') });
    } catch {
      setState({ status: 'error', message: LOAD_ERROR });
    }
  }, []);
  useEffect(() => {
    if (!uid || !isCoach) {
      setState({ status: 'ready', data: null });
      return;
    }
    void load();
  }, [uid, isCoach, load]);
  return { state, reload: load };
}

/** What the browser checks before it bothers uploading. Storage rules and the API check it again. */
export function fileProblem(file: File): string | null {
  if (!(CREDENTIAL_MIME_TYPES as readonly string[]).includes(file.type)) {
    return 'Upload a PDF, JPEG or PNG.';
  }
  if (file.size === 0) return 'That file is empty.';
  if (file.size > CREDENTIAL_MAX_BYTES) return 'Each document must be under 5 MB.';
  return null;
}

/**
 * Uploads one document and records it.
 *
 * The file goes straight from the browser to Storage, so it never passes through the API. The server
 * hands out the id and path first, which is what stops anyone writing a record that points at somebody
 * else's file.
 */
export async function uploadCredential(file: File, qualificationId: string | null) {
  const problem = fileProblem(file);
  if (problem) throw new Error(problem);
  const { storagePath } = await apiFetch<{ docId: string; storagePath: string }>(
    '/coach/credentials/upload-target',
    { method: 'POST', json: {} },
  );
  const { ref, uploadBytes } = await import('firebase/storage');
  await uploadBytes(ref(requireStorage(), storagePath), file, { contentType: file.type });
  return apiFetch<CredentialDocRecord>('/coach/credentials/documents', {
    method: 'POST',
    json: {
      qualificationId,
      fileName: file.name,
      contentType: file.type,
      sizeBytes: file.size,
      storagePath,
    },
  });
}

export const removeCredential = (docId: string) =>
  apiFetch<{ ok: true }>(`/coach/credentials/documents/${docId}`, { method: 'DELETE' });

export const submitCredentials = () =>
  apiFetch<{ ok: true }>('/coach/credentials/submit', { method: 'POST', json: {} });
