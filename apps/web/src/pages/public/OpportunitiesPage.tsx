// Migrated from the SportBridge HTML prototype (rendered markup) by tools/html_to_jsx.py. Maintained by hand.
import { PublicListingsGrid } from '../../features/listings/PublicListingsGrid';

export default function OpportunitiesPage() {
  return (
    <>
      <section className="page active" id="opportunities">
        <div className="section soft">
          <div className="wrap">
            <div className="section-head">
              <span className="eyebrow">OPPORTUNITIES</span>
              <h2>Featured Opportunities</h2>
              <p>Explore trials, scholarships, coaching roles, events and more.</p>
            </div>
            <PublicListingsGrid kind="opportunity" />
          </div>
        </div>
      </section>
    </>
  );
}
