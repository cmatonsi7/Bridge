import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import type { GuardianLinkDoc } from '@sportbridge/shared';
import { fixtures, fullProfile } from './athleteMocks';
import * as gs from '../features/guardian/guardianService';
import { GuardianDashboard } from '../features/guardian/GuardianDashboard';
import { AthleteGuardianNotice } from '../features/guardian/AthleteGuardianNotice';
import ChildProfilePage from '../pages/app/guardian/ChildProfilePage';

type L = GuardianLinkDoc & { id: string };
const g = { pending: [] as L[], children: [] as L[], mine: [] as L[] };
const link = (over: Partial<L> = {}): L => ({
  id: 'L1',
  athleteUid: 'kid',
  athleteName: 'Thabo Mokoena',
  guardianEmail: 'mom@example.com',
  guardianUid: null,
  relationship: 'parent',
  status: 'pending',
  requestedAt: 't',
  verifiedAt: null,
  consentVersion: null,
  ...over,
});

vi.mock('../features/auth/AuthProvider', async () => (await import('./athleteMocks')).authMock());
vi.mock('../features/athlete/athleteService', async () => (await import('./athleteMocks')).serviceMock());
vi.mock('../features/guardian/guardianService', () => ({
  usePendingRequests: () => ({ status: 'ready', data: g.pending }),
  useMyChildren: () => ({ status: 'ready', data: g.children }),
  useMyGuardianLinks: () => ({ status: 'ready', data: g.mine }),
  confirmRequest: vi.fn(async () => ({ ok: true })),
  declineRequest: vi.fn(async () => ({ ok: true })),
  withdrawConsent: vi.fn(async () => ({ ok: true })),
  saveGuardianName: vi.fn(async () => {}),
}));

const dash = () =>
  render(
    <MemoryRouter>
      <GuardianDashboard uid="mom" email="mom@example.com" firstName="Naledi" />
    </MemoryRouter>,
  );

beforeEach(() => {
  g.pending = [];
  g.children = [];
  g.mine = [];
  fixtures.profile = null;
  fixtures.achievements = [];
  vi.clearAllMocks();
});

describe('GuardianDashboard', () => {
  it('explains how to connect a child when there are none', () => {
    dash();
    expect(screen.getByText('No children connected yet.')).toBeTruthy();
    expect(screen.getAllByText('mom@example.com').length).toBeGreaterThan(0);
  });

  it('requires the consent box before confirming, then calls the server', async () => {
    g.pending = [link()];
    dash();
    expect(screen.getByText('Thabo Mokoena')).toBeTruthy();
    const confirm = screen.getByRole('button', { name: 'Confirm & give consent' }) as HTMLButtonElement;
    expect(confirm.disabled).toBe(true);
    fireEvent.click(screen.getByRole('checkbox'));
    expect(confirm.disabled).toBe(false);
    fireEvent.click(confirm);
    await waitFor(() => expect(gs.confirmRequest).toHaveBeenCalledWith('L1'));
  });

  it('declines after confirmation prompt', async () => {
    g.pending = [link()];
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    dash();
    fireEvent.click(screen.getByRole('button', { name: 'This is not my child' }));
    await waitFor(() => expect(gs.declineRequest).toHaveBeenCalledWith('L1'));
  });

  it('lists confirmed children with their real profile data', () => {
    g.children = [link({ status: 'verified', guardianUid: 'mom' })];
    fixtures.profile = fullProfile;
    dash();
    expect(screen.getByText(/Football · Midfielder/)).toBeTruthy();
    expect(screen.getByText('Guardian verified')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'View Child Profile' })).toBeTruthy();
  });
});

describe('AthleteGuardianNotice', () => {
  it('tells the child which email their parent must sign up with', () => {
    g.mine = [link()];
    render(<AthleteGuardianNotice uid="kid" />);
    expect(screen.getByText('mom@example.com')).toBeTruthy();
    expect(screen.getByText(/Parent \/ Guardian/)).toBeTruthy();
  });
  it('explains a declined request', () => {
    g.mine = [link({ status: 'declined' })];
    render(<AthleteGuardianNotice uid="kid" />);
    expect(screen.getByText(/said they are not your guardian/)).toBeTruthy();
  });
});

describe('ChildProfilePage', () => {
  const at = () =>
    render(
      <MemoryRouter initialEntries={['/app/children/kid']}>
        <Routes>
          <Route path="/app/children/:childUid" element={<ChildProfilePage />} />
          <Route path="/app" element={<div>dashboard</div>} />
        </Routes>
      </MemoryRouter>,
    );

  it('refuses a child that is not linked to this parent', () => {
    at();
    expect(screen.getByText(/isn’t connected to your account/)).toBeTruthy();
  });

  it('shows a linked child and lets the parent withdraw consent', async () => {
    g.children = [
      link({
        status: 'verified',
        guardianUid: 'mom',
        verifiedAt: '2026-11-03T10:00:00.000Z',
        consentVersion: 'v1',
      }),
    ];
    fixtures.profile = fullProfile;
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    at();
    expect(screen.getByText(/Football · Midfielder/)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Withdraw consent' }));
    await waitFor(() => expect(gs.withdrawConsent).toHaveBeenCalledWith('L1'));
  });
});
