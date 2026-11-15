import { beforeAll, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import type { Role } from '@sportbridge/shared';
import { canAccess, navFor } from '../config/navigation';
import { PublicLayout } from '../layouts/PublicLayout';
import ResourcesPage from '../pages/public/ResourcesPage';

vi.mock('../features/auth/AuthProvider', () => ({ useAuth: () => ({ state: { status: 'signedOut' } }) }));

const sections = (role: Role) => navFor(role).map((i) => i.section);
const ALL_ROLES: Role[] = ['athlete', 'guardian', 'coach', 'organisation', 'admin'];
const labels = (role: Role) => navFor(role).map((i) => i.label);

describe('each role’s sidebar shows only what applies to it', () => {
  it('a parent sees their children’s things, not a personal profile, progress, saved items or sponsorship', () => {
    expect([...sections('guardian')].sort()).toEqual([
      'applications',
      'connections',
      'dashboard',
      'directory',
      'opportunities',
      'programmes',
      'settings',
    ]);
    expect(labels('guardian')).toContain('Children’s applications');
    expect(labels('guardian')).toContain('Coach requests');
    for (const s of ['profile', 'progress', 'saved', 'sponsorship', 'messages', 'membership'] as const)
      expect(canAccess('guardian', s)).toBe(false);
  });

  it('a coach does not get applications, but keeps connections and a profile, and can support athletes', () => {
    expect(canAccess('coach', 'applications')).toBe(false);
    expect(canAccess('coach', 'sponsorship')).toBe(true);
    expect(labels('coach')).toContain('Support athletes');
    expect(canAccess('coach', 'connections')).toBe(true);
    expect(canAccess('coach', 'profile')).toBe(true);
  });

  it('an organisation reviews “Applications” and can support athletes, with no coach connections or saved items', () => {
    expect(labels('organisation')).toContain('Applications');
    expect(labels('organisation')).not.toContain('My Applications');
    for (const s of ['connections', 'saved', 'progress'] as const)
      expect(canAccess('organisation', s)).toBe(false);
    expect(labels('organisation')).toContain('Support athletes');
    expect(canAccess('organisation', 'applications')).toBe(true);
  });

  it('an athlete keeps the full set, and every role can reach its dashboard', () => {
    expect(sections('athlete')).toContain('sponsorship');
    expect(sections('athlete')).toContain('progress');
    expect(labels('athlete')).toContain('My Applications');
    for (const role of ALL_ROLES) expect(canAccess(role, 'dashboard') || role === 'admin').toBe(true);
  });
});

describe('public pages', () => {
  beforeAll(() => {
    window.scrollTo = vi.fn() as unknown as typeof window.scrollTo;
  });
  const at = (path: string) =>
    render(
      <MemoryRouter initialEntries={[path]}>
        <PublicLayout showCta={false} />
      </MemoryRouter>,
    );

  it('give each page its own browser title, and a sensible one for unknown pages', () => {
    at('/about');
    expect(document.title).toBe('About — SportBridge');
    at('/resources');
    expect(document.title).toBe('Resources — SportBridge');
    at('/no-such-page');
    expect(document.title).toBe('SportBridge — People. Opportunities. Sport.');
  });

  it('leave the title of an organisation page to that page', () => {
    document.title = 'Durban Netball Academy — SportBridge';
    at('/organisations/abc');
    expect(document.title).toBe('Durban Netball Academy — SportBridge');
  });

  it('Resources has real, honest content and no promises about unbuilt features', () => {
    render(
      <MemoryRouter>
        <ResourcesPage />
      </MemoryRouter>,
    );
    expect(screen.getByText('How verification works')).toBeTruthy();
    expect(screen.getByRole('button', { name: /Create an account/ })).toBeTruthy();
    const text = document.body.textContent ?? '';
    for (const claim of ['messaging', 'sponsorship', 'guarantee', 'safe and secure'])
      expect(text.toLowerCase()).not.toContain(claim);
  });
});
