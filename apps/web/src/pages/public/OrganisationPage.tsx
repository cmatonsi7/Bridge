import { useEffect } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Check, MapPin } from 'lucide-react';
import { filterListings } from '@sportbridge/shared';
import { useAuth } from '../../features/auth/AuthProvider';
import { useOrgListings } from '../../features/listings/listingsService';
import { PublicListingCard } from '../../features/listings/PublicListingCard';
import { orgTypeLabel, usePublicOrganisation } from '../../features/public/publicDirectory';

/** Public page for one listed organisation: who it is, who vouches for it, and what it has open. */
export default function OrganisationPage() {
  const { key } = useParams();
  const org = usePublicOrganisation(key);
  const { state: auth } = useAuth();
  const signedIn = auth.status === 'signedIn';
  const entry = org.status === 'ready' ? org.data : null;
  const unclaimed = entry?.claimed === false;
  // An organisation nobody owns cannot have listings, so there is nothing to ask for.
  const listings = useOrgListings(entry && !unclaimed ? entry.orgId : undefined);

  useEffect(() => {
    if (entry) document.title = `${entry.displayName} — SportBridge`;
  }, [entry]);

  if (org.status === 'loading') {
    return (
      <section className="section">
        <div className="wrap">
          <p className="meta">Loading…</p>
        </div>
      </section>
    );
  }
  if (org.status === 'error') {
    return (
      <section className="section">
        <div className="wrap">
          <p className="meta" role="alert">
            {org.message}
          </p>
        </div>
      </section>
    );
  }
  if (!entry) {
    return (
      <section className="section">
        <div className="wrap discover-empty">
          <h1>This organisation isn’t listed</h1>
          <p>It may have been removed, or the address may be wrong.</p>
          <Link className="btn green" to="/discover">
            Browse organisations
          </Link>
        </div>
      </section>
    );
  }

  const open = listings.status === 'ready' ? filterListings(listings.data, {}) : [];
  return (
    <section className="section" id="organisation">
      <div className="wrap">
        <Link to="/discover" className="link">
          ← All organisations
        </Link>
        <div style={{ marginTop: 14 }}>
          <span className="eyebrow">{orgTypeLabel(entry.orgType).toUpperCase()}</span>
          <h1>{entry.displayName}</h1>
          <p className="meta">
            {entry.verified ? (
              <span className="verified">
                <Check className="icon" aria-hidden="true" /> Verified organisation
              </span>
            ) : (
              <span className="discover-note">{unclaimed ? 'Added by SportBridge' : 'Not yet verified'}</span>
            )}
            {(entry.city || entry.province) && (
              <>
                {' · '}
                <MapPin className="icon" aria-hidden="true" />{' '}
                {[entry.city, entry.province].filter(Boolean).join(', ')}
              </>
            )}
          </p>
          {entry.sports.length > 0 && (
            <div className="org-chips" aria-label="Sports">
              {entry.sports.map((s) => (
                <span className="tag" key={s}>
                  {s}
                </span>
              ))}
            </div>
          )}
          {entry.headline && <p style={{ maxWidth: 680, lineHeight: 1.7 }}>{entry.headline}</p>}
        </div>

        {unclaimed ? (
          <div className="discover-empty" style={{ marginTop: 22 }}>
            <h3>Added by SportBridge</h3>
            <p>
              This organisation hasn’t been claimed yet, so it can’t post opportunities. If you represent it,
              ask SportBridge for your claim code, then create an organisation account and enter it.
            </p>
          </div>
        ) : (
          <div style={{ marginTop: 28 }}>
            <h2>Open opportunities and programmes</h2>
            {listings.status === 'loading' ? (
              <p className="meta">Loading…</p>
            ) : listings.status === 'error' ? (
              <p className="meta" role="alert">
                We couldn’t load its listings right now. Please try again later.
              </p>
            ) : open.length === 0 ? (
              <p className="meta">Nothing is open right now.</p>
            ) : (
              <div className="feature-grid">
                {open.map((l) => (
                  <PublicListingCard key={l.id} listing={l} programme={l.kind === 'programme'} />
                ))}
              </div>
            )}
          </div>
        )}

        <div className="discover-empty" style={{ marginTop: 32 }}>
          <h3>{signedIn ? 'See more in SportBridge' : 'Want to apply or get in touch?'}</h3>
          <p>
            {signedIn
              ? 'Open this organisation inside SportBridge.'
              : 'Create a free account to apply for opportunities. SportBridge never shows contact details publicly.'}
          </p>
          {signedIn ? (
            <Link className="btn green" to={`/app/directory/${entry.id}`}>
              Open in SportBridge
            </Link>
          ) : (
            <div style={{ display: 'flex', gap: 10, justifyContent: 'center', flexWrap: 'wrap' }}>
              <Link className="btn green" to="/register">
                Create a free account
              </Link>
              <Link className="btn" to="/sign-in">
                Sign in
              </Link>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
