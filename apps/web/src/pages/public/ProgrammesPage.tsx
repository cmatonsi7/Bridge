// Migrated from the SportBridge HTML prototype (rendered markup) by tools/html_to_jsx.py. Maintained by hand.
import { Calendar, MapPin } from 'lucide-react';

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
            <div className="feature-grid">
              <article className="programme-card">
                <img src="/images/football-holiday.webp" alt="" loading="lazy" />
                <div className="op-body">
                  <span className="tag">HOLIDAY PROGRAMME</span>
                  <h3>Multi-Sport Holiday Camp</h3>
                  <div className="meta">
                    SportZone Academy
                    <br />
                    <MapPin className="icon" aria-hidden="true" /> Stellenbosch, Western Cape
                    <br />
                    <Calendar className="icon" aria-hidden="true" /> 16–19 Dec 2026
                  </div>
                  <div className="op-footer">
                    <span className="link">View programme →</span>
                  </div>
                </div>
              </article>
              <article className="programme-card">
                <img src="/images/swim-fitness.webp" alt="" loading="lazy" />
                <div className="op-body">
                  <span className="tag">HOLIDAY PROGRAMME</span>
                  <h3>Swim & Fitness Camp</h3>
                  <div className="meta">
                    Aqua Elite
                    <br />
                    <MapPin className="icon" aria-hidden="true" /> Durban, KwaZulu-Natal
                    <br />
                    <Calendar className="icon" aria-hidden="true" /> 12–16 Dec 2026
                  </div>
                  <div className="op-footer">
                    <span className="link">View programme →</span>
                  </div>
                </div>
              </article>
              <article className="programme-card">
                <img src="/images/opportunities.webp" alt="" loading="lazy" />
                <div className="op-body">
                  <span className="tag">HOLIDAY PROGRAMME</span>
                  <h3>Tennis Development Programme</h3>
                  <div className="meta">
                    Game On Tennis
                    <br />
                    <MapPin className="icon" aria-hidden="true" /> Johannesburg, Gauteng
                    <br />
                    <Calendar className="icon" aria-hidden="true" /> 7–11 Dec 2026
                  </div>
                  <div className="op-footer">
                    <span className="link">View programme →</span>
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
