import { useState } from 'react';
import { Search } from 'lucide-react';
import {
  DIRECTORY_ROLES,
  PROVINCES,
  SPORTS,
  filterDirectory,
  type DirectoryFilters,
  type DirectoryRole,
} from '@sportbridge/shared';
import { useDirectory } from '../../../features/directory/directoryService';
import { DirectoryCard } from '../../../features/directory/DirectoryCard';
import { BootScreen } from '../../../app/guards';

const ROLE_LABEL: Record<DirectoryRole, string> = {
  athlete: 'Athletes',
  coach: 'Coaches',
  organisation: 'Organisations',
};

/** Talent Directory: only people who chose to be listed. Under-18 athletes never appear. */
export default function DirectoryPage() {
  const dir = useDirectory();
  const [f, setF] = useState<DirectoryFilters>({});
  if (dir.status === 'loading') return <BootScreen label="Loading the directory…" />;
  if (dir.status === 'error')
    return (
      <div className="sb-card sb-empty" role="alert">
        {dir.message}
      </div>
    );
  const items = filterDirectory(dir.data, f);
  const set = <K extends keyof DirectoryFilters>(k: K, v: DirectoryFilters[K]) => setF({ ...f, [k]: v });

  return (
    <section className="sb-page active" id="sb-page-directory">
      <div className="sb-page-head">
        <div>
          <div className="sb-kicker">DISCOVER PEOPLE</div>
          <h1>Talent Directory</h1>
          <p>Explore athletes, coaches and organisations who have chosen to be listed.</p>
        </div>
      </div>
      <div className="sb-filterbar">
        <div className="sb-page-search">
          <Search className="icon" aria-hidden="true" />
          <input
            aria-label="Search the directory"
            placeholder="Search names, sports or towns…"
            value={f.query ?? ''}
            onChange={(e) => set('query', e.target.value)}
          />
        </div>
        <label className="sr-only" htmlFor="d-role">
          Role
        </label>
        <select
          id="d-role"
          className="sb-input"
          value={f.role ?? ''}
          onChange={(e) => set('role', e.target.value as DirectoryRole | '')}
          style={{ minWidth: 0, flex: '1 1 150px' }}
        >
          <option value="">Everyone</option>
          {DIRECTORY_ROLES.map((r) => (
            <option key={r} value={r}>
              {ROLE_LABEL[r]}
            </option>
          ))}
        </select>
        <label className="sr-only" htmlFor="d-sport">
          Sport
        </label>
        <select
          id="d-sport"
          className="sb-input"
          value={f.sport ?? ''}
          onChange={(e) => set('sport', e.target.value as never)}
          style={{ minWidth: 0, flex: '1 1 150px' }}
        >
          <option value="">All sports</option>
          {SPORTS.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
        <label className="sr-only" htmlFor="d-prov">
          Province
        </label>
        <select
          id="d-prov"
          className="sb-input"
          value={f.province ?? ''}
          onChange={(e) => set('province', e.target.value as never)}
          style={{ minWidth: 0, flex: '1 1 170px' }}
        >
          <option value="">All provinces</option>
          {PROVINCES.map((p) => (
            <option key={p} value={p}>
              {p}
            </option>
          ))}
        </select>
      </div>
      <p className="sb-meta" role="status" style={{ marginBottom: 12 }}>
        {items.length} {items.length === 1 ? 'result' : 'results'}
      </p>
      {dir.data.length === 0 ? (
        <div className="sb-card sb-empty">
          Nobody is listed yet. People appear here once they turn on discoverability in their settings. For
          safety, athletes under 18 are never listed.
        </div>
      ) : items.length === 0 ? (
        <div className="sb-card sb-empty">No results match your search. Try clearing a filter.</div>
      ) : (
        <div className="sb-grid-3">
          {items.map((e) => (
            <DirectoryCard key={e.id} entry={e} />
          ))}
        </div>
      )}
    </section>
  );
}
