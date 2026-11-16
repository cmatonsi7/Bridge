import { describe, expect, it, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useApplicationEvents, useMyListingEvents } from './calendarService';

// Firestore's own onSnapshot never fires for these hooks when they're given no id at all — that's a
// permanent state for a role that doesn't apply (an organisation has no "accepted applications", an
// athlete has no "own listings"), not a transient gap before data loads. A regression here is exactly
// what hung the live Calendar page forever for every role: see PROJECT_STATUS.md.
vi.mock('../applications/applicationsService', () => ({
  useApplicationsBy: vi.fn(() => ({ status: 'loading' })),
}));
vi.mock('../listings/listingsService', () => ({
  useListingsByIds: vi.fn(() => ({ status: 'loading' })),
  useMyListings: vi.fn(() => ({ status: 'loading' })),
}));

describe('calendar derived-event hooks, called with no uid (the permanent case for a role that has none of this kind)', () => {
  it('useApplicationEvents resolves to ready/empty rather than hanging in loading', () => {
    const { result } = renderHook(() => useApplicationEvents(undefined));
    expect(result.current).toEqual({ status: 'ready', data: [] });
  });

  it('useMyListingEvents resolves to ready/empty rather than hanging in loading', () => {
    const { result } = renderHook(() => useMyListingEvents(undefined));
    expect(result.current).toEqual({ status: 'ready', data: [] });
  });
});
