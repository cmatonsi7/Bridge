import { useEffect, useState } from 'react';
import { doc, onSnapshot, updateDoc } from 'firebase/firestore';
import {
  COLLECTIONS,
  orgPrivacySchema,
  organisationProfileSchema,
  type OrgPrivacy,
  type OrganisationFullDoc,
  type OrganisationProfileInput,
} from '@sportbridge/shared';
import { requireDb } from '../../lib/firebase';
import type { Loadable } from '../athlete/athleteService';

const nowIso = () => new Date().toISOString();

/** Live organisations/{orgId}. Only the owner (and admins) can read it. */
export function useOrganisation(orgId: string | undefined): Loadable<OrganisationFullDoc | null> {
  const [state, setState] = useState<Loadable<OrganisationFullDoc | null>>({ status: 'loading' });
  useEffect(() => {
    if (!orgId) return;
    return onSnapshot(
      doc(requireDb(), COLLECTIONS.organisations, orgId),
      (snap) =>
        setState({ status: 'ready', data: snap.exists() ? (snap.data() as OrganisationFullDoc) : null }),
      () =>
        setState({
          status: 'error',
          message: 'We couldn’t load your organisation. Check your connection and refresh.',
        }),
    );
  }, [orgId]);
  return state;
}

export async function saveOrganisation(orgId: string, input: OrganisationProfileInput) {
  const fields = organisationProfileSchema.parse(input);
  await updateDoc(doc(requireDb(), COLLECTIONS.organisations, orgId), { ...fields, updatedAt: nowIso() });
}

export async function saveOrgPrivacy(orgId: string, privacy: OrgPrivacy) {
  const p = orgPrivacySchema.parse(privacy);
  await updateDoc(doc(requireDb(), COLLECTIONS.organisations, orgId), { privacy: p, updatedAt: nowIso() });
}

/** Owner's own name, on users/{uid} only (organisation owners have no personal role profile). */
export async function saveOwnerName(uid: string, firstName: string, surname: string) {
  const f = firstName.trim();
  const s = surname.trim();
  if (!f || !s || f.length > 60 || s.length > 60) throw new Error('INVALID_NAME');
  await updateDoc(doc(requireDb(), COLLECTIONS.users, uid), {
    firstName: f,
    surname: s,
    displayName: `${f} ${s}`,
    updatedAt: nowIso(),
  });
}
