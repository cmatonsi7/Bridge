import { useState } from 'react';
import { saveListing, unsaveListing, useSaved, type ListingWithId } from './listingsService';
import { useToast } from '../../components/Toast';

/** Saved state for the signed-in member, with optimistic-free toggling and a toast. */
export function useSaveToggle(uid: string | undefined) {
  const saved = useSaved(uid);
  const toast = useToast();
  const [busy, setBusy] = useState<string | null>(null);
  const ids = new Set(saved.status === 'ready' ? saved.data.map((s) => s.listingId) : []);
  async function toggle(l: ListingWithId) {
    if (!uid || busy) return;
    setBusy(l.id);
    try {
      if (ids.has(l.id)) {
        await unsaveListing(uid, l.id);
        toast('Removed from saved');
      } else {
        await saveListing(uid, l);
        toast('Saved');
      }
    } catch {
      toast('Couldn’t update saved items. Try again.');
    } finally {
      setBusy(null);
    }
  }
  return { saved, ids, toggle };
}
