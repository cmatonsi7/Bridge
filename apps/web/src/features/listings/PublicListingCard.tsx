import { Link } from 'react-router-dom';
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
  return (
    <article className={programme ? 'programme-card' : 'op-card'} style={{ position: 'relative' }}>
      {/* Stretched link: a real, keyboard- and screen-reader-accessible <a> covering the whole
          card (so cmd/ctrl-click and "open in new tab" work too), instead of the old
          role="link" + onClick/onKeyDown hack on the <article> (an invalid ARIA role on that
          element, and keyboard support for Enter only). The visible content below is
          unchanged, so nothing here affects layout or styling. */}
      <Link
        to={`/listings/${l.id}`}
        aria-label={`View details for ${l.title}`}
        style={{ position: 'absolute', inset: 0, zIndex: 1 }}
      />
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
