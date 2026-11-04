// Migrated from the SportBridge HTML prototype (rendered markup) by tools/html_to_jsx.py. Maintained by hand.
import { PublicListingsGrid } from '../../features/listings/PublicListingsGrid';

export default function ProgrammesPage() {
  return (
    <>
      <section className="page active" id="programmes">
        <div className="section soft">
          <div className="wrap">
            <div className="section-head">
              <span className="eyebrow">HOLIDAY PROGRAMMES</span>
              <h2>Keep athletes active.</h2>
              <p>Discover programmes during school holidays.</p>
            </div>
            <PublicListingsGrid kind="programme" />
          </div>
        </div>
      </section>
    </>
  );
}
