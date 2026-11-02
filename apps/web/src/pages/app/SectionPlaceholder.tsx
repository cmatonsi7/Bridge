import { useNavigate } from 'react-router-dom';
import type { NavItem } from '../../config/navigation';

/** Page header from the prototype (.sb-page-head) with an honest empty state until the section is built. */
export default function SectionPlaceholder({ item }: { item: NavItem }) {
  const navigate = useNavigate();
  return (
    <section className="sb-page active" id={`sb-page-${item.section}`}>
      <div className="sb-page-head">
        <div>
          <div className="sb-kicker">{item.eyebrow}</div>
          <h1>{item.title}</h1>
          <p>{item.description}</p>
        </div>
      </div>
      <div className="sb-card" style={{ padding: 22 }}>
        <p className="sb-extra-muted" style={{ marginTop: 0 }}>
          This section is not available yet. It is being built in an upcoming release.
        </p>
        <button className="sb-btn primary" type="button" onClick={() => navigate('/app')}>
          Back to dashboard
        </button>
      </div>
    </section>
  );
}
