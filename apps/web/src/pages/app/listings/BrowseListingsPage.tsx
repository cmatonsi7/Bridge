import { useState } from 'react';
import { Search } from 'lucide-react';
import { filterListings, type ListingFilters as Filters, type ListingKind } from '@sportbridge/shared';
import { usePublishedListings } from '../../../features/listings/listingsService';
import { ListingCard } from '../../../features/listings/ListingCard';
import { ListingFilters } from '../../../features/listings/ListingFilters';
import { useSaveToggle } from '../../../features/listings/useSaveToggle';
import { useSignedInUser } from '../../../features/account/useSignedInUser';
import { BootScreen } from '../../../app/guards';

const COPY: Record<ListingKind, { kicker: string; title: string; text: string; noun: string }> = {
  opportunity: {
    kicker: 'DISCOVER',
    title: 'Opportunities',
    text: 'Find trials, scholarships, bursaries, talent ID and more.',
    noun: 'opportunities',
  },
  programme: {
    kicker: 'PROGRAMMES',
    title: 'Programmes',
    text: 'Find camps, academies and development programmes.',
    noun: 'programmes',
  },
};

export function BrowseListingsPage({ kind }: { kind: ListingKind }) {
  const me = useSignedInUser();
  const listings = usePublishedListings(kind);
  const { ids, toggle } = useSaveToggle(me?.uid);
  const [filters, setFilters] = useState<Filters>({});
  const c = COPY[kind];
  if (listings.status === 'loading') return <BootScreen label={`Loading ${c.noun}…`} />;
  if (listings.status === 'error')
    return (
      <div className="sb-card sb-empty" role="alert">
        {listings.message}
      </div>
    );
  const items = filterListings(listings.data, filters);
  const total = filterListings(listings.data, {}).length;

  return (
    <section className="sb-page active" id={`sb-page-${kind}-browse`}>
      <div className="sb-page-head">
        <div>
          <div className="sb-kicker">{c.kicker}</div>
          <h1>{c.title}</h1>
          <p>{c.text}</p>
        </div>
      </div>
      <div className="sb-filterbar">
        <div className="sb-page-search">
          <Search className="icon" aria-hidden="true" />
          <input
            aria-label={`Search ${c.noun}`}
            placeholder={`Search ${c.noun}, organisations or towns…`}
            value={filters.query ?? ''}
            onChange={(e) => setFilters({ ...filters, query: e.target.value })}
          />
        </div>
        <span className="sb-meta" role="status">
          {items.length} of {total} open
        </span>
      </div>
      <div className="sb-op-layout">
        <ListingFilters value={filters} onChange={setFilters} />
        {total === 0 ? (
          <div className="sb-card sb-empty">
            No {c.noun} are open right now. Organisations are adding them; check back soon.
          </div>
        ) : items.length === 0 ? (
          <div className="sb-card sb-empty">No {c.noun} match these filters. Try clearing some of them.</div>
        ) : (
          <div className="sb-grid-3">
            {items.map((l) => (
              <ListingCard
                key={l.id}
                listing={l}
                saved={ids.has(l.id)}
                onToggleSave={me ? () => void toggle(l) : undefined}
              />
            ))}
          </div>
        )}
      </div>
    </section>
  );
}

export const BrowseOpportunitiesPage = () => <BrowseListingsPage kind="opportunity" />;
export const BrowseProgrammesPage = () => <BrowseListingsPage kind="programme" />;
