// Migrated from the SportBridge HTML prototype (rendered markup) by tools/html_to_jsx.py. Maintained by hand.
import { useLegacyActions } from '../../features/marketing/useLegacyActions';

export default function AboutPage() {
  const a = useLegacyActions();
  return (
    <>
      <section className="page role-landing active" id="about">
        <div className="role-hero" style={{ backgroundImage: 'url(/images/community.webp)' }}>
          <div className="role-hero-inner">
            <span className="eyebrow">ABOUT SPORTBRIDGE</span>
            <h1>
              Connecting People.
              <br />
              <span>Creating Sporting Pathways.</span>
            </h1>
            <p>
              SportBridge is a sports opportunity platform designed to connect athletes, parents, coaches and
              sporting organisations through one connected ecosystem.
            </p>
            <div className="hero-actions">
              <button className="btn green" onClick={a.register} type="button">
                Join SportBridge →
              </button>
              <button className="btn" onClick={a.go('/discover')} type="button">
                Explore the Community
              </button>
            </div>
          </div>
        </div>
        <div className="role-content">
          <div className="role-intro">
            <span className="eyebrow">WHO WE ARE</span>
            <h2>Building a more connected sporting ecosystem.</h2>
            <p>
              SportBridge brings people, opportunities and sport together. The platform is designed to make it
              easier for athletes to showcase their journeys, for coaches to connect with talent and for
              organisations to create and share opportunities.
            </p>
          </div>
          <div className="benefit-grid">
            <article>
              <div className="benefit-icon">01</div>
              <h3>Access</h3>
              <p>Make sporting opportunities easier to find and access across different communities.</p>
            </article>
            <article>
              <div className="benefit-icon">02</div>
              <h3>Connection</h3>
              <p>Bring athletes, families, coaches and organisations into one ecosystem.</p>
            </article>
            <article>
              <div className="benefit-icon">03</div>
              <h3>Opportunity</h3>
              <p>Create clearer pathways from sporting potential to meaningful opportunity.</p>
            </article>
            <article>
              <div className="benefit-icon">04</div>
              <h3>Community</h3>
              <p>Support a sporting environment built around people and relationships.</p>
            </article>
          </div>
        </div>
        <div className="role-feature">
          <img src="/images/community.webp" alt="" loading="lazy" />
          <div>
            <span className="eyebrow">OUR PURPOSE</span>
            <h2>Discover talent. Create opportunities. Build brighter futures.</h2>
            <p>
              SportBridge is built around a simple idea: when the right people can find one another and the
              right opportunities are easier to access, sporting journeys can become more connected.
            </p>
          </div>
        </div>
        <div className="section soft">
          <div className="wrap">
            <div className="section-head">
              <span className="eyebrow">OUR CORE VALUES</span>
              <h2>What SportBridge is built around.</h2>
              <p>These principles shape the experience we aim to create across the platform.</p>
            </div>
            <div className="benefit-grid">
              <article>
                <div className="benefit-icon">01</div>
                <h3>People First</h3>
                <p>Sport is ultimately about people, relationships and journeys.</p>
              </article>
              <article>
                <div className="benefit-icon">02</div>
                <h3>Opportunity</h3>
                <p>We aim to make pathways and possibilities easier to discover.</p>
              </article>
              <article>
                <div className="benefit-icon">03</div>
                <h3>Inclusion</h3>
                <p>
                  We seek to create a platform that can connect sporting communities across different
                  backgrounds and locations.
                </p>
              </article>
              <article>
                <div className="benefit-icon">04</div>
                <h3>Trust & Safety</h3>
                <p>
                  Privacy, consent, verification and responsible participation are important parts of the
                  platform experience.
                </p>
              </article>
            </div>
          </div>
        </div>
        <div className="role-cta">
          <span className="eyebrow">BECOME PART OF THE ECOSYSTEM</span>
          <h2>There is a place for you on SportBridge.</h2>
          <button className="btn green" onClick={a.register} type="button">
            Get Started →
          </button>
        </div>
      </section>
    </>
  );
}
