import { useCallback, useEffect, useState } from 'react';
import type { MessageDoc, ThreadDoc } from '@sportbridge/shared';
import { apiFetch } from '../../lib/apiClient';
import type { Loadable } from '../athlete/athleteService';

/**
 * Messages come from the API rather than straight from Firestore. The server is what decides who is in
 * a thread and whether it is still open, and reading through it keeps that one source of truth.
 */

const LIST_ERROR = 'We couldn’t load your messages. Check your connection and refresh.';
const THREAD_ERROR = 'We couldn’t load this conversation. Check your connection and try again.';

export interface ThreadView {
  thread: ThreadDoc;
  messages: MessageDoc[];
}

/** `null` means nobody is signed in — an answer, not a wait that never ends. */
export function useThreads(uid: string | undefined) {
  const [state, setState] = useState<Loadable<ThreadDoc[] | null>>({ status: 'loading' });
  const load = useCallback(async () => {
    try {
      const { threads } = await apiFetch<{ threads: ThreadDoc[] }>('/messages/threads');
      setState({ status: 'ready', data: threads });
    } catch {
      setState({ status: 'error', message: LIST_ERROR });
    }
  }, []);
  useEffect(() => {
    if (!uid) {
      setState({ status: 'ready', data: null });
      return;
    }
    void load();
  }, [uid, load]);
  return { state, reload: load };
}

/** One conversation and its messages. `null` threadId means none is open yet. */
export function useThread(threadId: string | null) {
  const [state, setState] = useState<Loadable<ThreadView | null>>({ status: 'ready', data: null });
  const load = useCallback(async () => {
    if (!threadId) {
      setState({ status: 'ready', data: null });
      return;
    }
    setState({ status: 'loading' });
    try {
      setState({ status: 'ready', data: await apiFetch<ThreadView>(`/messages/threads/${threadId}`) });
    } catch {
      setState({ status: 'error', message: THREAD_ERROR });
    }
  }, [threadId]);
  useEffect(() => {
    void load();
  }, [load]);
  return { state, reload: load };
}

export const sendMessage = (threadId: string, body: string) =>
  apiFetch<MessageDoc>(`/messages/threads/${threadId}/send`, { method: 'POST', json: { body } });

/** Opens the conversation behind a relationship that already exists. */
export const openThreadFor = (kind: 'connection' | 'application', sourceId: string) =>
  apiFetch<{ thread: ThreadDoc }>('/messages/threads/open', {
    method: 'POST',
    json: { kind, sourceId },
  });

/** The other side of a thread, from the point of view of whoever is reading it. */
export function otherSide(thread: ThreadDoc, uid: string | undefined) {
  const others = thread.participants.filter((p) => p.uid !== uid);
  return others.length > 0 ? others : thread.participants;
}

/** A short, human time for the thread list: today's messages show a time, older ones a date. */
export function when(iso: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  const today = new Date();
  const sameDay =
    d.getFullYear() === today.getFullYear() &&
    d.getMonth() === today.getMonth() &&
    d.getDate() === today.getDate();
  return sameDay
    ? d.toLocaleTimeString('en-ZA', { hour: '2-digit', minute: '2-digit' })
    : d.toLocaleDateString('en-ZA', { day: 'numeric', month: 'short' });
}
