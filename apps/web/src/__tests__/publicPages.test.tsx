import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import type { Loadable } from '../features/athlete/athleteService';
import {
  NO_FILTERS,
  filterOrganisations,
  sortOrganisations,
  type PublicOrg,
} from '../features/public/publicDirectory';
import DiscoverPage from '../pages/public/DiscoverPage';
import OrganisationPage from '../pages/public/OrganisationPage';
import HomePage from '../pages/public/HomePage';

const org = (over: Partial<PublicOrg> & { id: string; displayName: string }): PublicOrg => ({
  uid: over.id,
  role: 'organisation',
  sports: ['Football'],
  province: 'Gauteng',
  city: 'Soweto',
  headline: null,
  tags: [],
  orgId: `o-${over.id}`,
  orgType: 'school',
  verified: false,
  claimed: true,
  updatedAt: '',
  ...over,
});
const VERIFIED = org({
  id: 'v1',
  displayName: 'Durban Netball Academy',
  orgType: 'academy',
  sports: ['Netball'],
  province: 'KwaZulu-Natal',
  city: 'Durban',
  verified: true,
  headline: 'Developing netballers since 2010.',
});
const PLAIN = org({
  id: 'p1',
  displayName: 'Test FC',
  orgType: 'club',
  sports: ['Football', 'Rugby'],
  province: 'Limpopo',
  city: 'Polokwane',
});
const UNCLAIMED = org({ id: 'org_u1', displayName: 'Soweto High School', claimed: false });

const future = '2099-01-01';
const listing = (over: Record<string, unknown>) => ({
  id: 'l1',
  kind: 'opportunity',
  type: 'Trial',
  title: 'Football Trials',
  orgName: 'Durban Netball Academy',
  city: 'Durban',
  province: 'KwaZulu-Natal',
  deadline: future,
  sports: ['Netball'],
  isFree: true,
  priceZar: null,
  status: 'published',
  startDate: null,
  endDate: null,
  ageMin: 10,
  ageMax: 18,
  ...over,
});

const st = {
  orgs: { status: 'ready', data: [PLAIN, UNCLAIMED, VERIFIED] } as Loadable<PublicOrg[]>,
  org: { status: 'ready', data: VERIFIED } as Loadable<PublicOrg | null>,
  listings: { status: 'ready', data: [] } as Loadable<Array<Record<string, unknown>>>,
  signedIn: false,
};
const orgListingsSpy = vi.fn();

vi.mock('../features/public/publicDirectory', async () => {
  const actual = await vi.importActual<typeof import('../features/public/publicDirectory')>(
    '../features/public/publicDirectory',
  );
  return { ...actual, usePublicOrganisations: () => st.orgs, usePublicOrganisation: () => st.org };
});
vi.mock('../features/listings/listingsService', () => ({
  useOrgListings: (id: string | undefined) => {
    orgListingsSpy(id);
    return st.listings;
  },
  usePublishedListings: () => ({ status: 'ready', data: [] }),
}));
vi.mock('../features/auth/AuthProvider', () => ({
  useAuth: () => ({
    state: st.signedIn ? { status: 'signedIn', user: { uid: 'u1' } } : { status: 'signedOut' },
  }),
}));

const discover = () =>
  render(
    <MemoryRouter initialEntries={['/discover']}>
      <Routes>
        <Route path="/discover" element={<DiscoverPage />} />
        <Route path="/organisations/:key" element={<div>ORG PAGE</div>} />
      </Routes>
    </MemoryRouter>,
  );
const orgPage = (key = 'v1') =>
  render(
    <MemoryRouter initialEntries={[`/organisations/${key}`]}>
      <Routes>
        <Route path="/organisations/:key" element={<OrganisationPage />} />
        <Route path="/discover" element={<div>DISCOVER</div>} />
      </Routes>
    </MemoryRouter>,
  );

beforeEach(() => {
  st.orgs = { status: 'ready', data: [PLAIN, UNCLAIMED, VERIFIED] };
  st.org = { status: 'ready', data: VERIFIED };
  st.listings = { status: 'ready', data: [] };
  st.signedIn = false;
  orgListingsSpy.mockClear();
});

