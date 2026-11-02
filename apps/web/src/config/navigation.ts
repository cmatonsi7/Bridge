import type { Role } from '@sportbridge/shared';

export type AppSection =
  | 'dashboard'
  | 'opportunities'
  | 'programmes'
  | 'messages'
  | 'saved'
  | 'profile'
  | 'progress'
  | 'calendar'
  | 'membership'
  | 'settings'
  | 'directory'
  | 'applications'
  | 'sponsorship'
  | 'admin';

export interface NavItem {
  section: AppSection;
  label: string;
  icon: string; // lucide icon name, resolved in AppShell
  /** Phase in which the page becomes functional. */
  phase: number;
  title: string;
  eyebrow: string;
  description: string;
}

/** Sidebar order and copy follow the prototype. */
export const NAV_ITEMS: NavItem[] = [
  {
    section: 'dashboard',
    label: 'Dashboard',
    icon: 'house',
    phase: 2,
    eyebrow: 'YOUR SPORTING JOURNEY',
    title: 'Dashboard',
    description: 'Your SportBridge overview.',
  },
  {
    section: 'opportunities',
    label: 'Opportunities',
    icon: 'sparkles',
    phase: 3,
    eyebrow: 'DISCOVER',
    title: 'Opportunities',
    description: 'Trials, scholarships, bursaries and more.',
  },
  {
    section: 'programmes',
    label: 'Programmes',
    icon: 'layout-grid',
    phase: 3,
    eyebrow: 'DISCOVER',
    title: 'Programmes',
    description: 'Academies, camps and holiday programmes.',
  },
  {
    section: 'messages',
    label: 'Messages',
    icon: 'mail',
    phase: 5,
    eyebrow: 'CONNECT',
    title: 'Messages',
    description: 'Stay connected with coaches, clubs, programme providers and SportBridge support.',
  },
  {
    section: 'saved',
    label: 'Saved',
    icon: 'heart',
    phase: 3,
    eyebrow: 'SAVED',
    title: 'Saved',
    description: 'Opportunities and programmes you saved.',
  },
  {
    section: 'profile',
    label: 'My Profile',
    icon: 'circle-user',
    phase: 2,
    eyebrow: 'PROFILE',
    title: 'My Profile',
    description: 'How others see you on SportBridge.',
  },
  {
    section: 'progress',
    label: 'My Progress',
    icon: 'trending-up',
    phase: 2,
    eyebrow: 'DEVELOPMENT',
    title: 'My Progress',
    description: 'Track profile completion, achievements and development milestones.',
  },
  {
    section: 'calendar',
    label: 'Calendar',
    icon: 'calendar',
    phase: 2,
    eyebrow: 'SCHEDULE',
    title: 'Calendar',
    description: 'Sessions, trials and deadlines.',
  },
  {
    section: 'membership',
    label: 'Membership',
    icon: 'crown',
    phase: 4,
    eyebrow: 'MEMBERSHIP',
    title: 'My Membership',
    description: 'Unlock more opportunities and get the most out of SportBridge.',
  },
  {
    section: 'settings',
    label: 'Settings',
    icon: 'settings',
    phase: 2,
    eyebrow: 'ACCOUNT',
    title: 'Settings',
    description: 'Manage your account, privacy, notifications and membership preferences.',
  },
  {
    section: 'directory',
    label: 'Talent Directory',
    icon: 'users',
    phase: 3,
    eyebrow: 'DISCOVER PEOPLE',
    title: 'Talent Directory',
    description:
      "Explore athlete, coach and organisation profiles. Visibility follows each profile's privacy setting.",
  },
  {
    section: 'applications',
    label: 'My Applications',
    icon: 'clipboard-check',
    phase: 3,
    eyebrow: 'YOUR SUBMISSIONS',
    title: 'My Applications',
    description: 'Track applications, deadlines and status updates in one place.',
  },
  {
    section: 'sponsorship',
    label: 'Sponsorship',
    icon: 'hand-heart',
    phase: 3,
    eyebrow: 'ATHLETE SUPPORT',
    title: 'Sponsorship Centre',
    description: 'Request support for sporting expenses.',
  },
  {
    section: 'admin',
    label: 'Admin',
    icon: 'layout-dashboard',
    phase: 5,
    eyebrow: 'PLATFORM ADMIN',
    title: 'Admin Control Centre',
    description: 'Manage SportBridge users, opportunities, programmes, moderation and platform settings.',
  },
];

const COMMON: AppSection[] = [
  'dashboard',
  'opportunities',
  'programmes',
  'messages',
  'saved',
  'profile',
  'membership',
  'settings',
];

/** Per-role pages, as defined by the prototype's applyRoleNavigation(). */
export const ROLE_SECTIONS: Record<Role, AppSection[]> = {
  athlete: [...COMMON, 'progress', 'calendar', 'directory', 'applications', 'sponsorship'],
  guardian: [...COMMON, 'progress', 'calendar', 'directory', 'applications', 'sponsorship'],
  coach: [...COMMON, 'calendar', 'directory', 'applications', 'sponsorship'],
  organisation: [...COMMON, 'calendar', 'directory', 'applications', 'sponsorship'],
  admin: [...COMMON, 'progress', 'calendar', 'directory', 'applications', 'sponsorship', 'admin'],
};

export function navFor(role: Role | undefined): NavItem[] {
  const allowed = new Set(ROLE_SECTIONS[role ?? 'athlete']);
  return NAV_ITEMS.filter((i) => allowed.has(i.section));
}

export function canAccess(role: Role | undefined, section: AppSection): boolean {
  return !!role && ROLE_SECTIONS[role].includes(section);
}
