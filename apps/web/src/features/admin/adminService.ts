import { useEffect, useState } from 'react';
import {
  collection,
  doc,
  getCountFromServer,
  getDoc,
  getDocs,
  limit,
  onSnapshot,
  orderBy,
  query,
  where,
  type Query,
} from 'firebase/firestore';
import {
  COLLECTIONS,
  isOpen,
  type ListingDoc,
  type OrganisationFullDoc,
  type UserDoc,
} from '@sportbridge/shared';
import { apiFetch } from '../../lib/apiClient';
import { requireDb } from '../../lib/firebase';
import type { Loadable } from '../athlete/athleteService';

/** A figure, or null when it could not be read (shown as "—", never as a misleading 0). */
export type Figure = number | null;

export interface Overview {
  unclaimed: Figure;
  claimedImports: Figure;
  organisationsUnverified: Figure;
  accounts: { athlete: Figure; guardian: Figure; coach: Figure; organisation: Figure };
  liveOpportunities: Figure;
  liveProgrammes: Figure;
  applicationsThisWeek: Figure;
}

async function count(q: Query): Promise<Figure> {
  try {
    return (await getCountFromServer(q)).data().count;
  } catch {
    return null;
  }
}

/** Counts used by the Overview. Administrators only: the security rules refuse everyone else. */
export async function loadOverview(now = new Date()): Promise<Overview> {
  const db = requireDb();
  const orgs = collection(db, COLLECTIONS.organisations);
  const users = collection(db, COLLECTIONS.users);
  const weekAgo = new Date(now.getTime() - 7 * 86400000).toISOString();

  const [unclaimed, claimedImports, orgsUnverified, athlete, guardian, coach, organisation, apps, live] =
    await Promise.all([
      count(query(orgs, where('claimStatus', '==', 'unclaimed'))),
      count(query(orgs, where('source', '==', 'staff_import'), where('claimStatus', '==', 'claimed'))),
      count(query(orgs, where('verified', '==', false))),
      count(query(users, where('role', '==', 'athlete'))),
      count(query(users, where('role', '==', 'guardian'))),
      count(query(users, where('role', '==', 'coach'))),
      count(query(users, where('role', '==', 'organisation'))),
      count(query(collection(db, 'applications'), where('createdAt', '>=', weekAgo))),
      getDocs(query(collection(db, 'listings'), where('status', '==', 'published'), limit(500))).catch(
        () => null,
      ),
    ]);

  const open = live
    ? live.docs.map((d) => d.data() as ListingDoc).filter((l) => isOpen(l, now.toISOString().slice(0, 10)))
    : null;
  return {
    unclaimed,
    claimedImports,
    // Organisations nobody has claimed are always unverified, so they are not "waiting" for anything.
    organisationsUnverified:
      orgsUnverified === null || unclaimed === null ? null : Math.max(0, orgsUnverified - unclaimed),
    accounts: { athlete, guardian, coach, organisation },
    liveOpportunities: open ? open.filter((l) => l.kind === 'opportunity').length : null,
    liveProgrammes: open ? open.filter((l) => l.kind === 'programme').length : null,
    applicationsThisWeek: apps,
  };
}

export function useOverview(): Loadable<Overview> {
  const [state, setState] = useState<Loadable<Overview>>({ status: 'loading' });
  useEffect(() => {
    let live = true;
    loadOverview()
      .then((data) => live && setState({ status: 'ready', data }))
      .catch(
        () =>
          live &&
          setState({
            status: 'error',
            message: 'We couldn’t load the overview. Check your connection and refresh.',
          }),
      );
    return () => {
      live = false;
    };
  }, []);
  return state;
}

export interface ActivityEntry {
  id: string;
  type: string;
  at: string;
  by: string | null;
  byName: string | null;
  organisationName: string | null;
  organisationId: string | null;
  source: string | null;
  note: string | null;
}

/** Only these events are staff-relevant onboarding actions. Other audit entries concern families and are not listed here. */
const ACTIVITY_PREFIX = 'organisation.';

export async function loadActivity(): Promise<ActivityEntry[]> {
  const db = requireDb();
  // The newest entries across everything, narrowed to onboarding events here: it needs no extra database index.
  const snap = await getDocs(query(collection(db, COLLECTIONS.auditLogs), orderBy('at', 'desc'), limit(300)));
  const rows = snap.docs
    .map(
      (d) =>
        ({ id: d.id, ...(d.data() as Record<string, unknown>) }) as Record<string, unknown> & { id: string },
    )
    .filter((r) => typeof r.type === 'string' && (r.type as string).startsWith(ACTIVITY_PREFIX));

  const uids = Array.from(new Set(rows.map((r) => r.by).filter((v): v is string => typeof v === 'string')));
  const names = new Map<string, string>();
  await Promise.all(
    uids.map(async (uid) => {
      try {
        const u = await getDoc(doc(db, COLLECTIONS.users, uid));
        if (u.exists()) names.set(uid, (u.data() as UserDoc).displayName);
      } catch {
        /* a name we cannot read just shows as unknown */
      }
    }),
  );
  return rows.map((r) => ({
    id: r.id,
    type: r.type as string,
    at: typeof r.at === 'string' ? r.at : '',
    by: typeof r.by === 'string' ? r.by : null,
    byName: typeof r.by === 'string' ? (names.get(r.by) ?? null) : null,
    organisationName: typeof r.organisationName === 'string' ? r.organisationName : null,
    organisationId: typeof r.organisationId === 'string' ? r.organisationId : null,
    source: typeof r.source === 'string' ? r.source : null,
    note: typeof r.note === 'string' ? r.note : null,
  }));
}

