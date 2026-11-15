import { useLegacyActions } from '../../features/marketing/useLegacyActions';

/** Plain answers about how SportBridge works today. Nothing here promises a feature that is not built. */
export default function ResourcesPage() {
  const a = useLegacyActions();
  return (
    <section className="page active" id="resources">
      <div className="section">
        <div className="wrap">
          <div className="section-head">
            <span className="eyebrow">RESOURCES</span>
            <h2>Resources for the sporting community.</h2>
            <p>How SportBridge works, in plain language.</p>
          </div>
          <div className="benefit-grid">
            <article>
              <div className="benefit-icon">01</div>
              <h3>For parents and guardians</h3>
              <p>
                Under-18s are never listed in the Talent Directory and their contact details are never shown.
                A child needs a confirmed parent or guardian on SportBridge, and the parent sees every update
                to their child’s applications.
              </p>
            </article>
            <article>
              <div className="benefit-icon">02</div>
              <h3>How verification works</h3>
              <p>
                SportBridge staff check that an organisation is real and that the account represents it, then
                mark it Verified. Organisations that have not been checked say “Not yet verified”.
              </p>
            </article>
            <article>
              <div className="benefit-icon">03</div>
              <h3>Is your school or club already here?</h3>
              <p>
                SportBridge may have added your school or club already. If we gave you a claim code, create an
                organisation account and enter the code to take over that profile.
              </p>
            </article>
            <article>
              <div className="benefit-icon">04</div>
              <h3>Cost</h3>
              <p>
                Starter is free, and organisations can post opportunities and programmes at no charge for now.
                Paid plans are not open yet, so nothing is charged today.
              </p>
            </article>
          </div>
          <div className="hero-actions" style={{ marginTop: 28, justifyContent: 'center' }}>
            <button className="btn green" onClick={a.register} type="button">
              Create an account →
            </button>
            <button className="btn" onClick={a.go('/about')} type="button">
              About SportBridge
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}
