import type { ReactNode } from 'react';
import { Calendar, MapPin, Tag, Users } from 'lucide-react';
import { formatDate, formatPrice, isOpen } from '@sportbridge/shared';
import type { ListingWithId } from './listingsService';
import { listingImage } from './listingImage';

/** Full listing details, shared by the in-app and public detail pages. `actions` renders the buttons. */
export function ListingDetails({
  listing: l,
  actions,
  publicSite = false,
}: {
  listing: ListingWithId;
  actions?: ReactNode;
  publicSite?: boolean;
}) {
  const open = isOpen(l);
  const card = publicSite ? 'op-card' : 'sb-card';
  const meta = publicSite ? 'meta' : 'sb-meta';
  return (
    <div className={card} style={{ overflow: 'hidden' }}>
      <img
        src={listingImage(l.sports)}
        alt=""
        style={{ width: '100%', height: 220, objectFit: 'cover', display: 'block' }}
      />
      <div style={{ padding: 22 }}>
        <span className={publicSite ? 'tag' : 'sb-tag'}>{l.type.toUpperCase()}</span>{' '}
        {l.status === 'draft' && <span className="v-badge pending">Draft — not visible to others</span>}
        {!open && l.status !== 'draft' && <span className="v-badge pending">Closed</span>}
        <h1 style={{ margin: '12px 0 6px', fontSize: 26 }}>{l.title}</h1>
        <p className={meta}>
          {l.orgName}{' '}
          <span className={`v-badge ${l.orgVerified ? 'ok' : 'pending'}`}>
            {l.orgVerified ? 'Verified organisation' : 'Organisation not yet verified'}
          </span>
        </p>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))',
            gap: 12,
            margin: '16px 0',
          }}
        >
          <p className={meta}>
            <MapPin className="icon" aria-hidden="true" /> {l.city}, {l.province}
          </p>
          <p className={meta}>
            <Calendar className="icon" aria-hidden="true" /> Closes {formatDate(l.deadline)}
          </p>
          {l.startDate && (
            <p className={meta}>
              <Calendar className="icon" aria-hidden="true" /> {formatDate(l.startDate)}
              {l.endDate ? ` – ${formatDate(l.endDate)}` : ''}
            </p>
          )}
          <p className={meta}>
            <Users className="icon" aria-hidden="true" /> Ages {l.ageMin}–{l.ageMax}
          </p>
          <p className={meta}>
            <Tag className="icon" aria-hidden="true" /> {formatPrice(l)}
          </p>
        </div>
        <div className="sb-pill-row" style={{ marginBottom: 14 }}>
          {l.sports.map((s) => (
            <span className="sb-pill" key={s}>
              {s}
            </span>
          ))}
          {l.inclusions.map((i) => (
            <span className="sb-pill" key={i}>
              Includes {i.toLowerCase()}
            </span>
          ))}
        </div>
        <p style={{ whiteSpace: 'pre-line', lineHeight: 1.7 }}>{l.description}</p>
        {actions && (
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 20 }}>{actions}</div>
        )}
      </div>
    </div>
  );
}
