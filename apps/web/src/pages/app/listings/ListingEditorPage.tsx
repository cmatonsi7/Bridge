import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import type { ListingKind } from '@sportbridge/shared';
import { createListing, updateListing, useListing } from '../../../features/listings/listingsService';
import { ListingForm } from '../../../features/listings/ListingForm';
import { useMyOrganisation } from '../../../features/organisation/useMyOrganisation';
import { OrgUnavailable } from '../../../features/organisation/OrgUnavailable';
import { useToast } from '../../../components/Toast';
import { BootScreen } from '../../../app/guards';

/** /app/listings/new?kind=… and /app/listings/:listingId/edit (organisation owners only). */
export default function ListingEditorPage() {
  const { listingId } = useParams();
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const toast = useToast();
  const { me, orgId, org } = useMyOrganisation();
  const existing = useListing(listingId);
  if (!me) return null;
  if (!orgId) return <OrgUnavailable />;
  if (org.status === 'loading' || (listingId && existing.status === 'loading'))
    return <BootScreen label="Loading…" />;
  if (org.status !== 'ready' || !org.data) return <OrgUnavailable />;
  const editing = listingId && existing.status === 'ready' ? existing.data : null;
  if (listingId && (!editing || editing.ownerUid !== me.uid)) {
    return (
      <div className="sb-card sb-empty" role="alert">
        You can only edit your own organisation’s listings.
      </div>
    );
  }
  const kind: ListingKind =
    editing?.kind ?? (params.get('kind') === 'programme' ? 'programme' : 'opportunity');
  const backTo = kind === 'programme' ? '/app/programmes' : '/app/opportunities';
  const o = org.data;

  return (
    <section className="sb-page active" id="sb-page-listing-editor">
      <div className="sb-page-head">
        <div>
          <div className="sb-kicker">{o.name.toUpperCase()}</div>
          <h1>{editing ? 'Edit listing' : kind === 'programme' ? 'New programme' : 'New opportunity'}</h1>
          <p>
            Drafts are only visible to you. Published listings appear to everyone on SportBridge until they
            close.
          </p>
        </div>
      </div>
      <div className="sb-card sb-form-card">
        <ListingForm
          kind={kind}
          initial={editing ?? undefined}
          onCancel={() => navigate(backTo)}
          onSubmit={async (input) => {
            if (editing) await updateListing(editing.id, editing, o, input);
            else await createListing(orgId, o, me.uid, input);
            toast(input.status === 'published' ? 'Listing published' : 'Draft saved');
            navigate(backTo);
          }}
        />
      </div>
    </section>
  );
}
