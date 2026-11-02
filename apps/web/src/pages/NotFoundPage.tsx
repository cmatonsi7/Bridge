import { useNavigate } from 'react-router-dom';

export default function NotFoundPage() {
  const navigate = useNavigate();
  return (
    <section className="page active">
      <div className="section">
        <div className="wrap">
          <div className="section-head">
            <span className="eyebrow">PAGE NOT FOUND</span>
            <h2>We couldn’t find that page.</h2>
            <p>The link may be out of date. Go back to the home page to keep exploring.</p>
            <button
              className="btn green"
              type="button"
              onClick={() => navigate('/')}
              style={{ marginTop: 18 }}
            >
              Go to home page
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}
