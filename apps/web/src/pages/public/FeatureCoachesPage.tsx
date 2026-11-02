// Migrated from the SportBridge HTML prototype (rendered markup) by tools/html_to_jsx.py. Maintained by hand.
import { useLegacyActions } from '../../features/marketing/useLegacyActions';

export default function FeatureCoachesPage() {
  const a = useLegacyActions();
  return (
    <>
      <section className="page role-landing active" id="feature-coaches">
        <div className="role-hero role-hero-coach">
          <div className="role-hero-inner">
            <span className="eyebrow">COACHES & MENTORS</span>
            <h1>
              Connect With Talent.
              <br />
              <span>Support Development.</span>
            </h1>
            <p>
              Create a professional coaching profile and connect with athletes who are looking for guidance,
              development and sporting support.
            </p>
            <div className="hero-actions">
              <button className="btn green" onClick={a.register} type="button">
                Create Your Coach Profile →
              </button>
              <button className="btn" onClick={a.go('/discover')} type="button">
                Discover Coaches
              </button>
            </div>
          </div>
        </div>
        <div className="role-content">
          <div className="role-intro">
            <span className="eyebrow">COACHING CONNECTIONS</span>
            <h2>Bring your coaching experience into one professional profile.</h2>
            <p>
              Showcase your qualifications, experience, sporting codes, services and areas of support to the
              wider sporting community.
            </p>
          </div>
          <div className="benefit-grid">
            <article>
              <div className="benefit-icon">01</div>
              <h3>Build your profile</h3>
              <p>Showcase qualifications, certifications, experience and sporting codes.</p>
            </article>
            <article>
              <div className="benefit-icon">02</div>
              <h3>Connect with athletes</h3>
              <p>Build relationships with multiple athletes through one professional presence.</p>
            </article>
            <article>
              <div className="benefit-icon">03</div>
              <h3>Show your expertise</h3>
              <p>Make your coaching services and areas of support clear.</p>
            </article>
            <article>
              <div className="benefit-icon">04</div>
              <h3>Discover opportunities</h3>
              <p>Find relevant coaching and sporting opportunities across the ecosystem.</p>
            </article>
          </div>
        </div>
        <div className="role-feature reverse">
          <div>
            <span className="eyebrow">COACH & ATHLETE</span>
            <h2>Build relationships that support development.</h2>
            <p>
              SportBridge creates a connected space for athletes and coaches to discover, connect and grow.
            </p>
            <button className="btn green" onClick={a.register} type="button">
              Join as a Coach →
            </button>
          </div>
          <img src="/images/coach-athlete.webp" alt="" loading="lazy" />
        </div>
        <div className="role-cta">
          <span className="eyebrow">JOIN THE SPORTING COMMUNITY</span>
          <h2>Put your experience in front of the right people.</h2>
          <button className="btn green" onClick={a.register} type="button">
            Get Started →
          </button>
        </div>
      </section>
    </>
  );
}
