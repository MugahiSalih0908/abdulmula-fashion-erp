// src/pages/ActivateAccountPage.jsx
// Staff activates their account via the email link

import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { motion } from 'framer-motion';
import toast from 'react-hot-toast';
import api from '../services/api';
import {
  Eye,
  EyeOff,
  CheckCircle,
  ShieldCheck,
  AlertTriangle
} from 'lucide-react';

// Password strength checker
const getStrength = (pwd) => {
  let score = 0;
  if (!pwd) return { score: 0, label: '', color: '' };
  if (pwd.length >= 8)                  score++;
  if (/[A-Z]/.test(pwd))               score++;
  if (/[a-z]/.test(pwd))               score++;
  if (/\d/.test(pwd))                  score++;
  if (/[^A-Za-z0-9]/.test(pwd))        score++;
  const levels = [
    { label: '',          color: 'bg-gray-200' },
    { label: 'Very Weak', color: 'bg-red-400'  },
    { label: 'Weak',      color: 'bg-orange-400' },
    { label: 'Fair',      color: 'bg-yellow-400' },
    { label: 'Strong',    color: 'bg-green-400' },
    { label: 'Very Strong', color: 'bg-emerald-500' },
  ];
  return { score, ...levels[Math.min(score, 5)] };
};

export default function ActivateAccountPage() {
  const { token }   = useParams();
  const navigate    = useNavigate();
  const [showPwd,   setShowPwd]   = useState(false);
  const [activated, setActivated] = useState(false);
  const [tokenErr,  setTokenErr]  = useState('');

  const {
    register, handleSubmit, watch,
    formState: { errors, isSubmitting }
  } = useForm();

  const pwd      = watch('password', '');
  const strength = getStrength(pwd);

  const onSubmit = async (data) => {
    if (data.password !== data.confirmPassword) {
      toast.error('Passwords do not match.');
      return;
    }
    try {
      await api.post(`/auth/activate/${token}`, {
        password:        data.password,
        confirmPassword: data.confirmPassword,
      });
      setActivated(true);
      setTimeout(() => navigate('/login'), 3000);
    } catch (err) {
      const code = err?.response?.data?.code;
      const msg  = err?.response?.data?.message || 'Activation failed. Please try again.';
      if (code === 'INVALID_TOKEN' || code === 'ALREADY_VERIFIED') {
        setTokenErr(msg);
      } else {
        toast.error(msg);
      }
    }
  };

  // ── Token error state ────────────────────────────────────────
  if (tokenErr) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4"
           style={{ background: 'linear-gradient(135deg, #111 0%, #1a1a1a 100%)' }}>
        <div className="bg-white rounded-3xl p-8 max-w-sm w-full text-center shadow-2xl">
          <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <AlertTriangle size={32} className="text-red-500" />
          </div>
          <h2 className="font-black text-xl text-gray-900 mb-2">Link Expired</h2>
          <p className="text-gray-500 text-sm mb-6">{tokenErr}</p>
          <p className="text-xs text-gray-400">
            Contact your system administrator to resend the activation email.
          </p>
        </div>
      </div>
    );
  }

  // ── Success state ─────────────────────────────────────────────
  if (activated) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4"
           style={{ background: 'linear-gradient(135deg, #111 0%, #1a1a1a 100%)' }}>
        <motion.div
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1,   opacity: 1 }}
          className="bg-white rounded-3xl p-8 max-w-sm w-full text-center shadow-2xl"
        >
          <motion.div
            initial={{ scale: 0 }} animate={{ scale: 1 }}
            transition={{ delay: 0.2, type: 'spring', stiffness: 200 }}
            className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4"
          >
            <CheckCircle size={40} className="text-green-600" />
          </motion.div>
          <h2 className="font-black text-2xl text-gray-900 mb-2">Account Activated!</h2>
          <p className="text-gray-500 text-sm mb-2">
            Your account is ready. Redirecting to login…
          </p>
          <div className="flex justify-center mt-4">
            <div className="w-8 h-1 rounded-full animate-pulse" style={{ background: '#d4a017' }} />
          </div>
        </motion.div>
      </div>
    );
  }

  // ── Activation form ───────────────────────────────────────────
  return (
    <div className="min-h-screen flex items-center justify-center p-4"
         style={{ background: 'linear-gradient(135deg, #111 0%, #1a1a1a 100%)' }}>
      <div className="w-full max-w-sm">

        {/* Brand */}
        <div className="text-center mb-8">
          <div className="w-20 h-20 rounded-2xl flex items-center justify-center font-black text-3xl mx-auto mb-4 shadow-2xl"
               style={{ background: '#d4a017', color: '#111' }}>
            AF
          </div>
          <h1 className="text-white font-black text-2xl">Abdulmula Fashion</h1>
          <p className="text-sm mt-1" style={{ color: '#d4a017' }}>Activate Your Account</p>
        </div>

        {/* Card */}
        <div className="bg-white rounded-3xl p-6 shadow-2xl">
          <div className="flex items-center gap-2 mb-4">
            <ShieldCheck size={20} style={{ color: '#d4a017' }} />
            <div>
              <h2 className="font-bold text-lg text-gray-900 leading-tight">Set Your Password</h2>
              <p className="text-xs text-gray-500">Choose a strong password to activate your account</p>
            </div>
          </div>

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>

            {/* New password */}
            <div>
              <label className="text-sm font-semibold text-gray-700 block mb-1.5">
                New Password
              </label>
              <div className="relative">
                <input
                  type={showPwd ? 'text' : 'password'}
                  {...register('password', {
                    required: 'Password is required',
                    minLength: { value: 8, message: 'Must be at least 8 characters' }
                  })}
                  className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none bg-gray-50 pr-12"
                  onFocus={e => e.target.style.borderColor = '#d4a017'}
                  onBlur={e  => e.target.style.borderColor = '#e5e7eb'}
                  placeholder="Min. 8 characters"
                  autoComplete="new-password"
                />
                <button type="button" onClick={() => setShowPwd(!showPwd)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400">
                  {showPwd ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
              {errors.password && (
                <p className="text-red-500 text-xs mt-1">{errors.password.message}</p>
              )}

              {/* Strength meter */}
              {pwd.length > 0 && (
                <div className="mt-2">
                  <div className="flex gap-1 h-1.5">
                    {[1,2,3,4,5].map(i => (
                      <div key={i} className={`flex-1 rounded-full transition-colors ${
                        i <= strength.score ? strength.color : 'bg-gray-200'
                      }`} />
                    ))}
                  </div>
                  {strength.label && (
                    <p className="text-xs mt-1 text-gray-500">
                      Strength: <span className="font-semibold">{strength.label}</span>
                    </p>
                  )}
                </div>
              )}
            </div>

            {/* Confirm password */}
            <div>
              <label className="text-sm font-semibold text-gray-700 block mb-1.5">
                Confirm Password
              </label>
              <input
                type={showPwd ? 'text' : 'password'}
                {...register('confirmPassword', {
                  required: 'Please confirm your password',
                  validate: v => v === pwd || 'Passwords do not match'
                })}
                className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none bg-gray-50"
                onFocus={e => e.target.style.borderColor = '#d4a017'}
                onBlur={e  => e.target.style.borderColor = '#e5e7eb'}
                placeholder="Repeat password"
                autoComplete="new-password"
              />
              {errors.confirmPassword && (
                <p className="text-red-500 text-xs mt-1">{errors.confirmPassword.message}</p>
              )}
            </div>

            {/* Requirements checklist */}
            <div className="bg-gray-50 rounded-xl p-3 space-y-1">
              {[
                { label: 'At least 8 characters',         ok: pwd.length >= 8 },
                { label: 'Contains uppercase letter',      ok: /[A-Z]/.test(pwd) },
                { label: 'Contains lowercase letter',      ok: /[a-z]/.test(pwd) },
                { label: 'Contains a number',             ok: /\d/.test(pwd) },
              ].map(({ label, ok }) => (
                <p key={label} className={`text-xs flex items-center gap-1.5 ${ok ? 'text-green-600' : 'text-gray-400'}`}>
                  <span>{ok ? '✓' : '○'}</span> {label}
                </p>
              ))}
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full py-4 rounded-2xl font-bold text-sm disabled:opacity-60 flex items-center justify-center gap-2 text-black mt-2"
              style={{ background: '#d4a017' }}
            >
              {isSubmitting && (
                <span className="w-5 h-5 border-2 border-black border-t-transparent rounded-full animate-spin" />
              )}
              Activate Account
            </button>
          </form>
        </div>

        <p className="text-center text-gray-600 text-xs mt-4">
          Having trouble? Contact your system administrator.
        </p>
      </div>
    </div>
  );
}
