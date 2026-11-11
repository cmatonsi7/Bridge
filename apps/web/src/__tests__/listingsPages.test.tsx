import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import type { ListingDoc, OrganisationFullDoc } from '@sportbridge/shared';
import * as ls from '../features/listings/listingsService';
import { BrowseListingsPage } from '../pages/app/listings/BrowseListingsPage';
import ListingDetailPage from '../pages/app/listings/ListingDetailPage';
import SavedPage from '../pages/app/listings/SavedPage';
import { OrgListingsPage } from '../pages/app/listings/OrgListingsPage';
import ListingEditorPage from '../pages/app/listings/ListingEditorPage';
import { PublicListingsGrid } from '../features/listings/PublicListingsGrid';

const future = (d: number) => new Date(Date.now() + d * 86400000).toISOString().slice(0, 10);
const L = (id: string, over: Partial<ListingDoc> = {}): ListingDoc & { id: string } => ({
  id,
  kind: 'opportunity',
  type: 'Trial',
  title: `Listing ${id}`,
  description: 'Open trials for the provincial squad.',
  sports: ['Football'],
  province: 'Gauteng',
  city: 'Soweto',
  ageMin: 14,
  ageMax: 17,
  deadline: future(10),
  startDate: null,
  endDate: null,
  isFree: true,
  priceZar: null,
  inclusions: [],
  status: 'published',
  orgId: 'org1',
  ownerUid: 'o1',
  orgName: 'Soweto FC',
  orgVerified: false,
  createdAt: 'c',
  updatedAt: 'u',
  publishedAt: 'p',
  ...over,
});
const org: OrganisationFullDoc = {
  name: 'Soweto FC',
  type: 'club',
  ownerUid: 'o1',
  verified: false,
  createdAt: '',
  updatedAt: '',
};
const st = {
  uid: 'a1',
  role: 'athlete',
  status: 'active',
  published: [] as ReturnType<typeof L>[],
  mine: [] as ReturnType<typeof L>[],
  one: null as ReturnType<typeof L> | null,
  saved: [] as { id: string; listingId: string; kind: 'opportunity'; title: string; savedAt: string }[],
};

vi.mock('../features/account/useSignedInUser', () => ({
  useSignedInUser: () => ({
    uid: st.uid,
    email: 'x@example.com',
    user: { uid: st.uid, role: st.role, status: st.status, organisationId: 'org1', displayName: 'X' },
  }),
}));
vi.mock('../features/organisation/useMyOrganisation', () => ({
  useMyOrganisation: () => ({
    me: { uid: st.uid, email: 'x', user: { uid: st.uid } },
    orgId: 'org1',
    org: { status: 'ready', data: org },
  }),
}));
vi.mock('../features/listings/listingsService', () => ({
  usePublishedListings: () => ({ status: 'ready', data: st.published }),
  useMyListings: () => ({ status: 'ready', data: st.mine }),
  useListing: (id?: string) => ({
    status: 'ready',
    data: id ? (st.one && st.one.id === id ? st.one : (st.published.find((l) => l.id === id) ?? null)) : null,
  }),
  useSaved: () => ({ status: 'ready', data: st.saved }),
  saveListing: vi.fn(async () => {}),
  unsaveListing: vi.fn(async () => {}),
  createListing: vi.fn(async () => 'new-id'),
  updateListing: vi.fn(async () => {}),
  closeListing: vi.fn(async () => {}),
  deleteDraft: vi.fn(async () => {}),
}));

vi.mock('../features/auth/AuthProvider', () => ({ useAuth: () => ({ state: { status: 'signedOut' } }) }));
vi.mock('../features/applications/applicationsService', () => ({
  useApplicationsBy: () => ({ status: 'ready', data: [] }),
  applyTo: vi.fn(async () => ({ id: 'x' })),
}));

const at = (path: string, el: JSX.Element, route = path) =>
  render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path={route} element={el} />
        <Route path="*" element={<div>elsewhere</div>} />
      </Routes>
    </MemoryRouter>,
  );

beforeEach(() => {
  Object.assign(st, {
    uid: 'a1',
    role: 'athlete',
    status: 'active',
    published: [],
    mine: [],
    one: null,
    saved: [],
  });
  vi.clearAllMocks();
});

