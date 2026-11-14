import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Search } from 'lucide-react';
import { ORGANISATION_TYPES, ORGANISATION_TYPE_LABELS, PROVINCES, SPORTS } from '@sportbridge/shared';
import { useAuth } from '../../features/auth/AuthProvider';
import { PublicOrgCard } from '../../features/public/PublicOrgCard';
import {
  NO_FILTERS,
  filterOrganisations,
  sortOrganisations,
  usePublicOrganisations,
} from '../../features/public/publicDirectory';

type Tab = 'organisations' | 'athletes' | 'coaches';
const TABS: Array<{ key: Tab; label: string }> = [
  { key: 'organisations', label: 'Organisations' },
  { key: 'athletes', label: 'Athletes' },
  { key: 'coaches', label: 'Coaches' },
];

/**
 * Public Discover page. It shows real, listed organisations only. Athletes and coaches chose to be found by
 * signed-in members, not by the open internet, so for them this page points to sign-in.
 */
export default function DiscoverPage() {
  const [tab, setTab] = useState<Tab>('organisations');
  const [filters, setFilters] = useState(NO_FILTERS);
  const orgs = usePublicOrganisations();
  const { state: auth } = useAuth();
  const signedIn = auth.status === 'signedIn';
  const set = (k: keyof typeof NO_FILTERS, v: string) => setFilters((f) => ({ ...f, [k]: v }));
  const filtered = orgs.status === 'ready' ? sortOrganisations(filterOrganisations(orgs.data, filters)) : [];
  const anyFilter = Object.values(filters).some(Boolean);

  return (
    <section className="page active" id="discover">
      <div className="discover-hero">
        <div className="wrap">
          <span className="eyebrow">DISCOVER SPORTBRIDGE</span>
          <h1>
            Discover. <span>Connect. Grow.</span>
          </h1>
          <p>Explore the schools, clubs and academies on SportBridge.</p>
          <div className="discover-search">
            <span>
              <Search className="icon" aria-hidden="true" />
            </span>
            <input
              id="discoverSearch"
              type="search"
              aria-label="Search organisations"
              placeholder="Search by name, town or sport…"
              value={filters.q}
              onChange={(e) => {
                set('q', e.target.value);
                setTab('organisations');
              }}
            />
            <button
              className="btn green"
              type="button"
              onClick={() =>
                document.getElementById('discoverResults')?.scrollIntoView?.({ behavior: 'smooth' })
              }
            >
              Search
            </button>
          </div>
        </div>
      </div>

      <section className="section" id="discoverResults">
        <div className="wrap">
          <div className="discover-tabs" role="tablist" aria-label="What to discover">
            {TABS.map((t) => (
              <button
                key={t.key}
                type="button"
                role="tab"
                aria-selected={tab === t.key}
                className={tab === t.key ? 'active' : ''}
                onClick={() => setTab(t.key)}
              >
                {t.label}
              </button>
            ))}
          </div>

          {tab === 'organisations' ? (
            <>
              <div className="section-head discover-heading">
                <span className="eyebrow">SCHOOLS, CLUBS AND ACADEMIES</span>
                <h2>Organisations on SportBridge.</h2>
                <p>
                  Each one is marked Verified once SportBridge has checked it, or “Added by SportBridge” until
                  its representative takes it over.
                </p>
              </div>

              <div className="discover-filters">
                <select
                  aria-label="Sport"
                  value={filters.sport}
                  onChange={(e) => set('sport', e.target.value)}
                >
                  <option value="">All sports</option>
                  {SPORTS.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
                <select
                  aria-label="Province"
                  value={filters.province}
                  onChange={(e) => set('province', e.target.value)}
                >
                  <option value="">All provinces</option>
                  {PROVINCES.map((p) => (
                    <option key={p} value={p}>
                      {p}
                    </option>
                  ))}
                </select>
                <select aria-label="Type" value={filters.type} onChange={(e) => set('type', e.target.value)}>
                  <option value="">All types</option>
                  {ORGANISATION_TYPES.map((t) => (
                    <option key={t} value={t}>
                      {ORGANISATION_TYPE_LABELS[t]}
                    </option>
                  ))}
                </select>
                {anyFilter && (
                  <button type="button" className="btn" onClick={() => setFilters(NO_FILTERS)}>
                    Clear filters
                  </button>
                )}
              </div>

              {orgs.status === 'loading' ? (
                <p className="meta">Loading organisations…</p>
              ) : orgs.status === 'error' ? (
                <p className="meta" role="alert">
                  {orgs.message}
                </p>
              ) : orgs.data.length === 0 ? (
                <div className="discover-empty">
                  <h3>No organisations are listed yet</h3>
                  <p>
                    Schools, clubs and academies are being added now. Create a free account to be ready when
                    they appear.
                  </p>
                  <Link className="btn green" to="/register">
                    Create a free account
                  </Link>
                </div>
              ) : filtered.length === 0 ? (
                <div className="discover-empty">
                  <h3>No organisations match</h3>
                  <p>Try a different sport or province, or clear the filters.</p>
                  <button type="button" className="btn green" onClick={() => setFilters(NO_FILTERS)}>
                    Clear filters
                  </button>
                </div>
              ) : (
                <>
                  <p className="meta" role="status">
                    Showing {filtered.length} of {orgs.data.length}{' '}
                    {orgs.data.length === 1 ? 'organisation' : 'organisations'}
                  </p>
                  <div className="discover-grid" id="discoverGrid">
                    {filtered.map((o) => (
                      <PublicOrgCard key={o.id} org={o} />
                    ))}
                  </div>
                </>
              )}
            </>
          ) : (
            <div className="discover-empty">
              <h3>{tab === 'athletes' ? 'Athletes' : 'Coaches'} are visible to signed-in members</h3>
              <p>
                {tab === 'athletes' ? 'Athletes' : 'Coaches'} choose to be found by other SportBridge members,
                not by the whole internet. Under-18s are never listed at all.
                {signedIn
                  ? ' Open the Talent Directory to search.'
                  : ' Sign in to search the Talent Directory.'}
              </p>
              {signedIn ? (
                <Link className="btn green" to="/app/directory">
                  Open the Talent Directory
                </Link>
              ) : (
                <div style={{ display: 'flex', gap: 10, justifyContent: 'center', flexWrap: 'wrap' }}>
                  <Link className="btn green" to="/sign-in">
                    Sign in
                  </Link>
                  <Link className="btn" to="/register">
                    Create a free account
                  </Link>
                </div>
              )}
            </div>
          )}
        </div>
      </section>
    </section>
  );
}
