import type { Sport } from '@sportbridge/shared';

/** Stock photo per sport until organisations can upload their own images (needs Storage / Blaze). */
const BY_SPORT: Partial<Record<Sport, string>> = {
  Football: '/images/football-bursary.webp',
  Rugby: '/images/rugby-user-image.webp',
  Cricket: '/images/cricket-user-image.webp',
  Netball: '/images/netball-user-image.webp',
  Athletics: '/images/athletics-user-image.webp',
  Hockey: '/images/hockey-user-image.webp',
  Golf: '/images/golf-user-image.webp',
  Swimming: '/images/swim-fitness.webp',
};

export const listingImage = (sports: readonly string[]) =>
  BY_SPORT[sports[0] as Sport] ?? '/images/opportunities.webp';
