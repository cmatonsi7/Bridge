import { useNavigate } from 'react-router-dom';
import { formatDate, isOpen, type ListingKind } from '@sportbridge/shared';
import {
  closeListing,
  deleteDraft,
  useMyListings,
  type ListingWithId,
} from '../../../features/listings/listingsService';
import { useMyOrganisation } from '../../../features/organisation/useMyOrganisation';
import { OrgUnavailable } from '../../../features/organisation/OrgUnavailable';
import { useToast } from '../../../components/Toast';
import { BootScreen } from '../../../app/guards';

/**
 * Three different things, which used to look the same on screen:
 * a draft, a live listing, one whose closing date has passed, and one closed by hand.
 */
const status = (l: ListingWithId) =>
  l.status === 'draft'
    ? { label: 'Draft', cls: 'pending', hint: 'Only you can see this' }
    : l.status === 'closed'
      ? { label: 'Closed', cls: 'pending', hint: 'You closed this listing' }
      : isOpen(l)
        ? { label: 'Published', cls: 'ok', hint: '' }
        : {
            label: 'Date passed',
            cls: 'pending',
            hint: 'Edit it and set a future closing date to list it again',
          };

/** An organisation's own listings of one kind, with create / edit / close / delete. */
export function OrgListingsPage({ kind }: { kind: ListingKind }) {
  const navigate = useNavigate();
  const toast = useToast();
  const { me, orgId, org } = useMyOrganisation();
  const mine = useMyListings(me?.uid);
  if (!me) return null;
  if (!orgId) return <OrgUnavailable />;
  if (org.status === 'loading' || mine.status === 'loading')
    return <BootScreen label="Loading your listings…" />;
  if (org.status === 'error' || mine.status === 'error' || !org.data) return <OrgUnavailable />;
  const o = org.data;
  const noun = kind === 'programme' ? 'programme' : 'opportunity';
  const items = mine.data
    .filter((l) => l.kind === kind)
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));

  async function close(l: ListingWithId) {
    if (!window.confirm(`Close “${l.title}”? It will no longer appear in search.`)) return;
    try {
      await closeListing(l.id, o);
      toast('Listing closed');
    } catch {
      toast('Couldn’t close the listing. Try again.');
    }
  }
  async function remove(l: ListingWithId) {
    if (!window.confirm(`Delete the draft “${l.title}”? This can’t be undone.`)) return;
    try {
      await deleteDraft(l.id);
      toast('Draft deleted');
    } catch {
      toast('Couldn’t delete the draft. Try again.');
    }
  }

  return (
    <section className="sb-page active" id={`sb-page-${kind}-manage`}>
      <div className="sb-page-head">
        <div>
          <div className="sb-kicker">{o.name.toUpperCase()}</div>
          <h1>{kind === 'programme' ? 'Your programmes' : 'Your opportunities'}</h1>
          <p>
            Create {noun === 'programme' ? 'programmes' : 'opportunities'}, publish them to SportBridge and
            close them when they’re full.
          </p>
        </div>
        <button
          type="button"
          className="sb-btn primary"
          onClick={() => navigate(`/app/listings/new?kind=${kind}`)}
        >
          ＋ New {noun}
        </button>
      </div>
      {!o.verified && (
        <div className="sb-member-notice" role="status" style={{ marginBottom: 15 }}>
          <div>
            <strong>Your organisation isn’t verified yet</strong>
            <span>
              You can publish now. Your listings will show “Organisation not yet verified” until SportBridge
              verifies you.
            </span>
          </div>
        </div>
      )}
      {items.length === 0 ? (
        <div className="sb-card sb-empty">
          You haven’t created any {kind === 'programme' ? 'programmes' : 'opportunities'} yet.
        </div>
      ) : (
        <div className="sb-card" style={{ padding: 0, overflowX: 'auto' }}>
          <table className="sb-table" style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                <th style={{ textAlign: 'left', padding: 12 }}>Title</th>
                <th style={{ textAlign: 'left', padding: 12 }}>Status</th>
                <th style={{ textAlign: 'left', padding: 12 }}>Closes</th>
                <th style={{ textAlign: 'right', padding: 12 }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {items.map((l) => {
                const s = status(l);
                return (
                  <tr key={l.id} style={{ borderTop: '1px solid #edf0ee' }}>
                    <td style={{ padding: 12 }}>
                      <button
                        type="button"
                        className="auth-link"
                        onClick={() => navigate(`/app/listings/${l.id}`)}
                      >
                        {l.title}
                      </button>
                      <div className="sb-meta">
                        {l.type} · {l.sports.join(', ')}
                      </div>
                    </td>
                    <td style={{ padding: 12 }}>
                      <span className={`v-badge ${s.cls}`}>{s.label}</span>
                      {s.hint && <div className="sb-meta">{s.hint}</div>}
                    </td>
                    <td style={{ padding: 12 }} className="sb-meta">
                      {formatDate(l.deadline)}
                    </td>
                    <td style={{ padding: 12, textAlign: 'right', whiteSpace: 'nowrap' }}>
                      <button
                        type="button"
                        className="sb-btn"
                        onClick={() => navigate(`/app/listings/${l.id}/edit`)}
                      >
                        Edit
                      </button>{' '}
                      {l.status === 'published' && isOpen(l) && (
                        <button type="button" className="sb-btn" onClick={() => void close(l)}>
                          Close
                        </button>
                      )}
                      {l.status === 'draft' && (
                        <button type="button" className="sb-btn" onClick={() => void remove(l)}>
                          Delete
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

export const OrgOpportunitiesPage = () => <OrgListingsPage kind="opportunity" />;
export const OrgProgrammesPage = () => <OrgListingsPage kind="programme" />;
