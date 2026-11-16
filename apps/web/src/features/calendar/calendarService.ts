import { useEffect, useMemo, useState } from 'react';
import { collection, deleteDoc, doc, onSnapshot, query, setDoc, updateDoc } from 'firebase/firestore';
import { calendarEntrySchema, type CalendarEntryDoc, type CalendarEntryInput } from '@sportbridge/shared';
import { requireDb } from '../../lib/firebase';
import { useApplicationsBy, type ApplicationWithId } from '../applications/applicationsService';
import { useListingsByIds, useMyListings } from '../listings/listingsService';
import type { Loadable } from '../athlete/athleteService';

export type CalendarEntryWithId = CalendarEntryDoc & { id: string };
const LOAD_ERROR = 'We couldn’t load this. Check your connection and refresh.';
const nowIso = () => new Date().toISOString();
const ENTRIES = 'calendarEntries';

/** A single thing to show on the calendar, whatever it came from. */
export interface CalendarItem {
  id: string;
  date: string;
  endDate: string | null;
  title: string;
  subtitle: string | null;
  note: string | null;
  source: 'manual' | 'application' | 'listing';
}

/** The signed-in member's own personal entries — the only kind they can add, edit or remove themselves. */
export function useMyEntries(uid: string | undefined): Loadable<CalendarEntryWithId[]> {
  const [state, setState] = useState<Loadable<CalendarEntryWithId[]>>({ status: 'loading' });
  useEffect(() => {
    if (!uid) return;
    let q;
    try {
      q = query(collection(requireDb(), 'users', uid, ENTRIES));
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
            .map((d) => ({ id: d.id, ...(d.data() as CalendarEntryDoc) }))
            .sort((a, b) => a.date.localeCompare(b.date)),
        }),
      () => setState({ status: 'error', message: LOAD_ERROR }),
    );
  }, [uid]);
  return state;
}

export async function addCalendarEntry(uid: string, input: CalendarEntryInput) {
  const fields = calendarEntrySchema.parse(input);
  const ts = nowIso();
  const ref = doc(collection(requireDb(), 'users', uid, ENTRIES));
  await setDoc(ref, { ...fields, createdAt: ts, updatedAt: ts });
  return ref.id;
}

export async function updateCalendarEntry(uid: string, id: string, input: CalendarEntryInput) {
  const fields = calendarEntrySchema.parse(input);
  await updateDoc(doc(requireDb(), 'users', uid, ENTRIES, id), { ...fields, updatedAt: nowIso() });
}

export async function deleteCalendarEntry(uid: string, id: string) {
  await deleteDoc(doc(requireDb(), 'users', uid, ENTRIES, id));
}

const asItems = (entries: CalendarEntryWithId[]): CalendarItem[] =>
  entries.map((e) => ({
    id: `manual-${e.id}`,
    date: e.date,
    endDate: e.endDate,
    title: e.title,
    subtitle: null,
    note: e.note,
    source: 'manual',
  }));

/** The events behind one person's accepted applications (their own, or — via a parent's access — a child's). */
export function useApplicationEvents(applicantUid: string | undefined): Loadable<CalendarItem[]> {
  const apps = useApplicationsBy(applicantUid);
  const accepted = useMemo<ApplicationWithId[]>(
    () => (apps.status === 'ready' ? apps.data.filter((a) => a.status === 'accepted') : []),
    [apps],
  );
  const listings = useListingsByIds(accepted.map((a) => a.listingId));
  // No uid means this role has nothing of this kind (not "still loading" — that would wait forever,
  // since the underlying Firestore hooks never resolve out of 'loading' when passed no id at all).
  if (!applicantUid) return { status: 'ready', data: [] };
  if (apps.status === 'loading' || (accepted.length > 0 && listings.status === 'loading'))
    return { status: 'loading' };
  if (apps.status === 'error') return apps;
  if (listings.status === 'error') return listings;
  const byId = new Map((listings.status === 'ready' ? listings.data : []).map((l) => [l.id, l]));
  const items: CalendarItem[] = accepted.flatMap((a) => {
    const l = byId.get(a.listingId);
    const date = l?.startDate ?? l?.deadline;
    if (!date) return [];
    return [
      {
        id: `application-${a.id}`,
        date,
        endDate: l?.endDate ?? null,
        title: a.listingTitle,
        subtitle: a.orgName,
        note: null,
        source: 'application' as const,
      },
    ];
  });
  return { status: 'ready', data: items };
}

/** An organisation's own published listings, as calendar events. */
export function useMyListingEvents(ownerUid: string | undefined): Loadable<CalendarItem[]> {
  const listings = useMyListings(ownerUid);
  // Same reasoning as useApplicationEvents: no uid means "not an organisation", permanently — not a
  // transient gap to wait out.
  if (!ownerUid) return { status: 'ready', data: [] };
  if (listings.status !== 'ready') return listings;
  const items: CalendarItem[] = listings.data
    .filter((l) => l.status === 'published')
    .map((l) => ({
      id: `listing-${l.id}`,
      date: l.startDate ?? l.deadline,
      endDate: l.endDate ?? null,
      title: l.title,
      subtitle: l.startDate ? null : 'Applications close',
      note: null,
      source: 'listing' as const,
    }));
  return { status: 'ready', data: items };
}

/** Merges manual entries with derived events and sorts by date. */
export function mergeItems(...groups: CalendarItem[][]): CalendarItem[] {
  return groups.flat().sort((a, b) => a.date.localeCompare(b.date));
}

export { asItems as manualAsItems };
