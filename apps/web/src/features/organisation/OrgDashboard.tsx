import { useNavigate } from 'react-router-dom';
import { CircleCheck, ShieldAlert } from 'lucide-react';
import { ORGANISATION_TYPE_LABELS, organisationCompletion } from '@sportbridge/shared';
import { useMyOrganisation } from './useMyOrganisation';
import { OrgUnavailable } from './OrgUnavailable';
import { ClaimOrganisationCard } from '../onboarding/ClaimOrganisationCard';
import { useMyListings } from '../listings/listingsService';
import { useApplicationsTo } from '../applications/applicationsService';
import { isOpen } from '@sportbridge/shared';

/** Organisation dashboard (prototype "Organisation dashboard"), with real data and honest empty states. */
export function OrgDashboard() {
  const navigate = useNavigate();
  const { me, orgId, org } = useMyOrganisation();
  const mine = useMyListings(me?.uid);
  const apps = useApplicationsTo(me?.uid);
  if (!me) return null;
  if (!orgId) return <OrgUnavailable />;
  if (org.status === 'loading') return <p className="sb-empty">Loading…</p>;
  if (org.status === 'error')
    return (
      <div className="sb-card sb-empty" role="alert">
        {org.message}
      </div>
    );
  if (!org.data) return <OrgUnavailable />;
  const o = org.data;
  const { percent, items } = organisationCompletion(o);
  const next = items.find((i) => !i.done);

  return (
    <section className="sb-page role-dashboard-page active" id="sb-page-dashboard">
      <div className="sb-page-head">
        <div>
          <div className="sb-kicker">ORGANISATION DASHBOARD</div>
          <h1>{o.name}</h1>
          <p>Manage your profile, publish opportunities and programmes, and review applications.</p>
          <div className="dashboard-context">
            <b>Organisation account</b> · {ORGANISATION_TYPE_LABELS[o.type]} · Owner: {me.user.displayName}
          </div>
        </div>
        <span className="risk-pill">
          {o.verified ? (
            <CircleCheck className="icon" aria-hidden="true" />
          ) : (
            <ShieldAlert className="icon" aria-hidden="true" />
          )}{' '}
          {o.verified ? 'Organisation verified' : 'Not yet verified'}
        </span>
      </div>

      <div className="sb-grid-2" style={{ marginBottom: 15 }}>
        <div className="sb-card sb-progress-card">
          <div className="sb-section-title" style={{ margin: '0 0 18px' }}>
            <h2>Organisation profile</h2>
            <button type="button" className="auth-link" onClick={() => navigate('/app/profile')}>
              View profile
            </button>
          </div>
          <div className="sb-progress-row">
            <div
              className="sb-ring"
              role="img"
              aria-label={`Profile ${percent}% complete`}
              style={{
                background: `conic-gradient(var(--sb-green) 0 ${percent}%, #E7ECE8 ${percent}% 100%)`,
              }}
            >
              <span>{percent}%</span>
            </div>
            <div className="sb-checks">
              {items.map((i) => (
                <div className="sb-check" key={i.key}>
                  <i aria-hidden="true">{i.done ? '✓' : '!'}</i>
                  <span>{i.label}</span>
                </div>
              ))}
              {next && (
                <button
                  type="button"
                  className="sb-btn primary"
                  style={{ marginTop: 8, justifySelf: 'start' }}
                  onClick={() => navigate('/app/profile')}
                >
                  {percent === 0 ? 'Start your profile' : 'Complete your profile'}
                </button>
              )}
            </div>
          </div>
        </div>
        <div className="sb-card" style={{ padding: 18 }}>
          <div className="sb-section-title" style={{ margin: '0 0 12px' }}>
            <h2>Verification</h2>
          </div>
          <p className="sb-meta" style={{ lineHeight: 1.7 }}>
            {o.verified
              ? 'SportBridge has verified your organisation.'
              : 'Your organisation has not been verified yet. SportBridge staff will review organisations once verification opens; until then your profile shows as “Not yet verified”.'}
          </p>
        </div>
      </div>

      <div className="sb-grid-3">
        <ListingsCard
          title="Opportunities"
          kind="opportunity"
          items={mine.status === 'ready' ? mine.data : null}
          onOpen={() => navigate('/app/opportunities')}
        />
        <ListingsCard
          title="Programmes"
          kind="programme"
          items={mine.status === 'ready' ? mine.data : null}
          onOpen={() => navigate('/app/programmes')}
        />
        <div className="sb-card">
          <h3>Applications</h3>
          <p className="sb-meta">
            {apps.status !== 'ready'
              ? 'Loading…'
              : apps.data.length === 0
                ? 'No applications yet. They appear here when athletes apply to your listings.'
                : `${apps.data.filter((a) => a.status === 'submitted').length} waiting for review · ${apps.data.length} in total`}
          </p>
          <button
            type="button"
            className="sb-btn"
            style={{ marginTop: 8 }}
            onClick={() => navigate('/app/applications')}
          >
            Review applications
          </button>
        </div>
      </div>
      {o.source !== 'staff_import' && !o.verified && <ClaimOrganisationCard />}
    </section>
  );
}

type Mine =
  ReturnType<typeof useMyListings> extends infer R
    ? R extends { status: 'ready'; data: infer D }
      ? D
      : never
    : never;

/** "3 live · 1 draft" for one kind of listing, with a button to manage them. */
function ListingsCard({
  title,
  kind,
  items,
  onOpen,
}: {
  title: string;
  kind: 'opportunity' | 'programme';
  items: Mine | null;
  onOpen: () => void;
}) {
  const mineOfKind = (items ?? []).filter((l) => l.kind === kind);
  const live = mineOfKind.filter((l) => isOpen(l)).length;
  const drafts = mineOfKind.filter((l) => l.status === 'draft').length;
  const noun = kind === 'programme' ? 'programme' : 'opportunity';
  return (
    <div className="sb-card">
      <h3>{title}</h3>
      <p className="sb-meta">
        {items === null
          ? 'Loading…'
          : mineOfKind.length === 0
            ? `You haven’t created any ${title.toLowerCase()} yet.`
            : `${live} live${drafts ? ` · ${drafts} draft${drafts === 1 ? '' : 's'}` : ''}`}
      </p>
      <button type="button" className="sb-btn" style={{ marginTop: 8 }} onClick={onOpen}>
        {mineOfKind.length === 0 ? `Create your first ${noun}` : `Manage ${title.toLowerCase()}`}
      </button>
    </div>
  );
}
