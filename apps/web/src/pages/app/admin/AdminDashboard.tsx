import { useSearchParams } from 'react-router-dom';
import { lazy, Suspense } from 'react';
import { BootScreen } from '../../../app/guards';
import AdminOverview from './AdminOverview';

const AdminSchoolsSection = lazy(() => import('./AdminSchoolsSection'));
const AdminImport = lazy(() => import('./AdminImport'));
const AdminVerification = lazy(() => import('./AdminVerification'));
const AdminActivity = lazy(() => import('./AdminActivity'));

/** Sections appear here only once they exist, so staff never open a tab that leads nowhere. */
const TABS = [
  { key: 'overview', label: 'Overview' },
  { key: 'schools', label: 'Schools & organisations' },
  { key: 'import', label: 'Import' },
  { key: 'verification', label: 'Verification' },
  { key: 'activity', label: 'Activity log' },
] as const;
type TabKey = (typeof TABS)[number]['key'];

/** The single staff dashboard. The selected section lives in the address (?tab=) so it survives a refresh. */
export default function AdminDashboard() {
  const [params, setParams] = useSearchParams();
  const asked = params.get('tab');
  const tab: TabKey = TABS.some((t) => t.key === asked) ? (asked as TabKey) : 'overview';
  const open = (key: TabKey) => setParams(key === 'overview' ? {} : { tab: key }, { replace: false });

  return (
    <section className="sb-page active" id="sb-page-admin">
      <div className="sb-page-head">
        <div>
          <div className="sb-kicker">PLATFORM ADMIN</div>
          <h1>Admin Dashboard</h1>
          <p>
            See what is happening on SportBridge and add schools and organisations. Only SportBridge staff can
            see this area.
          </p>
        </div>
      </div>

      <nav className="sb-tabs" aria-label="Admin sections">
        {TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            aria-current={tab === t.key ? 'page' : undefined}
            onClick={() => open(t.key)}
          >
            {t.label}
          </button>
        ))}
      </nav>

      <Suspense fallback={<BootScreen />}>
        {tab === 'overview' && (
          <AdminOverview
            onOpenSchools={() => open('schools')}
            onOpenVerification={() => open('verification')}
          />
        )}
        {tab === 'schools' && <AdminSchoolsSection />}
        {tab === 'import' && <AdminImport />}
        {tab === 'verification' && <AdminVerification />}
        {tab === 'activity' && <AdminActivity />}
      </Suspense>
    </section>
  );
}
