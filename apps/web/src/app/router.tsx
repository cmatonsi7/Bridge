import { lazy, Suspense } from 'react';
import { createBrowserRouter, Outlet, RouterProvider } from 'react-router-dom';
import { PublicLayout } from '../layouts/PublicLayout';
import { AppShell } from '../layouts/AppShell';
import { BootScreen, GuestOnly, RequireAccount, RequireRole, RequireSection, SignedInOnly } from './guards';
import { NAV_ITEMS } from '../config/navigation';
import HomePage from '../pages/public/HomePage';
import NotFoundPage from '../pages/NotFoundPage';
import RouteErrorBoundary from './RouteErrorBoundary';

const page = (load: () => Promise<{ default: React.ComponentType }>) => {
  const C = lazy(load);
  return (
    <Suspense fallback={<BootScreen />}>
      <C />
    </Suspense>
  );
};

// NOTE: this must not be a component that calls page()/lazy() during render — doing so builds a
// brand-new lazy component on every render, so the Suspense boundary never settles.
const discoverElement = page(() => import('../pages/public/DiscoverPage'));
const RegisterFinish = lazy(() => import('../pages/auth/RegisterPage'));
const SectionRoute = lazy(() => import('../pages/app/SectionRoute'));

const router = createBrowserRouter([
  {
    element: <PublicLayout />,
    errorElement: <RouteErrorBoundary />,
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
      {
        path: '/listings/:listingId',
        element: page(() => import('../pages/public/PublicListingDetailPage')),
      },
      { path: '*', element: <NotFoundPage /> },
    ],
  },
  {
    element: <PublicLayout showCta={false} />,
    errorElement: <RouteErrorBoundary />,
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
    errorElement: <RouteErrorBoundary />,
    children: [
      { index: true, element: page(() => import('../pages/app/DashboardPage')) },
      {
        path: 'listings/new',
        element: (
          <RequireRole role="organisation">
            {page(() => import('../pages/app/listings/ListingEditorPage'))}
          </RequireRole>
        ),
      },
      {
        path: 'listings/:listingId/edit',
        element: (
          <RequireRole role="organisation">
            {page(() => import('../pages/app/listings/ListingEditorPage'))}
          </RequireRole>
        ),
      },
      { path: 'listings/:listingId', element: page(() => import('../pages/app/listings/ListingDetailPage')) },
      { path: 'directory/:uid', element: page(() => import('../pages/app/directory/DirectoryProfilePage')) },
      {
        path: 'children/:childUid',
        element: (
          <RequireRole role="guardian">
            {page(() => import('../pages/app/guardian/ChildProfilePage'))}
          </RequireRole>
        ),
      },
      ...NAV_ITEMS.filter((i) => i.section !== 'dashboard').map((item) => ({
        path: item.section,
        element: (
          <RequireSection section={item.section}>
            <Suspense fallback={<BootScreen />}>
              <SectionRoute item={item} />
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
