import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import toast from 'react-hot-toast';
import useAuthStore from '../store/authStore';
import { AlertCircle, Eye, EyeOff, Mail, ShieldOff } from 'lucide-react';
import { Input } from '../components/ui';
import AuthShell from '../components/AuthShell';

const CODE_UI = {
  ACCOUNT_LOCKED: { icon: ShieldOff, tone: 'danger' },
  ACCOUNT_DISABLED: { icon: ShieldOff, tone: 'neutral' },
  NOT_VERIFIED: { icon: Mail, tone: 'warning' }
};

export default function LoginPage() {
  const { register, handleSubmit, formState: { errors } } = useForm();
  const { login, isLoading } = useAuthStore();
  const navigate = useNavigate();
  const [showPwd, setShowPwd] = useState(false);
  const [errorUI, setErrorUI] = useState(null);

  const onSubmit = async ({ email, password }) => {
    setErrorUI(null);
    const result = await login(email, password);

    if (result.success) {
      toast.success('Welcome back!');
      navigate('/dashboard');
      return;
    }

    if (result.code && CODE_UI[result.code]) {
      setErrorUI({ code: result.code, message: result.message });
    } else {
      toast.error(result.message || 'Sign-in failed. Please try again.', { duration: 5000 });
    }
  };

  const errorMeta = errorUI ? CODE_UI[errorUI.code] : null;
  const ErrorIcon = errorMeta?.icon;

  return (
    <AuthShell
      eyebrow="STAFF PORTAL"
      title="Welcome back"
      description="Sign in with your Abdulmula Fashion staff credentials to open your workspace."
      footer={<>Need access to the system? Contact your administrator to create or invite your account.</>}
    >
      {errorUI && (
        <div className={'auth-alert ' + (errorMeta?.tone === 'danger' ? 'is-danger' : '')} role="alert">
          {ErrorIcon ? <ErrorIcon size={18} aria-hidden="true" /> : <AlertCircle size={18} aria-hidden="true" />}
          <div>
            <strong>{errorUI.message}</strong>
            {errorUI.code === 'NOT_VERIFIED' && <p>Check your inbox for the account activation email.</p>}
            {errorUI.code === 'ACCOUNT_LOCKED' && <p>Too many failed attempts. Wait until the lock expires before trying again.</p>}
            {errorUI.code === 'ACCOUNT_DISABLED' && <p>Contact an administrator if you believe this account should be active.</p>}
          </div>
        </div>
      )}

      <form onSubmit={handleSubmit(onSubmit)} className="auth-form" noValidate>
        <Input
          id="login-email"
          type="email"
          label="Email address"
          placeholder="you@abdulmula.com"
          autoComplete="email"
          required
          error={errors.email?.message}
          {...register('email', {
            required: 'Email is required',
            pattern: { value: /^\S+@\S+\.\S+$/, message: 'Enter a valid email address.' }
          })}
        />

        <div className="auth-field">
          <div className="auth-field-row">
            <label htmlFor="login-password">Password</label>
            <Link to="/forgot-password" className="auth-link">Forgot password?</Link>
          </div>
          <div className="auth-password-input">
            <input
              id="login-password"
              type={showPwd ? 'text' : 'password'}
              autoComplete="current-password"
              placeholder="Enter your password"
              aria-invalid={!!errors.password}
              aria-describedby={errors.password ? 'login-password-error' : undefined}
              {...register('password', { required: 'Password is required' })}
            />
            <button
              type="button"
              className="auth-password-toggle"
              onClick={() => setShowPwd(value => !value)}
              aria-label={showPwd ? 'Hide password' : 'Show password'}
              aria-pressed={showPwd}
            >
              {showPwd ? <EyeOff size={17} aria-hidden="true" /> : <Eye size={17} aria-hidden="true" />}
            </button>
          </div>
          {errors.password && <p id="login-password-error" className="auth-field-error" role="alert">{errors.password.message}</p>}
        </div>

        <button type="submit" className="auth-submit" disabled={isLoading}>
          {isLoading && <span className="auth-spinner" aria-hidden="true" />}
          {isLoading ? 'Signing in…' : 'Sign in to workspace'}
        </button>
      </form>
    </AuthShell>
  );
}
