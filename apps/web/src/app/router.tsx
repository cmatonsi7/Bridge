import { lazy, Suspense } from 'react';
import { createBrowserRouter, Outlet, RouterProvider } from 'react-router-dom';
import { PublicLayout } from '../layouts/PublicLayout';
import { AppShell } from '../layouts/AppShell';
import { BootScreen, GuestOnly, RequireAccount, RequireSection, SignedInOnly } from './guards';
import { NAV_ITEMS } from '../config/navigation';
import HomePage from '../pages/public/HomePage';
import NotFoundPage from '../pages/NotFoundPage';

const page = (load: () => Promise<{ default: React.ComponentType }>) => {
  const C = lazy(load);
  return (
    <Suspense fallback={<BootScreen />}>
      <C />
    </Suspense>
  );
};

const discoverElement = page(() => import('../pages/public/DiscoverPage'));
const RegisterFinish = lazy(() => import('../pages/auth/RegisterPage'));
const SectionPlaceholder = lazy(() => import('../pages/app/SectionPlaceholder'));

const router = createBrowserRouter([
  {
    element: <PublicLayout />,
    children: [
      { path: '/', element: <HomePage /> },
      { path: '/discover', element: discoverElement },      
      { path: '/features', element: page(() => import('../pages/public/FeaturesPage')) },
      { path: '/features/athletes', element: page(() => import('../pages/public/FeatureAthletesPage')) },
      { path: '/features/coaches', element: page(() => import('../pages/public/FeatureCoachesPage')) },
      {
        path: '/features/talent-discovery',
        element: page(() => import('../pages/public/FeatureDiscoveryPage')),
      },
      {
        path: '/features/organisations',
        element: page(() => import('../pages/public/FeatureOrganisationsPage')),
      },
      { path: '/about', element: page(() => import('../pages/public/AboutPage')) },
      { path: '/opportunities', element: page(() => import('../pages/public/OpportunitiesPage')) },
      { path: '/programmes', element: page(() => import('../pages/public/ProgrammesPage')) },
      { path: '/athletes', element: page(() => import('../pages/public/AthletesPage')) },
      { path: '/coaches', element: page(() => import('../pages/public/CoachesPage')) },
      { path: '/clubs', element: page(() => import('../pages/public/ClubsPage')) },
      { path: '/resources', element: page(() => import('../pages/public/ResourcesPage')) },
      { path: '*', element: <NotFoundPage /> },
    ],
  },
  {
    element: <PublicLayout showCta={false} />,
    children: [
      { path: '/sign-in', element: <GuestOnly>{page(() => import('../pages/auth/SignInPage'))}</GuestOnly> },
      {
        path: '/register',
        element: <GuestOnly>{page(() => import('../pages/auth/RegisterPage'))}</GuestOnly>,
      },
      { path: '/reset-password', element: page(() => import('../pages/auth/ResetPasswordPage')) },
      {
        path: '/verify-email',
        element: <SignedInOnly>{page(() => import('../pages/auth/VerifyEmailPage'))}</SignedInOnly>,
      },
      {
        path: '/register/finish',
        element: (
          <SignedInOnly>
            <Suspense fallback={<BootScreen />}>
              <RegisterFinish mode="finish" />
            </Suspense>
          </SignedInOnly>
        ),
      },
    ],
  },
  {
    path: '/app',
    element: (
      <RequireAccount>
        <AppShell />
      </RequireAccount>
    ),
    children: [
      { index: true, element: page(() => import('../pages/app/DashboardPage')) },
      ...NAV_ITEMS.filter((i) => i.section !== 'dashboard').map((item) => ({
        path: item.section,
        element: (
          <RequireSection section={item.section}>
            <Suspense fallback={<BootScreen />}>
              <SectionPlaceholder item={item} />
            </Suspense>
          </RequireSection>
        ),
      })),
      { path: '*', element: <Outlet /> },
    ],
  },
]);

export function AppRouter() {
  return <RouterProvider router={router} />;
}
