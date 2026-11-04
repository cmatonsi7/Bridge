import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { ZodError } from 'zod';
import { fixtures, fullProfile } from './athleteMocks';
import * as service from '../features/athlete/athleteService';
import AthleteProfilePage from '../pages/app/athlete/AthleteProfilePage';
import AthleteProgressPage from '../pages/app/athlete/AthleteProgressPage';
import AthleteSettingsPage from '../pages/app/athlete/AthleteSettingsPage';

vi.mock('../features/auth/AuthProvider', async () => (await import('./athleteMocks')).authMock());
vi.mock('../features/athlete/athleteService', async () => (await import('./athleteMocks')).serviceMock());

const renderIn = (el: JSX.Element) => render(<MemoryRouter>{el}</MemoryRouter>);

beforeEach(() => {
  fixtures.profile = null;
  fixtures.achievements = [];
  vi.clearAllMocks();
});

describe('AthleteProfilePage', () => {
  it('shows honest empty states for a brand-new profile', () => {
    renderIn(<AthleteProfilePage />);
    expect(screen.getByText('Sport and position not added')).toBeTruthy();
    expect(screen.getByText('No skills selected yet.')).toBeTruthy();
  });

  it('shows real saved data', () => {
    fixtures.profile = fullProfile;
    renderIn(<AthleteProfilePage />);
    expect(screen.getByText(/Football · Midfielder/)).toBeTruthy();
    expect(screen.getByText(/Johannesburg, Gauteng · Age 26/)).toBeTruthy();
    expect(screen.getAllByText('Teamwork').length).toBeGreaterThan(0);
  });

  it('saves edits through the service with fixed-list values', async () => {
    renderIn(<AthleteProfilePage />);
    fireEvent.click(screen.getAllByText('Edit Profile')[0]!);
    fireEvent.change(screen.getByLabelText('Sport'), { target: { value: 'Rugby' } });
    fireEvent.change(screen.getByLabelText('Position'), { target: { value: 'Wing' } });
    fireEvent.click(screen.getByRole('button', { name: 'Leadership' }));
    fireEvent.click(screen.getByRole('button', { name: 'Save Changes' }));
    await waitFor(() => expect(service.saveAthleteProfile).toHaveBeenCalled());
    const [, payload] = vi.mocked(service.saveAthleteProfile).mock.calls[0]!;
    expect(payload).toMatchObject({ sport: 'Rugby', position: 'Wing', skills: ['Leadership'] });
    expect(service.saveName).not.toHaveBeenCalled(); // name unchanged
  });

  it('shows field errors returned by validation', async () => {
    vi.mocked(service.saveAthleteProfile).mockRejectedValueOnce(
      new ZodError([{ code: 'custom', path: ['experienceYears'], message: 'Whole years only' }]),
    );
    renderIn(<AthleteProfilePage />);
    fireEvent.click(screen.getAllByText('Edit Profile')[0]!);
    fireEvent.click(screen.getByRole('button', { name: 'Save Changes' }));
    expect(await screen.findByText('Whole years only')).toBeTruthy();
    expect(screen.getByRole('alert').textContent).toMatch(/highlighted/);
  });

  it('marks media and documents as coming soon instead of showing broken screens', () => {
    renderIn(<AthleteProfilePage />);
    fireEvent.click(screen.getByRole('button', { name: 'Documents' }));
    expect(screen.getByText(/coming in an upcoming release/)).toBeTruthy();
  });
});

describe('AthleteProgressPage', () => {
  it('computes completion from real data (0% when empty)', () => {
    renderIn(<AthleteProgressPage />);
    expect(screen.getByRole('img', { name: 'Profile 0% complete' })).toBeTruthy();
    expect(screen.getByText(/No achievements yet/)).toBeTruthy();
  });

  it('reaches 100% with a full profile and one achievement', () => {
    fixtures.profile = fullProfile;
    fixtures.achievements = [
      {
        id: 'a1',
        title: 'District Champions',
        year: 2025,
        organisation: 'Soweto FC',
        detail: null,
        createdAt: 'c',
        updatedAt: 'u',
      },
    ];
    renderIn(<AthleteProgressPage />);
    expect(screen.getByRole('img', { name: 'Profile 100% complete' })).toBeTruthy();
    expect(screen.getByText('District Champions')).toBeTruthy();
  });

  it('adds an achievement', async () => {
    renderIn(<AthleteProgressPage />);
    fireEvent.click(screen.getByRole('button', { name: '＋ Add Achievement' }));
    fireEvent.change(screen.getByLabelText('Achievement'), { target: { value: 'Regional Selection' } });
    fireEvent.change(screen.getByLabelText('Year'), { target: { value: '2025' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save Achievement' }));
    await waitFor(() => expect(service.addAchievement).toHaveBeenCalled());
    expect(vi.mocked(service.addAchievement).mock.calls[0]![1]).toMatchObject({
      title: 'Regional Selection',
      year: 2025,
    });
  });
});

describe('AthleteSettingsPage', () => {
  it('shows the sign-in email read-only and the saved phone number', () => {
    renderIn(<AthleteSettingsPage />);
    const email = screen.getByLabelText('Email address') as HTMLInputElement;
    expect(email.value).toBe('jordan@example.com');
    expect(email.readOnly).toBe(true);
    expect((screen.getByLabelText('Phone number') as HTMLInputElement).value).toBe('0821234567');
  });

  it('saves a privacy toggle', async () => {
    renderIn(<AthleteSettingsPage />);
    fireEvent.click(screen.getByRole('button', { name: 'Privacy' }));
    fireEvent.click(
      screen.getByRole('switch', { name: 'Make my profile discoverable to coaches and clubs' }),
    );
    await waitFor(() => expect(service.savePrivacy).toHaveBeenCalled());
    expect(vi.mocked(service.savePrivacy).mock.calls[0]![1]).toEqual({
      discoverable: true,
      showAchievements: false,
      allowEnquiries: false,
    });
  });
});
