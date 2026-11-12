import { useEffect, useState, type ComponentType } from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import {
  Calendar,
  CircleUser,
  ClipboardCheck,
  Crown,
  HandHeart,
  Heart,
  House,
  LayoutDashboard,
  LayoutGrid,
  LogOut,
  Mail,
  Menu,
  Search,
  Settings,
  Sparkles,
  TrendingUp,
  Undo2,
  Users,
  type LucideProps,
} from 'lucide-react';
import { ROLE_LABELS } from '@sportbridge/shared';
import { NotificationsBell } from '../features/applications/NotificationsBell';
import { useDirectoryReconcile } from '../features/directory/useDirectoryReconcile';
import { effectiveRole, useAuth } from '../features/auth/AuthProvider';
import { navFor } from '../config/navigation';

const ICONS: Record<string, ComponentType<LucideProps>> = {
  house: House,
  sparkles: Sparkles,
  'layout-grid': LayoutGrid,
  mail: Mail,
  heart: Heart,
  'circle-user': CircleUser,
  'trending-up': TrendingUp,
  calendar: Calendar,
  crown: Crown,
  settings: Settings,
  users: Users,
  'clipboard-check': ClipboardCheck,
  'hand-heart': HandHeart,
  'layout-dashboard': LayoutDashboard,
};

/** Signed-in frame migrated from the prototype's #sbApp sidebar + top bar. */
export function AppShell() {
  const { state, signOut } = useAuth();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const [mobileNav, setMobileNav] = useState(false);
  useEffect(() => setMobileNav(false), [pathname]);
  if (state.status !== 'signedIn') return null;

  const role = effectiveRole(state.claims);
  useDirectoryReconcile(state.user.uid, role);
  const profile = typeof state.profile === 'object' ? state.profile : null;
  const name = profile?.displayName ?? state.user.displayName ?? state.user.email ?? '';
  const initials = name
    .split(' ')
    .map((p) => p[0])
    .filter(Boolean)
    .slice(0, 2)
    .join('')
    .toUpperCase();
  const items = navFor(role);
  const main = items.filter((i) => i.section !== 'admin');
  const admin = items.find((i) => i.section === 'admin');

  const link = (section: string) => (section === 'dashboard' ? '/app' : `/app/${section}`);

  return (
    <div id="sbApp" className={`open${mobileNav ? ' mobile-nav' : ''}`}>
      <aside className="sb-sidebar" aria-label="SportBridge navigation">
        <div className="sb-brand">
          <div className="sb-brand-mark">
            <img alt="" src="/images/sportbridge-logo.webp" />
          </div>
          <div>
            <strong>SportBridge</strong>
            <small>CONNECTING SPORT</small>
          </div>
        </div>
        <div className="sb-nav-label">MY SPORTBRIDGE</div>
        <nav className="sb-nav">
          {main.map((i) => {
            const Icon = ICONS[i.icon] ?? House;
            return (
              <NavLink
                key={i.section}
                to={link(i.section)}
                end={i.section === 'dashboard'}
                className={({ isActive }) => (isActive ? 'active' : '')}
                style={{ display: 'flex', textDecoration: 'none' }}
              >
                <span className="ico">
                  <Icon className="icon" aria-hidden="true" />
                </span>
                {i.label}
              </NavLink>
            );
          })}
        </nav>
        <div className="sb-nav-label">PLATFORM</div>
        <nav className="sb-nav">
          {admin && (
            <NavLink
              to="/app/admin"
              className={({ isActive }) => (isActive ? 'active' : '')}
              style={{ display: 'flex', textDecoration: 'none' }}
            >
              <span className="ico">
                <LayoutDashboard className="icon" aria-hidden="true" />
              </span>
              Admin
            </NavLink>
          )}
          <button type="button" onClick={() => navigate('/')}>
            <span className="ico">
              <Undo2 className="icon" aria-hidden="true" />
            </span>
            Return to website
          </button>
          <button type="button" onClick={() => void signOut().then(() => navigate('/'))}>
            <span className="ico">
              <LogOut className="icon" aria-hidden="true" />
            </span>
            Sign out
          </button>
        </nav>
      </aside>
      <div className="sb-main">
        <header className="sb-topbar">
          <button
            aria-label="Menu"
            aria-expanded={mobileNav}
            className="sb-mobile-menu"
            type="button"
            onClick={() => setMobileNav((o) => !o)}
          >
            <Menu className="icon" aria-hidden="true" />
          </button>
          <div className="sb-search">
            <Search className="icon" aria-hidden="true" />{' '}
            <input
              aria-label="Search"
              placeholder="Search opportunities, programmes, clubs..."
              disabled
              title="Search arrives with opportunities (Phase 3)"
            />
          </div>
          <div className="sb-top-actions">
            <NotificationsBell uid={state.user.uid} />
            <button
              className="sb-user"
              type="button"
              onClick={() => navigate('/app/profile')}
              style={{ border: 0, background: 'transparent', cursor: 'pointer', textAlign: 'left' }}
            >
              <div
                className="sb-avatar"
                aria-hidden="true"
                style={{
                  display: 'grid',
                  placeItems: 'center',
                  background: '#006B35',
                  color: '#fff',
                  fontWeight: 800,
                  fontSize: 14.5,
                }}
              >
                {initials}
              </div>
              <div className="sb-user-text">
                <b>{name}</b>
                <span>{role ? ROLE_LABELS[role] : ''}</span>
              </div>
            </button>
          </div>
        </header>
        <main className="sb-content" id="main">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