describe('public Discover page', () => {
  it('shows real organisations, verified first, each saying honestly who vouches for it', () => {
    discover();
    const cards = screen.getAllByRole('link').filter((a) => a.classList.contains('discover-card'));
    expect(cards.map((c) => within(c).getByRole('heading').textContent)).toEqual([
      'Durban Netball Academy',
      'Test FC',
      'Soweto High School',
    ]);
    expect(within(cards[0]!).getByText('Verified')).toBeTruthy();
    expect(within(cards[1]!).getByText('Not yet verified')).toBeTruthy();
    expect(within(cards[2]!).getByText('Added by SportBridge')).toBeTruthy();
    expect(screen.getByText('Showing 3 of 3 organisations')).toBeTruthy();
  });

  it('contains none of the invented people or organisations from the prototype', () => {
    discover();
    const text = document.body.textContent ?? '';
    for (const fake of [
      'Thabo Mokoena',
      'Lerato Dlamini',
      'National Sports Academy',
      'Aqua Elite',
      'Sample profile',
    ])
      expect(text).not.toContain(fake);
  });

  it('filters by sport, province and search, and can clear them', () => {
    discover();
    fireEvent.change(screen.getByLabelText('Sport'), { target: { value: 'Rugby' } });
    expect(screen.getByText('Showing 1 of 3 organisations')).toBeTruthy();
    expect(screen.getByText('Test FC')).toBeTruthy();
    fireEvent.change(screen.getByLabelText('Sport'), { target: { value: '' } });
    fireEvent.change(screen.getByLabelText('Province'), { target: { value: 'KwaZulu-Natal' } });
    expect(screen.getByText('Showing 1 of 3 organisations')).toBeTruthy();
    fireEvent.change(screen.getByLabelText('Province'), { target: { value: '' } });
    fireEvent.change(screen.getByLabelText('Search organisations'), { target: { value: 'soweto' } });
    expect(screen.getByText('Soweto High School')).toBeTruthy();
    expect(screen.queryByText('Test FC')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Clear filters' }));
    expect(screen.getByText('Showing 3 of 3 organisations')).toBeTruthy();
  });

  it('says so when nothing matches, and when nothing is listed at all', () => {
    discover();
    fireEvent.change(screen.getByLabelText('Search organisations'), { target: { value: 'zzzz' } });
    expect(screen.getByText('No organisations match')).toBeTruthy();
    st.orgs = { status: 'ready', data: [] };
    const second = discover();
    expect(within(second.container).getByText('No organisations are listed yet')).toBeTruthy();
    expect(within(second.container).getByRole('link', { name: 'Create a free account' })).toBeTruthy();
  });

  it('shows a plain message when the list cannot be loaded', () => {
    st.orgs = {
      status: 'error',
      message: 'We couldn’t load organisations right now. Please try again later.',
    };
    discover();
    expect(screen.getByRole('alert').textContent).toMatch(/couldn’t load organisations/);
  });

  it('opens an organisation’s own page from its card', () => {
    discover();
    fireEvent.click(screen.getByText('Durban Netball Academy').closest('article')!);
    expect(screen.getByText('ORG PAGE')).toBeTruthy();
  });

  it('never lists athletes or coaches publicly: those tabs point to sign-in', () => {
    discover();
    fireEvent.click(screen.getByRole('tab', { name: 'Athletes' }));
    expect(screen.getByText(/Athletes are visible to signed-in members/)).toBeTruthy();
    expect(screen.getByText(/Under-18s are never listed at all/)).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Sign in' })).toBeTruthy();
    fireEvent.click(screen.getByRole('tab', { name: 'Coaches' }));
    expect(screen.getByText(/Coaches are visible to signed-in members/)).toBeTruthy();
  });

  it('points a signed-in member to the Talent Directory instead', () => {
    st.signedIn = true;
    discover();
    fireEvent.click(screen.getByRole('tab', { name: 'Coaches' }));
    expect(screen.getByRole('link', { name: 'Open the Talent Directory' }).getAttribute('href')).toBe(
      '/app/directory',
    );
    expect(screen.queryByRole('link', { name: 'Sign in' })).toBeNull();
  });
});

describe('public organisation page', () => {
  it('shows who it is, that it is verified, its sports and its open listings', () => {
    st.listings = {
      status: 'ready',
      data: [listing({}), listing({ id: 'l2', title: 'Old Trials', deadline: '2020-01-01' })],
    };
    orgPage();
    expect(screen.getByRole('heading', { name: 'Durban Netball Academy' })).toBeTruthy();
    expect(screen.getByText('Verified organisation')).toBeTruthy();
    expect(screen.getByText('Developing netballers since 2010.')).toBeTruthy();
    expect(screen.getByText('Netball', { selector: '.tag' })).toBeTruthy();
    expect(screen.getByText('Football Trials')).toBeTruthy();
    expect(screen.queryByText('Old Trials')).toBeNull(); // a closed listing is not offered
    expect(orgListingsSpy).toHaveBeenCalledWith('o-v1');
  });

  it('offers a visitor sign-up, and a signed-in member a way into the app', () => {
    orgPage();
    expect(screen.getByRole('link', { name: 'Create a free account' })).toBeTruthy();
    expect(screen.getByText(/never shows contact details publicly/)).toBeTruthy();
  });
  it('a signed-in member gets “Open in SportBridge”', () => {
    st.signedIn = true;
    orgPage('v1');
    expect(screen.getByRole('link', { name: 'Open in SportBridge' }).getAttribute('href')).toBe(
      '/app/directory/v1',
    );
  });

  it('explains an unclaimed school and does not look for listings it cannot have', () => {
    st.org = { status: 'ready', data: UNCLAIMED };
    orgPage('org_u1');
    expect(screen.getByText('Added by SportBridge', { selector: '.discover-note' })).toBeTruthy();
    expect(screen.getByText(/hasn’t been claimed yet, so it can’t post opportunities/)).toBeTruthy();
    expect(screen.queryByText('Open opportunities and programmes')).toBeNull();
    expect(orgListingsSpy).toHaveBeenCalledWith(undefined);
  });

  it('says honestly when an organisation has nothing open, or is not listed', () => {
    orgPage();
    expect(screen.getByText('Nothing is open right now.')).toBeTruthy();
    st.org = { status: 'ready', data: null };
    const second = orgPage('someone-elses-key');
    expect(within(second.container).getByText('This organisation isn’t listed')).toBeTruthy();
    expect(within(second.container).getByRole('link', { name: 'Browse organisations' })).toBeTruthy();
  });

  it('names the page after the organisation', () => {
    orgPage();
    expect(document.title).toBe('Durban Netball Academy — SportBridge');
  });
});

describe('the Home page no longer shows invented content', () => {
  it('has no made-up testimonials or quotes attributed to people', () => {
    render(
      <MemoryRouter>
        <HomePage />
      </MemoryRouter>,
    );
    const text = document.body.textContent ?? '';
    for (const invented of [
      'Nomsa Dlamini',
      'Sibusiso Khumalo',
      'Lauren Peters',
      'REAL PEOPLE. REAL IMPACT.',
      'Sport changed my life',
    ]) {
      expect(text).not.toContain(invented);
    }
    expect(screen.getByText('Choose a plan'.toUpperCase())).toBeTruthy(); // the rest of the page is still there
  });
});

describe('thin pages lead somewhere', () => {
  it('/athletes, /coaches and /clubs go to the fuller Features pages', () => {
    const router = readFileSync(resolve(process.cwd(), 'src/app/router.tsx'), 'utf8');
    for (const [from, to] of [
      ['athletes', 'athletes'],
      ['coaches', 'coaches'],
      ['clubs', 'organisations'],
    ]) {
      expect(router).toMatch(
        new RegExp(`path:\\s*'/${from}',\\s*element:\\s*<Navigate\\s+to="/features/${to}"\\s+replace`),
      );
    }
  });
});

describe('organisation filtering and order', () => {
  const all = [PLAIN, UNCLAIMED, VERIFIED];
  it('filters by sport, province, type and text', () => {
    expect(filterOrganisations(all, { ...NO_FILTERS, sport: 'Rugby' }).map((o) => o.id)).toEqual(['p1']);
    expect(filterOrganisations(all, { ...NO_FILTERS, province: 'Gauteng' }).map((o) => o.id)).toEqual([
      'org_u1',
    ]);
    expect(filterOrganisations(all, { ...NO_FILTERS, type: 'academy' }).map((o) => o.id)).toEqual(['v1']);
    expect(filterOrganisations(all, { ...NO_FILTERS, q: 'POLOKWANE' }).map((o) => o.id)).toEqual(['p1']);
    expect(filterOrganisations(all, { ...NO_FILTERS, q: 'netballers' }).map((o) => o.id)).toEqual(['v1']);
    expect(filterOrganisations(all, NO_FILTERS)).toHaveLength(3);
  });
  it('puts verified first, then organisations with an owner, then unclaimed, alphabetically within each', () => {
    const extra = org({ id: 'a1', displayName: 'Alpha Club' });
    expect(sortOrganisations([UNCLAIMED, PLAIN, extra, VERIFIED]).map((o) => o.displayName)).toEqual([
      'Durban Netball Academy',
      'Alpha Club',
      'Test FC',
      'Soweto High School',
    ]);
  });
});
