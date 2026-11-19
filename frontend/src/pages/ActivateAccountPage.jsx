import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import toast from 'react-hot-toast';
import api from '../services/api';
import { ArrowLeft, CheckCircle2, Eye, EyeOff, ShieldCheck, AlertTriangle } from 'lucide-react';
import AuthShell from '../components/AuthShell';

function getStrength(password) {
  if (!password) return 0;
  return [
    password.length >= 12,
    /[A-Z]/.test(password),
    /[a-z]/.test(password),
    /\d/.test(password),
    /[^A-Za-z0-9]/.test(password)
  ].filter(Boolean).length;
}

const STRENGTH_LABELS = ['', 'Very weak', 'Weak', 'Fair', 'Strong', 'Very strong'];

export default function ActivateAccountPage() {
  const { token } = useParams();
  const navigate = useNavigate();
  const [showPwd, setShowPwd] = useState(false);
  const [activated, setActivated] = useState(false);
  const [tokenErr, setTokenErr] = useState('');

  const {
    register, handleSubmit, watch,
    formState: { errors, isSubmitting }
  } = useForm();

  const password = watch('password', '');
  const strength = getStrength(password);

  useEffect(() => {
    if (!activated) return undefined;
    const timer = window.setTimeout(() => navigate('/login'), 3000);
    return () => window.clearTimeout(timer);
  }, [activated, navigate]);

  const onSubmit = async ({ password: newPassword, confirmPassword }) => {
    try {
      await api.post('/auth/activate/' + token, {
        password: newPassword,
        confirmPassword
      });
      setActivated(true);
    } catch (error) {
      const code = error?.response?.data?.code;
      const message = error?.response?.data?.message || 'Activation failed. Please try again.';
      if (code === 'INVALID_TOKEN' || code === 'ALREADY_VERIFIED') setTokenErr(message);
      else toast.error(message);
    }
  };

  if (tokenErr) {
    return (
      <AuthShell
        eyebrow="ACCOUNT ACTIVATION"
        title="Activation link unavailable"
        description="This activation link can no longer be used."
        footer={<Link to="/login" className="auth-link"><ArrowLeft size={14} aria-hidden="true" /> Back to sign in</Link>}
      >
        <div className="auth-alert is-danger" role="alert">
          <AlertTriangle size={19} aria-hidden="true" />
          <div><strong>We couldn’t activate this account</strong><p>{tokenErr}</p><p>Contact your administrator to request a new activation email.</p></div>
        </div>
      </AuthShell>
    );
  }

  if (activated) {
    return (
      <AuthShell
        eyebrow="ACCOUNT ACTIVATED"
        title="You’re all set"
        description="Your staff account is active and ready to use."
        footer={<Link to="/login" className="auth-link">Continue to sign in</Link>}
      >
        <div className="auth-alert is-success" role="status" aria-live="polite">
          <CheckCircle2 size={22} aria-hidden="true" />
          <div><strong>Account activation complete</strong><p>Redirecting to sign in in a few seconds…</p></div>
        </div>
        <p className="auth-redirect-note">You can also use the sign-in link below.</p>
      </AuthShell>
    );
  }

  return (
    <AuthShell
      eyebrow="NEW STAFF ACCOUNT"
      title="Set your password"
      description="Create a strong password to activate your Abdulmula Fashion account."
      footer="Need help? Contact your system administrator."
    >
      <div className="auth-alert">
        <ShieldCheck size={18} aria-hidden="true" />
        <div><strong>Secure account activation</strong><p>Use at least 12 characters and avoid reusing a password from another service.</p></div>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="auth-form" noValidate>
        <div className="auth-field">
          <label htmlFor="activate-password">New password</label>
          <div className="auth-password-input">
            <input
              id="activate-password"
              type={showPwd ? 'text' : 'password'}
              autoComplete="new-password"
              placeholder="At least 12 characters"
              aria-invalid={!!errors.password}
              aria-describedby={errors.password ? 'activate-password-error' : 'activate-password-strength'}
              {...register('password', {
                required: 'Password is required.',
                minLength: { value: 12, message: 'Use at least 12 characters.' }
              })}
            />
            <button type="button" className="auth-password-toggle" onClick={() => setShowPwd(value => !value)} aria-label={showPwd ? 'Hide password' : 'Show password'} aria-pressed={showPwd}>
              {showPwd ? <EyeOff size={17} aria-hidden="true" /> : <Eye size={17} aria-hidden="true" />}
            </button>
          </div>
          {errors.password && <p id="activate-password-error" className="auth-field-error" role="alert">{errors.password.message}</p>}
          {password && (
            <div id="activate-password-strength">
              <div className="auth-password-meter" data-score={strength} aria-label={'Password strength: ' + STRENGTH_LABELS[strength]}>
                {[1,2,3,4,5].map(item => <span key={item} />)}
              </div>
              <p className="auth-password-strength">Password strength: {STRENGTH_LABELS[strength]}</p>
            </div>
          )}
        </div>

        <div className="auth-field">
          <label htmlFor="activate-confirm-password">Confirm password</label>
          <input
            id="activate-confirm-password"
            type={showPwd ? 'text' : 'password'}
            autoComplete="new-password"
            placeholder="Re-enter your password"
            aria-invalid={!!errors.confirmPassword}
            aria-describedby={errors.confirmPassword ? 'activate-confirm-error' : undefined}
            {...register('confirmPassword', {
              required: 'Please confirm your password.',
              validate: value => value === password || 'Passwords do not match.'
            })}
          />
          {errors.confirmPassword && <p id="activate-confirm-error" className="auth-field-error" role="alert">{errors.confirmPassword.message}</p>}
        </div>

        <div className="auth-requirements">
          {[
            ['At least 12 characters', password.length >= 12],
            ['Uppercase letter', /[A-Z]/.test(password)],
            ['Lowercase letter', /[a-z]/.test(password)],
            ['Number', /\d/.test(password)]
          ].map(([label, met]) => (
            <p key={label} className={met ? 'is-met' : ''}><span>{met ? '✓' : '○'}</span>{label}</p>
          ))}
        </div>

        <button type="submit" className="auth-submit" disabled={isSubmitting}>
          {isSubmitting && <span className="auth-spinner" aria-hidden="true" />}
          {isSubmitting ? 'Activating account…' : 'Activate account'}
        </button>
      </form>
    </AuthShell>
  );
}
