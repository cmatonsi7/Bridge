import type { ReactNode } from 'react';
import { useOverview, type Figure } from '../../../features/admin/adminService';
import { BootScreen } from '../../../app/guards';

const n = (f: Figure) => (f === null ? '—' : f.toLocaleString('en-ZA'));

function Stat({
  label,
  value,
  note,
  action,
}: {
  label: string;
  value: ReactNode;
  note?: string;
  action?: ReactNode;
}) {
  return (
    <div className="sb-card sb-stat">
      <div className="sb-stat-label">{label}</div>
      <div className="sb-stat-value">{value}</div>
      {note && <p className="sb-meta">{note}</p>}
      {action}
    </div>
  );
}

/** Real figures only. A figure that could not be read shows as "—", never as a made-up zero. */
export default function AdminOverview({
  onOpenSchools,
  onOpenVerification,
}: {
  onOpenSchools: () => void;
  onOpenVerification: () => void;
}) {
  const o = useOverview();
  if (o.status === 'loading') return <BootScreen label="Loading the overview…" />;
  if (o.status === 'error')
    return (
      <div className="sb-card sb-empty" role="alert">
        {o.message}
      </div>
    );
  const d = o.data;
  const added = d.unclaimed === null || d.claimedImports === null ? null : d.unclaimed + d.claimedImports;

  return (
    <>
      <div className="sb-stat-grid">
        <Stat
          label="Schools & organisations added by SportBridge"
          value={n(added)}
          note={`${n(d.unclaimed)} waiting to be claimed · ${n(d.claimedImports)} claimed`}
          action={
            <button type="button" className="sb-btn" style={{ marginTop: 8 }} onClick={onOpenSchools}>
              Manage schools & organisations
            </button>
          }
        />
        <Stat
          label="Organisations awaiting verification"
          value={n(d.organisationsUnverified)}
          note="Organisations with an owner that SportBridge has not verified yet."
          action={
            <button type="button" className="sb-btn" style={{ marginTop: 8 }} onClick={onOpenVerification}>
              Review organisations
            </button>
          }
        />
        <Stat
          label="Live opportunities"
          value={n(d.liveOpportunities)}
          note="Published, and the closing date has not passed."
        />
        <Stat label="Live programmes" value={n(d.liveProgrammes)} />
        <Stat label="Applications in the last 7 days" value={n(d.applicationsThisWeek)} />
      </div>

      <div style={{ marginTop: 32 }}>
        <div className="sb-section-title">
          <h2>Accounts</h2>
        </div>
        <div className="sb-stat-grid">
          <Stat label="Athletes" value={n(d.accounts.athlete)} />
          <Stat label="Parents & guardians" value={n(d.accounts.guardian)} />
          <Stat label="Coaches" value={n(d.accounts.coach)} />
          <Stat label="Organisations" value={n(d.accounts.organisation)} />
        </div>
      </div>
    </>
  );
}
