// Migrated from the SportBridge HTML prototype (rendered markup) by tools/html_to_jsx.py. Maintained by hand.
import { useLegacyActions } from '../../features/marketing/useLegacyActions';

export default function FeatureAthletesPage() {
  const a = useLegacyActions();
  return (
    <>
      <section className="page role-landing active" id="feature-athletes">
        <div className="role-hero role-hero-athlete">
          <div className="role-hero-inner">
            <span className="eyebrow">ATHLETE PROFILES</span>
            <h1>
              Showcase Your Journey.
              <br />
              <span>Be Seen For Your Potential.</span>
            </h1>
            <p>
              Create a professional sporting profile that brings your achievements, experience, goals and
              potential together in one place.
            </p>
            <div className="hero-actions">
              <button className="btn green" onClick={a.register} type="button">
                Create Your Profile →
              </button>
              <button className="btn" onClick={a.go('/discover')} type="button">
                Explore Discover
              </button>
            </div>
          </div>
        </div>
        <div className="role-content">
          <div className="role-intro">
            <span className="eyebrow">YOUR SPORTING IDENTITY</span>
            <h2>Put your sporting journey in one place.</h2>
            <p>
              SportBridge helps athletes create a profile that can showcase their sporting code, achievements,
              experience, goals and potential.
            </p>
          </div>
          <div className="benefit-grid">
            <article>
              <div className="benefit-icon">01</div>
              <h3>Build your profile</h3>
              <p>Present your sporting journey, achievements and experience in one professional profile.</p>
            </article>
            <article>
              <div className="benefit-icon">02</div>
              <h3>Show your potential</h3>
              <p>Highlight your strengths, goals and sporting aspirations.</p>
            </article>
            <article>
              <div className="benefit-icon">03</div>
              <h3>Get discovered</h3>
              <p>Choose whether your profile can be publicly discoverable by the SportBridge community.</p>
            </article>
            <article>
              <div className="benefit-icon">04</div>
              <h3>Find opportunities</h3>
              <p>
                Connect your sporting journey to trials, programmes, scholarships and other opportunities.
              </p>
            </article>
          </div>
        </div>
        <div className="role-feature">
          <img src="/images/athlete-profile.webp" alt="" loading="lazy" />
          <div>
            <span className="eyebrow">YOUR PROFILE</span>
            <h2>A clearer picture of who you are as an athlete.</h2>
            <p>
              Build a profile that helps coaches, organisations and relevant sporting communities understand
              your journey.
            </p>
            <button className="btn green" onClick={a.register} type="button">
              Create Your Profile →
            </button>
          </div>
        </div>
        <div className="role-cta">
          <span className="eyebrow">START YOUR SPORTING JOURNEY</span>
          <h2>Your profile can be the beginning of your next opportunity.</h2>
          <button className="btn green" onClick={a.register} type="button">
            Get Started →
          </button>
        </div>
      </section>
    </>
  );
}
