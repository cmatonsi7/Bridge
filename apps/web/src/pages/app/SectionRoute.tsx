import { lazy, Suspense, type ComponentType } from 'react';
import type { Role } from '@sportbridge/shared';
import { effectiveRole, useAuth } from '../../features/auth/AuthProvider';
import type { AppSection, NavItem } from '../../config/navigation';
import { BootScreen } from '../../app/guards';
import SectionPlaceholder from './SectionPlaceholder';

const AthleteProfilePage = lazy(() => import('./athlete/AthleteProfilePage'));
const AthleteProgressPage = lazy(() => import('./athlete/AthleteProgressPage'));
const AthleteSettingsPage = lazy(() => import('./athlete/AthleteSettingsPage'));
const GuardianSettingsPage = lazy(() => import('./guardian/GuardianSettingsPage'));
const CoachProfilePage = lazy(() => import('./coach/CoachProfilePage'));
const CoachSettingsPage = lazy(() => import('./coach/CoachSettingsPage'));
const OrgProfilePage = lazy(() => import('./organisation/OrgProfilePage'));
const OrgSettingsPage = lazy(() => import('./organisation/OrgSettingsPage'));
const BrowseOpportunitiesPage = lazy(() =>
  import('./listings/BrowseListingsPage').then((m) => ({ default: m.BrowseOpportunitiesPage })),
);
const BrowseProgrammesPage = lazy(() =>
  import('./listings/BrowseListingsPage').then((m) => ({ default: m.BrowseProgrammesPage })),
);
const OrgOpportunitiesPage = lazy(() =>
  import('./listings/OrgListingsPage').then((m) => ({ default: m.OrgOpportunitiesPage })),
);
const OrgProgrammesPage = lazy(() =>
  import('./listings/OrgListingsPage').then((m) => ({ default: m.OrgProgrammesPage })),
);
const SavedPage = lazy(() => import('./listings/SavedPage'));
const MyApplicationsPage = lazy(() => import('./applications/MyApplicationsPage'));
const OrgApplicationsPage = lazy(() => import('./applications/OrgApplicationsPage'));
const GuardianApplicationsPage = lazy(() => import('./applications/GuardianApplicationsPage'));

/** Browsing and saving listings are the same for every member role. */
const MEMBER_LISTINGS = {
  opportunities: BrowseOpportunitiesPage,
  programmes: BrowseProgrammesPage,
  saved: SavedPage,
};

/** Pages that are built for a role. Anything not listed falls back to the "not available yet" placeholder. */
const BUILT: Partial<Record<Role, Partial<Record<AppSection, ComponentType>>>> = {
  athlete: {
    ...MEMBER_LISTINGS,
    applications: MyApplicationsPage,
    profile: AthleteProfilePage,
    progress: AthleteProgressPage,
    settings: AthleteSettingsPage,
  },
  guardian: {
    ...MEMBER_LISTINGS,
    applications: GuardianApplicationsPage,
    profile: GuardianSettingsPage,
    settings: GuardianSettingsPage,
  },
  coach: {
    ...MEMBER_LISTINGS,
    profile: CoachProfilePage,
    settings: CoachSettingsPage,
  },
  organisation: {
    opportunities: OrgOpportunitiesPage,
    programmes: OrgProgrammesPage,
    saved: SavedPage,
    applications: OrgApplicationsPage,
    profile: OrgProfilePage,
    settings: OrgSettingsPage,
  },
};

export default function SectionRoute({ item }: { item: NavItem }) {
  const { state } = useAuth();
  const role = state.status === 'signedIn' ? effectiveRole(state.claims) : undefined;
  const Page = role ? BUILT[role]?.[item.section] : undefined;
  if (!Page) return <SectionPlaceholder item={item} />;
  return (
    <Suspense fallback={<BootScreen />}>
      <Page />
    </Suspense>
  );
}
