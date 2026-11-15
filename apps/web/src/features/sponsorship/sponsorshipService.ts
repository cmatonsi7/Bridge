import { useEffect, useState } from 'react';
import { collection, limit, onSnapshot, query, where } from 'firebase/firestore';
import type {
  SponsorshipOfferDoc,
  SponsorshipRequestDoc,
  SponsorshipRequestInput,
} from '@sportbridge/shared';
import { requireDb } from '../../lib/firebase';
import { apiFetch } from '../../lib/apiClient';
import type { Loadable } from '../athlete/athleteService';

export type RequestWithId = SponsorshipRequestDoc & { id: string };
export type OfferWithId = SponsorshipOfferDoc & { id: string };
const LOAD_ERROR = 'We couldn’t load this. Check your connection and refresh.';

function useWhere<T>(
  coll: string,
  field: string,
  value: string | undefined,
): Loadable<(T & { id: string })[]> {
  const [state, setState] = useState<Loadable<(T & { id: string })[]>>({ status: 'loading' });
  useEffect(() => {
    if (!value) return;
    let q;
    try {
      q = query(collection(requireDb(), coll), where(field, '==', value), limit(200));
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
            .map((d) => ({ id: d.id, ...(d.data() as T) }))
            .sort((a, b) =>
              String((b as { updatedAt?: string }).updatedAt ?? '').localeCompare(
                String((a as { updatedAt?: string }).updatedAt ?? ''),
              ),
            ),
        }),
      () => setState({ status: 'error', message: LOAD_ERROR }),
    );
  }, [coll, field, value]);
  return state;
}

const REQUESTS = 'sponsorshipRequests';
const OFFERS = 'sponsorshipOffers';

/** Requests anyone signed in (except children) may browse. Expired ones are filtered out by the page. */
export const useOpenRequests = () => useWhere<SponsorshipRequestDoc>(REQUESTS, 'status', 'open');
/** Requests waiting for staff (admins only). */
export const usePendingRequests = () => useWhere<SponsorshipRequestDoc>(REQUESTS, 'status', 'pending_review');
export const useMyRequests = (uid: string | undefined) =>
  useWhere<SponsorshipRequestDoc>(REQUESTS, 'requesterUid', uid);
export const useOffersMade = (uid: string | undefined) =>
  useWhere<SponsorshipOfferDoc>(OFFERS, 'offererUid', uid);
export const useOffersReceived = (uid: string | undefined) =>
  useWhere<SponsorshipOfferDoc>(OFFERS, 'requesterUid', uid);

export const createSponsorshipRequest = (input: SponsorshipRequestInput) =>
  apiFetch<{ id: string; status: string }>('/sponsorship/requests', { method: 'POST', json: input });
export const closeSponsorshipRequest = (id: string) =>
  apiFetch(`/sponsorship/requests/${id}/close`, { method: 'POST' });
export const reportSponsorshipRequest = (id: string, reason: string) =>
  apiFetch(`/sponsorship/requests/${id}/report`, { method: 'POST', json: { reason } });
export const offerHelp = (requestId: string, message: string) =>
  apiFetch<{ id: string }>(`/sponsorship/requests/${requestId}/offers`, {
    method: 'POST',
    json: { message },
  });
export const answerOffer = (id: string, accept: boolean) =>
  apiFetch(`/sponsorship/offers/${id}/respond`, { method: 'POST', json: { accept } });
export const withdrawOffer = (id: string) =>
  apiFetch(`/sponsorship/offers/${id}/withdraw`, { method: 'POST' });
export const reviewSponsorshipRequest = (id: string, approve: boolean, note: string) =>
  apiFetch(`/admin/sponsorship/requests/${id}/review`, { method: 'POST', json: { approve, note } });

export const rand = (n: number) => `R${n.toLocaleString('en-ZA').replace(/,/g, ' ')}`;
export const daysLeft = (expiresAt: string, now = Date.now()) =>
  Math.max(0, Math.ceil((Date.parse(expiresAt) - now) / 86400000));
