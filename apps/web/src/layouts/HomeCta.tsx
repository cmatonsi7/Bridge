// Migrated from the SportBridge HTML prototype (rendered markup) by tools/html_to_jsx.py. Maintained by hand.
import { useLegacyActions } from '../features/marketing/useLegacyActions';

export default function HomeCta() {
  const a = useLegacyActions();
  return (
    <>
      <section className="cta" id="homeCta">
        <div className="wrap cta-inner">
          <div>
            <span className="eyebrow">JOIN SPORTBRIDGE TODAY</span>
            <h2>Be part of a stronger sporting future.</h2>
            <p>Create your profile and unlock new opportunities.</p>
          </div>
          <div className="cta-actions">
            <button className="btn green" onClick={a.openApp} type="button">
              Create Account →
            </button>
            <button className="btn" onClick={a.go('/opportunities')} type="button">
              Explore Opportunities
            </button>
          </div>
        </div>
      </section>
    </>
  );
}
