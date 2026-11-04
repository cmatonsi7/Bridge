import { useNavigate } from 'react-router-dom';
import { Heart } from 'lucide-react';
import { formatDate, formatPrice } from '@sportbridge/shared';
import type { ListingWithId } from './listingsService';
import { listingImage } from './listingImage';

/** In-app listing card (prototype .sb-op-card), with an optional save toggle. */
export function ListingCard({
  listing: l,
  saved,
  onToggleSave,
}: {
  listing: ListingWithId;
  saved?: boolean;
  onToggleSave?: () => void;
}) {
  const navigate = useNavigate();
  const dates = l.startDate
    ? `${formatDate(l.startDate)}${l.endDate ? ` – ${formatDate(l.endDate)}` : ''}`
    : null;
  return (
    <article className="sb-card sb-op-card">
      <div className="sb-op-img">
        <img src={listingImage(l.sports)} alt="" loading="lazy" />
        {onToggleSave && (
          <button
            type="button"
            className="sb-bookmark"
            aria-pressed={!!saved}
            aria-label={saved ? `Remove ${l.title} from saved` : `Save ${l.title}`}
            onClick={onToggleSave}
          >
            <Heart className="icon" aria-hidden="true" fill={saved ? 'currentColor' : 'none'} />
          </button>
        )}
      </div>
      <div className="sb-op-body">
        <span className="sb-tag">{l.type.toUpperCase()}</span>
        <h3>{l.title}</h3>
        <div className="sb-meta">
          {l.orgName}
          {!l.orgVerified && (
            <span className="v-badge pending" style={{ marginLeft: 6 }}>
              Not yet verified
            </span>
          )}
          <br />
          {l.city}, {l.province}
          <br />
          {dates ? `${dates} · ` : ''}Closes {formatDate(l.deadline)}
        </div>
        <div className="sb-tags">
          {l.sports.map((s) => (
            <span className="sb-pill" key={s}>
              {s}
            </span>
          ))}
          <span className="sb-pill">
            Ages {l.ageMin}–{l.ageMax}
          </span>
          <span className="sb-pill">{formatPrice(l)}</span>
        </div>
        <div className="sb-op-footer">
          <button type="button" className="sb-btn primary" onClick={() => navigate(`/app/listings/${l.id}`)}>
            View details
          </button>
        </div>
      </div>
    </article>
  );
}
