import type { ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';

/** The prototype's split auth screen: green visual on the left, card on the right. */
export function AuthCard({ tabs, children }: { tabs?: 'signin' | 'signup'; children: ReactNode }) {
  const navigate = useNavigate();
  return (
    <section className="page auth-page active" id="auth">
      <div className="auth-shell">
        <div className="auth-visual">
          <div className="auth-visual-content">
            <span className="eyebrow" style={{ color: '#F5B900' }}>
              WELCOME TO SPORTBRIDGE
            </span>
            <h1>Connect to your sporting journey.</h1>
            <p>
              Create an account to showcase your journey, discover people and opportunities, or sign in to
              continue where you left off.
            </p>
          </div>
        </div>
        <div className="auth-panel">
          <div className="auth-card">
            <div className="auth-brand">
              <img alt="" src="/images/sportbridge-logo.webp" width={40} height={40} />
              <span>SportBridge</span>
            </div>
            {tabs && (
              // A plain nav, not role="tablist"/"tab": each button navigates to its own page
              // rather than switching a panel in place, so "tab" semantics (which promise the
              // latter to assistive tech) would be misleading. aria-current marks the one
              // that matches the page already showing, the same pattern Header.tsx uses.
              <nav className="auth-switch" aria-label="Sign in or create account">
                <button
                  type="button"
                  aria-current={tabs === 'signin' ? 'page' : undefined}
                  className={tabs === 'signin' ? 'active' : ''}
                  onClick={() => navigate('/sign-in')}
                >
                  Sign In
                </button>
                <button
                  type="button"
                  aria-current={tabs === 'signup' ? 'page' : undefined}
                  className={tabs === 'signup' ? 'active' : ''}
                  onClick={() => navigate('/register')}
                >
                  Create Account
                </button>
              </nav>
            )}
            {children}
          </div>
        </div>
      </div>
    </section>
  );
}
