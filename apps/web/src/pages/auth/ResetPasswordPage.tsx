import { useState, type FormEvent } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { sendPasswordResetEmail } from 'firebase/auth';
import { requireAuth } from '../../lib/firebase';
import { authErrorMessage } from '../../features/auth/authErrors';
import { AuthCard } from './AuthCard';
import { TextField } from './Field';

export default function ResetPasswordPage() {
  const navigate = useNavigate();
  const initial = (useLocation().state as { email?: string } | null)?.email ?? '';
  const [email, setEmail] = useState(initial);
  const [error, setError] = useState('');
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError('');
    if (!/^\S+@\S+\.\S+$/.test(email.trim())) return setError('Enter the email address you registered with.');
    setBusy(true);
    try {
      await sendPasswordResetEmail(requireAuth(), email.trim(), { url: `${window.location.origin}/sign-in` });
      setSent(true);
    } catch (err) {
      const code = (err as { code?: string }).code;
      // Never reveal whether an account exists for this address.
      if (code === 'auth/user-not-found' || code === 'auth/invalid-email') setSent(true);
      else setError(authErrorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <AuthCard>
      <form className="auth-form active" onSubmit={submit} noValidate>
        <h2>Reset your password.</h2>
        <p className="intro">Enter your email address and we’ll send you a link to choose a new password.</p>
        <TextField
          id="resetEmail"
          label="Email address"
          type="email"
          autoComplete="email"
          placeholder="you@example.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        <div className="auth-error" role="alert">
          {error}
        </div>
        {sent ? (
          <div className="auth-success" role="status">
            If an account exists for {email.trim()}, a reset link is on its way. Check your inbox and spam
            folder.
          </div>
        ) : (
          <button className="btn green verify-full" type="submit" disabled={busy}>
            {busy ? 'Sending…' : 'Send Reset Link'}
          </button>
        )}
        <div style={{ textAlign: 'center', marginTop: 16 }}>
          <button className="auth-link" type="button" onClick={() => navigate('/sign-in')}>
            Back to sign in
          </button>
        </div>
      </form>
    </AuthCard>
  );
}
