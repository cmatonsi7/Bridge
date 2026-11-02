// Migrated from the SportBridge HTML prototype (rendered markup) by tools/html_to_jsx.py. Maintained by hand.
import { useLegacyActions } from '../../features/marketing/useLegacyActions';

export default function FeatureDiscoveryPage() {
  const a = useLegacyActions();
  return (
    <>
      <section className="page role-landing active" id="feature-discovery">
        <div className="role-hero" style={{ backgroundImage: 'url(/images/opportunities.webp)' }}>
          <div className="role-hero-inner">
            <span className="eyebrow">TALENT DISCOVERY</span>
            <h1>
              Discover Talent.
              <br />
              <span>Get Discovered.</span>
            </h1>
            <p>
              SportBridge helps athletes become visible and helps coaches and organisations discover talent
              within the sporting community.
            </p>
            <div className="hero-actions">
              <button className="btn green" onClick={a.go('/discover')} type="button">
                Explore Discover →
              </button>
              <button className="btn" onClick={a.register} type="button">
                Create Your Profile
              </button>
            </div>
          </div>
        </div>
        <div className="role-content">
          <div className="role-intro">
            <span className="eyebrow">A CONNECTED SPORTING ECOSYSTEM</span>
            <h2>Make the right sporting connections easier to find.</h2>
            <p>Discover athletes, coaches and organisations who choose to be visible within SportBridge.</p>
          </div>
          <div className="benefit-grid">
            <article>
              <div className="benefit-icon">01</div>
              <h3>Discover athletes</h3>
              <p>Find athletes who have chosen to make their profiles discoverable.</p>
            </article>
            <article>
              <div className="benefit-icon">02</div>
              <h3>Discover coaches</h3>
              <p>Explore coaches and mentors across different sporting disciplines.</p>
            </article>
            <article>
              <div className="benefit-icon">03</div>
              <h3>Discover organisations</h3>
              <p>Connect with schools, clubs, academies and programme providers.</p>
            </article>
            <article>
              <div className="benefit-icon">04</div>
              <h3>Connect intentionally</h3>
              <p>Use discovery as a starting point for meaningful sporting connections.</p>
            </article>
          </div>
        </div>
        <div className="role-feature">
          <img src="/images/athletes.webp" alt="" loading="lazy" />
          <div>
            <span className="eyebrow">DISCOVER</span>
            <h2>Who you discover starts with who chooses to be seen.</h2>
            <p>
              Public discovery is designed with privacy and visibility choices in mind, especially for young
              athletes.
            </p>
            <button className="btn green" onClick={a.go('/discover')} type="button">
              Explore Discover →
            </button>
          </div>
        </div>
        <div className="role-cta">
          <span className="eyebrow">YOUR NEXT CONNECTION</span>
          <h2>Discover talent. Get discovered.</h2>
          <button className="btn green" onClick={a.register} type="button">
            Get Started →
          </button>
        </div>
      </section>
    </>
  );
}
