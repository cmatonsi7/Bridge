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

/** Pages that are built for a role. Anything not listed falls back to the "not available yet" placeholder. */
const BUILT: Partial<Record<Role, Partial<Record<AppSection, ComponentType>>>> = {
  athlete: {
    profile: AthleteProfilePage,
    progress: AthleteProgressPage,
    settings: AthleteSettingsPage,
  },
  guardian: {
    profile: GuardianSettingsPage,
    settings: GuardianSettingsPage,
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
