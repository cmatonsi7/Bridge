import { vi } from 'vitest';
import type { AthleteProfileDoc, UserDoc } from '@sportbridge/shared';

export const user: UserDoc = {
  uid: 'u1',
  email: 'jordan@example.com',
  firstName: 'Jordan',
  surname: 'Mokoena',
  displayName: 'Jordan Mokoena',
  role: 'athlete',
  status: 'active',
  isMinor: false,
  onboardingComplete: true,
  termsVersion: 'v',
  termsAcceptedAt: '',
  createdAt: '',
  updatedAt: '',
};

export const fullProfile: AthleteProfileDoc = {
  uid: 'u1',
  displayName: 'Jordan Mokoena',
  visibility: 'members',
  createdAt: '',
  updatedAt: '',
  sport: 'Football',
  position: 'Midfielder',
  city: 'Johannesburg',
  province: 'Gauteng',
  club: 'Soweto FC',
  school: 'Orlando High',
  experienceYears: 4,
  bio: 'Passionate footballer who trains every day.',
  skills: ['Teamwork', 'Leadership'],
  interests: ['Football', 'Sports Science'],
};

/** Mutable fixtures the mocked service returns. Tests set these before rendering. */
export const fixtures = {
  profile: null as AthleteProfileDoc | null,
  achievements: [] as Array<{
    id: string;
    title: string;
    year: number;
    organisation: string | null;
    detail: string | null;
    createdAt: string;
    updatedAt: string;
  }>,
};

export const authMock = () => ({
  useAuth: () => ({
    state: {
      status: 'signedIn',
      user: { uid: 'u1', email: 'jordan@example.com', displayName: 'Jordan Mokoena', emailVerified: true },
      claims: { role: 'athlete' },
      profile: user,
    },
    configured: true,
    refresh: vi.fn(),
    signOut: vi.fn(),
  }),
  effectiveRole: (c: { role?: string; admin?: boolean }) => (c.admin ? 'admin' : c.role),
});

export const serviceMock = () => ({
  useAthleteProfile: () => ({ status: 'ready', data: fixtures.profile }),
  useAchievements: () => ({ status: 'ready', data: fixtures.achievements }),
  usePrivateDetails: () => ({ status: 'ready', data: { dateOfBirth: '2000-01-01', mobile: '0821234567' } }),
  saveAthleteProfile: vi.fn(async () => {}),
  saveName: vi.fn(async () => {}),
  saveMobile: vi.fn(async () => {}),
  savePrivacy: vi.fn(async () => {}),
  addAchievement: vi.fn(async () => {}),
  updateAchievement: vi.fn(async () => {}),
  deleteAchievement: vi.fn(async () => {}),
  ageFromDob: () => 26,
});
