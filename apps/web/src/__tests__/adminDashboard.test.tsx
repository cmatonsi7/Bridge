import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import type { ActivityEntry, Overview } from '../features/admin/adminService';
import { describeActivity } from '../features/admin/adminService';
import AdminDashboard from '../pages/app/admin/AdminDashboard';

const base: Overview = {
  unclaimed: 4,
  claimedImports: 2,
  organisationsUnverified: 3,
  accounts: { athlete: 120, guardian: 45, coach: 12, organisation: 9 },
  liveOpportunities: 7,
  liveProgrammes: 2,
  applicationsThisWeek: 31,
};
const st = { overview: base, activity: [] as ActivityEntry[] };

vi.mock('../features/admin/adminService', async () => {
  const actual = await vi.importActual<typeof import('../features/admin/adminService')>(
    '../features/admin/adminService',
  );
  return {
    ...actual,
    useOverview: () => ({ status: 'ready', data: st.overview }),
    useActivity: () => ({ status: 'ready', data: st.activity }),
  };
});
vi.mock('../features/onboarding/onboardingService', () => ({
  useImportedOrganisations: () => ({ status: 'ready', data: [] }),
  addOrganisation: vi.fn(),
  newClaimCode: vi.fn(),
  removeOrganisation: vi.fn(),
}));

const entry = (over: Partial<ActivityEntry>): ActivityEntry => ({
  id: 'x',
  type: 'organisation.imported',
  at: '2026-11-11T10:30:00.000Z',
  by: 'staff',
  byName: 'Bongiwe N',
  organisationName: 'Soweto High School',
  organisationId: 'o1',
  source: 'Gauteng schools list',
  ...over,
});
const at = (path = '/app/admin') =>
  render(
    <MemoryRouter initialEntries={[path]}>
      <AdminDashboard />
    </MemoryRouter>,
  );

beforeEach(() => {
  st.overview = base;
  st.activity = [];
});

describe('AdminDashboard', () => {
  it('opens on the Overview with real figures', () => {
    at();
    expect(screen.getByRole('heading', { name: 'Admin Dashboard' })).toBeTruthy();
    expect(screen.getByText('4 waiting to be claimed · 2 claimed')).toBeTruthy();
    expect(screen.getByText('31')).toBeTruthy();
    expect(screen.getByText('120')).toBeTruthy();
    expect(screen.getByText(/Verification tools arrive in a later update/)).toBeTruthy();
  });

  it('shows a dash, not a made-up zero, for a figure it could not read', () => {
    st.overview = { ...base, applicationsThisWeek: null, accounts: { ...base.accounts, coach: null } };
    at();
    const apps = screen.getByText('Applications in the last 7 days').parentElement!;
    expect(within(apps).getByText('—')).toBeTruthy();
    expect(within(apps).queryByText('0')).toBeNull();
    expect(screen.getAllByText('—').length).toBeGreaterThanOrEqual(2);
  });

  it('only offers sections that exist', () => {
    at();
    const nav = screen.getByRole('navigation', { name: 'Admin sections' });
    expect(
      within(nav)
        .getAllByRole('button')
        .map((b) => b.textContent),
    ).toEqual(['Overview', 'Schools & organisations', 'Activity log']);
  });

  it('moves between sections, and the selected one is marked', async () => {
    at();
    fireEvent.click(screen.getByRole('button', { name: 'Schools & organisations' }));
    expect(await screen.findByRole('button', { name: 'Add and create claim code' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Schools & organisations' }).getAttribute('aria-current')).toBe(
      'page',
    );
    fireEvent.click(screen.getByRole('button', { name: 'Overview' }));
    expect(screen.getByText('Applications in the last 7 days')).toBeTruthy();
  });

  it('the Overview button opens the schools section', async () => {
    at();
    fireEvent.click(screen.getByRole('button', { name: 'Manage schools & organisations' }));
    expect(await screen.findByRole('button', { name: 'Add and create claim code' })).toBeTruthy();
  });

  it('remembers the section in the address, and ignores an unknown one', async () => {
    const first = at('/app/admin?tab=activity');
    expect(await screen.findByText(/Nothing yet/)).toBeTruthy();
    first.unmount();
    at('/app/admin?tab=nonsense');
    expect(screen.getByText('Applications in the last 7 days')).toBeTruthy();
  });

  it('lists staff actions in plain language, newest first as supplied', async () => {
    st.activity = [
      entry({ id: '1' }),
      entry({ id: '2', type: 'organisation.claim_code_reset', organisationName: 'Camps Bay High' }),
      entry({ id: '3', type: 'organisation.removed', organisationName: 'Old School' }),
      entry({
        id: '4',
        type: 'organisation.claimed',
        byName: 'Thandi M',
        organisationName: 'Soweto High School',
      }),
    ];
    at('/app/admin?tab=activity');
    const list = await screen.findByRole('list', { name: 'Activity log' });
    const rows = within(list)
      .getAllByRole('listitem')
      .map((r) => r.textContent ?? '');
    expect(rows[0]).toContain('Bongiwe N added Soweto High School (source: Gauteng schools list)');
    expect(rows[1]).toContain('Bongiwe N created a new claim code for Camps Bay High');
    expect(rows[2]).toContain('Bongiwe N removed Old School');
    expect(rows[3]).toContain('Thandi M claimed Soweto High School');
  });
});

describe('describeActivity', () => {
  it('copes with missing names', () => {
    expect(describeActivity(entry({ byName: null, organisationName: null, source: null }))).toBe(
      'A staff member added an organisation',
    );
    expect(describeActivity(entry({ type: 'organisation.claimed', byName: null }))).toBe(
      'A representative claimed Soweto High School',
    );
    expect(describeActivity(entry({ type: 'organisation.something_new' }))).toBe(
      'organisation.something_new',
    );
  });
});
