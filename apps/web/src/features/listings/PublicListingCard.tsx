import { useNavigate } from 'react-router-dom';
import { Calendar, MapPin } from 'lucide-react';
import { formatDate, formatPrice } from '@sportbridge/shared';
import type { ListingWithId } from './listingsService';
import { listingImage } from './listingImage';

/** Public-site card (prototype .op-card / .programme-card) for one published listing; opens its public page. */
export function PublicListingCard({
  listing: l,
  programme = false,
}: {
  listing: ListingWithId;
  programme?: boolean;
}) {
  const navigate = useNavigate();
  const open = () => navigate(`/listings/${l.id}`);
  return (
    <article
      className={programme ? 'programme-card' : 'op-card'}
      role="link"
      tabIndex={0}
      style={{ cursor: 'pointer' }}
      onClick={open}
      onKeyDown={(e) => e.key === 'Enter' && open()}
    >
      <img src={listingImage(l.sports)} alt="" loading="lazy" />
      <div className="op-body">
        <span className="tag">{l.type.toUpperCase()}</span>
        <h3>{l.title}</h3>
        <div className="meta">
          {l.orgName}
          <br />
          <MapPin className="icon" aria-hidden="true" /> {l.city}, {l.province}
          <br />
          <Calendar className="icon" aria-hidden="true" /> Closes {formatDate(l.deadline)} · {formatPrice(l)}
        </div>
        <div className="op-footer">
          <span className="link">View details →</span>
        </div>
      </div>
    </article>
  );
}
