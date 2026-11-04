import { useEffect, useState } from 'react';
import { collection, onSnapshot, query, where } from 'firebase/firestore';
import { COLLECTIONS, type GuardianLinkDoc } from '@sportbridge/shared';
import { requireDb } from '../../lib/firebase';
import { apiFetch } from '../../lib/apiClient';
import type { Loadable } from '../athlete/athleteService';

export type LinkWithId = GuardianLinkDoc & { id: string };
const LOAD_ERROR = 'We couldn’t load this. Check your connection and refresh.';

function useLinks(
  field: 'guardianEmail' | 'guardianUid' | 'athleteUid',
  value: string | undefined,
  status?: string,
) {
  const [state, setState] = useState<Loadable<LinkWithId[]>>({ status: 'loading' });
  useEffect(() => {
    if (!value) return;
    const base = collection(requireDb(), COLLECTIONS.guardianLinks);
    const q = status
      ? query(base, where(field, '==', value), where('status', '==', status))
      : query(base, where(field, '==', value));
    return onSnapshot(
      q,
      (snap) =>
        setState({
          status: 'ready',
          data: snap.docs.map((d) => ({ id: d.id, ...(d.data() as GuardianLinkDoc) })),
        }),
      () => setState({ status: 'error', message: LOAD_ERROR }),
    );
  }, [field, value, status]);
  return state;
}

/** Requests addressed to this parent's (verified) email that nobody has answered yet. */
export const usePendingRequests = (email: string | undefined) =>
  useLinks('guardianEmail', email?.toLowerCase(), 'pending');
/** Children this parent has confirmed. */
export const useMyChildren = (guardianUid: string | undefined) =>
  useLinks('guardianUid', guardianUid, 'verified');
/** For an athlete: their own guardian requests (to show what to tell their parent). */
export const useMyGuardianLinks = (athleteUid: string | undefined) => useLinks('athleteUid', athleteUid);

export const confirmRequest = (id: string) => apiFetch(`/guardian/links/${id}/confirm`, { method: 'POST' });
export const declineRequest = (id: string) => apiFetch(`/guardian/links/${id}/decline`, { method: 'POST' });
export const withdrawConsent = (id: string) => apiFetch(`/guardian/links/${id}/revoke`, { method: 'POST' });

/** Parent's name lives on users/{uid}, mirrored to guardianProfiles/{uid}.displayName. */
export async function saveGuardianName(uid: string, firstName: string, surname: string) {
  const { doc, updateDoc } = await import('firebase/firestore');
  const f = firstName.trim();
  const s = surname.trim();
  if (!f || !s || f.length > 60 || s.length > 60) throw new Error('INVALID_NAME');
  const displayName = `${f} ${s}`;
  const ts = new Date().toISOString();
  await updateDoc(doc(requireDb(), COLLECTIONS.users, uid), {
    firstName: f,
    surname: s,
    displayName,
    updatedAt: ts,
  });
  await updateDoc(doc(requireDb(), COLLECTIONS.guardianProfiles, uid), { displayName, updatedAt: ts });
}
