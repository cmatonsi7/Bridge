// Migrated from the SportBridge HTML prototype (rendered markup) by tools/html_to_jsx.py. Maintained by hand.
import { useLegacyActions } from '../../features/marketing/useLegacyActions';

export default function FeatureOrganisationsPage() {
  const a = useLegacyActions();
  return (
    <>
      <section className="page role-landing active" id="feature-organisations">
        <div className="role-hero role-hero-org">
          <div className="role-hero-inner">
            <span className="eyebrow">ORGANISATIONS</span>
            <h1>
              Connect Your Organisation.
              <br />
              <span>Create Opportunities.</span>
            </h1>
            <p>
              Bring schools, clubs, academies, facilities, programme providers and tertiary institutions into
              one connected sporting ecosystem.
            </p>
            <div className="hero-actions">
              <button className="btn green" onClick={a.register} type="button">
                Register Your Organisation →
              </button>
              <button className="btn" onClick={a.go('/discover')} type="button">
                Explore Organisations
              </button>
            </div>
          </div>
        </div>
        <div className="role-content">
          <div className="role-intro">
            <span className="eyebrow">FOR SPORTING ORGANISATIONS</span>
            <h2>Build a stronger presence within the sporting ecosystem.</h2>
            <p>
              Create an organisation profile and connect with athletes, coaches, parents and the wider
              sporting community.
            </p>
          </div>
          <div className="org-type-grid">
            <article>
              <span>01</span>
              <h3>Club</h3>
              <p>Connect with athletes and create sporting opportunities.</p>
            </article>
            <article>
              <span>02</span>
              <h3>School</h3>
              <p>Support students and connect them with sporting pathways.</p>
            </article>
            <article>
              <span>03</span>
              <h3>Academy</h3>
              <p>Develop athletes, programmes and sporting services.</p>
            </article>
            <article>
              <span>04</span>
              <h3>Sports Facility</h3>
              <p>Showcase venues, facilities and availability.</p>
            </article>
            <article>
              <span>05</span>
              <h3>Programme Provider</h3>
              <p>Publish programmes, trials and opportunities.</p>
            </article>
            <article>
              <span>06</span>
              <h3>University or Tertiary Institution</h3>
              <p>Connect sporting and educational pathways.</p>
            </article>
            <article>
              <span>07</span>
              <h3>Other</h3>
              <p>For organisations that do not fit the listed categories.</p>
            </article>
          </div>
        </div>
        <div className="role-feature reverse">
          <div>
            <span className="eyebrow">CREATE OPPORTUNITIES</span>
            <h2>Turn your organisation into a gateway to opportunity.</h2>
            <p>
              Publish relevant opportunities and programmes and connect with the people your organisation
              serves.
            </p>
            <button className="btn green" onClick={a.register} type="button">
              Register Your Organisation →
            </button>
          </div>
          <img src="/images/academy.webp" alt="" loading="lazy" />
        </div>
        <div className="role-cta">
          <span className="eyebrow">JOIN SPORTBRIDGE</span>
          <h2>Bring your organisation into the sporting ecosystem.</h2>
          <button className="btn green" onClick={a.register} type="button">
            Get Started →
          </button>
        </div>
      </section>
    </>
  );
}
