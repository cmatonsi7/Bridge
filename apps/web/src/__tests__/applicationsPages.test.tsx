import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import type { ApplicationDoc, ListingDoc } from '@sportbridge/shared';
import * as as from '../features/applications/applicationsService';
import { ApplyPanel } from '../features/applications/ApplyPanel';
import MyApplicationsPage from '../pages/app/applications/MyApplicationsPage';
import OrgApplicationsPage from '../pages/app/applications/OrgApplicationsPage';
import { NotificationsBell } from '../features/applications/NotificationsBell';

const future = new Date(Date.now() + 10 * 86400000).toISOString().slice(0, 10);
const listing: ListingDoc & { id: string } = {
  id: 'L1',
  kind: 'opportunity',
  type: 'Trial',
  title: 'U17 Trials',
  description: 'Open trials for the U17 squad.',
  sports: ['Football'],
  province: 'Gauteng',
  city: 'Soweto',
  ageMin: 14,
  ageMax: 17,
  deadline: future,
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
};
const app = (over: Partial<ApplicationDoc & { id: string }> = {}): ApplicationDoc & { id: string } => ({
  id: 'L1_kid',
  listingId: 'L1',
  listingTitle: 'U17 Trials',
  listingKind: 'opportunity',
  orgId: 'org1',
  orgName: 'Soweto FC',
  ownerUid: 'o1',
  applicantUid: 'kid',
  applicantIsMinor: true,
  status: 'submitted',
  note: 'Keen!',
  orgMessage: null,
  snapshot: {
    displayName: 'Thabo M',
    age: 15,
    isMinor: true,
    sport: 'Football',
    position: 'Wing',
    city: 'Soweto',
    province: 'Gauteng',
    bio: null,
    skills: ['Teamwork'],
    email: null,
    phone: null,
  },
  history: [],
  createdAt: '2026-11-04T10:00:00.000Z',
  updatedAt: '2026-11-04T10:00:00.000Z',
  ...over,
});
const st = {
  mine: [] as ReturnType<typeof app>[],
  received: [] as ReturnType<typeof app>[],
  notes: [] as Array<{
    id: string;
    type: string;
    title: string;
    body: string;
    link: string;
    read: boolean;
    createdAt: string;
  }>,
};

vi.mock('../features/account/useSignedInUser', () => ({
  useSignedInUser: () => ({
    uid: 'u1',
    email: 'x@example.com',
    user: { uid: 'u1', role: 'athlete', status: 'active' },
  }),
}));
vi.mock('../features/applications/applicationsService', () => ({
  useApplicationsBy: () => ({ status: 'ready', data: st.mine }),
  useApplicationsTo: () => ({ status: 'ready', data: st.received }),
  useNotifications: () => ({ status: 'ready', data: st.notes }),
  applyTo: vi.fn(async () => ({ id: 'L1_u1' })),
  setApplicationStatus: vi.fn(async () => ({ ok: true })),
  withdrawApplication: vi.fn(async () => ({ ok: true })),
  markNotificationRead: vi.fn(async () => {}),
  markAllNotificationsRead: vi.fn(async () => {}),
  deleteNotification: vi.fn(async () => {}),
}));

const r = (el: JSX.Element) => render(<MemoryRouter>{el}</MemoryRouter>);
beforeEach(() => {
  st.mine = [];
  st.received = [];
  st.notes = [];
  vi.clearAllMocks();
});

