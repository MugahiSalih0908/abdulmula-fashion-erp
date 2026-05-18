// src/pages/ForgotPasswordPage.jsx

import { useState }        from 'react';
import { Link }            from 'react-router-dom';
import { useForm }         from 'react-hook-form';
import { motion }          from 'framer-motion';
import toast               from 'react-hot-toast';
import api                 from '../services/api';
import { Mail, ArrowLeft, CheckCircle } from 'lucide-react';

export default function ForgotPasswordPage() {
  const [sent, setSent] = useState(false);
  const [sentEmail, setSentEmail] = useState('');

  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm();

  const onSubmit = async ({ email }) => {
    try {
      await api.post('/auth/forgot-password', { email });
      setSentEmail(email);
      setSent(true);
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Request failed. Please try again.');
    }
  };

  if (sent) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4"
           style={{ background: 'linear-gradient(135deg, #111 0%, #1a1a1a 100%)' }}>
        <motion.div
          initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
          className="bg-white rounded-3xl p-8 max-w-sm w-full text-center shadow-2xl"
        >
          <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <CheckCircle size={32} className="text-green-600" />
          </div>
          <h2 className="font-black text-xl text-gray-900 mb-2">Check Your Email</h2>
          <p className="text-gray-500 text-sm mb-1">
            We sent a password reset link to:
          </p>
          <p className="font-semibold text-gray-800 text-sm mb-6">{sentEmail}</p>
          <p className="text-xs text-gray-400 mb-6">
            The link expires in <strong>15 minutes</strong>.
            Check your spam folder if you don't see it.
          </p>
          <Link to="/login"
                className="flex items-center justify-center gap-2 text-sm font-semibold"
                style={{ color: '#d4a017' }}>
            <ArrowLeft size={16} /> Back to Login
          </Link>
        </motion.div>
      </div>
    );
  }

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
          <p className="text-sm mt-1" style={{ color: '#d4a017' }}>Password Recovery</p>
        </div>

        {/* Card */}
        <div className="bg-white rounded-3xl p-6 shadow-2xl">
          <div className="flex items-center gap-2 mb-1">
            <Mail size={20} style={{ color: '#d4a017' }} />
            <h2 className="font-bold text-lg text-gray-900">Forgot Password?</h2>
          </div>
          <p className="text-gray-500 text-sm mb-6">
            Enter your email and we'll send a secure reset link.
          </p>

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
            <div>
              <label className="text-sm font-semibold text-gray-700 block mb-1.5">
                Email Address
              </label>
              <input
                type="email"
                {...register('email', {
                  required: 'Email is required',
                  pattern: { value: /^\S+@\S+\.\S+$/, message: 'Enter a valid email' }
                })}
                className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none bg-gray-50"
                onFocus={e => e.target.style.borderColor = '#d4a017'}
                onBlur={e  => e.target.style.borderColor = '#e5e7eb'}
                placeholder="your@email.com"
                autoComplete="email"
                autoFocus
              />
              {errors.email && (
                <p className="text-red-500 text-xs mt-1">{errors.email.message}</p>
              )}
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full py-4 rounded-2xl font-bold text-sm disabled:opacity-60 flex items-center justify-center gap-2 text-black"
              style={{ background: '#d4a017' }}
            >
              {isSubmitting && (
                <span className="w-5 h-5 border-2 border-black border-t-transparent rounded-full animate-spin" />
              )}
              Send Reset Link
            </button>
          </form>
        </div>

        <div className="text-center mt-4">
          <Link to="/login"
                className="flex items-center justify-center gap-1.5 text-sm font-semibold"
                style={{ color: '#d4a017' }}>
            <ArrowLeft size={15} /> Back to Login
          </Link>
        </div>
      </div>
    </div>
  );
}
