// src/pages/LoginPage.jsx – Premium Luxury Retail ERP Login
import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { motion, AnimatePresence } from 'framer-motion';
import toast from 'react-hot-toast';
import useAuthStore from '../store/authStore';
import { Eye, EyeOff, Mail, ShieldOff, Sparkles } from 'lucide-react';

// Map backend error codes to UI states
const CODE_UI = {
  ACCOUNT_LOCKED:   { icon: ShieldOff, color: 'text-red-400', bg: 'bg-red-500/10 border-red-500/20' },
  ACCOUNT_DISABLED: { icon: ShieldOff, color: 'text-gray-400', bg: 'bg-gray-500/10 border-gray-500/20' },
  NOT_VERIFIED:     { icon: Mail,      color: 'text-amber-400', bg: 'bg-amber-500/10 border-amber-500/20' },
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
      toast.success('Welcome back!', { icon: '✨' });
      navigate('/dashboard');
    } else {
      const code = result.code;
      if (code && CODE_UI[code]) {
        setErrorUI({ code, message: result.message });
      } else {
        toast.error(result.message, { duration: 5000 });
      }
    }
  };

  // Animation variants
  const containerVariants = {
    hidden: { opacity: 0 },
    visible: { opacity: 1, transition: { staggerChildren: 0.1, delayChildren: 0.2 } }
  };
  const itemVariants = {
    hidden: { y: 20, opacity: 0 },
    visible: { y: 0, opacity: 1, transition: { type: 'spring', damping: 20 } }
  };
  const logoVariants = {
    hidden: { scale: 0.8, opacity: 0, rotate: -5 },
    visible: { scale: 1, opacity: 1, rotate: 0, transition: { type: 'spring', stiffness: 300, damping: 15 } }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 overflow-hidden relative"
         style={{
           background: 'radial-gradient(ellipse at 30% 40%, rgba(212, 160, 23, 0.15) 0%, rgba(0,0,0,0.95) 70%)',
           backgroundColor: '#0a0a0a'
         }}>
      {/* Animated gold glow orb */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full blur-[120px] opacity-30 animate-pulse"
           style={{ background: 'radial-gradient(circle, #d4a017 0%, transparent 70%)' }} />
      
      {/* Subtle noise texture overlay */}
      <div className="absolute inset-0 opacity-5 pointer-events-none"
           style={{ backgroundImage: 'url("data:image/svg+xml,%3Csvg viewBox=\'0 0 200 200\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cfilter id=\'noise\'%3E%3CfeTurbulence type=\'fractalNoise\' baseFrequency=\'0.65\' numOctaves=\'3\' stitchTiles=\'stitch\'/%3E%3C/filter%3E%3Crect width=\'100%25\' height=\'100%25\' filter=\'url(%23noise)\'/%3E%3C/svg%3E")', backgroundRepeat: 'repeat', backgroundSize: '120px' }} />

      <motion.div
        variants={containerVariants}
        initial="hidden"
        animate="visible"
        className="w-full max-w-md relative z-10"
      >
        {/* Logo & Brand */}
        <motion.div variants={itemVariants} className="text-center mb-8">
          <motion.div
            variants={logoVariants}
            className="w-24 h-24 rounded-2xl flex items-center justify-center mx-auto mb-5 shadow-2xl cursor-pointer"
            style={{ background: 'linear-gradient(135deg, #d4a017 0%, #b8860b 100%)', boxShadow: '0 10px 25px -5px rgba(212,160,23,0.3)' }}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.98 }}
          >
            <span className="font-black text-3xl text-black">AF</span>
          </motion.div>
          <motion.h1 variants={itemVariants} className="text-white font-black text-3xl tracking-tight">
            Abdulmula <span className="text-gold">Fashion</span>
          </motion.h1>
          <motion.p variants={itemVariants} className="text-gold/80 text-sm mt-1 font-medium tracking-wide">
            ERP & POS System
          </motion.p>
          <motion.p variants={itemVariants} className="text-gray-500 text-xs mt-2">
            Konyo-Konyo Market · Juba, South Sudan
          </motion.p>
        </motion.div>

        {/* Glassmorphism Card */}
        <motion.div
          variants={itemVariants}
          className="backdrop-blur-xl bg-white/5 border border-white/10 rounded-3xl p-6 shadow-2xl"
          style={{ boxShadow: '0 25px 45px -12px rgba(0,0,0,0.5)' }}
        >
          <div className="text-center mb-6">
            <h2 className="text-2xl font-bold text-white">Welcome Back</h2>
            <p className="text-gray-400 text-sm mt-1">Sign in to manage your retail empire</p>
          </div>

          {/* Error Banner */}
          <AnimatePresence>
            {errorUI && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className={`flex items-start gap-3 p-3 rounded-xl border mb-5 ${CODE_UI[errorUI.code]?.bg || 'bg-red-500/10 border-red-500/20'}`}
              >
                {(() => {
                  const { icon: Icon, color } = CODE_UI[errorUI.code] || { icon: ShieldOff, color: 'text-red-400' };
                  return <Icon size={18} className={`${color} shrink-0 mt-0.5`} />;
                })()}
                <div>
                  <p className={`text-sm font-semibold ${CODE_UI[errorUI.code]?.color || 'text-red-400'}`}>
                    {errorUI.message}
                  </p>
                  {errorUI.code === 'NOT_VERIFIED' && (
                    <p className="text-xs text-amber-300/80 mt-1">
                      Check your inbox for the activation email from Abdulmula Fashion ERP.
                    </p>
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
            {/* Email Field */}
            <div>
              <label className="text-sm font-semibold text-gray-300 block mb-1.5">Email Address</label>
              <input
                type="email"
                {...register('email', { required: 'Email is required' })}
                className="w-full bg-white/10 border border-white/20 rounded-xl px-4 py-3 text-white text-sm placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-gold/60 focus:border-transparent transition-all"
                placeholder="manager@abdulmula.com"
                autoComplete="email"
              />
              {errors.email && <p className="text-red-400 text-xs mt-1">{errors.email.message}</p>}
            </div>

            {/* Password Field */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-sm font-semibold text-gray-300">Password</label>
                <Link
                  to="/forgot-password"
                  className="text-xs font-medium text-gold/80 hover:text-gold transition-colors"
                >
                  Forgot password?
                </Link>
              </div>
              <div className="relative">
                <input
                  type={showPwd ? 'text' : 'password'}
                  {...register('password', { required: 'Password is required' })}
                  className="w-full bg-white/10 border border-white/20 rounded-xl px-4 py-3 text-white text-sm placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-gold/60 focus:border-transparent transition-all pr-12"
                  placeholder="••••••••"
                  autoComplete="current-password"
                />
                <button
                  type="button"
                  onClick={() => setShowPwd(!showPwd)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gold transition-colors"
                >
                  {showPwd ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
              {errors.password && <p className="text-red-400 text-xs mt-1">{errors.password.message}</p>}
            </div>

            {/* Submit Button */}
            <motion.button
              type="submit"
              disabled={isLoading}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              className="w-full py-3.5 rounded-xl font-bold text-black text-sm tracking-wide flex items-center justify-center gap-2 transition-all disabled:opacity-70 disabled:cursor-not-allowed"
              style={{ background: 'linear-gradient(135deg, #d4a017 0%, #b8860b 100%)', boxShadow: '0 4px 14px 0 rgba(212,160,23,0.3)' }}
            >
              {isLoading ? (
                <>
                  <span className="w-5 h-5 border-2 border-black/30 border-t-black rounded-full animate-spin" />
                  <span>Authenticating...</span>
                </>
              ) : (
                <>
                  <Sparkles size={16} />
                  <span>Sign In</span>
                </>
              )}
            </motion.button>
          </form>

          {/* Divider */}
          <div className="relative my-6">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-white/10"></div>
            </div>
            <div className="relative flex justify-center text-xs">
              <span className="px-2 bg-transparent text-gray-500">Secure Access</span>
            </div>
          </div>

          {/* Footer Note */}
          <div className="text-center space-y-1">
            <p className="text-gray-400 text-xs">Don't have an account?</p>
            <p className="text-gray-500 text-xs">Contact your system administrator.</p>
            <p className="text-gold/60 text-xs font-semibold">Admin-created accounts only.</p>
          </div>
        </motion.div>

        {/* Decorative gold line */}
        <motion.div
          variants={itemVariants}
          className="mt-6 text-center text-xs text-gray-600"
        >
          <span>🔒 End-to-end encrypted</span>
        </motion.div>
      </motion.div>
    </div>
  );
}