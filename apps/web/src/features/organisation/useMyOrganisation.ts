import { useSignedInUser } from '../account/useSignedInUser';
import { useOrganisation } from './orgService';

/** The signed-in owner's organisation (users/{uid}.organisationId, set by the server at sign-up). */
export function useMyOrganisation() {
  const me = useSignedInUser();
  const orgId = me?.user.organisationId;
  const org = useOrganisation(orgId);
  return { me, orgId, org };
}
