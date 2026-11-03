import { describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import type { UserDoc } from '@sportbridge/shared';
import { AppShell } from '../layouts/AppShell';
import DashboardPage from '../pages/app/DashboardPage';

// Renders the real signed-in tree (AppShell + DashboardPage) the way production does after
// registration + email verification, with a mocked AuthProvider — this is exactly the path that
// broke in production ("n is not a function") because it was never exercised against real
// Firebase locally. Any render-time bug here reproduces without needing a live Firebase project.
const profile: UserDoc = {
  uid: 'u1',
  email: 'jordan@example.com',
  firstName: 'Jordan',
  surname: 'Mokoena',
  displayName: 'Jordan Mokoena',
  role: 'athlete',
  status: 'active',
  isMinor: false,
  onboardingComplete: true,
  termsVersion: 'v',
  termsAcceptedAt: '',
  createdAt: '',
  updatedAt: '',
};

vi.mock('../features/auth/AuthProvider', async () => {
  const actual = await vi.importActual<typeof import('../features/auth/AuthProvider')>(
    '../features/auth/AuthProvider',
  );
  return {
    ...actual,
    useAuth: () => ({
      state: {
        status: 'signedIn',
        user: { uid: 'u1', email: 'jordan@example.com', displayName: 'Jordan Mokoena', emailVerified: true },
        claims: { role: 'athlete' },
        profile,
      },
      configured: true,
      refresh: vi.fn(),
      signOut: vi.fn(),
    }),
  };
});

vi.mock('../features/athlete/athleteService', async () => (await import('./athleteMocks')).serviceMock());

describe('signed-in app renders without crashing', () => {
  it('mounts AppShell with the Dashboard index route', async () => {
    render(
      <MemoryRouter initialEntries={['/app']}>
        <Routes>
          <Route path="/app" element={<AppShell />}>
            <Route index element={<DashboardPage />} />
          </Route>
        </Routes>
      </MemoryRouter>,
    );
    await waitFor(() =>
      expect(screen.getAllByRole('heading', { level: 2 })[0]?.textContent).toMatch(/Welcome, Jordan/),
    );
    expect(screen.getAllByText('SportBridge').length).toBeGreaterThan(0);
  });
});
