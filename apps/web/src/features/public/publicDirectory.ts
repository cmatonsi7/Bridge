import { useEffect, useState } from 'react';
import { collection, doc, getDoc, getDocs, limit, query, where } from 'firebase/firestore';
import { ORGANISATION_TYPE_LABELS, type DirectoryEntryDoc, type OrganisationType } from '@sportbridge/shared';
import { requireDb } from '../../lib/firebase';
import type { Loadable } from '../athlete/athleteService';

/** An organisation as the public sees it. People are never read here: the security rules would refuse. */
export type PublicOrg = DirectoryEntryDoc & { id: string };
const DIRECTORY = 'directoryProfiles';

const BROKEN = 'We couldn’t load organisations right now. Please try again later.';

/** Listed schools, clubs and academies. Needs no sign-in. */
export function usePublicOrganisations(): Loadable<PublicOrg[]> {
  const [state, setState] = useState<Loadable<PublicOrg[]>>({ status: 'loading' });
  useEffect(() => {
    let live = true;
    let q;
    try {
      q = query(collection(requireDb(), DIRECTORY), where('role', '==', 'organisation'), limit(500));
    } catch {
      setState({ status: 'error', message: BROKEN });
      return;
    }
    getDocs(q)
      .then(
        (snap) =>
          live &&
          setState({
            status: 'ready',
            data: snap.docs.map((d) => ({ id: d.id, ...(d.data() as DirectoryEntryDoc) })),
          }),
      )
      .catch(() => live && setState({ status: 'error', message: BROKEN }));
    return () => {
      live = false;
    };
  }, []);
  return state;
}

/** One organisation by its directory key, or null when it is not listed (including when the address is somebody else's). */
export function usePublicOrganisation(key: string | undefined): Loadable<PublicOrg | null> {
  const [state, setState] = useState<Loadable<PublicOrg | null>>({ status: 'loading' });
  useEffect(() => {
    if (!key) {
      setState({ status: 'ready', data: null });
      return;
    }
    let live = true;
    setState({ status: 'loading' });
    getDoc(doc(requireDb(), DIRECTORY, key))
      .then((s) => {
        if (!live) return;
        const data = s.exists() ? ({ id: s.id, ...(s.data() as DirectoryEntryDoc) } as PublicOrg) : null;
        setState({ status: 'ready', data: data && data.role === 'organisation' ? data : null });
      })
      .catch((err: { code?: string }) => {
        if (!live) return;
        // The rules refuse anything that is not an organisation: to a visitor that is simply "not listed".
        if (err?.code === 'permission-denied') setState({ status: 'ready', data: null });
        else setState({ status: 'error', message: BROKEN });
      });
    return () => {
      live = false;
    };
  }, [key]);
  return state;
}

export const orgTypeLabel = (t: string | undefined) =>
  ORGANISATION_TYPE_LABELS[t as OrganisationType] ?? 'Organisation';

export interface OrgFilters {
  q: string;
  sport: string;
  province: string;
  type: string;
}
export const NO_FILTERS: OrgFilters = { q: '', sport: '', province: '', type: '' };

/** Filters on the device: the list is small (a few hundred at most). */
export function filterOrganisations(items: PublicOrg[], f: OrgFilters): PublicOrg[] {
  const q = f.q.trim().toLowerCase();
  return items.filter((o) => {
    if (f.sport && !o.sports.includes(f.sport as never)) return false;
    if (f.province && o.province !== f.province) return false;
    if (f.type && o.orgType !== f.type) return false;
    if (!q) return true;
    const haystack = [o.displayName, o.city, o.province, o.headline, orgTypeLabel(o.orgType), ...o.sports]
      .filter(Boolean)
      .join(' ')
      .toLowerCase();
    return haystack.includes(q);
  });
}

/** Verified first, then organisations with an owner, then the rest, each alphabetically. */
export function sortOrganisations(items: PublicOrg[]): PublicOrg[] {
  const rank = (o: PublicOrg) => (o.verified ? 0 : o.claimed === false ? 2 : 1);
  return [...items].sort((a, b) => rank(a) - rank(b) || a.displayName.localeCompare(b.displayName, 'en'));
}
