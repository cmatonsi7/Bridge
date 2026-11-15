import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import * as svc from '../features/sponsorship/sponsorshipService';
import SponsorshipPage from '../pages/app/sponsorship/SponsorshipPage';
import AdminSponsorship from '../pages/app/admin/AdminSponsorship';

const future = new Date(Date.now() + 10 * 86400000).toISOString();
const request = (over: Record<string, unknown> = {}) => ({
  id: 'r1',
  requesterUid: 'other',
  athleteUid: 'other',
  forChild: false,
  displayName: 'Thabo M.',
  ageBand: 'Adult',
  title: 'Boots for the season',
  story: 'My boots split and I need new ones for league games.',
  category: 'Kit & equipment',
  amountZar: 900,
  sport: 'Football',
  province: 'Gauteng',
  status: 'open',
  offerCount: 0,
  reportCount: 0,
  reviewNote: null,
  createdAt: 't',
  updatedAt: 't',
  expiresAt: future,
  ...over,
});
const offer = (over: Record<string, unknown> = {}) => ({
  id: 'r1_coach',
  requestId: 'r1',
  requestTitle: 'Boots for the season',
  requesterUid: 'me',
  offererUid: 'coach',
  offererName: 'Coach Dube',
  offererRole: 'coach',
  message: 'Happy to pay for the boots.',
  status: 'pending',
  contacts: null,
  createdAt: 't',
  updatedAt: 't',
  ...over,
});

const st = {
  role: 'athlete',
  isMinor: false,
  open: [] as unknown[],
  mine: [] as unknown[],
  made: [] as unknown[],
  received: [] as unknown[],
  pending: [] as unknown[],
};
const ready = (data: unknown[]) => ({ status: 'ready', data });
vi.mock('../features/account/useSignedInUser', () => ({
  useSignedInUser: () => ({ uid: 'me', email: 'me@x.co', user: { role: st.role, isMinor: st.isMinor } }),
}));
vi.mock('../features/sponsorship/sponsorshipService', async (orig) => ({
  ...(await orig<typeof import('../features/sponsorship/sponsorshipService')>()),
  useOpenRequests: () => ready(st.open),
  usePendingRequests: () => ready(st.pending),
  useMyRequests: () => ready(st.mine),
  useOffersMade: () => ready(st.made),
  useOffersReceived: () => ready(st.received),
  createSponsorshipRequest: vi.fn(async () => ({ id: 'n', status: 'open' })),
  offerHelp: vi.fn(async () => ({ id: 'o' })),
  answerOffer: vi.fn(async () => ({})),
  reportSponsorshipRequest: vi.fn(async () => ({})),
  reviewSponsorshipRequest: vi.fn(async () => ({})),
  closeSponsorshipRequest: vi.fn(async () => ({})),
  withdrawOffer: vi.fn(async () => ({})),
}));

const page = () =>
  render(
    <MemoryRouter>
      <SponsorshipPage />
    </MemoryRouter>,
  );

beforeEach(() => {
  Object.assign(st, {
    role: 'athlete',
    isMinor: false,
    open: [],
    mine: [],
    made: [],
    received: [],
    pending: [],
  });
  vi.clearAllMocks();
});

