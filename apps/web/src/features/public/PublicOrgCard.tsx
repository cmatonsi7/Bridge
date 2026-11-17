import { Link } from 'react-router-dom';
import { Check, MapPin } from 'lucide-react';
import { listingImage } from '../listings/listingImage';
import { orgTypeLabel, type PublicOrg } from './publicDirectory';

/** Discover card (prototype .discover-card) for one listed organisation. Says plainly who vouches for it. */
export function PublicOrgCard({ org }: { org: PublicOrg }) {
  // The picture follows the organisation's first sport; only one with no sport falls back to its type.
  const image = org.sports.length
    ? listingImage(org.sports)
    : org.orgType === 'school' || org.orgType === 'tertiary'
      ? '/images/schools.webp'
      : '/images/academy.webp';
  const sports = org.sports.slice(0, 3).join(', ');
  return (
    <article className="discover-card" style={{ position: 'relative' }}>
      {/* Stretched link: a real, keyboard- and screen-reader-accessible <a> covering the whole
          card (so cmd/ctrl-click and "open in new tab" work too), instead of the old
          role="link" + onClick/onKeyDown hack on the <article> (an invalid ARIA role on that
          element, and keyboard support for Enter only). The visible content below, and its
          CSS (including the #discover .discover-card > img direct-child rule), is unchanged. */}
      <Link
        to={`/organisations/${org.id}`}
        aria-label={`View details for ${org.displayName}`}
        style={{ position: 'absolute', inset: 0, zIndex: 1 }}
      />
      <img src={image} alt="" loading="lazy" />
      <div className="discover-body">
        <div className="discover-top">
          <span className="tag">ORGANISATION</span>
          {org.verified ? (
            <span className="verified">
              <Check className="icon" aria-hidden="true" /> Verified
            </span>
          ) : (
            <span className="discover-note">
              {org.claimed === false ? 'Added by SportBridge' : 'Not yet verified'}
            </span>
          )}
        </div>
        <h3>{org.displayName}</h3>
        <p>
          {orgTypeLabel(org.orgType)}
          {sports ? ` • ${sports}` : ''}
        </p>
        {(org.city || org.province) && (
          <span className="discover-meta">
            <MapPin className="icon" aria-hidden="true" />{' '}
            {[org.city, org.province].filter(Boolean).join(', ')}
          </span>
        )}
        <span className="link">View organisation →</span>
      </div>
    </article>
  );
}
