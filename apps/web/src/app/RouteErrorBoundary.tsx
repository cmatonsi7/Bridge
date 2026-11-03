import { isRouteErrorResponse, useNavigate, useRouteError } from 'react-router-dom';

/**
 * Friendly recovery screen for any error thrown while rendering a route (including the
 * "n is not a function" class of crash caused by something outside React mutating the DOM
 * React manages, e.g. Chrome's built-in page translator — now also guarded against directly
 * via translate="no" in index.html). A full reload gives React a clean DOM to mount into again.
 */
export default function RouteErrorBoundary() {
  const error = useRouteError();
  const navigate = useNavigate();
  const notFound = isRouteErrorResponse(error) && error.status === 404;

  return (
    <section className="page active">
      <div className="section">
        <div className="wrap">
          <div className="section-head">
            <span className="eyebrow">{notFound ? 'PAGE NOT FOUND' : 'SOMETHING WENT WRONG'}</span>
            <h2>{notFound ? "We couldn't find that page." : 'This page hit a snag.'}</h2>
            <p>
              {notFound
                ? 'The link may be out of date. Go back to the home page to keep exploring.'
                : 'Something interrupted this page — often a browser extension or page translator changing the page underneath it. Reloading usually fixes it.'}
            </p>
            <div style={{ display: 'flex', gap: 12, justifyContent: 'center', marginTop: 18 }}>
              <button className="btn green" type="button" onClick={() => window.location.reload()}>
                Reload page
              </button>
              <button className="btn" type="button" onClick={() => navigate('/')}>
                Go to home page
              </button>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
