import { useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../../features/auth/AuthProvider';
import { useListing } from '../../features/listings/listingsService';
import { ListingDetails } from '../../features/listings/ListingDetails';

/** Public listing page: anyone can read a published listing; saving and applying need an account. */
export default function PublicListingDetailPage() {
  const { listingId } = useParams();
  const navigate = useNavigate();
  const { state } = useAuth();
  const listing = useListing(listingId);
  const signedIn = state.status === 'signedIn';
  return (
    <section className="page active" id="listing">
      <div className="section soft">
        <div className="wrap" style={{ maxWidth: 900 }}>
          {listing.status === 'loading' ? (
            <p className="meta">Loading…</p>
          ) : listing.status !== 'ready' || !listing.data ? (
            <div className="section-head">
              <h2>This listing isn’t available.</h2>
              <p>It may have closed or been removed.</p>
              <button
                className="btn green"
                type="button"
                onClick={() => navigate('/opportunities')}
                style={{ marginTop: 14 }}
              >
                See current opportunities
              </button>
            </div>
          ) : (
            <ListingDetails
              publicSite
              listing={listing.data}
              actions={
                signedIn ? (
                  <button
                    className="btn green"
                    type="button"
                    onClick={() => navigate(`/app/listings/${listing.data!.id}`)}
                  >
                    Open in your dashboard
                  </button>
                ) : (
                  <>
                    <button className="btn green" type="button" onClick={() => navigate('/register')}>
                      Create a free account
                    </button>
                    <button
                      className="btn nav-login-btn"
                      type="button"
                      onClick={() => navigate(`/sign-in?next=/app/listings/${listing.data!.id}`)}
                    >
                      Sign in to save or apply
                    </button>
                  </>
                )
              }
            />
          )}
        </div>
      </div>
    </section>
  );
}
