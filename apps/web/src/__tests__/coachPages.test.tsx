import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import type { CoachProfileDoc } from '@sportbridge/shared';
import * as cs from '../features/coach/coachService';
import CoachProfilePage from '../pages/app/coach/CoachProfilePage';
import CoachSettingsPage from '../pages/app/coach/CoachSettingsPage';
import { CoachDashboard } from '../features/coach/CoachDashboard';

const c = {
  profile: null as CoachProfileDoc | null,
  quals: [] as Array<{
    id: string;
    title: string;
    issuer: string | null;
    year: number | null;
    createdAt: string;
    updatedAt: string;
  }>,
};
const fullCoach: CoachProfileDoc = {
  uid: 'c1',
  displayName: 'Sibusiso Khumalo',
  visibility: 'members',
  createdAt: '',
  updatedAt: '',
  sports: ['Football'],
  coachingLevel: 'Club',
  experienceYears: 10,
  organisation: 'Soweto FC',
  city: 'Soweto',
  province: 'Gauteng',
  bio: 'Youth football coach for ten years.',
  specialisations: ['Youth Development'],
  services: ['Group Sessions'],
  ageGroups: ['Under 16'],
};

vi.mock('../features/account/useSignedInUser', () => ({
  useSignedInUser: () => ({
    uid: 'c1',
    email: 'coach@example.com',
    user: {
      uid: 'c1',
      firstName: 'Sibusiso',
      surname: 'Khumalo',
      displayName: 'Sibusiso Khumalo',
      role: 'coach',
      isMinor: false,
      status: 'active',
    },
  }),
}));
vi.mock('../features/athlete/athleteService', () => ({
  usePrivateDetails: () => ({ status: 'ready', data: { dateOfBirth: '1985-01-01', mobile: '0821234567' } }),
  saveMobile: vi.fn(async () => {}),
}));
vi.mock('../features/directory/directoryService', () => ({
  useCoachConnections: () => ({ status: 'ready', data: [] }),
  syncDirectory: vi.fn(async () => ({ listed: true })),
}));
vi.mock('../features/coach/coachService', () => ({
  useCoachProfile: () => ({ status: 'ready', data: c.profile }),
  useQualifications: () => ({ status: 'ready', data: c.quals }),
  saveCoachProfile: vi.fn(async () => {}),
  saveCoachName: vi.fn(async () => {}),
  saveCoachPrivacy: vi.fn(async () => {}),
  addQualification: vi.fn(async () => {}),
  updateQualification: vi.fn(async () => {}),
  deleteQualification: vi.fn(async () => {}),
}));

const renderIn = (el: JSX.Element) => render(<MemoryRouter>{el}</MemoryRouter>);

beforeEach(() => {
  c.profile = null;
  c.quals = [];
  vi.clearAllMocks();
});

describe('CoachProfilePage', () => {
  it('shows honest empty states and a self-declared badge', () => {
    renderIn(<CoachProfilePage />);
    expect(screen.getByText('Sports and level not added')).toBeTruthy();
    expect(screen.getByText('Credentials self-declared')).toBeTruthy();
  });

  it('shows saved data', () => {
    c.profile = fullCoach;
    renderIn(<CoachProfilePage />);
    expect(screen.getByText(/Football · Club level/)).toBeTruthy();
    expect(screen.getByText('Youth Development')).toBeTruthy();
  });

  it('saves edits with fixed-list values', async () => {
    renderIn(<CoachProfilePage />);
    fireEvent.click(screen.getAllByText('Edit Profile')[0]!);
    fireEvent.change(screen.getByLabelText('Coaching level'), { target: { value: 'Academy' } });
    fireEvent.click(screen.getByRole('button', { name: 'Rugby' }));
    fireEvent.click(screen.getByRole('button', { name: 'Holiday Camps' }));
    fireEvent.click(screen.getByRole('button', { name: 'Save Changes' }));
    await waitFor(() => expect(cs.saveCoachProfile).toHaveBeenCalled());
    expect(vi.mocked(cs.saveCoachProfile).mock.calls[0]![1]).toMatchObject({
      coachingLevel: 'Academy',
      sports: ['Rugby'],
      services: ['Holiday Camps'],
    });
  });

  it('adds a qualification marked self-declared', async () => {
    renderIn(<CoachProfilePage />);
    fireEvent.click(screen.getByRole('button', { name: 'Qualifications' }));
    fireEvent.click(screen.getByRole('button', { name: '＋ Add Qualification' }));
    fireEvent.change(screen.getByLabelText('Qualification'), { target: { value: 'SAFA C Licence' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save Qualification' }));
    await waitFor(() => expect(cs.addQualification).toHaveBeenCalled());
    expect(vi.mocked(cs.addQualification).mock.calls[0]![1]).toMatchObject({
      title: 'SAFA C Licence',
      year: null,
    });
  });
});

describe('CoachSettingsPage', () => {
  it('saves a privacy switch', async () => {
    renderIn(<CoachSettingsPage />);
    fireEvent.click(screen.getByRole('button', { name: 'Privacy' }));
    fireEvent.click(screen.getByRole('switch', { name: 'Accept coaching enquiries' }));
    await waitFor(() => expect(cs.saveCoachPrivacy).toHaveBeenCalled());
    expect(vi.mocked(cs.saveCoachPrivacy).mock.calls[0]![1]).toEqual({
      discoverable: false,
      showQualifications: false,
      allowEnquiries: true,
    });
  });
});

describe('CoachDashboard', () => {
  it('computes completion from real data and does not show a fake roster', () => {
    c.profile = fullCoach;
    c.quals = [
      { id: 'q1', title: 'SAFA C Licence', issuer: 'SAFA', year: 2022, createdAt: 'c', updatedAt: 'u' },
    ];
    renderIn(<CoachDashboard uid="c1" firstName="Sibusiso" />);
    expect(screen.getByRole('img', { name: 'Profile 100% complete' })).toBeTruthy();
    expect(screen.getByText(/0 connected athletes/)).toBeTruthy();
    expect(screen.getByText(/No connected athletes yet/)).toBeTruthy();
  });
});
