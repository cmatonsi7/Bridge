import { useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { ChevronDown, Menu, X } from 'lucide-react';
import { useAuth } from '../features/auth/AuthProvider';

const FEATURE_LINKS = [
  { to: '/features/athletes', title: 'Athlete Profiles', sub: 'Showcase your sporting journey' },
  {
    to: '/features/coaches',
    title: 'Coaches & Mentors',
    sub: 'Connect with people who can support your growth',
  },
  { to: '/features/talent-discovery', title: 'Talent Discovery', sub: 'Discover talent. Get discovered.' },
  { to: '/features/organisations', title: 'Organisations', sub: 'Connect with the sporting ecosystem' },
];

/** Public site header, migrated from the prototype's header.nav with a mobile menu added. */
export function Header() {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const { state, signOut } = useAuth();
  const [featuresOpen, setFeaturesOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const signedIn = state.status === 'signedIn';

  useEffect(() => {
    setFeaturesOpen(false);
    setMenuOpen(false);
  }, [pathname]);

  useEffect(() => {
    const close = (e: MouseEvent) => {
      if (!dropdownRef.current?.contains(e.target as Node)) setFeaturesOpen(false);
    };
    const esc = (e: KeyboardEvent) => e.key === 'Escape' && (setFeaturesOpen(false), setMenuOpen(false));
    document.addEventListener('click', close);
    document.addEventListener('keydown', esc);
    return () => {
      document.removeEventListener('click', close);
      document.removeEventListener('keydown', esc);
    };
  }, []);

  const go = (to: string) => () => navigate(to);

  return (
    <header className={`nav${menuOpen ? ' menu-open' : ''}`}>
      <div className="nav-inner">
        <button
          className="logo"
          onClick={go('/')}
          type="button"
          style={{ border: 0, background: 'transparent', cursor: 'pointer', padding: 0, textAlign: 'left' }}
          aria-label="SportBridge home"
        >
          <img alt="" className="brand-logo-img" src="/images/sportbridge-logo.webp" width={44} height={44} />
          <div>
            <strong>SportBridge</strong>
            <small>PEOPLE. OPPORTUNITIES. SPORT.</small>
          </div>
        </button>
        <nav className="navlinks" id="site-nav" aria-label="Main">
          <button type="button" onClick={go('/')} aria-current={pathname === '/' ? 'page' : undefined}>
            Home
          </button>
          <button
            type="button"
            onClick={go('/discover')}
            aria-current={pathname === '/discover' ? 'page' : undefined}
          >
            Discover
          </button>
          <button
            type="button"
            onClick={go('/opportunities')}
            aria-current={pathname === '/opportunities' ? 'page' : undefined}
          >
            Opportunities
          </button>
          <div className="nav-dropdown" ref={dropdownRef}>
            <button
              className="nav-dropdown-btn"
              type="button"
              aria-expanded={featuresOpen}
              aria-controls="featuresMenu"
              onClick={(e) => {
                e.stopPropagation();
                setFeaturesOpen((o) => !o);
              }}
            >
              Features{' '}
              <span>
                <ChevronDown className="icon" aria-hidden="true" />
              </span>
            </button>
            <div className={`nav-dropdown-menu${featuresOpen ? ' open' : ''}`} id="featuresMenu">
              {FEATURE_LINKS.map((f) => (
                <button key={f.to} type="button" onClick={go(f.to)}>
                  <strong>{f.title}</strong>
                  <small>{f.sub}</small>
                </button>
              ))}
            </div>
          </div>
          <button
            type="button"
            onClick={go('/about')}
            aria-current={pathname === '/about' ? 'page' : undefined}
          >
            About
          </button>
          {signedIn ? (
            <button
              type="button"
              className="nav-mobile-only"
              onClick={() => void signOut().then(() => navigate('/'))}
            >
              Sign Out
            </button>
          ) : (
            <button type="button" className="nav-mobile-only" onClick={go('/sign-in')}>
              Sign In
            </button>
          )}
        </nav>
        <div className="nav-actions">
          {signedIn ? (
            <>
              <button
                className="btn nav-login-btn"
                type="button"
                onClick={() => void signOut().then(() => navigate('/'))}
              >
                Sign Out
              </button>
              <button className="btn green" type="button" onClick={go('/app')}>
                Dashboard
              </button>
            </>
          ) : (
            <>
              <button className="btn nav-login-btn" type="button" onClick={go('/sign-in')}>
                Sign In
              </button>
              <button className="btn green" type="button" onClick={go('/register')}>
                Get Started
              </button>
            </>
          )}
          <button
            className="nav-menu-btn"
            type="button"
            aria-label={menuOpen ? 'Close menu' : 'Open menu'}
            aria-expanded={menuOpen}
            aria-controls="site-nav"
            onClick={() => setMenuOpen((o) => !o)}
          >
            {menuOpen ? <X size={20} aria-hidden="true" /> : <Menu size={20} aria-hidden="true" />}
          </button>
        </div>
      </div>
    </header>
  );
}
