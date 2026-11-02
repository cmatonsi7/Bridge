import { useState, type FormEvent } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { Lock } from 'lucide-react';
import { requireAuth } from '../../lib/firebase';
import { authErrorMessage } from '../../features/auth/authErrors';
import { AuthCard } from './AuthCard';
import { TextField } from './Field';

export default function SignInPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const next = new URLSearchParams(location.search).get('next');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      await signInWithEmailAndPassword(requireAuth(), email.trim(), password);
      // Guards decide the destination: finish registration, verify email, or the dashboard.
      navigate(next && next.startsWith('/app') ? next : '/app', { replace: true });
    } catch (err) {
      setError(authErrorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <AuthCard tabs="signin">
      <form className="auth-form active" id="signinForm" onSubmit={submit} noValidate>
        <h2>Welcome back.</h2>
        <p className="intro">Sign in to access your SportBridge profile, opportunities and connections.</p>
        <TextField
          id="signinEmail"
          label="Email address"
          type="email"
          autoComplete="email"
          placeholder="you@example.com"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        <TextField
          id="signinPassword"
          label="Password"
          type="password"
          autoComplete="current-password"
          placeholder="Enter your password"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
        <div className="auth-error" role="alert">
          {error}
        </div>
        <button className="btn green verify-full" type="submit" disabled={busy}>
          {busy ? 'Signing in…' : 'Sign In & Continue →'}
        </button>
        <div className="auth-inline-links" style={{ marginTop: 16 }}>
          <button
            className="auth-link"
            type="button"
            onClick={() => navigate('/reset-password', { state: { email } })}
          >
            Forgot password?
          </button>
          <button className="auth-link" type="button" onClick={() => navigate('/register')}>
            Create an account
          </button>
        </div>
        <div className="auth-secure">
          <Lock className="icon" aria-hidden="true" />{' '}
          <span>
            <strong>Secure sign-in.</strong> Sign-in is protected by Firebase Authentication. SportBridge
            staff can never see your password.
          </span>
        </div>
      </form>
    </AuthCard>
  );
}
