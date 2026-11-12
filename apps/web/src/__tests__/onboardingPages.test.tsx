import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import type { DirectoryEntryDoc } from '@sportbridge/shared';
import { ApiError } from '../lib/apiClient';
import * as os from '../features/onboarding/onboardingService';
import { ClaimOrganisationCard } from '../features/onboarding/ClaimOrganisationCard';
import AdminOnboardingPage from '../pages/app/admin/AdminSchoolsSection';
import { DirectoryCard } from '../features/directory/DirectoryCard';
import DirectoryProfilePage from '../pages/app/directory/DirectoryProfilePage';
import { OrgDashboard } from '../features/organisation/OrgDashboard';

const st = {
  imported: [] as Array<Record<string, unknown>>,
  org: {
    name: 'My School',
    type: 'school',
    ownerUid: 'o1',
    verified: false,
    createdAt: '',
    updatedAt: '',
  } as Record<string, unknown>,
  entry: null as (DirectoryEntryDoc & { id: string }) | null,
};

vi.mock('../features/onboarding/onboardingService', () => ({
  claimOrganisation: vi.fn(async () => ({ organisationId: 'org1', name: 'Soweto High School' })),
  addOrganisation: vi.fn(async () => ({
    id: 'org1',
    claimCode: 'SB-7K4M-9XQ2',
    expiresAt: '2027-01-10T00:00:00.000Z',
  })),
  newClaimCode: vi.fn(async () => ({ claimCode: 'SB-NEW2-CODE', expiresAt: '2027-01-10T00:00:00.000Z' })),
  removeOrganisation: vi.fn(async () => ({ ok: true })),
  useImportedOrganisations: () => ({ status: 'ready', data: st.imported }),
}));
vi.mock('../features/organisation/useMyOrganisation', () => ({
  useMyOrganisation: () => ({
    me: { uid: 'o1', email: 'o@example.com', user: { uid: 'o1', displayName: 'Owner' } },
    orgId: 'org1',
    org: { status: 'ready', data: st.org },
  }),
}));
vi.mock('../features/account/useSignedInUser', () => ({
  useSignedInUser: () => ({
    uid: 'u1',
    email: 'x@example.com',
    user: { uid: 'u1', role: 'guardian', status: 'active', isMinor: false },
  }),
}));
vi.mock('../features/directory/directoryService', () => ({
  useDirectoryEntry: () => ({ status: 'ready', data: st.entry }),
  useCoachConnections: () => ({ status: 'ready', data: [] }),
  requestConnection: vi.fn(),
}));
vi.mock('../features/listings/listingsService', () => ({
  useOrgListings: () => ({ status: 'ready', data: [] }),
  useMyListings: () => ({ status: 'ready', data: [] }),
}));
vi.mock('../features/applications/applicationsService', () => ({
  useApplicationsTo: () => ({ status: 'ready', data: [] }),
}));

const unclaimed: DirectoryEntryDoc & { id: string } = {
  id: 'org_org1',
  uid: 'org_org1',
  role: 'organisation',
  displayName: 'Soweto High School',
  sports: ['Football'],
  province: 'Gauteng',
  city: 'Soweto',
  headline: 'A public high school.',
  tags: [],
  orgId: 'org1',
  verified: false,
  claimed: false,
  updatedAt: '',
};
const r = (el: JSX.Element) => render(<MemoryRouter>{el}</MemoryRouter>);

beforeEach(() => {
  st.imported = [];
  st.org = {
    name: 'My School',
    type: 'school',
    ownerUid: 'o1',
    verified: false,
    createdAt: '',
    updatedAt: '',
  };
  st.entry = unclaimed;
  vi.clearAllMocks();
});

describe('ClaimOrganisationCard', () => {
  it('sends the code as typed, and the button waits until something is entered', async () => {
    r(<ClaimOrganisationCard />);
    const button = screen.getByRole('button', { name: 'Claim my organisation' }) as HTMLButtonElement;
    expect(button.disabled).toBe(true);
    fireEvent.change(screen.getByLabelText('Claim code'), { target: { value: 'sb-7k4m-9xq2' } });
    fireEvent.click(button);
    await waitFor(() => expect(os.claimOrganisation).toHaveBeenCalledWith('sb-7k4m-9xq2'));
  });
  it('shows the server’s explanation when the code is refused', async () => {
    vi.mocked(os.claimOrganisation).mockRejectedValueOnce(
      new ApiError(404, 'CODE_INVALID', 'That claim code isn’t valid. Check it and try again.'),
    );
    r(<ClaimOrganisationCard />);
    fireEvent.change(screen.getByLabelText('Claim code'), { target: { value: 'SB-AAAA-BBBB' } });
    fireEvent.click(screen.getByRole('button', { name: 'Claim my organisation' }));
    expect(await screen.findByText(/That claim code isn’t valid/)).toBeTruthy();
  });
});

