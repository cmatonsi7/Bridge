import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import type { OrganisationFullDoc } from '@sportbridge/shared';
import * as os from '../features/organisation/orgService';
import OrgProfilePage from '../pages/app/organisation/OrgProfilePage';
import OrgSettingsPage from '../pages/app/organisation/OrgSettingsPage';
import { OrgDashboard } from '../features/organisation/OrgDashboard';

const newOrg: OrganisationFullDoc = {
  name: 'Soweto FC',
  type: 'club',
  ownerUid: 'o1',
  verified: false,
  createdAt: '',
  updatedAt: '',
};
const fullOrg: OrganisationFullDoc = {
  ...newOrg,
  description: 'A community football club developing young players in Soweto since 1998.',
  contactEmail: 'info@sowetofc.co.za',
  contactPhone: '0111234567',
  website: 'https://sowetofc.co.za',
  city: 'Soweto',
  province: 'Gauteng',
  sports: ['Football'],
  ageGroups: ['Under 16'],
  offerings: ['Trials'],
  facilities: ['Grass Field'],
};
const st = { org: newOrg as OrganisationFullDoc | null, orgId: 'org1' as string | undefined };

vi.mock('../features/account/useSignedInUser', () => ({
  useSignedInUser: () => ({
    uid: 'o1',
    email: 'owner@sowetofc.co.za',
    user: {
      uid: 'o1',
      firstName: 'Thandi',
      surname: 'Nkosi',
      displayName: 'Thandi Nkosi',
      role: 'organisation',
      organisationId: st.orgId,
    },
  }),
}));
vi.mock('../features/athlete/athleteService', () => ({
  usePrivateDetails: () => ({ status: 'ready', data: { dateOfBirth: '1980-01-01', mobile: '0821234567' } }),
  saveMobile: vi.fn(async () => {}),
}));
const dash = { listings: [] as Array<Record<string, unknown>>, apps: [] as Array<Record<string, unknown>> };
vi.mock('../features/listings/listingsService', () => ({
  useMyListings: () => ({ status: 'ready', data: dash.listings }),
}));
vi.mock('../features/applications/applicationsService', () => ({
  useApplicationsTo: () => ({ status: 'ready', data: dash.apps }),
}));
vi.mock('../features/directory/directoryService', () => ({
  syncDirectory: vi.fn(async () => ({ listed: true })),
}));
vi.mock('../features/organisation/orgService', () => ({
  useOrganisation: () => ({ status: 'ready', data: st.org }),
  saveOrganisation: vi.fn(async () => {}),
  saveOrgPrivacy: vi.fn(async () => {}),
  saveOwnerName: vi.fn(async () => {}),
}));

const renderIn = (el: JSX.Element) => render(<MemoryRouter>{el}</MemoryRouter>);

beforeEach(() => {
  st.org = newOrg;
  st.orgId = 'org1';
  dash.listings = [];
  dash.apps = [];
  vi.clearAllMocks();
});

describe('OrgDashboard', () => {
  it('shows real counts of live and draft listings and applications waiting', () => {
    const future = new Date(Date.now() + 10 * 86400000).toISOString().slice(0, 10);
    dash.listings = [
      { id: 'a', kind: 'opportunity', status: 'published', deadline: future },
      { id: 'b', kind: 'opportunity', status: 'published', deadline: future },
      { id: 'c', kind: 'opportunity', status: 'draft', deadline: future },
      { id: 'd', kind: 'programme', status: 'published', deadline: '2020-01-01' },
    ];
    dash.apps = [
      { id: '1', status: 'submitted' },
      { id: '2', status: 'accepted' },
    ];
    renderIn(<OrgDashboard />);
    expect(screen.getByText('2 live · 1 draft')).toBeTruthy();
    expect(screen.getByText('0 live')).toBeTruthy(); // the programme's date has passed
    expect(screen.getByText('1 waiting for review · 2 in total')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Manage opportunities' })).toBeTruthy();
  });

  it('shows real completion, an unverified badge and honest empty sections', () => {
    renderIn(<OrgDashboard />);
    expect(screen.getByRole('img', { name: 'Profile 0% complete' })).toBeTruthy();
    expect(screen.getAllByText('Not yet verified').length).toBeGreaterThan(0);
    expect(screen.getByText(/haven’t created any opportunities yet/)).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Create your first opportunity' })).toBeTruthy();
  });
  it('reaches 100% with a complete profile', () => {
    st.org = fullOrg;
    renderIn(<OrgDashboard />);
    expect(screen.getByRole('img', { name: 'Profile 100% complete' })).toBeTruthy();
  });
  it('explains a missing organisation link instead of crashing', () => {
    st.orgId = undefined;
    renderIn(<OrgDashboard />);
    expect(screen.getByText(/couldn’t find your organisation/)).toBeTruthy();
  });
});

describe('OrgProfilePage', () => {
  it('saves edits, and the form never sends verified or ownerUid', async () => {
    renderIn(<OrgProfilePage />);
    fireEvent.click(screen.getAllByText('Edit Profile')[0]!);
    fireEvent.change(screen.getByLabelText('Contact email'), { target: { value: 'info@sowetofc.co.za' } });
    fireEvent.click(screen.getByRole('button', { name: 'Trials' }));
    fireEvent.click(screen.getByRole('button', { name: 'Save Changes' }));
    await waitFor(() => expect(os.saveOrganisation).toHaveBeenCalled());
    const [orgId, payload] = vi.mocked(os.saveOrganisation).mock.calls[0]!;
    expect(orgId).toBe('org1');
    expect(payload).toMatchObject({
      contactEmail: 'info@sowetofc.co.za',
      offerings: ['Trials'],
      name: 'Soweto FC',
    });
    expect(payload).not.toHaveProperty('verified');
    expect(payload).not.toHaveProperty('ownerUid');
  });
  it('shows contact details on the Contact tab', () => {
    st.org = fullOrg;
    renderIn(<OrgProfilePage />);
    fireEvent.click(screen.getByRole('button', { name: 'Contact' }));
    expect(screen.getByText('info@sowetofc.co.za')).toBeTruthy();
    expect(screen.getByRole('link', { name: 'https://sowetofc.co.za' })).toBeTruthy();
  });
});

describe('OrgSettingsPage', () => {
  it('saves a privacy switch against the organisation', async () => {
    renderIn(<OrgSettingsPage />);
    fireEvent.click(screen.getByRole('button', { name: 'Privacy' }));
    fireEvent.click(screen.getByRole('switch', { name: 'List my organisation in the Talent Directory' }));
    await waitFor(() =>
      expect(os.saveOrgPrivacy).toHaveBeenCalledWith('org1', {
        listed: true,
        showContactDetails: false,
        acceptEnquiries: false,
      }),
    );
  });
  it('explains that teams are one-owner for now', () => {
    renderIn(<OrgSettingsPage />);
    fireEvent.click(screen.getByRole('button', { name: 'Team' }));
    expect(screen.getByText(/one owner for now/)).toBeTruthy();
  });
});
