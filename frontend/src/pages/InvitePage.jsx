// src/pages/InvitePage.jsx – Accept invitation and setup password

import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { validateInvitation, acceptInvitation } from '../services/invitationService';
import useAuthStore from '../store/authStore';
import toast from 'react-hot-toast';
import { AlertCircle, CheckCircle, Clock, Mail } from 'lucide-react';

export default function InvitePage() {
  const { token } = useParams();
  const navigate = useNavigate();
  const setAuth = useAuthStore((s) => s.setAuth);

  const [loading, setLoading] = useState(true);
  const [validating, setValidating] = useState(false);
  const [step, setStep] = useState('validate'); // validate | setup | success
  const [invitation, setInvitation] = useState(null);
  const [error, setError] = useState(null);

  const [formData, setFormData] = useState({
    name: '',
    password: '',
    confirmPassword: ''
  });

  const [passwordStrength, setPasswordStrength] = useState(0);
  const [formErrors, setFormErrors] = useState({});

  // ── Validate token on mount ────────────────────────────────────
  useEffect(() => {
    const validate = async () => {
      if (!token) {
        setError({ message: 'No invitation token provided', code: 'INVALID_TOKEN' });
        setStep('error');
        setLoading(false);
        return;
      }

      try {
        const result = await validateInvitation(token);
        setInvitation(result.data);
        setStep('setup');
      } catch (err) {
        console.error('Validation error:', err);
        setError(err);
        setStep('error');
      } finally {
        setLoading(false);
      }
    };

    validate();
  }, [token]);

  // ── Calculate password strength ────────────────────────────────
  const calculatePasswordStrength = (pwd) => {
    if (!pwd) return 0;
    let strength = 0;
    if (pwd.length >= 8) strength++;
    if (pwd.length >= 12) strength++;
    if (/[a-z]/.test(pwd) && /[A-Z]/.test(pwd)) strength++;
    if (/\d/.test(pwd)) strength++;
    if (/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(pwd)) strength++;
    return Math.min(5, strength);
  };

  // ── Handle password change ─────────────────────────────────────
  const handlePasswordChange = (e) => {
    const pwd = e.target.value;
    setFormData({ ...formData, password: pwd });
    setPasswordStrength(calculatePasswordStrength(pwd));
  };

  // ── Validate form ──────────────────────────────────────────────
  const validateForm = () => {
    const errors = {};

    if (!formData.name.trim()) {
      errors.name = 'Name is required';
    } else if (formData.name.trim().length < 2) {
      errors.name = 'Name must be at least 2 characters';
    }

    if (!formData.password) {
      errors.password = 'Password is required';
    } else if (formData.password.length < 8) {
      errors.password = 'Password must be at least 8 characters';
    }

    if (!formData.confirmPassword) {
      errors.confirmPassword = 'Please confirm your password';
    } else if (formData.password !== formData.confirmPassword) {
      errors.confirmPassword = 'Passwords do not match';
    }

    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  // ── Handle form submission ─────────────────────────────────────
  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!validateForm()) {
      toast.error('Please fix the errors below');
      return;
    }

    setValidating(true);

    try {
      const result = await acceptInvitation(token, formData);

      // Store tokens
      setAuth({
        accessToken: result.data.accessToken,
        refreshToken: result.data.refreshToken,
        user: result.data.user
      });

      setStep('success');
      toast.success('Account created successfully!');

      // Redirect to dashboard after short delay
      setTimeout(() => {
        navigate('/dashboard');
      }, 1500);
    } catch (err) {
      console.error('Acceptance error:', err);
      if (err.code === 'EXPIRED_TOKEN') {
        setError(err);
        setStep('error');
        toast.error('Invitation has expired');
      } else {
        toast.error(err.message || 'Failed to create account');
      }
    } finally {
      setValidating(false);
    }
  };

  // ── Loading state ──────────────────────────────────────────────
  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-black via-gray-900 to-black flex items-center justify-center p-4">
        <div className="text-center">
          <div className="w-20 h-20 bg-gradient-to-br from-yellow-400 to-yellow-600 rounded-2xl flex items-center justify-center mx-auto mb-6 animate-pulse">
            <span className="text-3xl font-bold text-black">AF</span>
          </div>
          <p className="text-gray-300 text-lg">Validating your invitation...</p>
        </div>
      </div>
    );
  }

  // ── Error state ────────────────────────────────────────────────
  if (step === 'error') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-black via-gray-900 to-black flex items-center justify-center p-4">
        <div className="bg-gray-800/40 backdrop-blur-xl border border-gray-700 rounded-2xl p-8 max-w-md w-full text-center">
          <div className="mb-4 flex justify-center">
            <div className="w-16 h-16 bg-red-900/20 rounded-full flex items-center justify-center">
              <AlertCircle className="w-8 h-8 text-red-400" />
            </div>
          </div>
          <h1 className="text-2xl font-bold text-white mb-2">Invitation Error</h1>
          <p className="text-gray-300 mb-6">
            {error?.code === 'EXPIRED_TOKEN' ? (
              <>
                Your invitation has expired. Please ask your administrator to send you a new one.
              </>
            ) : (
              error?.message || 'Invalid or expired invitation link'
            )}
          </p>
          {error?.code === 'EXPIRED_TOKEN' && error?.data?.invitationId && (
            <p className="text-sm text-gray-400 mb-6">
              Invitation ID: {error.data.invitationId}
            </p>
          )}
          <button
            onClick={() => navigate('/login')}
            className="w-full py-3 bg-yellow-500 hover:bg-yellow-600 text-black font-semibold rounded-lg transition"
          >
            Back to Login
          </button>
        </div>
      </div>
    );
  }

  // ── Setup password state ───────────────────────────────────────
  if (step === 'setup') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-black via-gray-900 to-black flex items-center justify-center p-4">
        <div className="bg-gray-800/40 backdrop-blur-xl border border-gray-700 rounded-2xl p-8 max-w-md w-full">
          {/* Header */}
          <div className="text-center mb-8">
            <div className="w-20 h-20 bg-gradient-to-br from-yellow-400 to-yellow-600 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <span className="text-3xl font-bold text-black">AF</span>
            </div>
            <h1 className="text-3xl font-bold text-white mb-2">Welcome! 🎉</h1>
            <p className="text-gray-300">Abdulmula Fashion ERP</p>
          </div>

          {/* Invitation Info */}
          <div className="bg-gray-900/50 border border-gray-700 rounded-lg p-4 mb-6">
            <div className="flex items-start gap-3 mb-3">
              <Mail className="w-5 h-5 text-yellow-500 flex-shrink-0 mt-1" />
              <div>
                <p className="text-xs text-gray-400">Email</p>
                <p className="text-white font-medium">{invitation?.email}</p>
              </div>
            </div>
            <div className="flex items-start gap-3 mb-3">
              <CheckCircle className="w-5 h-5 text-yellow-500 flex-shrink-0 mt-1" />
              <div>
                <p className="text-xs text-gray-400">Role</p>
                <p className="text-white font-medium capitalize">{invitation?.role}</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <Clock className="w-5 h-5 text-yellow-500 flex-shrink-0 mt-1" />
              <div>
                <p className="text-xs text-gray-400">Expires</p>
                <p className="text-white font-medium">
                  {new Date(invitation?.expiresAt).toLocaleString()}
                </p>
              </div>
            </div>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Name */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">Full Name</label>
              <input
                type="text"
                placeholder="Your full name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className={`w-full px-4 py-3 bg-gray-700/50 border rounded-lg text-white placeholder-gray-400 focus:outline-none focus:border-yellow-500 transition ${
                  formErrors.name ? 'border-red-500' : 'border-gray-600'
                }`}
              />
              {formErrors.name && (
                <p className="text-red-400 text-sm mt-1">{formErrors.name}</p>
              )}
            </div>

            {/* Password */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">Password</label>
              <input
                type="password"
                placeholder="Enter a strong password"
                value={formData.password}
                onChange={handlePasswordChange}
                className={`w-full px-4 py-3 bg-gray-700/50 border rounded-lg text-white placeholder-gray-400 focus:outline-none focus:border-yellow-500 transition ${
                  formErrors.password ? 'border-red-500' : 'border-gray-600'
                }`}
              />
              {formData.password && (
                <div className="mt-2">
                  <div className="flex gap-1 h-2">
                    {[...Array(5)].map((_, i) => (
                      <div
                        key={i}
                        className={`flex-1 rounded-full transition ${
                          i < passwordStrength ? 'bg-yellow-500' : 'bg-gray-700'
                        }`}
                      />
                    ))}
                  </div>
                  <p className="text-xs text-gray-400 mt-1">
                    {passwordStrength === 5
                      ? '🔐 Strong password'
                      : passwordStrength >= 3
                      ? '⚠️ Good password'
                      : '⚡ Weak password'}
                  </p>
                </div>
              )}
              {formErrors.password && (
                <p className="text-red-400 text-sm mt-1">{formErrors.password}</p>
              )}
            </div>

            {/* Confirm Password */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Confirm Password
              </label>
              <input
                type="password"
                placeholder="Confirm your password"
                value={formData.confirmPassword}
                onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })}
                className={`w-full px-4 py-3 bg-gray-700/50 border rounded-lg text-white placeholder-gray-400 focus:outline-none focus:border-yellow-500 transition ${
                  formErrors.confirmPassword ? 'border-red-500' : 'border-gray-600'
                }`}
              />
              {formErrors.confirmPassword && (
                <p className="text-red-400 text-sm mt-1">{formErrors.confirmPassword}</p>
              )}
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={validating}
              className="w-full py-3 bg-gradient-to-r from-yellow-400 to-yellow-600 hover:from-yellow-500 hover:to-yellow-700 text-black font-semibold rounded-lg transition disabled:opacity-50 disabled:cursor-not-allowed mt-6"
            >
              {validating ? 'Creating Account...' : '✨ Create Account & Login'}
            </button>
          </form>

          {/* Help */}
          <p className="text-center text-xs text-gray-400 mt-4">
            Password must be at least 8 characters
          </p>
        </div>
      </div>
    );
  }

  // ── Success state ──────────────────────────────────────────────
  if (step === 'success') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-black via-gray-900 to-black flex items-center justify-center p-4">
        <div className="bg-gray-800/40 backdrop-blur-xl border border-gray-700 rounded-2xl p-8 max-w-md w-full text-center">
          <div className="mb-4 flex justify-center">
            <div className="w-16 h-16 bg-green-900/20 rounded-full flex items-center justify-center animate-pulse">
              <CheckCircle className="w-8 h-8 text-green-400" />
            </div>
          </div>
          <h1 className="text-2xl font-bold text-white mb-2">Account Created! ✅</h1>
          <p className="text-gray-300">Redirecting to your dashboard...</p>
        </div>
      </div>
    );
  }
}
