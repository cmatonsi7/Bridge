import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { sendEmailVerification } from 'firebase/auth';
import { MailCheck } from 'lucide-react';
import { useAuth } from '../../features/auth/AuthProvider';
import { authErrorMessage } from '../../features/auth/authErrors';
import { AuthCard } from './AuthCard';

export default function VerifyEmailPage() {
  const navigate = useNavigate();
  const { state, refresh, signOut } = useAuth();
  const [msg, setMsg] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const user = state.status === 'signedIn' ? state.user : null;

  useEffect(() => {
    if (user?.emailVerified) navigate('/app', { replace: true });
  }, [user?.emailVerified, navigate]);

  // Pick up verification done in another tab when the person comes back.
  useEffect(() => {
    const onFocus = () => void refresh().catch(() => {});
    window.addEventListener('focus', onFocus);
    return () => window.removeEventListener('focus', onFocus);
  }, [refresh]);

  if (!user) return null;

  async function check() {
    setError('');
    setBusy(true);
    try {
      await refresh();
      if (!user!.emailVerified)
        setError('Your email is not verified yet. Open the link in the email we sent, then try again.');
    } catch (err) {
      setError(authErrorMessage(err));
    } finally {
      setBusy(false);
    }
  }
  async function resend() {
    setError('');
    setMsg('');
    try {
      await sendEmailVerification(user!, { url: `${window.location.origin}/verify-email` });
      setMsg('A new verification link has been sent.');
    } catch (err) {
      setError(authErrorMessage(err));
    }
  }

  return (
    <AuthCard>
      <div className="auth-form active">
        <h2>Verify your email.</h2>
        <p className="intro">
          We sent a verification link to <strong>{user.email}</strong>. Open it to activate your SportBridge
          account, then come back here.
        </p>
        <div className="auth-secure">
          <MailCheck className="icon" aria-hidden="true" />{' '}
          <span>
            Can’t find it? Check your spam or promotions folder. Links expire after a while; request a new one
            if needed.
          </span>
        </div>
        <div className="auth-error" role="alert">
          {error}
        </div>
        {msg && (
          <div className="auth-success" role="status">
            {msg}
          </div>
        )}
        <button
          className="btn green verify-full"
          type="button"
          onClick={check}
          disabled={busy}
          style={{ marginTop: 14 }}
        >
          {busy ? 'Checking…' : 'I’ve Verified My Email'}
        </button>
        <div className="auth-inline-links" style={{ marginTop: 16 }}>
          <button className="auth-link" type="button" onClick={resend}>
            Resend link
          </button>
          <button
            className="auth-link"
            type="button"
            onClick={() => void signOut().then(() => navigate('/sign-in'))}
          >
            Use a different account
          </button>
        </div>
      </div>
    </AuthCard>
  );
}
