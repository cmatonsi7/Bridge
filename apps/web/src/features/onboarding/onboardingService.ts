import { useEffect, useState } from 'react';
import { collection, limit, onSnapshot, query, where } from 'firebase/firestore';
import type { OrganisationFullDoc, UnclaimedOrganisationInput } from '@sportbridge/shared';
import { requireDb } from '../../lib/firebase';
import { apiFetch } from '../../lib/apiClient';
import type { Loadable } from '../athlete/athleteService';

export type ImportedOrganisation = OrganisationFullDoc & { id: string };

/** A representative takes over a school or club that staff added, using the claim code they were given. */
export const claimOrganisation = (code: string) =>
  apiFetch<{ organisationId: string; name: string }>('/organisations/claim', {
    method: 'POST',
    json: { code },
  });

/** Staff only (the server checks the administrator claim). */
export const addOrganisation = (input: UnclaimedOrganisationInput) =>
  apiFetch<{ id: string; claimCode: string; expiresAt: string }>('/admin/organisations', {
    method: 'POST',
    json: input,
  });
export const newClaimCode = (id: string) =>
  apiFetch<{ claimCode: string; expiresAt: string }>(`/admin/organisations/${id}/claim-code`, {
    method: 'POST',
  });
export const removeOrganisation = (id: string) =>
  apiFetch(`/admin/organisations/${id}/remove`, { method: 'POST' });

/** Organisations staff added. Only administrators can read this list (the security rules enforce it). */
export function useImportedOrganisations(): Loadable<ImportedOrganisation[]> {
  const [state, setState] = useState<Loadable<ImportedOrganisation[]>>({ status: 'loading' });
  useEffect(() => {
    let q;
    try {
      q = query(collection(requireDb(), 'organisations'), where('source', '==', 'staff_import'), limit(500));
    } catch {
      setState({ status: 'error', message: 'We couldn’t load this. Check your connection and refresh.' });
      return;
    }
    return onSnapshot(
      q,
      (snap) =>
        setState({
          status: 'ready',
          data: snap.docs
            .map((d) => ({ id: d.id, ...(d.data() as OrganisationFullDoc) }))
            .sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
        }),
      () => setState({ status: 'error', message: 'We couldn’t load this. You may not have access.' }),
    );
  }, []);
  return state;
}
