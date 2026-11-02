import { useMemo, useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { createUserWithEmailAndPassword, sendEmailVerification, updateProfile } from 'firebase/auth';
import { Mail } from 'lucide-react';
import {
  GUARDIAN_RELATIONSHIPS,
  GUARDIAN_RELATIONSHIP_LABELS,
  ORGANISATION_TYPES,
  ORGANISATION_TYPE_LABELS,
  ageOn,
  onboardingSchema,
  parseIsoDate,
  passwordSchema,
  type SelfServiceRole,
} from '@sportbridge/shared';
import { requireAuth } from '../../lib/firebase';
import { ApiError, apiFetch } from '../../lib/apiClient';
import { authErrorMessage } from '../../features/auth/authErrors';
import { useAuth } from '../../features/auth/AuthProvider';
import { useFieldErrors } from '../../features/auth/useFieldErrors';
import { AuthCard } from './AuthCard';
import { SelectField, TextField } from './Field';

const ROLE_OPTIONS: { value: SelfServiceRole; label: string; hint: string }[] = [
  {
    value: 'athlete',
    label: 'Athlete',
    hint: 'Build your sporting profile, track progress and discover opportunities.',
  },
  {
    value: 'guardian',
    label: 'Parent / Guardian',
    hint: "Manage your children's sporting journeys and consent from one account.",
  },
  {
    value: 'coach',
    label: 'Coach / Mentor',
    hint: 'Showcase your coaching experience and support athlete development.',
  },
  {
    value: 'organisation',
    label: 'Organisation',
    hint: 'Clubs, schools, academies and programme providers: post opportunities and manage applications.',
  },
];

const today = () => new Date().toISOString().slice(0, 10);

/**
 * Registration, matching the prototype's Create Account form.
 * mode="finish" is shown to someone who has a Firebase account but never completed their profile
 * (for example the connection dropped mid-registration): email and password are hidden.
 */
export default function RegisterPage({ mode = 'signup' }: { mode?: 'signup' | 'finish' }) {
  const navigate = useNavigate();
  const { refresh, state } = useAuth();
  const { errors, fromZod, fromApi, setErrors } = useFieldErrors();
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState('');
  const [f, setF] = useState({
    firstName: '',
    surname: '',
    email: '',
    mobile: '',
    dateOfBirth: '',
    role: '' as SelfServiceRole | '',
    organisationName: '',
    organisationType: '',
    guardianEmail: '',
    guardianRelationship: '',
    guardianConsentAcknowledged: false,
    password: '',
    confirmPassword: '',
    termsAccepted: false,
  });
  const set = <K extends keyof typeof f>(k: K, v: (typeof f)[K]) => setF((p) => ({ ...p, [k]: v }));

  const age = useMemo(() => {
    const d = parseIsoDate(f.dateOfBirth);
    return d ? ageOn(d, new Date()) : null;
  }, [f.dateOfBirth]);
  const isMinor = age !== null && age < 18;
  const showGuardian = isMinor && (f.role === 'athlete' || f.role === '');
  const roleHint = ROLE_OPTIONS.find((r) => r.value === f.role)?.hint;

  function payload() {
    return {
      firstName: f.firstName,
      surname: f.surname,
      mobile: f.mobile,
      dateOfBirth: f.dateOfBirth,
      role: f.role,
      termsAccepted: f.termsAccepted,
      ...(f.role === 'organisation'
        ? { organisationName: f.organisationName, organisationType: f.organisationType || undefined }
        : {}),
      ...(isMinor
        ? {
            guardianEmail: f.guardianEmail || undefined,
            guardianRelationship: f.guardianRelationship || undefined,
            guardianConsentAcknowledged: f.guardianConsentAcknowledged,
          }
        : {}),
    };
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    setFormError('');
    const parsed = onboardingSchema.safeParse(payload());
    const extra: Record<string, string> = {};
    // Zod skips cross-field checks until basic fields pass, so surface the guardian/organisation ones together.
    if (isMinor && f.role === 'athlete') {
      if (!/^\S+@\S+\.\S+$/.test(f.guardianEmail.trim()))
        extra.guardianEmail = 'Parent / guardian email is required';
      if (!f.guardianRelationship) extra.guardianRelationship = 'Select a relationship';
      if (!f.guardianConsentAcknowledged)
        extra.guardianConsentAcknowledged = 'Confirm the guardian consent process';
    }
    if (f.role === 'organisation') {
      if (!f.organisationName.trim()) extra.organisationName = 'Organisation name is required';
      if (!f.organisationType) extra.organisationType = 'Select an organisation type';
    }
    if (mode === 'signup') {
      if (!/^\S+@\S+\.\S+$/.test(f.email.trim())) extra.email = 'Enter a valid email address';
      const pw = passwordSchema.safeParse(f.password);
      if (!pw.success) extra.password = pw.error.issues[0]!.message;
      else if (f.password !== f.confirmPassword) extra.confirmPassword = 'Passwords do not match';
    }
    if (!parsed.success || Object.keys(extra).length) {
      const fieldErrs = parsed.success ? {} : fromZod(parsed.error);
      setErrors({ ...fieldErrs, ...extra });
      setFormError('Check the highlighted fields.');
      return;
    }
    setErrors({});
    setBusy(true);
    try {
      const auth = requireAuth();
      let user = auth.currentUser;
      // On a retry after a failed profile save, reuse the account that was already created.
      if (mode === 'signup' && (!user || user.email?.toLowerCase() !== f.email.trim().toLowerCase())) {
        const cred = await createUserWithEmailAndPassword(auth, f.email.trim(), f.password);
        user = cred.user;
        await updateProfile(user, { displayName: `${f.firstName.trim()} ${f.surname.trim()}` });
        try {
          await sendEmailVerification(user, { url: `${window.location.origin}/verify-email` });
        } catch {
          /* The verify-email page offers "Resend" if this fails. */
        }
      }
      if (!user) throw new Error('NO_USER');
      await apiFetch('/onboarding', { method: 'POST', json: parsed.data });
      await refresh(); // picks up the new role claim
      navigate(user.emailVerified ? '/app' : '/verify-email', { replace: true });
    } catch (err) {
      if (err instanceof ApiError) {
        if (err.fields) fromApi(err.fields);
        setFormError(
          err.code === 'NETWORK'
            ? 'Your account was created but your profile could not be saved. Check your connection and select Try Again.'
            : err.message,
        );
      } else setFormError(authErrorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  const accountCreated = mode === 'signup' && state.status === 'signedIn';

  return (
    <AuthCard tabs={mode === 'signup' ? 'signup' : undefined}>
      <form className="auth-form active" id="signupForm" onSubmit={submit} noValidate>
        <h2>{mode === 'finish' ? 'Finish setting up your account.' : 'Create your account.'}</h2>
        <p className="intro">
          Tell us a little about yourself so we can create the right SportBridge experience for you.
        </p>
        <div className="form-grid">
          <TextField
            id="firstName"
            label="First name"
            autoComplete="given-name"
            placeholder="First name"
            value={f.firstName}
            error={errors.firstName}
            onChange={(e) => set('firstName', e.target.value)}
          />
          <TextField
            id="surname"
            label="Surname"
            autoComplete="family-name"
            placeholder="Surname"
            value={f.surname}
            error={errors.surname}
            onChange={(e) => set('surname', e.target.value)}
          />
        </div>
        {mode === 'signup' && (
          <TextField
            id="signupEmail"
            label="Email address"
            type="email"
            autoComplete="email"
            placeholder="you@example.com"
            value={f.email}
            error={errors.email}
            disabled={accountCreated}
            onChange={(e) => set('email', e.target.value)}
          />
        )}
        <div className="form-grid">
          <TextField
            id="mobile"
            label="Mobile number"
            type="tel"
            autoComplete="tel"
            placeholder="e.g. 071 234 5678"
            value={f.mobile}
            error={errors.mobile}
            onChange={(e) => set('mobile', e.target.value)}
          />
          <TextField
            id="dob"
            label="Date of birth"
            type="date"
            max={today()}
            value={f.dateOfBirth}
            error={errors.dateOfBirth}
            onChange={(e) => set('dateOfBirth', e.target.value)}
          />
        </div>
        <SelectField
          id="accountRole"
          label="How will you use SportBridge?"
          value={f.role}
          error={errors.role}
          onChange={(e) => set('role', e.target.value as SelfServiceRole)}
        >
          <option value="">Select account type</option>
          {ROLE_OPTIONS.map((r) => (
            <option key={r.value} value={r.value}>
              {r.label}
            </option>
          ))}
        </SelectField>

        {f.role && (
          <div className="role-setup" id="roleSetup">
            {f.role === 'organisation' && (
              <div className="form-grid">
                <TextField
                  id="organisationName"
                  label="Organisation name"
                  placeholder="e.g. Soweto FC"
                  value={f.organisationName}
                  error={errors.organisationName}
                  onChange={(e) => set('organisationName', e.target.value)}
                />
                <SelectField
                  id="organisationType"
                  label="Organisation type"
                  value={f.organisationType}
                  error={errors.organisationType}
                  onChange={(e) => set('organisationType', e.target.value)}
                >
                  <option value="">Select type</option>
                  {ORGANISATION_TYPES.map((t) => (
                    <option key={t} value={t}>
                      {ORGANISATION_TYPE_LABELS[t]}
                    </option>
                  ))}
                </SelectField>
              </div>
            )}
            <div className="role-setup-hint" id="roleSetupHint">
              {roleHint}
            </div>
          </div>
        )}

        {isMinor && f.role && f.role !== 'athlete' && (
          <div className="auth-error" role="alert">
            Under-18 accounts can only be athlete accounts. A parent or guardian can register as Parent /
            Guardian.
          </div>
        )}

        {showGuardian && (
          <div className="age-consent-box show" id="minorGuardianFields">
            <strong>Parent / guardian consent required</strong>
            <p style={{ margin: '5px 0 9px' }}>
              Because the registered athlete is under 18, SportBridge will require a parent or legal guardian
              relationship to be verified before protected child information or relationship features are
              enabled.
            </p>
            <div className="form-grid">
              <TextField
                id="guardianEmail"
                label="Parent / guardian email"
                type="email"
                placeholder="guardian@example.com"
                value={f.guardianEmail}
                error={errors.guardianEmail}
                onChange={(e) => set('guardianEmail', e.target.value)}
              />
              <SelectField
                id="guardianRelationship"
                label="Relationship"
                value={f.guardianRelationship}
                error={errors.guardianRelationship}
                onChange={(e) => set('guardianRelationship', e.target.value)}
              >
                <option value="">Select relationship</option>
                {GUARDIAN_RELATIONSHIPS.map((r) => (
                  <option key={r} value={r}>
                    {GUARDIAN_RELATIONSHIP_LABELS[r]}
                  </option>
                ))}
              </SelectField>
            </div>
            <label className="auth-consent">
              <input
                id="guardianConsent"
                type="checkbox"
                checked={f.guardianConsentAcknowledged}
                onChange={(e) => set('guardianConsentAcknowledged', e.target.checked)}
              />
              <span>
                I confirm that the parent/legal guardian consent process will be completed before the child's
                protected profile features are activated.
              </span>
            </label>
            {errors.guardianConsentAcknowledged && (
              <span className="field-error" style={{ color: '#b42318', fontSize: 12, fontWeight: 600 }}>
                {errors.guardianConsentAcknowledged}
              </span>
            )}
          </div>
        )}

        {mode === 'signup' && !accountCreated && (
          <div className="form-grid">
            <TextField
              id="signupPassword"
              label="Password"
              type="password"
              autoComplete="new-password"
              placeholder="Create a password"
              value={f.password}
              error={errors.password}
              onChange={(e) => set('password', e.target.value)}
            />
            <TextField
              id="confirmPassword"
              label="Confirm password"
              type="password"
              autoComplete="new-password"
              placeholder="Repeat password"
              value={f.confirmPassword}
              error={errors.confirmPassword}
              onChange={(e) => set('confirmPassword', e.target.value)}
            />
          </div>
        )}
        <label className="auth-consent">
          <input
            id="termsConsent"
            type="checkbox"
            checked={f.termsAccepted}
            onChange={(e) => set('termsAccepted', e.target.checked)}
          />
          <span>
            I agree to the SportBridge terms and understand that privacy, consent and profile visibility
            settings apply to my account.
          </span>
        </label>
        {errors.termsAccepted && (
          <span className="field-error" style={{ color: '#b42318', fontSize: 12, fontWeight: 600 }}>
            {errors.termsAccepted}
          </span>
        )}
        <div className="auth-error" role="alert">
          {formError}
        </div>
        <button className="btn green verify-full" type="submit" disabled={busy}>
          {busy
            ? 'Creating your account…'
            : formError && accountCreated
              ? 'Try Again'
              : mode === 'finish'
                ? 'Save & Continue →'
                : 'Create Account & Verify Email →'}
        </button>
        {mode === 'signup' && (
          <div style={{ textAlign: 'center', marginTop: 16 }}>
            <button className="auth-link" type="button" onClick={() => navigate('/sign-in')}>
              Already have an account? Sign in
            </button>
          </div>
        )}
        <div className="auth-secure">
          <Mail className="icon" aria-hidden="true" />{' '}
          <span>
            <strong>Email verification required.</strong> We’ll email you a verification link. Open it to
            activate your account.
          </span>
        </div>
      </form>
    </AuthCard>
  );
}