describe('BrowseListingsPage', () => {
  it('shows an honest empty state when nothing is open', () => {
    at('/', <BrowseListingsPage kind="opportunity" />);
    expect(screen.getByText(/No opportunities are open right now/)).toBeTruthy();
  });
  it('lists open listings, filters them and saves one', async () => {
    st.published = [
      L('a', { title: 'Football Trials' }),
      L('b', { title: 'Netball Trials', sports: ['Netball'] }),
      L('c', { title: 'Closed Trials', deadline: '2020-01-01' }),
    ];
    at('/', <BrowseListingsPage kind="opportunity" />);
    expect(screen.getByText('Football Trials')).toBeTruthy();
    expect(screen.queryByText('Closed Trials')).toBeNull();
    fireEvent.change(screen.getByLabelText('Sport'), { target: { value: 'Netball' } });
    expect(screen.queryByText('Football Trials')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Save Netball Trials' }));
    await waitFor(() => expect(ls.saveListing).toHaveBeenCalled());
  });
});

describe('ListingDetailPage', () => {
  it('tells a restricted child they need a parent before applying', () => {
    st.status = 'restricted';
    st.published = [L('a')];
    at('/app/listings/a', <ListingDetailPage />, '/app/listings/:listingId');
    expect(screen.getByText(/parent or guardian needs to confirm your account/)).toBeTruthy();
  });
  it('shows the unverified organisation badge and an edit button only to the owner', () => {
    st.uid = 'o1';
    st.published = [L('a')];
    at('/app/listings/a', <ListingDetailPage />, '/app/listings/:listingId');
    expect(screen.getByText('Organisation not yet verified')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Edit listing' })).toBeTruthy();
  });
  it('handles a missing listing', () => {
    at('/app/listings/zzz', <ListingDetailPage />, '/app/listings/:listingId');
    expect(screen.getByText(/isn’t available/)).toBeTruthy();
  });
});

describe('SavedPage', () => {
  it('shows saved listings and handles ones that have gone', () => {
    st.published = [L('a', { title: 'Still Here' })];
    st.saved = [
      { id: 'a', listingId: 'a', kind: 'opportunity', title: 'Still Here', savedAt: '2' },
      { id: 'g', listingId: 'g', kind: 'opportunity', title: 'Gone Away', savedAt: '1' },
    ];
    at('/', <SavedPage />);
    expect(screen.getByText('Still Here')).toBeTruthy();
    expect(screen.getByText('No longer available.')).toBeTruthy();
  });
});

describe('organisation listings', () => {
  it('lists own listings with the right actions', () => {
    st.uid = 'o1';
    st.mine = [L('p', { title: 'Live Trial' }), L('d', { title: 'My Draft', status: 'draft' })];
    at('/', <OrgListingsPage kind="opportunity" />);
    expect(screen.getByText('Live Trial')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Close' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Delete' })).toBeTruthy();
    expect(screen.getByText(/isn’t verified yet/)).toBeTruthy();
  });
  it('validates and creates a listing', async () => {
    st.uid = 'o1';
    at('/app/listings/new?kind=opportunity', <ListingEditorPage />, '/app/listings/new');
    fireEvent.click(screen.getByRole('button', { name: 'Publish' }));
    expect(await screen.findByText('Check the highlighted fields.')).toBeTruthy();
    expect(ls.createListing).not.toHaveBeenCalled();
    fireEvent.change(screen.getByLabelText('Title'), { target: { value: 'U17 Provincial Trials' } });
    fireEvent.change(screen.getByLabelText('City / town'), { target: { value: 'Soweto' } });
    fireEvent.change(screen.getByLabelText('Province'), { target: { value: 'Gauteng' } });
    fireEvent.change(screen.getByLabelText('Minimum age'), { target: { value: '14' } });
    fireEvent.change(screen.getByLabelText('Maximum age'), { target: { value: '17' } });
    fireEvent.change(screen.getByLabelText('Closing date'), { target: { value: future(20) } });
    fireEvent.change(screen.getByLabelText('Description'), {
      target: { value: 'Open trials for the U17 provincial squad.' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Football' }));
    fireEvent.click(screen.getByRole('button', { name: 'Publish' }));
    await waitFor(() => expect(ls.createListing).toHaveBeenCalled());
    const [orgId, , ownerUid, input] = vi.mocked(ls.createListing).mock.calls[0]!;
    expect(orgId).toBe('org1');
    expect(ownerUid).toBe('o1');
    expect(input).toMatchObject({
      title: 'U17 Provincial Trials',
      status: 'published',
      sports: ['Football'],
      ageMin: 14,
    });
  });
});

describe('PublicListingsGrid', () => {
  it('invites sign-up when nothing is listed', () => {
    at('/', <PublicListingsGrid kind="programme" />);
    expect(screen.getByText('No programmes listed yet')).toBeTruthy();
  });
  it('shows published listings', () => {
    st.published = [L('a', { title: 'Holiday Camp', kind: 'programme', isFree: false, priceZar: 850 })];
    at('/', <PublicListingsGrid kind="programme" />);
    expect(screen.getByText('Holiday Camp')).toBeTruthy();
  });
  it('offers sign-up to visitors on the public empty state', () => {
    at('/', <PublicListingsGrid kind="programme" />);
    expect(screen.getByRole('button', { name: 'Create Account' })).toBeTruthy();
    expect(screen.getByText(/Create a free account/)).toBeTruthy();
  });
});
