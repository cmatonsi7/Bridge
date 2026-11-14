import { useNavigate } from 'react-router-dom';
import { Check, MapPin } from 'lucide-react';
import { listingImage } from '../listings/listingImage';
import { orgTypeLabel, type PublicOrg } from './publicDirectory';

/** Discover card (prototype .discover-card) for one listed organisation. Says plainly who vouches for it. */
export function PublicOrgCard({ org }: { org: PublicOrg }) {
  const navigate = useNavigate();
  const open = () => navigate(`/organisations/${org.id}`);
  // The picture follows the organisation's first sport; only one with no sport falls back to its type.
  const image = org.sports.length
    ? listingImage(org.sports)
    : org.orgType === 'school' || org.orgType === 'tertiary'
      ? '/images/schools.webp'
      : '/images/academy.webp';
  const sports = org.sports.slice(0, 3).join(', ');
  return (
    <article
      className="discover-card"
      role="link"
      tabIndex={0}
      style={{ cursor: 'pointer' }}
      onClick={open}
      onKeyDown={(e) => e.key === 'Enter' && open()}
    >
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
