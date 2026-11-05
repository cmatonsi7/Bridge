import { useNavigate } from 'react-router-dom';
import { Building2, ClipboardList, MapPin, UserRound } from 'lucide-react';
import type { DirectoryEntry } from './directoryService';

const ROLE_LABEL = { athlete: 'Athlete', coach: 'Coach', organisation: 'Organisation' } as const;

export function DirectoryCard({ entry: e }: { entry: DirectoryEntry }) {
  const navigate = useNavigate();
  const Icon = e.role === 'organisation' ? Building2 : e.role === 'coach' ? ClipboardList : UserRound;
  const initials = e.displayName
    .split(' ')
    .map((p) => p[0])
    .filter(Boolean)
    .slice(0, 2)
    .join('')
    .toUpperCase();
  return (
    <div className="sb-card" style={{ padding: 16 }}>
      <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
        <div
          className="sb-avatar"
          aria-hidden="true"
          style={{
            display: 'grid',
            placeItems: 'center',
            background: '#006B35',
            color: '#fff',
            fontWeight: 800,
          }}
        >
          {initials}
        </div>
        <div>
          <h3 style={{ margin: 0 }}>{e.displayName}</h3>
          <p className="sb-meta">
            <Icon className="icon" aria-hidden="true" /> {ROLE_LABEL[e.role]}
            {e.verified === false && e.role === 'organisation' && (
              <span className="v-badge pending" style={{ marginLeft: 6 }}>
                Not yet verified
              </span>
            )}
          </p>
        </div>
      </div>
      {e.headline && (
        <p className="sb-meta" style={{ marginTop: 8 }}>
          {e.headline}
        </p>
      )}
      <p className="sb-meta">
        <MapPin className="icon" aria-hidden="true" />{' '}
        {[e.city, e.province].filter(Boolean).join(', ') || 'Location not added'}
      </p>
      {(e.sports.length > 0 || e.tags.length > 0) && (
        <div className="sb-pill-row" style={{ marginTop: 8 }}>
          {e.sports.map((s) => (
            <span className="sb-pill" key={s}>
              {s}
            </span>
          ))}
          {e.tags.slice(0, 3).map((t) => (
            <span className="sb-pill" key={t}>
              {t}
            </span>
          ))}
        </div>
      )}
      <button
        type="button"
        className="sb-btn primary"
        style={{ marginTop: 12 }}
        onClick={() => navigate(`/app/directory/${e.uid}`)}
      >
        View profile
      </button>
    </div>
  );
}
