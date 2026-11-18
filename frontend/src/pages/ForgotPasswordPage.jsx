import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import toast from 'react-hot-toast';
import api from '../services/api';
import { ArrowLeft, CheckCircle2, Mail, ShieldCheck } from 'lucide-react';
import AuthShell from '../components/AuthShell';

export default function ForgotPasswordPage() {
  const [sent, setSent] = useState(false);
  const [sentEmail, setSentEmail] = useState('');
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm();

  const onSubmit = async ({ email }) => {
    try {
      await api.post('/auth/forgot-password', { email });
      setSentEmail(email.trim());
      setSent(true);
    } catch (error) {
      toast.error(error?.response?.data?.message || 'Request failed. Please try again.');
    }
  };

  if (sent) {
    return (
      <AuthShell
        eyebrow="PASSWORD RECOVERY"
        title="Check your inbox"
        description="Your request has been received."
        footer={<Link to="/login" className="auth-link"><ArrowLeft size={14} aria-hidden="true" /> Back to sign in</Link>}
      >
        <div className="auth-alert is-success" role="status" aria-live="polite">
          <CheckCircle2 size={19} aria-hidden="true" />
          <div>
            <strong>Check your email if the account is registered</strong>
            <p>If an active account exists for <b>{sentEmail}</b>, a secure password reset link will be sent. For security, this page does not reveal whether the address is registered.</p>
          </div>
        </div>
        <div className="auth-info-card">
          <div className="auth-info-row"><ShieldCheck size={17} aria-hidden="true" /><div><span>Security</span><strong>Reset links expire after 15 minutes.</strong></div></div>
          <div className="auth-info-row"><Mail size={17} aria-hidden="true" /><div><span>Next step</span><strong>Check your inbox and spam folder.</strong></div></div>
        </div>
      </AuthShell>
    );
  }

  return (
    <AuthShell
      eyebrow="ACCOUNT RECOVERY"
      title="Forgot your password?"
      description="Enter the email address associated with your staff account. We’ll guide you through a secure reset."
      footer={<Link to="/login" className="auth-link"><ArrowLeft size={14} aria-hidden="true" /> Back to sign in</Link>}
    >
      <form onSubmit={handleSubmit(onSubmit)} className="auth-form" noValidate>
        <div className="auth-field">
          <label htmlFor="forgot-email">Email address</label>
          <input
            id="forgot-email"
            type="email"
            autoComplete="email"
            autoFocus
            placeholder="you@abdulmula.com"
            aria-invalid={!!errors.email}
            aria-describedby={errors.email ? 'forgot-email-error' : undefined}
            {...register('email', {
              required: 'Email is required.',
              pattern: { value: /^\S+@\S+\.\S+$/, message: 'Enter a valid email address.' }
            })}
          />
          {errors.email && <p id="forgot-email-error" className="auth-field-error" role="alert">{errors.email.message}</p>}
        </div>

        <button type="submit" className="auth-submit" disabled={isSubmitting}>
          {isSubmitting && <span className="auth-spinner" aria-hidden="true" />}
          {isSubmitting ? 'Submitting request…' : 'Send password reset link'}
        </button>
      </form>
    </AuthShell>
  );
}