describe('organisation dashboard and the claim card', () => {
  it('offers the claim card to a self-registered, unverified organisation', () => {
    r(<OrgDashboard />);
    expect(screen.getByText('Is your school or club already on SportBridge?')).toBeTruthy();
  });
  it('does not offer it once the organisation is verified, or if it came from SportBridge', () => {
    st.org = { ...st.org, verified: true };
    const { unmount } = r(<OrgDashboard />);
    expect(screen.queryByText('Is your school or club already on SportBridge?')).toBeNull();
    unmount();
    st.org = { ...st.org, verified: false, source: 'staff_import', claimStatus: 'claimed' };
    r(<OrgDashboard />);
    expect(screen.queryByText('Is your school or club already on SportBridge?')).toBeNull();
  });
});

describe('AdminOnboardingPage', () => {
  it('validates before sending, then shows the claim code once with a clear warning', async () => {
    r(<AdminOnboardingPage />);
    fireEvent.click(screen.getByRole('button', { name: 'Add and create claim code' }));
    expect(await screen.findByText('Check the highlighted fields.')).toBeTruthy();
    expect(os.addOrganisation).not.toHaveBeenCalled();

    fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'Soweto High School' } });
    fireEvent.change(screen.getByLabelText('City / town'), { target: { value: 'Soweto' } });
    fireEvent.change(screen.getByLabelText('Province'), { target: { value: 'Gauteng' } });
    fireEvent.click(screen.getByRole('button', { name: 'Football' }));
    fireEvent.change(screen.getByLabelText('Where did this information come from?'), {
      target: { value: 'Gauteng schools list' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Add and create claim code' }));

    expect((await screen.findByTestId('claim-code')).textContent).toBe('SB-7K4M-9XQ2');
    expect(screen.getByText(/shown only now/)).toBeTruthy();
    expect(vi.mocked(os.addOrganisation).mock.calls[0]![0]).toMatchObject({
      name: 'Soweto High School',
      type: 'school',
      province: 'Gauteng',
      sports: ['Football'],
    });
    fireEvent.click(screen.getByRole('button', { name: 'I’ve copied it' }));
    expect(screen.queryByTestId('claim-code')).toBeNull();
  });
  it('copies the claim code to the clipboard when asked', async () => {
    const writeText = vi.fn(async () => {});
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });
    st.imported = [
      {
        id: 'a',
        name: 'Soweto High School',
        type: 'school',
        province: 'Gauteng',
        city: 'Soweto',
        claimStatus: 'unclaimed',
        createdAt: '2',
      },
    ];
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    r(<AdminOnboardingPage />);
    fireEvent.click(screen.getByRole('button', { name: 'New claim code' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Copy code' }));
    await waitFor(() => expect(writeText).toHaveBeenCalledWith('SB-NEW2-CODE'));
    expect(await screen.findByText('Copied ✓')).toBeTruthy();
  });

  it('lists what was added, with re-code and remove only for unclaimed ones', async () => {
    st.imported = [
      {
        id: 'a',
        name: 'Soweto High School',
        type: 'school',
        province: 'Gauteng',
        city: 'Soweto',
        claimStatus: 'unclaimed',
        schoolNumber: '700123',
        createdAt: '2',
      },
      {
        id: 'b',
        name: 'Cape Academy',
        type: 'academy',
        province: 'Western Cape',
        city: 'Cape Town',
        claimStatus: 'claimed',
        createdAt: '1',
      },
    ];
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    r(<AdminOnboardingPage />);
    expect(screen.getByText('Unclaimed')).toBeTruthy();
    expect(screen.getByText('Claimed')).toBeTruthy();
    expect(screen.getAllByRole('button', { name: 'Remove' })).toHaveLength(1);
    fireEvent.click(screen.getByRole('button', { name: 'New claim code' }));
    await waitFor(() => expect(os.newClaimCode).toHaveBeenCalledWith('a'));
    expect((await screen.findByTestId('claim-code')).textContent).toBe('SB-NEW2-CODE');
  });
});

describe('unclaimed organisations in the directory', () => {
  it('the card says SportBridge added it', () => {
    r(<DirectoryCard entry={unclaimed} />);
    expect(screen.getByText('Added by SportBridge')).toBeTruthy();
    expect(screen.queryByText('Not yet verified')).toBeNull();
  });
  it('the profile explains it cannot post yet and how a representative takes it over', () => {
    render(
      <MemoryRouter initialEntries={['/app/directory/org_org1']}>
        <Routes>
          <Route path="/app/directory/:uid" element={<DirectoryProfilePage />} />
        </Routes>
      </MemoryRouter>,
    );
    expect(screen.getByText(/hasn’t been claimed yet, so it can’t post opportunities/)).toBeTruthy();
    expect(screen.getByText(/ask SportBridge for your claim code/)).toBeTruthy();
    expect(screen.queryByText('Open opportunities and programmes')).toBeNull();
  });
});
