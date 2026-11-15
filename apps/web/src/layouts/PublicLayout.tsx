import { useEffect } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { Header } from './Header';
import HomeCta from './HomeCta';
import { SiteFooter } from './SiteFooter';

const SITE = 'SportBridge';
const TITLES: Record<string, string> = {
  '/': 'SportBridge — People. Opportunities. Sport.',
  '/discover': 'Discover organisations',
  '/features': 'Features',
  '/features/athletes': 'Athlete profiles',
  '/features/coaches': 'For coaches',
  '/features/talent-discovery': 'For parents and guardians',
  '/features/organisations': 'For organisations',
  '/about': 'About',
  '/opportunities': 'Opportunities',
  '/programmes': 'Holiday programmes',
  '/resources': 'Resources',
};

/** Public site frame: prototype header, page content, and the shared "Join SportBridge" call to action. */
export function PublicLayout({ showCta = true }: { showCta?: boolean }) {
  const { pathname } = useLocation();
  useEffect(() => {
    // Organisation pages name themselves once they have loaded; every other page gets its own title.
    if (pathname.startsWith('/organisations/')) return;
    const t = TITLES[pathname];
    document.title = !t ? TITLES['/']! : t.startsWith(SITE) ? t : `${t} — ${SITE}`;
  }, [pathname]);
  useEffect(() => {
    // Defensive: call window.scrollTo only if it's actually callable, and never return
    // anything from this effect (scrollTo's own return value is not a cleanup function).
    // This is the one effect that runs on every single page and every navigation, and was
    // traced via sourcemap resolution as the exact site of a recurring Chrome-only crash
    // ("n is not a function" inside React's effect-invocation code) — something outside this
    // component's control made window.scrollTo unavailable at the moment the effect actually
    // ran (effects fire asynchronously, after paint, not at render time).
    if (typeof window !== 'undefined' && typeof window.scrollTo === 'function') {
      window.scrollTo({ top: 0 });
    }
  }, [pathname]);
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
      <SiteFooter />
    </>
  );
}
