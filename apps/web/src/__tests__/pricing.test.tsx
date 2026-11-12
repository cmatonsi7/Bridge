import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
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
