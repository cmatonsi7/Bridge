// Migrated from the SportBridge HTML prototype (rendered markup) by tools/html_to_jsx.py. Maintained by hand.
import { Calendar, MapPin } from 'lucide-react';

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
            <div className="feature-grid" id="oppGrid">
              <article className="op-card">
                <img src="/images/opportunities.webp" alt="" loading="lazy" />
                <div className="op-body">
                  <span className="tag">TRIALS</span>
                  <h3>U17 Provincial Trials</h3>
                  <div className="meta">
                    Western Province Rugby
                    <br />
                    <MapPin className="icon" aria-hidden="true" /> Cape Town, Western Cape
                    <br />
                    <Calendar className="icon" aria-hidden="true" /> 15 Nov 2026
                  </div>
                  <div className="op-footer">
                    <span className="link">View details →</span>
                  </div>
                </div>
              </article>
              <article className="op-card">
                <img src="/images/football-bursary.webp" alt="" loading="lazy" />
                <div className="op-body">
                  <span className="tag">SCHOLARSHIP</span>
                  <h3>Football Bursary 2027</h3>
                  <div className="meta">
                    National Sports Academy
                    <br />
                    <MapPin className="icon" aria-hidden="true" /> Johannesburg, Gauteng
                    <br />
                    <Calendar className="icon" aria-hidden="true" /> 30 Nov 2026
                  </div>
                  <div className="op-footer">
                    <span className="link">View details →</span>
                  </div>
                </div>
              </article>
              <article className="op-card">
                <img src="/images/coach-athlete.webp" alt="" loading="lazy" />
                <div className="op-body">
                  <span className="tag">COACHING</span>
                  <h3>Assistant Coach Position</h3>
                  <div className="meta">
                    Elite Netball Academy
                    <br />
                    <MapPin className="icon" aria-hidden="true" /> Pretoria, Gauteng
                    <br />
                    <Calendar className="icon" aria-hidden="true" /> 22 Nov 2026
                  </div>
                  <div className="op-footer">
                    <span className="link">View details →</span>
                  </div>
                </div>
              </article>
              <article className="op-card">
                <img src="/images/athlete-journey.webp" alt="" loading="lazy" />
                <div className="op-body">
                  <span className="tag">TRIALS</span>
                  <h3>U19 Athletics Selection</h3>
                  <div className="meta">
                    Athletics South Africa
                    <br />
                    <MapPin className="icon" aria-hidden="true" /> Durban, KwaZulu-Natal
                    <br />
                    <Calendar className="icon" aria-hidden="true" /> 8 Dec 2026
                  </div>
                  <div className="op-footer">
                    <span className="link">View details →</span>
                  </div>
                </div>
              </article>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
