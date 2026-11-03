import { describe, expect, it, vi, afterEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { AuthProvider } from '../../features/auth/AuthProvider';
import { PublicLayout } from '../PublicLayout';

// Regression test for a recurring production crash ("n is not a function" inside React's own
// effect-invocation code, Chrome-only, every page, traced via sourcemap resolution to this exact
// component). PublicLayout's navigation effect calls window.scrollTo, which fires asynchronously
// after paint — if anything makes window.scrollTo unavailable by the time the effect actually
// runs, an unguarded call throws deep inside React. This simulates exactly that condition.
describe('PublicLayout', () => {
  const originalScrollTo = window.scrollTo;
  afterEach(() => {
    window.scrollTo = originalScrollTo;
  });

  it('does not throw when window.scrollTo is unavailable at effect time', async () => {
    // @ts-expect-error -- simulating scrollTo being removed/overwritten by something external
    window.scrollTo = undefined;
    expect(() =>
      render(
        <AuthProvider>
          <MemoryRouter initialEntries={['/']}>
            <Routes>
              <Route path="/" element={<PublicLayout />}>
                <Route index element={<div>page content</div>} />
              </Route>
            </Routes>
          </MemoryRouter>
        </AuthProvider>,
      ),
    ).not.toThrow();
    expect(screen.getByText('page content')).toBeTruthy();
  });

  it('still scrolls to top when window.scrollTo is a normal function', () => {
    const spy = vi.fn();
    window.scrollTo = spy;
    render(
      <AuthProvider>
        <MemoryRouter initialEntries={['/']}>
          <Routes>
            <Route path="/" element={<PublicLayout />}>
              <Route index element={<div>page content</div>} />
            </Route>
          </Routes>
        </MemoryRouter>
      </AuthProvider>,
    );
    expect(spy).toHaveBeenCalledWith({ top: 0 });
  });
});