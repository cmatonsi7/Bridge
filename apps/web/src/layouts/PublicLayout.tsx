import { useEffect } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { Header } from './Header';
import HomeCta from './HomeCta';

/** Public site frame: prototype header, page content, and the shared "Join SportBridge" call to action. */
export function PublicLayout({ showCta = true }: { showCta?: boolean }) {
  const { pathname } = useLocation();
  useEffect(() => window.scrollTo({ top: 0 }), [pathname]);
  return (
    <>
      <a href="#main" className="sr-only">
        Skip to content
      </a>
      <Header />
      <main id="main">
        <Outlet />
      </main>
      {showCta && <HomeCta />}
    </>
  );
}
