import { useNavigate, useParams } from 'react-router-dom';
import { isOpen } from '@sportbridge/shared';
import { useListing } from '../../../features/listings/listingsService';
import { ListingDetails } from '../../../features/listings/ListingDetails';
import { useSaveToggle } from '../../../features/listings/useSaveToggle';
import { useSignedInUser } from '../../../features/account/useSignedInUser';
import { BootScreen } from '../../../app/guards';

export default function ListingDetailPage() {
  const { listingId } = useParams();
  const navigate = useNavigate();
  const me = useSignedInUser();
  const listing = useListing(listingId);
  const { ids, toggle } = useSaveToggle(me?.uid);
  if (listing.status === 'loading') return <BootScreen label="Loading…" />;
  if (listing.status === 'error' || !listing.data) {
    return (
      <div className="sb-card sb-empty" role="alert">
        This listing isn’t available. It may have been removed.{' '}
        <button type="button" className="auth-link" onClick={() => navigate(-1)}>
          Go back
        </button>
      </div>
    );
  }
  const l = listing.data;
  const mine = me?.uid === l.ownerUid;
  const open = isOpen(l);
  const restricted = me?.user.status === 'restricted';

  return (
    <section className="sb-page active" id="sb-page-listing">
      <div className="sb-page-head">
        <div>
          <div className="sb-kicker">{l.kind === 'programme' ? 'PROGRAMME' : 'OPPORTUNITY'}</div>
        </div>
        <button type="button" className="sb-btn" onClick={() => navigate(-1)}>
          Back
        </button>
      </div>
      <ListingDetails
        listing={l}
        actions={
          mine ? (
            <button
              type="button"
              className="sb-btn primary"
              onClick={() => navigate(`/app/listings/${l.id}/edit`)}
            >
              Edit listing
            </button>
          ) : (
            <>
              <button
                type="button"
                className="sb-btn primary"
                disabled
                title="Applications open in the next update"
              >
                {l.kind === 'programme' ? 'Express interest' : 'Apply'} — opening soon
              </button>
              <button
                type="button"
                className="sb-btn"
                aria-pressed={ids.has(l.id)}
                onClick={() => void toggle(l)}
              >
                {ids.has(l.id) ? 'Saved ✓' : 'Save'}
              </button>
              <p className="sb-field-hint" style={{ width: '100%' }}>
                {!open
                  ? 'This listing is closed.'
                  : restricted
                    ? 'You can save this now. Applying needs a parent or guardian to confirm your account first.'
                    : 'Applying through SportBridge is coming in the next update. Save it so you don’t lose it.'}
              </p>
            </>
          )
        }
      />
    </section>
  );
}
