import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import toast from 'react-hot-toast';
import api from '../services/api';
import { AlertTriangle, ArrowLeft, CheckCircle2, Eye, EyeOff, LockKeyhole } from 'lucide-react';
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

export default function ResetPasswordPage() {
  const { token } = useParams();
  const navigate = useNavigate();
  const [showPwd, setShowPwd] = useState(false);
  const [done, setDone] = useState(false);
  const [tokenErr, setTokenErr] = useState('');

  const { register, handleSubmit, watch, formState: { errors, isSubmitting } } = useForm();
  const password = watch('password', '');
  const strength = getStrength(password);

  useEffect(() => {
    if (!done) return undefined;
    const timer = window.setTimeout(() => navigate('/login'), 3000);
    return () => window.clearTimeout(timer);
  }, [done, navigate]);

  const onSubmit = async ({ password: newPassword, confirmPassword }) => {
    try {
      await api.post('/auth/reset-password/' + token, {
        password: newPassword,
        confirmPassword
      });
      setDone(true);
    } catch (error) {
      const code = error?.response?.data?.code;
      const message = error?.response?.data?.message || 'Password reset failed. Please try again.';
      if (code === 'INVALID_TOKEN') setTokenErr(message);
      else toast.error(message);
    }
  };

  if (tokenErr) {
    return (
      <AuthShell
        eyebrow="PASSWORD RECOVERY"
        title="Reset link expired"
        description="This password reset link is invalid or no longer active."
        footer={<Link to="/login" className="auth-link"><ArrowLeft size={14} aria-hidden="true" /> Back to sign in</Link>}
      >
        <div className="auth-alert is-danger" role="alert">
          <AlertTriangle size={19} aria-hidden="true" />
          <div><strong>Request a fresh reset link</strong><p>{tokenErr}</p></div>
        </div>
        <Link to="/forgot-password" className="auth-submit">Request a new link</Link>
      </AuthShell>
    );
  }

  if (done) {
    return (
      <AuthShell
        eyebrow="PASSWORD UPDATED"
        title="Password reset complete"
        description="Your new password has been saved."
        footer={<Link to="/login" className="auth-link">Continue to sign in</Link>}
      >
        <div className="auth-alert is-success" role="status" aria-live="polite">
          <CheckCircle2 size={22} aria-hidden="true" />
          <div><strong>Password changed successfully</strong><p>Redirecting to sign in in a few seconds…</p></div>
        </div>
      </AuthShell>
    );
  }

  return (
    <AuthShell
      eyebrow="PASSWORD RECOVERY"
      title="Choose a new password"
      description="Create a strong password. For security, this link expires after 15 minutes."
      footer={<Link to="/login" className="auth-link"><ArrowLeft size={14} aria-hidden="true" /> Back to sign in</Link>}
    >
      <div className="auth-alert">
        <LockKeyhole size={18} aria-hidden="true" />
        <div><strong>Protect your account</strong><p>Use a unique password with a mix of letters, numbers and symbols.</p></div>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="auth-form" noValidate>
        <div className="auth-field">
          <label htmlFor="reset-password">New password</label>
          <div className="auth-password-input">
            <input
              id="reset-password"
              type={showPwd ? 'text' : 'password'}
              autoComplete="new-password"
              placeholder="At least 12 characters"
              aria-invalid={!!errors.password}
              aria-describedby={errors.password ? 'reset-password-error' : 'reset-password-strength'}
              {...register('password', {
                required: 'Password is required.',
                minLength: { value: 12, message: 'Use at least 12 characters.' }
              })}
            />
            <button type="button" className="auth-password-toggle" onClick={() => setShowPwd(value => !value)} aria-label={showPwd ? 'Hide password' : 'Show password'} aria-pressed={showPwd}>
              {showPwd ? <EyeOff size={17} aria-hidden="true" /> : <Eye size={17} aria-hidden="true" />}
            </button>
          </div>
          {errors.password && <p id="reset-password-error" className="auth-field-error" role="alert">{errors.password.message}</p>}
          {password && (
            <div id="reset-password-strength">
              <div className="auth-password-meter" data-score={strength} aria-label={'Password strength: ' + STRENGTH_LABELS[strength]}>
                {[1,2,3,4,5].map(item => <span key={item} />)}
              </div>
              <p className="auth-password-strength">Password strength: {STRENGTH_LABELS[strength]}</p>
            </div>
          )}
        </div>

        <div className="auth-field">
          <label htmlFor="reset-confirm-password">Confirm new password</label>
          <input
            id="reset-confirm-password"
            type={showPwd ? 'text' : 'password'}
            autoComplete="new-password"
            placeholder="Re-enter your password"
            aria-invalid={!!errors.confirmPassword}
            aria-describedby={errors.confirmPassword ? 'reset-confirm-error' : undefined}
            {...register('confirmPassword', {
              required: 'Please confirm your password.',
              validate: value => value === password || 'Passwords do not match.'
            })}
          />
          {errors.confirmPassword && <p id="reset-confirm-error" className="auth-field-error" role="alert">{errors.confirmPassword.message}</p>}
        </div>

        <button type="submit" className="auth-submit" disabled={isSubmitting}>
          {isSubmitting && <span className="auth-spinner" aria-hidden="true" />}
          {isSubmitting ? 'Saving new password…' : 'Reset password'}
        </button>
      </form>
    </AuthShell>
  );
}
