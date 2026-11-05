import { useEffect, useState } from 'react';
import { collection, doc, limit, onSnapshot, query, where } from 'firebase/firestore';
import type { ConnectRequestInput, ConnectionDoc, DirectoryEntryDoc } from '@sportbridge/shared';
import { requireDb } from '../../lib/firebase';
import { apiFetch } from '../../lib/apiClient';
import type { Loadable } from '../athlete/athleteService';

export type DirectoryEntry = DirectoryEntryDoc & { id: string };
export type ConnectionWithId = ConnectionDoc & { id: string };
const LOAD_ERROR = 'We couldn’t load this. Check your connection and refresh.';
const MAX = 300;

export function useDirectory(enabled = true): Loadable<DirectoryEntry[]> {
  const [state, setState] = useState<Loadable<DirectoryEntry[]>>({ status: 'loading' });
  useEffect(() => {
    if (!enabled) return;
    let q;
    try {
      q = query(collection(requireDb(), 'directoryProfiles'), limit(MAX));
    } catch {
      setState({ status: 'error', message: LOAD_ERROR });
      return;
    }
    return onSnapshot(
      q,
      (snap) =>
        setState({
          status: 'ready',
          data: snap.docs.map((d) => ({ id: d.id, ...(d.data() as DirectoryEntryDoc) })),
        }),
      () => setState({ status: 'error', message: LOAD_ERROR }),
    );
  }, [enabled]);
  return state;
}

export function useDirectoryEntry(uid: string | undefined): Loadable<DirectoryEntry | null> {
  const [state, setState] = useState<Loadable<DirectoryEntry | null>>({ status: 'loading' });
  useEffect(() => {
    if (!uid) return;
    let ref;
    try {
      ref = doc(requireDb(), 'directoryProfiles', uid);
    } catch {
      setState({ status: 'error', message: LOAD_ERROR });
      return;
    }
    return onSnapshot(
      ref,
      (snap) =>
        setState({
          status: 'ready',
          data: snap.exists() ? { id: snap.id, ...(snap.data() as DirectoryEntryDoc) } : null,
        }),
      () => setState({ status: 'ready', data: null }),
    );
  }, [uid]);
  return state;
}

function useConnectionsWhere(
  field: 'coachUid' | 'athleteUid',
  value: string | undefined,
): Loadable<ConnectionWithId[]> {
  const [state, setState] = useState<Loadable<ConnectionWithId[]>>({ status: 'loading' });
  useEffect(() => {
    if (!value) return;
    let q;
    try {
      q = query(collection(requireDb(), 'connections'), where(field, '==', value), limit(MAX));
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
            .map((d) => ({ id: d.id, ...(d.data() as ConnectionDoc) }))
            .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)),
        }),
      () => setState({ status: 'error', message: LOAD_ERROR }),
    );
  }, [field, value]);
  return state;
}

export const useCoachConnections = (coachUid: string | undefined) =>
  useConnectionsWhere('coachUid', coachUid);
export const useAthleteConnections = (athleteUid: string | undefined) =>
  useConnectionsWhere('athleteUid', athleteUid);

export const requestConnection = (input: ConnectRequestInput) =>
  apiFetch<{ id: string }>('/connections', { method: 'POST', json: input });
export const acceptConnection = (id: string) => apiFetch(`/connections/${id}/accept`, { method: 'POST' });
export const declineConnection = (id: string) => apiFetch(`/connections/${id}/decline`, { method: 'POST' });
export const endConnection = (id: string) => apiFetch(`/connections/${id}/end`, { method: 'POST' });
/** Rebuilds the caller's own directory entry after they change their privacy settings. */
export const syncDirectory = () => apiFetch<{ listed: boolean }>('/directory/sync', { method: 'POST' });
