import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import MembershipPage from '../pages/app/membership/MembershipPage';
import * as svc from '../features/membership/membershipService';
import { PLAN_LIMITS, type MembershipDoc } from '@sportbridge/shared';

const st = { role: 'athlete', view: null as unknown };

const membership = (over: Partial<MembershipDoc> = {}): MembershipDoc => ({
  uid: 'me',
  plan: 'starter',
  status: 'free',
  billingPeriod: null,
  trialEndsAt: null,
  interest: null,
  createdAt: '2026-11-01T00:00:00.000Z',
  updatedAt: '2026-11-01T00:00:00.000Z',
  ...over,
});

vi.mock('../features/account/useSignedInUser', () => ({
  useSignedInUser: () => ({ uid: 'me', email: 'me@x.co', user: { role: st.role } }),
}));
vi.mock('../features/membership/membershipService', async (orig) => ({
  ...(await orig<typeof import('../features/membership/membershipService')>()),
  useMembership: () => ({ state: { status: 'ready', data: st.view }, reload: vi.fn() }),
  registerUpgradeInterest: vi.fn(async () => ({})),
}));

beforeEach(() => {
  st.role = 'athlete';
  st.view = {
    membership: membership(),
    status: 'free',
    limits: PLAN_LIMITS.starter,
    trialDaysLeft: 0,
  };
  vi.clearAllMocks();
});

describe('Membership page', () => {
  it('shows a free athlete their plan and the application limit that is actually in force', () => {
    render(<MembershipPage />);
    expect(screen.getByRole('heading', { name: 'Starter' })).toBeTruthy();
    expect(screen.getByText(/3 applications waiting for an answer/)).toBeTruthy();
    // An answered application never holds a slot — the page says so rather than leaving people guessing.
    expect(screen.getByText(/answered or withdrawn is finished/)).toBeTruthy();
  });

  it('is honest that nothing can be paid for yet, and records interest instead of charging', async () => {
    render(<MembershipPage />);
    expect(screen.getByText(/not taking payments yet/i)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Annual' }));
    expect(screen.getByText(/R1 490/)).toBeTruthy();
    expect(screen.getByText(/Two months free/)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'I’m interested' }));
    await waitFor(() => expect(svc.registerUpgradeInterest).toHaveBeenCalledWith('pro', 'annual'));
  });

  it('tells an organisation how long its free trial has left', () => {
    st.role = 'organisation';
    st.view = {
      membership: membership({
        plan: 'organisation',
        status: 'trialing',
        trialEndsAt: '2026-12-16T00:00:00.000Z',
      }),
      status: 'trialing',
      limits: PLAN_LIMITS.organisation,
      trialDaysLeft: 12,
    };
    render(<MembershipPage />);
    expect(screen.getByText('Free trial')).toBeTruthy();
    expect(screen.getByText(/12 days left/)).toBeTruthy();
    expect(screen.getByText(/R499/)).toBeTruthy();
  });

  it('says plainly that a lapsed trial was never charged', () => {
    st.role = 'organisation';
    st.view = {
      membership: membership({
        plan: 'organisation',
        status: 'lapsed',
        trialEndsAt: '2026-01-01T00:00:00.000Z',
      }),
      status: 'lapsed',
      limits: PLAN_LIMITS.organisationLapsed,
      trialDaysLeft: 0,
    };
    render(<MembershipPage />);
    expect(screen.getByText('Trial ended')).toBeTruthy();
    expect(screen.getByText(/have not been charged/)).toBeTruthy();
  });

  it('shows what someone already asked for, and offers to change it', () => {
    st.view = {
      membership: membership({
        interest: { plan: 'pro', billingPeriod: 'monthly', at: '2026-11-10T00:00:00.000Z' },
      }),
      status: 'free',
      limits: PLAN_LIMITS.starter,
      trialDaysLeft: 0,
    };
    render(<MembershipPage />);
    expect(screen.getByText(/Noted — you asked about Pro monthly/)).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Update what I asked for' })).toBeTruthy();
  });

  it('shows an error rather than a blank page when the membership cannot be loaded', async () => {
    const m = await import('../features/membership/membershipService');
    vi.spyOn(m, 'useMembership').mockReturnValue({
      state: { status: 'error', message: 'We couldn’t load your membership.' },
      reload: vi.fn(),
    });
    render(<MembershipPage />);
    expect(screen.getByRole('alert').textContent).toMatch(/couldn’t load your membership/);
  });
});
