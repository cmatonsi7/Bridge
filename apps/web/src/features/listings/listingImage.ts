import type { Sport } from '@sportbridge/shared';

/** Stock photo per sport until organisations can upload their own images (needs Storage / Blaze). */
const BY_SPORT: Partial<Record<Sport, string>> = {
  Football: '/images/football-user-image.webp',
  Rugby: '/images/rugby-user-image.webp',
  Cricket: '/images/cricket-user-image.webp',
  Netball: '/images/netball-user-image.webp',
  Athletics: '/images/athletics-user-image.webp',
  Hockey: '/images/hockey-user-image.webp',
  Golf: '/images/golf-user-image.webp',
  Swimming: '/images/swimming-user-image.webp',
  Tennis: '/images/tennis-user-image.webp',
  Basketball: '/images/basketball-user-image.webp',
  Cycling: '/images/cycling-user-image.webp',
  Squash: '/images/squash-user-image.webp',
  Rowing: '/images/rowing-user-image.webp',
};

export const listingImage = (sports: readonly string[]) =>
  BY_SPORT[sports[0] as Sport] ?? '/images/opportunities.webp';