describe('ApplyPanel', () => {
  it('tells a child their contact details stay private, then applies', async () => {
    r(<ApplyPanel listing={listing} uid="u1" isMinor restricted={false} />);
    fireEvent.click(screen.getByRole('button', { name: 'Apply' }));
    expect(screen.getByText(/will not see your email or phone number/)).toBeTruthy();
    fireEvent.change(screen.getByLabelText(/Note to Soweto FC/), { target: { value: 'I play wing' } });
    fireEvent.click(screen.getByRole('button', { name: 'Send application' }));
    await waitFor(() => expect(as.applyTo).toHaveBeenCalledWith('L1', 'I play wing'));
  });
  it('tells an adult their contact details will be shared', () => {
    r(<ApplyPanel listing={listing} uid="u1" isMinor={false} restricted={false} />);
    fireEvent.click(screen.getByRole('button', { name: 'Apply' }));
    expect(screen.getByText(/plus your email and phone number/)).toBeTruthy();
  });
  it('does not let a restricted child apply', () => {
    r(<ApplyPanel listing={listing} uid="u1" isMinor restricted />);
    expect(screen.queryByRole('button', { name: 'Apply' })).toBeNull();
    expect(screen.getByText(/parent or guardian needs to confirm your account/)).toBeTruthy();
  });
  it('shows the existing application instead of applying twice', () => {
    st.mine = [app({ applicantUid: 'u1', status: 'shortlisted' })];
    r(<ApplyPanel listing={listing} uid="u1" isMinor restricted={false} />);
    expect(screen.queryByRole('button', { name: 'Apply' })).toBeNull();
    expect(screen.getByText('Shortlisted')).toBeTruthy();
  });
});

describe('MyApplicationsPage', () => {
  it('lists applications with the organisation message and withdraws', async () => {
    st.mine = [app({ status: 'accepted', orgMessage: 'See you Saturday' })];
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    r(<MyApplicationsPage />);
    expect(screen.getByText(/See you Saturday/)).toBeTruthy();
    expect(screen.getByText(/contact your parent or guardian through SportBridge/)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Withdraw' }));
    await waitFor(() => expect(as.withdrawApplication).toHaveBeenCalledWith('L1_kid'));
  });
  it('has no withdraw button once declined', () => {
    st.mine = [app({ status: 'declined' })];
    r(<MyApplicationsPage />);
    expect(screen.queryByRole('button', { name: 'Withdraw' })).toBeNull();
  });
});

describe('OrgApplicationsPage', () => {
  it('shows a child applicant without contact details and shortlists them with a message', async () => {
    st.received = [app()];
    r(<OrgApplicationsPage />);
    expect(screen.getByText('Under 18')).toBeTruthy();
    expect(screen.getByText(/Contact details are not shared for under-18 applicants/)).toBeTruthy();
    fireEvent.change(screen.getByLabelText(/Message to the applicant/), {
      target: { value: 'Arrive 08:30' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Shortlist' }));
    await waitFor(() =>
      expect(as.setApplicationStatus).toHaveBeenCalledWith('L1_kid', {
        status: 'shortlisted',
        message: 'Arrive 08:30',
      }),
    );
  });
  it("shows an adult applicant's contact details, and only allowed next steps", () => {
    st.received = [
      app({
        id: 'L1_a',
        applicantIsMinor: false,
        status: 'shortlisted',
        snapshot: { ...app().snapshot, isMinor: false, age: 22, email: 'a@example.com', phone: '0821234567' },
      }),
    ];
    r(<OrgApplicationsPage />);
    expect(screen.getByText(/a@example.com/)).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Shortlist' })).toBeNull();
    expect(screen.getByRole('button', { name: 'Accept' })).toBeTruthy();
  });
});

describe('NotificationsBell', () => {
  it('shows unread count and opens, marking all read', async () => {
    st.notes = [
      {
        id: 'n1',
        type: 'application.status',
        title: 'Application update',
        body: 'Accepted',
        link: '/app/applications',
        read: false,
        createdAt: new Date().toISOString(),
      },
    ];
    r(<NotificationsBell uid="u1" />);
    fireEvent.click(screen.getByRole('button', { name: 'Notifications, 1 unread' }));
    expect(screen.getByText('Application update')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Mark all read' }));
    await waitFor(() => expect(as.markAllNotificationsRead).toHaveBeenCalled());
  });
});
