import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { validateInvitation, acceptInvitation } from '../services/invitationService';
import useAuthStore from '../store/authStore';
import toast from 'react-hot-toast';
import {
  AlertCircle, ArrowLeft, CalendarClock, CheckCircle2, Eye, EyeOff,
  Mail, ShieldCheck, UserRound
} from 'lucide-react';
import AuthShell from '../components/AuthShell';

function calculatePasswordStrength(password) {
  if (!password) return 0;
  let score = 0;
  if (password.length >= 12) score++;
  if (password.length >= 12) score++;
  if (/[a-z]/.test(password) && /[A-Z]/.test(password)) score++;
  if (/\d/.test(password)) score++;
  if (/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)) score++;
  return Math.min(5, score);
}

const STRENGTH_LABELS = ['', 'Very weak', 'Weak', 'Fair', 'Strong', 'Very strong'];

function formatExpiry(value) {
  if (!value) return 'Not available';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? 'Not available' : date.toLocaleString();
}

export default function InvitePage() {
  const { token } = useParams();
  const navigate = useNavigate();
  const setAuth = useAuthStore(state => state.setAuth);

  const [loading, setLoading] = useState(true);
  const [validating, setValidating] = useState(false);
  const [step, setStep] = useState('validate');
  const [invitation, setInvitation] = useState(null);
  const [error, setError] = useState(null);
  const [showPassword, setShowPassword] = useState(false);
  const [formData, setFormData] = useState({ name: '', password: '', confirmPassword: '' });
  const [passwordStrength, setPasswordStrength] = useState(0);
  const [formErrors, setFormErrors] = useState({});

  useEffect(() => {
    let active = true;

    const validate = async () => {
      if (!token) {
        setError({ message: 'No invitation token was provided.', code: 'INVALID_TOKEN' });
        setStep('error');
        setLoading(false);
        return;
      }

      try {
        const result = await validateInvitation(token);
        if (!active) return;
        setInvitation(result.data);
        setStep('setup');
      } catch (requestError) {
        if (!active) return;
        const payload = requestError?.response?.data || requestError?.data || {};
        setError({
          code: payload.code || requestError?.code || 'INVALID_TOKEN',
          message: payload.message || requestError?.message || 'This invitation link is invalid or has expired.',
          data: payload.data || requestError?.data
        });
        setStep('error');
      } finally {
        if (active) setLoading(false);
      }
    };

    validate();
    return () => { active = false; };
  }, [token]);

  useEffect(() => {
    if (step !== 'success') return undefined;
    const timer = window.setTimeout(() => navigate('/dashboard'), 1500);
    return () => window.clearTimeout(timer);
  }, [step, navigate]);

  const handlePasswordChange = event => {
    const password = event.target.value;
    setFormData(current => ({ ...current, password }));
    setPasswordStrength(calculatePasswordStrength(password));
  };

  const validateForm = () => {
    const nextErrors = {};

    if (!formData.name.trim()) nextErrors.name = 'Name is required.';
    else if (formData.name.trim().length < 2) nextErrors.name = 'Name must be at least 2 characters.';

    if (!formData.password) nextErrors.password = 'Password is required.';
    else if (formData.password.length < 12) nextErrors.password = 'Password must be at least 12 characters.';

    if (!formData.confirmPassword) nextErrors.confirmPassword = 'Please confirm your password.';
    else if (formData.password !== formData.confirmPassword) nextErrors.confirmPassword = 'Passwords do not match.';

    setFormErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  const handleSubmit = async event => {
    event.preventDefault();
    if (!validateForm()) {
      toast.error('Please review the highlighted fields.');
      return;
    }

    setValidating(true);
    try {
      const result = await acceptInvitation(token, {
        ...formData,
        name: formData.name.trim()
      });

      setAuth({
        accessToken: result.data.accessToken,
        refreshToken: result.data.refreshToken,
        user: result.data.user
      });

      setStep('success');
      toast.success('Account created successfully!');
    } catch (requestError) {
      const payload = requestError?.response?.data || requestError?.data || {};
      const code = payload.code || requestError?.code;
      const message = payload.message || requestError?.message || 'Failed to create your account.';

      if (code === 'EXPIRED_TOKEN') {
        setError({ code, message, data: payload.data || requestError?.data });
        setStep('error');
      } else {
        toast.error(message);
      }
    } finally {
      setValidating(false);
    }
  };

  if (loading) {
    return (
      <AuthShell
        eyebrow="INVITATION"
        title="Checking your invitation"
        description="We’re verifying the secure invitation link."
        status={<><span className="auth-spinner" aria-hidden="true" /> Validating invitation…</>}
      >
        <div className="auth-loading"><div className="auth-loading-mark">AF</div><span>Please keep this page open.</span></div>
      </AuthShell>
    );
  }

  if (step === 'error') {
    const invitationId = error?.data?.invitationId;
    return (
      <AuthShell
        eyebrow="INVITATION"
        title="Invitation unavailable"
        description="This invitation can’t be used to create an account."
        footer={<Link to="/login" className="auth-link"><ArrowLeft size={14} aria-hidden="true" /> Back to sign in</Link>}
      >
        <div className="auth-alert is-danger" role="alert">
          <AlertCircle size={19} aria-hidden="true" />
          <div>
            <strong>{error?.code === 'EXPIRED_TOKEN' ? 'Invitation expired' : 'Invitation could not be validated'}</strong>
            <p>{error?.code === 'EXPIRED_TOKEN' ? 'Ask your administrator to send you a new invitation.' : (error?.message || 'The invitation link is invalid or expired.')}</p>
          </div>
        </div>
        {invitationId && <div className="auth-info-card"><div className="auth-info-row"><Mail size={16} aria-hidden="true" /><div><span>Invitation reference</span><strong>{invitationId}</strong></div></div></div>}
      </AuthShell>
    );
  }

  if (step === 'success') {
    return (
      <AuthShell
        eyebrow="ACCOUNT CREATED"
        title="Welcome to the team"
        description="Your invitation has been accepted and your workspace account is ready."
        footer={<span>Opening your dashboard…</span>}
      >
        <div className="auth-alert is-success" role="status" aria-live="polite">
          <CheckCircle2 size={22} aria-hidden="true" />
          <div><strong>Account created successfully</strong><p>You’re signed in. Redirecting to your dashboard.</p></div>
        </div>
      </AuthShell>
    );
  }

  return (
    <AuthShell
      wide
      eyebrow="TEAM INVITATION"
      title="Create your staff account"
      description="Confirm your details and choose a strong password to join Abdulmula Fashion ERP."
      footer="Your invitation is private to the email address shown above. Keep your password confidential."
    >
      <div className="auth-info-card">
        <div className="auth-info-row"><Mail size={17} aria-hidden="true" /><div><span>Invited email</span><strong>{invitation?.email || 'Email unavailable'}</strong></div></div>
        <div className="auth-info-row"><ShieldCheck size={17} aria-hidden="true" /><div><span>Workspace role</span><strong className="auth-capitalize">{invitation?.role || 'Staff'}</strong></div></div>
        <div className="auth-info-row"><CalendarClock size={17} aria-hidden="true" /><div><span>Invitation expires</span><strong>{formatExpiry(invitation?.expiresAt)}</strong></div></div>
      </div>

      <form onSubmit={handleSubmit} className="auth-form" noValidate>
        <div className="auth-field">
          <label htmlFor="invite-name">Full name</label>
          <div className="auth-password-input">
            <input
              id="invite-name"
              type="text"
              autoComplete="name"
              placeholder="Enter your full name"
              value={formData.name}
              aria-invalid={!!formErrors.name}
              aria-describedby={formErrors.name ? 'invite-name-error' : undefined}
              onChange={event => setFormData(current => ({ ...current, name: event.target.value }))}
            />
            <span className="auth-field-trailing-icon"><UserRound size={16} aria-hidden="true" /></span>
          </div>
          {formErrors.name && <p id="invite-name-error" className="auth-field-error" role="alert">{formErrors.name}</p>}
        </div>

        <div className="auth-field">
          <label htmlFor="invite-password">Password</label>
          <div className="auth-password-input">
            <input
              id="invite-password"
              type={showPassword ? 'text' : 'password'}
              autoComplete="new-password"
              placeholder="Create a password"
              value={formData.password}
              aria-invalid={!!formErrors.password}
              aria-describedby={formErrors.password ? 'invite-password-error' : 'invite-password-strength'}
              onChange={handlePasswordChange}
            />
            <button type="button" className="auth-password-toggle" onClick={() => setShowPassword(value => !value)} aria-label={showPassword ? 'Hide password' : 'Show password'} aria-pressed={showPassword}>
              {showPassword ? <EyeOff size={17} aria-hidden="true" /> : <Eye size={17} aria-hidden="true" />}
            </button>
          </div>
          {formData.password && (
            <div id="invite-password-strength">
              <div className="auth-password-meter" data-score={passwordStrength} aria-label={'Password strength: ' + STRENGTH_LABELS[passwordStrength]}>
                {[1,2,3,4,5].map(item => <span key={item} />)}
              </div>
              <p className="auth-password-strength">Password strength: {STRENGTH_LABELS[passwordStrength]}</p>
            </div>
          )}
          {formErrors.password && <p id="invite-password-error" className="auth-field-error" role="alert">{formErrors.password}</p>}
        </div>

        <div className="auth-field">
          <label htmlFor="invite-confirm-password">Confirm password</label>
          <input
            id="invite-confirm-password"
            type={showPassword ? 'text' : 'password'}
            autoComplete="new-password"
            placeholder="Re-enter your password"
            value={formData.confirmPassword}
            aria-invalid={!!formErrors.confirmPassword}
            aria-describedby={formErrors.confirmPassword ? 'invite-confirm-error' : undefined}
            onChange={event => setFormData(current => ({ ...current, confirmPassword: event.target.value }))}
          />
          {formErrors.confirmPassword && <p id="invite-confirm-error" className="auth-field-error" role="alert">{formErrors.confirmPassword}</p>}
        </div>

        <div className="auth-requirements">
          {[
            ['At least 12 characters', formData.password.length >= 8],
            ['Uppercase and lowercase letters', /[a-z]/.test(formData.password) && /[A-Z]/.test(formData.password)],
            ['A number', /\d/.test(formData.password)],
            ['A symbol', /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(formData.password)]
          ].map(([label, met]) => <p key={label} className={met ? 'is-met' : ''}><span>{met ? '✓' : '○'}</span>{label}</p>)}
        </div>

        <button type="submit" className="auth-submit" disabled={validating}>
          {validating && <span className="auth-spinner" aria-hidden="true" />}
          {validating ? 'Creating account…' : 'Create account & sign in'}
        </button>
      </form>
    </AuthShell>
  );
}
