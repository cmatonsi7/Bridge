// Migrated from the SportBridge HTML prototype (rendered markup) by tools/html_to_jsx.py. Maintained by hand.

export default function FeaturesPage() {
  return (
    <>
      <section className="page active" id="features">
        <div className="section">
          <div className="wrap">
            <div className="section-head">
              <span className="eyebrow">FEATURES</span>
              <h2>Everything you need to connect through sport.</h2>
              <p>
                SportBridge brings athletes, coaches, families and sporting organisations together in one
                connected ecosystem.
              </p>
            </div>
            <div className="feature-grid">
              <article className="why-card">
                <span className="eyebrow">01</span>
                <h3>Athlete Profiles</h3>
                <p>Showcase your sporting journey, achievements and potential.</p>
              </article>
              <article className="why-card">
                <span className="eyebrow">02</span>
                <h3>Coaches & Mentors</h3>
                <p>Connect with coaches and mentors who can support your development.</p>
              </article>
              <article className="why-card">
                <span className="eyebrow">03</span>
                <h3>Talent Discovery</h3>
                <p>Help athletes get discovered and connect talent with the right people.</p>
              </article>
              <article className="why-card">
                <span className="eyebrow">04</span>
                <h3>Organisations</h3>
                <p>Connect with schools, clubs, academies and other sporting organisations.</p>
              </article>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
