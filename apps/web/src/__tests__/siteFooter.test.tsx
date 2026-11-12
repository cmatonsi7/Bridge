import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { SiteFooter } from '../layouts/SiteFooter';

// Read the real router so a renamed or removed route fails this test instead of shipping a dead link.
const ROUTER = readFileSync(resolve(process.cwd(), 'src/app/router.tsx'), 'utf8');
const realRoutes = new Set([...ROUTER.matchAll(/path: '(\/[a-z/-]*)'/g)].map((m) => m[1]!));

describe('SiteFooter', () => {
  it('shows the brand, the year and the sections', () => {
    render(
      <MemoryRouter>
        <SiteFooter />
      </MemoryRouter>,
    );
    expect(screen.getByText('PLATFORM')).toBeTruthy();
    expect(screen.getByText('FOR YOU')).toBeTruthy();
    expect(screen.getByText('COMPANY')).toBeTruthy();
    expect(screen.getByText(new RegExp(`© ${new Date().getFullYear()} SportBridge`))).toBeTruthy();
  });

  it('every link points at a route that exists', () => {
    render(
      <MemoryRouter>
        <SiteFooter />
      </MemoryRouter>,
    );
    const hrefs = screen.getAllByRole('link').map((a) => a.getAttribute('href')!);
    expect(hrefs.length).toBeGreaterThan(8);
    for (const href of hrefs) expect(realRoutes.has(href), `${href} is not a route`).toBe(true);
  });

  it('lists the legal pages as text, not as links that go nowhere', () => {
    render(
      <MemoryRouter>
        <SiteFooter />
      </MemoryRouter>,
    );
    for (const label of ['Safety & Child Protection', 'Privacy & POPIA', 'Terms of Use']) {
      expect(screen.getByText(label)).toBeTruthy();
      expect(screen.queryByRole('link', { name: label })).toBeNull();
    }
  });
});
