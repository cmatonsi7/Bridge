import { useNavigate } from 'react-router-dom';
import { useListing, type ListingWithId } from '../../../features/listings/listingsService';
import { ListingCard } from '../../../features/listings/ListingCard';
import { useSaveToggle } from '../../../features/listings/useSaveToggle';
import { useSignedInUser } from '../../../features/account/useSignedInUser';
import { BootScreen } from '../../../app/guards';
import type { SavedListingDoc } from '@sportbridge/shared';

function SavedItem({
  item,
  onToggle,
}: {
  item: SavedListingDoc & { id: string };
  onToggle: (l: ListingWithId) => void;
}) {
  const listing = useListing(item.listingId);
  if (listing.status === 'loading') return <div className="sb-card sb-empty">Loading…</div>;
  if (listing.status !== 'ready' || !listing.data) {
    return (
      <div className="sb-card" style={{ padding: 16 }}>
        <h3 style={{ fontSize: 14 }}>{item.title}</h3>
        <p className="sb-meta">No longer available.</p>
        <button
          type="button"
          className="sb-btn"
          onClick={() =>
            onToggle({ id: item.listingId, kind: item.kind, title: item.title } as ListingWithId)
          }
        >
          Remove
        </button>
      </div>
    );
  }
  return <ListingCard listing={listing.data} saved onToggleSave={() => onToggle(listing.data!)} />;
}

export default function SavedPage() {
  const navigate = useNavigate();
  const me = useSignedInUser();
  const { saved, toggle } = useSaveToggle(me?.uid);
  if (saved.status === 'loading') return <BootScreen label="Loading saved items…" />;
  if (saved.status === 'error')
    return (
      <div className="sb-card sb-empty" role="alert">
        {saved.message}
      </div>
    );
  const items = [...saved.data].sort((a, b) => b.savedAt.localeCompare(a.savedAt));
  return (
    <section className="sb-page active" id="sb-page-saved">
      <div className="sb-page-head">
        <div>
          <div className="sb-kicker">YOUR SHORTLIST</div>
          <h1>Saved</h1>
          <p>Keep track of opportunities and programmes you want to revisit.</p>
        </div>
      </div>
      {items.length === 0 ? (
        <div className="sb-card sb-empty">
          Nothing saved yet. Tap the heart on any opportunity or programme to keep it here.{' '}
          <button type="button" className="auth-link" onClick={() => navigate('/app/opportunities')}>
            Browse opportunities
          </button>
        </div>
      ) : (
        <div className="sb-grid-3">
          {items.map((i) => (
            <SavedItem key={i.id} item={i} onToggle={(l) => void toggle(l)} />
          ))}
        </div>
      )}
    </section>
  );
}
