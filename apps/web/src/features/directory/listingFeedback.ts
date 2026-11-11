import { LISTING_REASON_MESSAGES } from '@sportbridge/shared';
import type { SyncResult } from './directoryService';

export interface Feedback {
  kind: 'ok' | 'err';
  text: string;
}

/** What to tell someone after they flip the directory switch (their choice is already saved). */
export function listingFeedback(result: SyncResult, wantsListing: boolean): Feedback {
  if (result.listed) return { kind: 'ok', text: 'Saved. You’re now listed in the Talent Directory.' };
  if (!wantsListing) return { kind: 'ok', text: 'Saved. You’re not listed in the Talent Directory.' };
  return {
    kind: 'err',
    text: `Saved, but you’re not listed: ${LISTING_REASON_MESSAGES[result.reason ?? 'SWITCH_OFF']}`,
  };
}

export const SYNC_FAILED: Feedback = {
  kind: 'err',
  text: 'Saved, but we couldn’t update the Talent Directory just now. Switch it off and on again to retry.',
};
