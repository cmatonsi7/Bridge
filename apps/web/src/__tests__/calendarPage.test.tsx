import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import CalendarPage from '../pages/app/calendar/CalendarPage';
import * as svc from '../features/calendar/calendarService';

const manual = (over: Record<string, unknown> = {}) => ({
  id: 'm1',
  title: 'Saturday training',
  date: '2026-12-05',
  endDate: null,
  note: 'Bring boots',
  createdAt: 't',
  updatedAt: 't',
  ...over,
});
const item = (over: Record<string, unknown> = {}) => ({
  id: 'application-a1',
  date: '2026-12-10',
  endDate: null,
  title: 'U17 Trials',
  subtitle: 'Soweto FC',
  note: null,
  source: 'application',
  ...over,
});

const st = {
  role: 'athlete',
  entries: [] as unknown[],
  appEvents: [] as unknown[],
  listingEvents: [] as unknown[],
};
const ready = (data: unknown[]) => ({ status: 'ready', data });
vi.mock('../features/account/useSignedInUser', () => ({
  useSignedInUser: () => ({ uid: 'me', email: 'me@x.co', user: { role: st.role } }),
}));
vi.mock('../features/guardian/guardianService', () => ({
  useMyChildren: () => ready([{ id: 'link1', athleteUid: 'kid', athleteName: 'Thabo' }]),
}));
vi.mock('../features/calendar/calendarService', async (orig) => ({
  ...(await orig<typeof import('../features/calendar/calendarService')>()),
  useMyEntries: () => ready(st.entries),
  useApplicationEvents: (uid: string | undefined) => (uid ? ready(st.appEvents) : ready([])),
  useMyListingEvents: (uid: string | undefined) => (uid ? ready(st.listingEvents) : ready([])),
  addCalendarEntry: vi.fn(async () => 'new'),
  updateCalendarEntry: vi.fn(async () => undefined),
  deleteCalendarEntry: vi.fn(async () => undefined),
}));

beforeEach(() => {
  Object.assign(st, { role: 'athlete', entries: [], appEvents: [], listingEvents: [] });
  vi.clearAllMocks();
});

describe('Calendar page', () => {
  it('shows a derived event from an accepted application, and lets the athlete add their own event', async () => {
    st.appEvents = [item()];
    render(<CalendarPage />);
    expect(screen.getByText('U17 Trials')).toBeTruthy();
    expect(screen.getByText(/From your accepted application/)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Add an event' }));
    fireEvent.change(screen.getByLabelText('Title'), { target: { value: 'Saturday training' } });
    fireEvent.click(screen.getByRole('button', { name: 'Add event' }));
    await waitFor(() =>
      expect(svc.addCalendarEntry).toHaveBeenCalledWith(
        'me',
        expect.objectContaining({ title: 'Saturday training' }),
      ),
    );
  });

  it('lets the owner edit or remove their own manual entry, but a derived event has no such buttons', () => {
    st.entries = [manual()];
    st.appEvents = [item()];
    render(<CalendarPage />);
    const manualCard = screen.getByText('Saturday training').closest('.sb-card') as HTMLElement;
    expect(manualCard.querySelector('button')).toBeTruthy();
    const derivedCard = screen.getByText('U17 Trials').closest('.sb-card') as HTMLElement;
    expect(derivedCard.querySelector('button')).toBeNull();
    fireEvent.click(manualCard.querySelector('button') as HTMLElement);
  });

  it('removes a manual entry', async () => {
    st.entries = [manual()];
    render(<CalendarPage />);
    fireEvent.click(screen.getByRole('button', { name: 'Remove' }));
    await waitFor(() => expect(svc.deleteCalendarEntry).toHaveBeenCalledWith('me', 'm1'));
  });

  it('shows an honest empty state when there is nothing', () => {
    render(<CalendarPage />);
    expect(screen.getByText(/Nothing coming up/)).toBeTruthy();
  });

  it('an organisation sees its own published listings on the calendar, with no "Add an event" for them hidden', () => {
    st.role = 'organisation';
    st.listingEvents = [
      item({ id: 'listing-l1', title: 'Winter trials', subtitle: null, source: 'listing' }),
    ];
    render(<CalendarPage />);
    expect(screen.getByText('Winter trials')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Add an event' })).toBeTruthy();
  });

  it('a parent sees each child’s upcoming events separately, plus their own reminders', () => {
    st.role = 'guardian';
    st.appEvents = [item()];
    render(<CalendarPage />);
    expect(screen.getByText('Thabo')).toBeTruthy();
    expect(screen.getByText('U17 Trials')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Add an event' })).toBeTruthy();
  });
});
