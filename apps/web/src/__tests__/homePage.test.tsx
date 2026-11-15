import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import HomePage from '../pages/public/HomePage';

type Published = { status: 'loading' } | { status: 'error' } | { status: 'ready'; data: unknown[] };
const st: { published: Published; signedIn: boolean } = {
  published: { status: 'ready', data: [] },
  signedIn: false,
};

vi.mock('../features/auth/AuthProvider', () => ({
  useAuth: () => ({ state: { status: st.signedIn ? 'signedIn' : 'signedOut' } }),
}));
vi.mock('../features/listings/listingsService', () => ({
  usePublishedListings: () => st.published,
}));

const listing = (n: number) => ({
  id: `l${n}`,
  kind: 'opportunity',
  type: 'Trial',
  title: `Real Trial ${n}`,
  orgName: `Real Club ${n}`,
  city: 'Durban',
  province: 'KwaZulu-Natal',
  sports: ['Football'],
  deadline: '2099-01-01',
  status: 'published',
  isFree: true,
  priceZar: null,
  startDate: null,
  endDate: null,
  ageMin: 10,
  ageMax: 18,
});

const home = () =>
  render(
    <MemoryRouter>
      <HomePage />
    </MemoryRouter>,
  );
const featured = () => {
  const heading = screen.getByRole('heading', { name: 'Find your next opportunity.' });
  return heading.closest('section') as HTMLElement;
};

beforeEach(() => {
  st.published = { status: 'ready', data: [] };
  st.signedIn = false;
});

describe('Home: featured opportunities are real', () => {
  it('shows an honest empty state, with a way to sign up, when nothing is open', () => {
    home();
    const f = within(featured());
    expect(f.getByText('No opportunities listed yet')).toBeTruthy();
    expect(f.getByRole('button', { name: 'Create Account' })).toBeTruthy();
    expect(f.queryByText('View details →')).toBeNull();
  });

  it('shows real open listings, at most four, each leading to its own page', () => {
    st.published = { status: 'ready', data: [1, 2, 3, 4, 5, 6].map(listing) };
    home();
    const f = within(featured());
    expect(f.getAllByText('View details →')).toHaveLength(4);
    expect(f.getByText('Real Trial 1')).toBeTruthy();
    expect(f.getByText(/Real Club 1/)).toBeTruthy();
    expect(f.queryByText('Real Trial 5')).toBeNull();
  });

  it('says so when listings cannot be loaded, and while they load', () => {
    st.published = { status: 'error' };
    const first = home();
    expect(within(featured()).getByRole('alert').textContent).toMatch(/couldn’t load opportunities/);
    first.unmount();
    st.published = { status: 'loading' };
    home();
    expect(within(featured()).getByText(/Loading opportunities/)).toBeTruthy();
  });

  it('shows none of the invented prototype listings or organisations', () => {
    home();
    const text = document.body.textContent ?? '';
    for (const fake of [
      'U17 Provincial Trials',
      'Football Bursary 2027',
      'Assistant Coach Position',
      'U19 Athletics Selection',
      'Western Province Rugby',
      'National Sports Academy',
      'Elite Netball Academy',
      'Athletics South Africa',
    ])
      expect(text).not.toContain(fake);
  });
});

describe('Home: no promises about features that do not exist yet', () => {
  it('has no sponsorship call to action (sponsorship is not built)', () => {
    home();
    expect(screen.queryByRole('button', { name: /Sponsorship/ })).toBeNull();
    expect(document.body.textContent).not.toMatch(/sponsorship/i);
  });

  it('does not promise messaging, coaching roles, smart matching or prototype wording', () => {
    home();
    const text = document.body.textContent ?? '';
    for (const claim of [
      'Message coaches',
      'coaching roles',
      'Smart Matching',
      'coach feedback',
      'Verified & Safe',
      'The demo',
      'subject to SportBridge approval',
    ])
      expect(text).not.toContain(claim);
  });

  it('keeps the FAQ in step with the real prices, and says nothing is charged yet', () => {
    home();
    fireEvent.click(screen.getByRole('button', { name: /Is SportBridge free to use/ }));
    const answer = screen.getByText(/Starter is free/).textContent ?? '';
    expect(answer).toContain('R149 a month or R1 490 a year');
    expect(answer).toContain('R499 a month or R4 990 a year');
    expect(answer).toMatch(/nothing is charged/);
  });

  it('is honest that the privacy notice is not published yet', () => {
    home();
    expect(screen.getByText(/Privacy & POPIA notice has not been published yet/)).toBeTruthy();
  });
});