describe('Sponsorship page', () => {
  it('an adult athlete with no request sees the form, and posts a request', async () => {
    page();
    expect(screen.getByText(/SportBridge never handles money/)).toBeTruthy();
    fireEvent.change(screen.getByLabelText('What do you need?'), {
      target: { value: 'Boots for the season' },
    });
    fireEvent.change(screen.getByLabelText('Tell people about it'), {
      target: { value: 'My boots split and I need new ones for league games.' },
    });
    fireEvent.change(screen.getByLabelText('Roughly how much (rand)'), { target: { value: '900' } });
    fireEvent.click(screen.getByRole('button', { name: 'Post my request' }));
    await waitFor(() => expect(svc.createSponsorshipRequest).toHaveBeenCalled());
    expect(vi.mocked(svc.createSponsorshipRequest).mock.calls[0]![0]).toMatchObject({
      title: 'Boots for the season',
      amountZar: 900,
    });
  });

  it('shows the athlete’s live request with offers to accept, and the email only once accepted', async () => {
    st.mine = [request({ requesterUid: 'me', offerCount: 2 })];
    st.received = [
      offer(),
      offer({
        id: 'r1_org',
        offererName: 'Soweto FC',
        status: 'accepted',
        contacts: { requesterEmail: 'me@x.co', offererEmail: 'club@x.co' },
      }),
    ];
    page();
    expect(screen.queryByRole('button', { name: 'Post my request' })).toBeNull();
    expect(screen.getByText(/10 days left/)).toBeTruthy();
    expect(screen.getByRole('link', { name: 'club@x.co' })).toBeTruthy();
    expect(screen.queryByText(/coach@/)).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Accept and share emails' }));
    await waitFor(() => expect(svc.answerOffer).toHaveBeenCalledWith('r1_coach', true));
  });

  it('lets an athlete browse others’ live requests, offer help and report, but never their own or expired ones', async () => {
    st.open = [
      request(),
      request({ id: 'mine', requesterUid: 'me', title: 'My own request' }),
      request({ id: 'old', title: 'Expired request', expiresAt: '2020-01-01T00:00:00Z' }),
    ];
    page();
    fireEvent.click(screen.getByRole('button', { name: 'Requests for support' }));
    expect(screen.getByText('Boots for the season')).toBeTruthy();
    expect(screen.queryByText('My own request')).toBeNull();
    expect(screen.queryByText('Expired request')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Offer to help' }));
    fireEvent.change(screen.getByLabelText('Your message to the athlete'), {
      target: { value: 'I can cover the boots.' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Send offer' }));
    await waitFor(() => expect(svc.offerHelp).toHaveBeenCalledWith('r1', 'I can cover the boots.'));
  });

  it('a coach or organisation can offer help but not ask, and sees an honest empty list', () => {
    st.role = 'coach';
    page();
    expect(screen.getByRole('heading', { name: 'Support athletes' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'My request' })).toBeNull();
    expect(screen.getByText(/No athletes are asking for support right now/)).toBeTruthy();
  });

  it('an under-18 athlete is told plainly they cannot ask, and sees no requests', () => {
    st.isMinor = true;
    st.open = [request()];
    page();
    expect(screen.getByText(/Under-18s cannot ask for sponsorship/)).toBeTruthy();
    expect(screen.queryByText('Boots for the season')).toBeNull();
  });

  it('shows offers the person made, and lets them withdraw a pending one', async () => {
    st.role = 'organisation';
    st.made = [offer({ id: 'r1_me', offererUid: 'me' })];
    page();
    fireEvent.click(screen.getByRole('button', { name: 'Offers I made' }));
    fireEvent.click(screen.getByRole('button', { name: 'Withdraw my offer' }));
    await waitFor(() => expect(svc.withdrawOffer).toHaveBeenCalledWith('r1_me'));
  });
});

describe('Admin sponsorship', () => {
  it('lets staff approve a child’s request with a note, and take down a reported one', async () => {
    st.pending = [
      request({ id: 'kid', forChild: true, displayName: null, ageBand: '13–15', status: 'pending_review' }),
    ];
    st.open = [
      request({ id: 'rep', reportCount: 2, title: 'Reported request' }),
      request({ id: 'fine', title: 'Fine one' }),
    ];
    render(<AdminSponsorship />);
    expect(screen.getByText(/For a child/)).toBeTruthy();
    expect(screen.queryByText('Fine one')).toBeNull();
    fireEvent.change(screen.getByLabelText('Note to the parent (optional)'), {
      target: { value: 'Looks good' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Approve and list it' }));
    await waitFor(() => expect(svc.reviewSponsorshipRequest).toHaveBeenCalledWith('kid', true, 'Looks good'));
    const card = screen.getByText('Reported request').closest('.sb-card') as HTMLElement;
    expect(within(card).getByText(/reported 2 times/)).toBeTruthy();
    fireEvent.click(within(card).getByRole('button', { name: 'Take it down' }));
    await waitFor(() => expect(svc.closeSponsorshipRequest).toHaveBeenCalledWith('rep'));
  });

  it('says so when nothing needs attention', () => {
    render(<AdminSponsorship />);
    expect(screen.getByText('No requests are waiting for review.')).toBeTruthy();
    expect(screen.getByText('Nobody has reported a request.')).toBeTruthy();
  });
});
