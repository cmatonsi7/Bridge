import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import type { ConnectionDoc, DirectoryEntryDoc } from '@sportbridge/shared';
import * as ds from '../features/directory/directoryService';
import DirectoryPage from '../pages/app/directory/DirectoryPage';
import DirectoryProfilePage from '../pages/app/directory/DirectoryProfilePage';
import ConnectionsPage from '../pages/app/directory/ConnectionsPage';
import { PrivacyForm } from '../features/athlete/PrivacyForm';
import { useDirectoryReconcile } from '../features/directory/useDirectoryReconcile';
import { renderHook } from '@testing-library/react';

const entry = (over: Partial<DirectoryEntryDoc> & { uid: string }): DirectoryEntryDoc & { id: string } => ({
  id: over.uid,
  role: 'athlete',
  displayName: 'Lerato K',
  sports: ['Football'],
  province: 'Gauteng',
  city: 'Soweto',
  headline: 'Wing · Soweto FC',
  tags: ['Teamwork'],
  updatedAt: '',
  ...over,
});
const conn = (over: Partial<ConnectionDoc> & { id: string }): ConnectionDoc & { id: string } => ({
  coachUid: 'c1',
  coachName: 'Coach One',
  athleteUid: 'a1',
  athleteName: 'Lerato K',
  athleteIsMinor: false,
  decidedByUid: null,
  decidedByRole: null,
  status: 'pending',
  message: 'Saw you at trials',
  createdAt: '1',
  updatedAt: '1',
  ...over,
});
const st = {
  role: 'athlete',
  uid: 'a1',
  dir: [] as ReturnType<typeof entry>[],
  coachConns: [] as ReturnType<typeof conn>[],
  athleteConns: [] as ReturnType<typeof conn>[],
  isMinor: false,
};

vi.mock('../features/account/useSignedInUser', () => ({
  useSignedInUser: () => ({
    uid: st.uid,
    email: 'x@example.com',
    user: { uid: st.uid, role: st.role, status: 'active', isMinor: st.isMinor, displayName: 'Me' },
  }),
}));
vi.mock('../features/guardian/guardianService', () => ({
  useMyChildren: () => ({ status: 'ready', data: [{ id: 'l1', athleteUid: 'kid', athleteName: 'Thabo M' }] }),
}));
vi.mock('../features/athlete/athleteService', () => ({ savePrivacy: vi.fn(async () => {}) }));
vi.mock('../features/directory/directoryService', () => ({
  useDirectory: () => ({ status: 'ready', data: st.dir }),
  useDirectoryEntry: (uid?: string) => ({ status: 'ready', data: st.dir.find((e) => e.uid === uid) ?? null }),
  useCoachConnections: () => ({ status: 'ready', data: st.coachConns }),
  useAthleteConnections: () => ({ status: 'ready', data: st.athleteConns }),
  requestConnection: vi.fn(async () => ({ id: 'c1_a1' })),
  acceptConnection: vi.fn(async () => ({})),
  declineConnection: vi.fn(async () => ({})),
  endConnection: vi.fn(async () => ({})),
  syncDirectory: vi.fn(async () => ({ listed: true })),
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
    role: 'athlete',
    uid: 'a1',
    dir: [],
    coachConns: [],
    athleteConns: [],
    isMinor: false,
  });
  vi.clearAllMocks();
});

describe('DirectoryPage', () => {
  it('explains that children are never listed when empty', () => {
    at('/', <DirectoryPage />);
    expect(screen.getByText(/athletes under 18 are never listed/)).toBeTruthy();
  });
  it('filters by role and sport', () => {
    st.dir = [
      entry({ uid: '1' }),
      entry({ uid: '2', displayName: 'Coach One', role: 'coach', sports: ['Netball'] }),
    ];
    at('/', <DirectoryPage />);
    expect(screen.getByText('Lerato K')).toBeTruthy();
    fireEvent.change(screen.getByLabelText('Role'), { target: { value: 'coach' } });
    expect(screen.queryByText('Lerato K')).toBeNull();
    expect(screen.getByText('Coach One')).toBeTruthy();
  });
});

