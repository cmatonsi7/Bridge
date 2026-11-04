import { useEffect, useState } from 'react';
import {
  collection,
  deleteDoc,
  doc,
  limit,
  onSnapshot,
  query,
  updateDoc,
  where,
  writeBatch,
} from 'firebase/firestore';
import {
  COLLECTIONS,
  type ApplicationDoc,
  type NotificationDoc,
  type StatusChangeInput,
} from '@sportbridge/shared';
import { requireDb } from '../../lib/firebase';
import { apiFetch } from '../../lib/apiClient';
import type { Loadable } from '../athlete/athleteService';

export type ApplicationWithId = ApplicationDoc & { id: string };
export type NotificationWithId = NotificationDoc & { id: string };
const LOAD_ERROR = 'We couldn’t load this. Check your connection and refresh.';

function useApplicationsWhere(
  field: 'applicantUid' | 'ownerUid',
  value: string | undefined,
): Loadable<ApplicationWithId[]> {
  const [state, setState] = useState<Loadable<ApplicationWithId[]>>({ status: 'loading' });
  useEffect(() => {
    if (!value) return;
    let q;
    try {
      q = query(collection(requireDb(), 'applications'), where(field, '==', value), limit(500));
    } catch {
      setState({ status: 'error', message: LOAD_ERROR });
      return;
    }
    return onSnapshot(
      q,
      (snap) =>
        setState({
          status: 'ready',
          data: snap.docs
            .map((d) => ({ id: d.id, ...(d.data() as ApplicationDoc) }))
            .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)),
        }),
      () => setState({ status: 'error', message: LOAD_ERROR }),
    );
  }, [field, value]);
  return state;
}

/** Applications made by an athlete (also used by a verified parent, with the child's uid). */
export const useApplicationsBy = (applicantUid: string | undefined) =>
  useApplicationsWhere('applicantUid', applicantUid);
/** Applications to an organisation owner's listings. */
export const useApplicationsTo = (ownerUid: string | undefined) => useApplicationsWhere('ownerUid', ownerUid);

export const applyTo = (listingId: string, note: string) =>
  apiFetch<{ id: string }>('/applications', { method: 'POST', json: { listingId, note } });
export const setApplicationStatus = (id: string, input: StatusChangeInput) =>
  apiFetch(`/applications/${id}/status`, { method: 'POST', json: input });
export const withdrawApplication = (id: string) =>
  apiFetch(`/applications/${id}/withdraw`, { method: 'POST' });

export function useNotifications(uid: string | undefined): Loadable<NotificationWithId[]> {
  const [state, setState] = useState<Loadable<NotificationWithId[]>>({ status: 'loading' });
  useEffect(() => {
    if (!uid) return;
    let q;
    try {
      q = query(collection(requireDb(), COLLECTIONS.users, uid, 'notifications'), limit(100));
    } catch {
      setState({ status: 'error', message: LOAD_ERROR });
      return;
    }
    return onSnapshot(
      q,
      (snap) =>
        setState({
          status: 'ready',
          data: snap.docs
            .map((d) => ({ id: d.id, ...(d.data() as NotificationDoc) }))
            .sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
        }),
      () => setState({ status: 'error', message: LOAD_ERROR }),
    );
  }, [uid]);
  return state;
}

export const markNotificationRead = (uid: string, id: string) =>
  updateDoc(doc(requireDb(), COLLECTIONS.users, uid, 'notifications', id), { read: true });

export async function markAllNotificationsRead(uid: string, items: NotificationWithId[]) {
  const unread = items.filter((n) => !n.read);
  if (!unread.length) return;
  const batch = writeBatch(requireDb());
  for (const n of unread)
    batch.update(doc(requireDb(), COLLECTIONS.users, uid, 'notifications', n.id), { read: true });
  await batch.commit();
}

export const deleteNotification = (uid: string, id: string) =>
  deleteDoc(doc(requireDb(), COLLECTIONS.users, uid, 'notifications', id));
