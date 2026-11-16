import { useCallback, useEffect, useState } from 'react';
import type { BillingPeriod, MembershipDoc, MembershipStatus, PlanId, PlanLimits } from '@sportbridge/shared';
import { apiFetch } from '../../lib/apiClient';
import type { Loadable } from '../athlete/athleteService';

/**
 * Membership comes from the API, not straight from Firestore: the record is created on first sight (which is
 * what starts an organisation's trial), and only the server may do that.
 */
export interface MembershipView {
  membership: MembershipDoc;
  status: MembershipStatus;
  limits: PlanLimits;
  trialDaysLeft: number;
}

const LOAD_ERROR = 'We couldn’t load your membership. Check your connection and refresh.';

/** `null` means nobody is signed in — which is an answer, not a wait that never ends. */
export function useMembership(uid: string | undefined) {
  const [state, setState] = useState<Loadable<MembershipView | null>>({ status: 'loading' });
  const load = useCallback(async () => {
    try {
      setState({ status: 'ready', data: await apiFetch<MembershipView>('/membership') });
    } catch {
      setState({ status: 'error', message: LOAD_ERROR });
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

/**
 * Says that this member would like a paid plan. Nothing is charged and nothing is unlocked — there is no
 * payment provider yet. This is the one call that changes when one is chosen.
 */
export const registerUpgradeInterest = (plan: PlanId, billingPeriod: BillingPeriod) =>
  apiFetch<MembershipView>('/membership/interest', { method: 'POST', json: { plan, billingPeriod } });
