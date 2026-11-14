import { useNavigate } from 'react-router-dom';
import { filterListings, type ListingKind } from '@sportbridge/shared';
import { useAuth } from '../auth/AuthProvider';
import { usePublishedListings } from './listingsService';
import { PublicListingCard } from './PublicListingCard';

/** Public-site cards (prototype .op-card) showing real published listings, soonest closing first. */
export function PublicListingsGrid({ kind, max = 8 }: { kind: ListingKind; max?: number }) {
  const navigate = useNavigate();
  const state = usePublishedListings(kind);
  const { state: auth } = useAuth();
  const signedIn = auth.status === 'signedIn';
  const label = kind === 'programme' ? 'programmes' : 'opportunities';

  if (state.status === 'loading') return <p className="meta">Loading {label}…</p>;
  if (state.status === 'error')
    return (
      <p className="meta" role="alert">
        We couldn’t load {label} right now. Please try again later.
      </p>
    );
  const items = filterListings(state.data, {}).slice(0, max);
  if (!items.length) {
    return (
      <div className="op-card" style={{ padding: 24, textAlign: 'center' }}>
        <h3>No {label} listed yet</h3>
        <p className="meta">
          Clubs, academies and programme providers are adding {label} now.
          {signedIn
            ? ' We’ll show them here as soon as they open.'
            : ' Create a free account to be ready when they open.'}
        </p>
        <button
          className="btn green"
          type="button"
          onClick={() =>
            navigate(signedIn ? `/app/${kind === 'programme' ? 'programmes' : 'opportunities'}` : '/register')
          }
          style={{ marginTop: 12 }}
        >
          {signedIn ? 'Go to your dashboard' : 'Create Account'}
        </button>
      </div>
    );
  }
  return (
    <div className="feature-grid">
      {items.map((l) => (
        <PublicListingCard key={l.id} listing={l} programme={kind === 'programme'} />
      ))}
    </div>
  );
}
