import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import HomePage from '../pages/public/HomePage';

vi.mock('../features/auth/AuthProvider', () => ({ useAuth: () => ({ state: { status: 'signedOut' } }) }));
vi.mock('../features/listings/listingsService', () => ({
  usePublishedListings: () => ({ status: 'ready', data: [] }),
}));

const home = () =>
  render(
    <MemoryRouter>
      <HomePage />
    </MemoryRouter>,
  );

describe('membership pricing (client figures, 2026-11-11)', () => {
  it('shows the monthly prices by default, with the annual price alongside', () => {
    home();
    expect(screen.getByText('R149')).toBeTruthy();
    expect(screen.getByText('R499')).toBeTruthy();
    expect(screen.getByText(/R1 490 \/ year — two months free/)).toBeTruthy();
    expect(screen.getByText(/R4 990 \/ year — two months free/)).toBeTruthy();
  });

  it('switches the prices themselves when Annual is chosen', () => {
    home();
    fireEvent.click(screen.getByRole('button', { name: /Annual/ }));
    expect(screen.getByText('R1 490')).toBeTruthy();
    expect(screen.getByText('R4 990')).toBeTruthy();
    expect(screen.queryByText('R149')).toBeNull();
    expect(screen.getAllByText('/ year').length).toBeGreaterThan(0);
  });

  it('goes back to monthly, and never shows the old prices', () => {
    home();
    fireEvent.click(screen.getByRole('button', { name: /Annual/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Monthly' }));
    expect(screen.getByText('R149')).toBeTruthy();
    for (const old of ['R99', 'R199', 'R299']) expect(screen.queryByText(old)).toBeNull();
  });

  it('mentions the 30-day organisation trial', () => {
    home();
    expect(screen.getByText(/30-day free trial for approved organisations/)).toBeTruthy();
  });
});

describe('pricing buttons lead somewhere honest', () => {
  const at = () =>
    render(
      <MemoryRouter>
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/register" element={<p>REGISTER PAGE</p>} />
        </Routes>
      </MemoryRouter>,
    );

  it('says paid plans are not open yet, and does not pretend to sell them', () => {
    at();
    // once under the plans, once in the FAQ
    expect(screen.getAllByText(/Paid plans are not open yet, so nothing is charged today/)).toHaveLength(2);
    expect(screen.queryByRole('button', { name: /Get Pro/ })).toBeNull();
    expect(screen.queryByRole('button', { name: /Get Organisation/ })).toBeNull();
  });

  it.each(['Get Started →', 'Start free →', 'Create an organisation account →'])(
    '“%s” takes the visitor to sign-up',
    (label) => {
      at();
      fireEvent.click(screen.getByRole('button', { name: label }));
      expect(screen.getByText('REGISTER PAGE')).toBeTruthy();
    },
  );
});
