import { useEffect, useState } from 'react';
import {
  collection,
  deleteDoc,
  doc,
  limit,
  onSnapshot,
  query,
  setDoc,
  updateDoc,
  where,
  addDoc,
} from 'firebase/firestore';
import {
  COLLECTIONS,
  listingSchema,
  type ListingDoc,
  type ListingInput,
  type ListingKind,
  type OrganisationFullDoc,
  type SavedListingDoc,
} from '@sportbridge/shared';
import { requireDb } from '../../lib/firebase';
import type { Loadable } from '../athlete/athleteService';

export type ListingWithId = ListingDoc & { id: string };
const LISTINGS = 'listings';
const SAVED = 'saved';
const LOAD_ERROR = 'We couldn’t load listings. Check your connection and refresh.';
const nowIso = () => new Date().toISOString();
/** Safety cap. Filtering happens on the device (Firestore has no free-text search). */
const MAX_LISTINGS = 300;

function useQueryList<T>(
  build: (() => ReturnType<typeof query>) | null,
  deps: unknown[],
): Loadable<(T & { id: string })[]> {
  const [state, setState] = useState<Loadable<(T & { id: string })[]>>({ status: 'loading' });
  useEffect(() => {
    if (!build) return;
    let q;
    try {
      q = build();
    } catch {
      setState({ status: 'error', message: LOAD_ERROR });
      return;
    }
    return onSnapshot(
      q,
      (snap) => setState({ status: 'ready', data: snap.docs.map((d) => ({ id: d.id, ...(d.data() as T) })) }),
      () => setState({ status: 'error', message: LOAD_ERROR }),
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
  return state;
}

/** Published listings of one kind (public: works signed out). */
export const usePublishedListings = (kind: ListingKind) =>
  useQueryList<ListingDoc>(
    () =>
      query(
        collection(requireDb(), LISTINGS),
        where('status', '==', 'published'),
        where('kind', '==', kind),
        limit(MAX_LISTINGS),
      ),
    [kind],
  );

/** An organisation's published listings, for its directory profile. */
export const useOrgListings = (orgId: string | undefined) =>
  useQueryList<ListingDoc>(
    orgId
      ? () =>
          query(
            collection(requireDb(), LISTINGS),
            where('orgId', '==', orgId),
            where('status', '==', 'published'),
            limit(50),
          )
      : null,
    [orgId],
  );

/** Every listing an organisation owner has created, drafts included. */
export const useMyListings = (ownerUid: string | undefined) =>
  useQueryList<ListingDoc>(
    ownerUid
      ? () => query(collection(requireDb(), LISTINGS), where('ownerUid', '==', ownerUid), limit(MAX_LISTINGS))
      : null,
    [ownerUid],
  );

export function useListing(id: string | undefined): Loadable<ListingWithId | null> {
  const [state, setState] = useState<Loadable<ListingWithId | null>>({ status: 'loading' });
  useEffect(() => {
    if (!id) return;
    let ref;
    try {
      ref = doc(requireDb(), LISTINGS, id);
    } catch {
      setState({ status: 'error', message: LOAD_ERROR });
      return;
    }
    return onSnapshot(
      ref,
      (snap) =>
        setState({
          status: 'ready',
          data: snap.exists() ? { id: snap.id, ...(snap.data() as ListingDoc) } : null,
        }),
      // A draft you don't own is unreadable, which is the same as "not found" to the visitor.
      () => setState({ status: 'ready', data: null }),
    );
  }, [id]);
  return state;
}

function withOrg(org: OrganisationFullDoc, orgId: string, ownerUid: string) {
  return { orgId, ownerUid, orgName: org.name, orgVerified: org.verified };
}

export async function createListing(
  orgId: string,
  org: OrganisationFullDoc,
  ownerUid: string,
  input: ListingInput,
) {
  const fields = listingSchema.parse(input);
  const ts = nowIso();
  const ref = await addDoc(collection(requireDb(), LISTINGS), {
    ...fields,
    ...withOrg(org, orgId, ownerUid),
    createdAt: ts,
    updatedAt: ts,
    publishedAt: fields.status === 'published' ? ts : null,
  });
  return ref.id;
}

export async function updateListing(
  id: string,
  existing: ListingDoc,
  org: OrganisationFullDoc,
  input: ListingInput,
) {
  const fields = listingSchema.parse(input);
  const ts = nowIso();
  await updateDoc(doc(requireDb(), LISTINGS, id), {
    ...fields,
    // Keep the organisation's current name and verified status in step with the organisation record.
    orgName: org.name,
    orgVerified: org.verified,
    updatedAt: ts,
    publishedAt: fields.status === 'published' ? (existing.publishedAt ?? ts) : existing.publishedAt,
  });
}

/** Closing keeps the listing (and, later, its applications) but takes it out of search. */
export async function closeListing(id: string, org: OrganisationFullDoc) {
  await updateDoc(doc(requireDb(), LISTINGS, id), {
    status: 'closed',
    orgName: org.name,
    orgVerified: org.verified,
    updatedAt: nowIso(),
  });
}

export async function deleteDraft(id: string) {
  await deleteDoc(doc(requireDb(), LISTINGS, id));
}

/** The signed-in member's shortlist. */
export const useSaved = (uid: string | undefined) =>
  useQueryList<SavedListingDoc>(
    uid ? () => query(collection(requireDb(), COLLECTIONS.users, uid, SAVED), limit(500)) : null,
    [uid],
  );

export async function saveListing(uid: string, l: ListingWithId) {
  const saved: SavedListingDoc = { listingId: l.id, kind: l.kind, title: l.title, savedAt: nowIso() };
  await setDoc(doc(requireDb(), COLLECTIONS.users, uid, SAVED, l.id), saved);
}

export async function unsaveListing(uid: string, listingId: string) {
  await deleteDoc(doc(requireDb(), COLLECTIONS.users, uid, SAVED, listingId));
}
