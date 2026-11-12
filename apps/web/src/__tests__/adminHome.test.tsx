import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { navFor } from '../config/navigation';
import DashboardPage from '../pages/app/DashboardPage';

const st = { role: 'admin' };
vi.mock('../features/auth/AuthProvider', () => ({
  useAuth: () => ({
    state: {
      status: 'signedIn',
      user: { uid: 'u1', email: 's@example.com', displayName: 'Staff One' },
      claims: { role: st.role, admin: st.role === 'admin' },
      profile: {
        uid: 'u1',
        firstName: 'Staff',
        surname: 'One',
        displayName: 'Staff One',
        role: st.role,
        status: 'active',
      },
    },
  }),
  effectiveRole: (c: { role: string }) => c.role,
}));

describe('staff home and navigation', () => {
  it('staff land on the Admin dashboard instead of a personal dashboard', () => {
    st.role = 'admin';
    render(
      <MemoryRouter initialEntries={['/app']}>
        <Routes>
          <Route path="/app" element={<DashboardPage />} />
          <Route path="/app/admin" element={<div>ADMIN HOME</div>} />
        </Routes>
      </MemoryRouter>,
    );
    expect(screen.getByText('ADMIN HOME')).toBeTruthy();
  });

  it('staff see only what they use in the sidebar', () => {
    expect(
      navFor('admin')
        .map((i) => i.section)
        .sort(),
    ).toEqual(['admin', 'directory', 'opportunities', 'programmes']);
  });

  it('other roles keep their full navigation', () => {
    const athlete = navFor('athlete').map((i) => i.section);
    expect(athlete).toContain('progress');
    expect(athlete).toContain('applications');
    expect(athlete).not.toContain('admin');
  });
});