export function useActivity(): Loadable<ActivityEntry[]> {
  const [state, setState] = useState<Loadable<ActivityEntry[]>>({ status: 'loading' });
  useEffect(() => {
    let live = true;
    loadActivity()
      .then((data) => live && setState({ status: 'ready', data }))
      .catch(
        () =>
          live &&
          setState({
            status: 'error',
            message: 'We couldn’t load the activity log. Check your connection and refresh.',
          }),
      );
    return () => {
      live = false;
    };
  }, []);
  return state;
}

/** Plain-language description of one logged action. */
export function describeActivity(e: ActivityEntry): string {
  const who = e.byName ?? 'A staff member';
  const what = e.organisationName ?? 'an organisation';
  switch (e.type) {
    case 'organisation.imported':
      return `${who} added ${what}${e.source ? ` (source: ${e.source})` : ''}`;
    case 'organisation.claim_code_reset':
      return `${who} created a new claim code for ${what}`;
    case 'organisation.removed':
      return `${who} removed ${what}`;
    case 'organisation.verified':
      return `${who} verified ${what}${e.note ? ` (note: ${e.note})` : ''}`;
    case 'organisation.unverified':
      return `${who} removed the verification from ${what}${e.note ? ` (note: ${e.note})` : ''}`;
    case 'organisation.claimed':
      return `${e.byName ?? 'A representative'} claimed ${what}`;
    default:
      return e.type;
  }
}

export interface QueueItem extends OrganisationFullDoc {
  id: string;
  listingCount: number;
}
export interface VerificationQueue {
  awaiting: QueueItem[];
  verified: QueueItem[];
}

/**
 * Organisations that have an owner, split into awaiting and verified. Updates live. An organisation nobody has
 * claimed is left out: there is nobody yet whose claim could be checked.
 */
export function useVerificationQueue(): Loadable<VerificationQueue> {
  const [state, setState] = useState<{ awaiting: QueueItem[]; verified: QueueItem[] } | null>(null);
  const [error, setError] = useState('');
  useEffect(() => {
    let awaiting: Array<OrganisationFullDoc & { id: string }> | null = null;
    let verified: Array<OrganisationFullDoc & { id: string }> | null = null;
    let counts = new Map<string, number>();
    const publish = () => {
      if (!awaiting || !verified) return;
      const withCount = (o: OrganisationFullDoc & { id: string }): QueueItem => ({
        ...o,
        listingCount: counts.get(o.id) ?? 0,
      });
      setState({
        awaiting: awaiting.map(withCount).sort((a, b) => a.createdAt.localeCompare(b.createdAt)),
        verified: verified
          .map(withCount)
          .sort((a, b) => (b.verifiedAt ?? '').localeCompare(a.verifiedAt ?? '')),
      });
    };
    const fail = () => setError('We couldn’t load organisations. Check your connection and refresh.');
    let db;
    try {
      db = requireDb();
    } catch {
      fail();
      return;
    }
    const orgs = collection(db, COLLECTIONS.organisations);
    const owned = (snap: { docs: Array<{ id: string; data: () => unknown }> }) =>
      snap.docs.map((d) => ({ id: d.id, ...(d.data() as OrganisationFullDoc) })).filter((o) => !!o.ownerUid);
    const u1 = onSnapshot(
      query(orgs, where('verified', '==', false), limit(500)),
      (snap) => {
        awaiting = owned(snap);
        publish();
      },
      fail,
    );
    const u2 = onSnapshot(
      query(orgs, where('verified', '==', true), limit(500)),
      (snap) => {
        verified = owned(snap);
        publish();
      },
      fail,
    );
    getDocs(query(collection(db, 'listings'), limit(2000)))
      .then((snap) => {
        counts = new Map();
        for (const d of snap.docs) {
          const id = (d.data() as ListingDoc).orgId;
          counts.set(id, (counts.get(id) ?? 0) + 1);
        }
        publish();
      })
      .catch(() => undefined); // counts are a convenience; the queue still works without them
    return () => {
      u1();
      u2();
    };
  }, []);
  if (error) return { status: 'error', message: error };
  return state ? { status: 'ready', data: state } : { status: 'loading' };
}

/** Staff only (the server checks). The note is internal and is never shown to the organisation. */
export const verifyOrganisation = (id: string, note: string) =>
  apiFetch<{ ok: true; name: string }>(`/admin/organisations/${id}/verify`, {
    method: 'POST',
    json: { note },
  });
export const removeVerification = (id: string, note: string) =>
  apiFetch<{ ok: true; name: string }>(`/admin/organisations/${id}/unverify`, {
    method: 'POST',
    json: { note },
  });