describe('DirectoryProfilePage', () => {
  it('never shows contact details and lets a coach send a request', async () => {
    st.role = 'coach';
    st.uid = 'c1';
    st.dir = [entry({ uid: 'a1' })];
    at('/app/directory/a1', <DirectoryProfilePage />, '/app/directory/:uid');
    expect(screen.getByText(/never shows contact details/)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Ask to connect' }));
    expect(screen.getByText(/their parent or guardian decides/)).toBeTruthy();
    fireEvent.change(screen.getByLabelText('Message (optional)'), { target: { value: 'Saw you play' } });
    fireEvent.click(screen.getByRole('button', { name: 'Send request' }));
    await waitFor(() =>
      expect(ds.requestConnection).toHaveBeenCalledWith({ athleteUid: 'a1', message: 'Saw you play' }),
    );
  });
  it('shows no connect button to a non-coach', () => {
    st.dir = [entry({ uid: 'a2', displayName: 'Someone' })];
    at('/app/directory/a2', <DirectoryProfilePage />, '/app/directory/:uid');
    expect(screen.queryByRole('button', { name: 'Ask to connect' })).toBeNull();
  });
});

describe('ConnectionsPage', () => {
  it('an adult athlete can accept their own request', async () => {
    st.athleteConns = [conn({ id: 'c1_a1' })];
    at('/', <ConnectionsPage />);
    fireEvent.click(screen.getByRole('button', { name: 'Accept' }));
    await waitFor(() => expect(ds.acceptConnection).toHaveBeenCalledWith('c1_a1'));
  });
  it('a child cannot accept; it says their parent decides', () => {
    st.isMinor = true;
    st.athleteConns = [conn({ id: 'c1_a1', athleteIsMinor: true })];
    at('/', <ConnectionsPage />);
    expect(screen.queryByRole('button', { name: 'Accept' })).toBeNull();
    expect(screen.getByText(/parent or guardian will decide/)).toBeTruthy();
  });
  it('a parent can accept for their child', async () => {
    st.role = 'guardian';
    st.athleteConns = [
      conn({ id: 'c1_kid', athleteUid: 'kid', athleteName: 'Thabo M', athleteIsMinor: true }),
    ];
    at('/', <ConnectionsPage />);
    fireEvent.click(screen.getByRole('button', { name: 'Accept' }));
    await waitFor(() => expect(ds.acceptConnection).toHaveBeenCalledWith('c1_kid'));
  });
  it('a coach sees requests they sent but cannot answer them', () => {
    st.role = 'coach';
    st.uid = 'c1';
    st.coachConns = [conn({ id: 'c1_a1' })];
    at('/', <ConnectionsPage />);
    expect(screen.getByText('Awaiting a decision')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Accept' })).toBeNull();
  });
});

describe('athlete privacy', () => {
  it('locks the directory switch for under-18s and explains why', () => {
    render(
      <PrivacyForm
        uid="a1"
        isMinor
        value={{ discoverable: false, showAchievements: false, allowEnquiries: false }}
      />,
    );
    expect(screen.getByText('Not available for under-18 accounts')).toBeTruthy();
    expect(
      (screen.getByRole('switch', { name: /List me in the Talent Directory/ }) as HTMLButtonElement).disabled,
    ).toBe(true);
  });
  it('lets an adult turn it on and syncs the directory', async () => {
    render(
      <PrivacyForm
        uid="a1"
        isMinor={false}
        value={{ discoverable: false, showAchievements: false, allowEnquiries: false }}
      />,
    );
    fireEvent.click(screen.getByRole('switch', { name: 'List me in the Talent Directory' }));
    await waitFor(() => expect(ds.syncDirectory).toHaveBeenCalled());
  });
  it('tells the person when the directory could not be updated, instead of saying Saved', async () => {
    vi.mocked(ds.syncDirectory).mockRejectedValueOnce(new Error('offline'));
    render(
      <PrivacyForm
        uid="a1"
        isMinor={false}
        value={{ discoverable: false, showAchievements: false, allowEnquiries: false }}
      />,
    );
    fireEvent.click(screen.getByRole('switch', { name: 'List me in the Talent Directory' }));
    expect(await screen.findByText(/couldn’t update the Talent Directory/)).toBeTruthy();
    expect(screen.queryByText('Saved.')).toBeNull();
  });
  it('confirms when the person is now listed', async () => {
    render(
      <PrivacyForm
        uid="a1"
        isMinor={false}
        value={{ discoverable: false, showAchievements: false, allowEnquiries: false }}
      />,
    );
    fireEvent.click(screen.getByRole('switch', { name: 'List me in the Talent Directory' }));
    expect(await screen.findByText(/You’re now listed in the Talent Directory/)).toBeTruthy();
  });
  it('explains exactly why someone is not listed when the switch is on', async () => {
    vi.mocked(ds.syncDirectory).mockResolvedValueOnce({ listed: false, reason: 'NOT_ACTIVE' });
    render(
      <PrivacyForm
        uid="a1"
        isMinor={false}
        value={{ discoverable: false, showAchievements: false, allowEnquiries: false }}
      />,
    );
    fireEvent.click(screen.getByRole('switch', { name: 'List me in the Talent Directory' }));
    expect(await screen.findByText(/you’re not listed: your account isn’t active yet/)).toBeTruthy();
  });
  it('does not touch the directory when a different switch changes', async () => {
    render(
      <PrivacyForm
        uid="a1"
        isMinor={false}
        value={{ discoverable: true, showAchievements: false, allowEnquiries: false }}
      />,
    );
    fireEvent.click(screen.getByRole('switch', { name: 'Show achievements publicly' }));
    expect(await screen.findByText('Saved.')).toBeTruthy();
    expect(ds.syncDirectory).not.toHaveBeenCalled();
  });
});

describe('quiet listing refresh', () => {
  beforeEach(() => sessionStorage.clear());
  it('refreshes a listable person once per session, without anyone touching a switch', async () => {
    const { rerender } = renderHook(({ uid, role }) => useDirectoryReconcile(uid, role), {
      initialProps: { uid: 'a1', role: 'athlete' },
    });
    await waitFor(() => expect(ds.syncDirectory).toHaveBeenCalledTimes(1));
    rerender({ uid: 'a1', role: 'athlete' });
    renderHook(() => useDirectoryReconcile('a1', 'athlete'));
    expect(ds.syncDirectory).toHaveBeenCalledTimes(1);
  });
  it('does not refresh parents or signed-out visitors', () => {
    renderHook(() => useDirectoryReconcile('g1', 'guardian'));
    renderHook(() => useDirectoryReconcile(undefined, undefined));
    expect(ds.syncDirectory).not.toHaveBeenCalled();
  });
});
