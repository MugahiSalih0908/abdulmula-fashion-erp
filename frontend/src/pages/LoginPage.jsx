// src/pages/LoginPage.jsx – v6 with forgot password link + lockout messages

import { useState }    from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useForm }     from 'react-hook-form';
import toast           from 'react-hot-toast';
import useAuthStore    from '../store/authStore';
import { Eye, EyeOff, AlertCircle, Mail, ShieldOff } from 'lucide-react';
import { Input, Button } from '../components/ui';

// Map backend error codes to friendly UI states
const CODE_UI = {
  ACCOUNT_LOCKED:   { icon: ShieldOff, color: 'text-red-600',    bg: 'bg-red-50 border-red-200'    },
  ACCOUNT_DISABLED: { icon: ShieldOff, color: 'text-gray-600',   bg: 'bg-gray-50 border-gray-200'   },
  NOT_VERIFIED:     { icon: Mail,       color: 'text-amber-700',  bg: 'bg-amber-50 border-amber-200' },
};

export default function LoginPage() {
  const { register, handleSubmit, formState: { errors } } = useForm();
  const { login, isLoading } = useAuthStore();
  const navigate  = useNavigate();
  const [showPwd, setShowPwd]   = useState(false);
  const [errorUI, setErrorUI]   = useState(null); // { code, message }

  const onSubmit = async ({ email, password }) => {
    setErrorUI(null);
    const result = await login(email, password);
    if (result.success) {
      toast.success('Welcome back!');
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

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-gray-900 to-gray-800">
      <div className="w-full max-w-sm">

        {/* Brand */}
        <div className="text-center mb-8">
          <div className="w-20 h-20 rounded-2xl flex items-center justify-center font-black text-3xl mx-auto mb-4 shadow-2xl bg-green-600 text-white">
            AF
          </div>
          <h1 className="text-white font-black text-2xl tracking-tight">Abdulmula Fashion</h1>
          <p className="text-sm mt-1 text-green-400 font-medium">ERP & POS System</p>
          <p className="text-gray-400 text-xs mt-0.5">Konyo-Konyo Market · Juba, South Sudan</p>
        </div>

        {/* Card */}
        <div className="bg-white rounded-3xl p-6 shadow-2xl">
          <h2 className="font-bold text-xl mb-1 text-gray-900">Sign In</h2>
          <p className="text-gray-500 text-sm mb-5">Enter your staff credentials</p>

          {/* Contextual error banners */}
          {errorUI && (() => {
            const { icon: Icon, color, bg } = CODE_UI[errorUI.code];
            return (
              <div className={`flex items-start gap-2.5 p-3 rounded-xl border mb-4 ${bg}`}>
                <Icon size={18} className={`${color} shrink-0 mt-0.5`} />
                <div>
                  <p className={`text-sm font-semibold ${color}`}>{errorUI.message}</p>
                  {errorUI.code === 'NOT_VERIFIED' && (
                    <p className="text-xs text-amber-600 mt-0.5">
                      Check your inbox for the activation email from Abdulmula Fashion ERP.
                    </p>
                  )}
                  {errorUI.code === 'ACCOUNT_LOCKED' && (
                    <p className="text-xs text-red-500 mt-0.5">
                      Too many failed attempts. Try again after the lock expires.
                    </p>
                  )}
                </div>
              </div>
            );
          })()}

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>

            <Input
              type="email"
              label="Email Address"
              placeholder="you@abdulmula.com"
              error={errors.email?.message}
              {...register('email', { required: 'Email is required' })}
              autoComplete="email"
            />

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-sm font-semibold text-gray-700">Password</label>
                <Link to="/forgot-password"
                      className="text-xs font-semibold text-green-600 hover:text-green-700">
                  Forgot password?
                </Link>
              </div>
              <div className="relative">
                <input
                  type={showPwd ? 'text' : 'password'}
                  {...register('password', { required: 'Password is required' })}
                  className="input"
                  placeholder="••••••••"
                  autoComplete="current-password"
                />
                <button type="button" onClick={() => setShowPwd(!showPwd)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors">
                  {showPwd ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
              {errors.password && <p className="text-red-500 text-xs mt-1">{errors.password.message}</p>}
            </div>

            <Button
              type="submit"
              variant="primary"
              size="lg"
              loading={isLoading}
              className="w-full mt-1"
            >
              Sign In
            </Button>
          </form>
        </div>

        {/* Footer note */}
        <div className="text-center mt-5 space-y-1">
          <p className="text-gray-400 text-xs">Don't have an account?</p>
          <p className="text-gray-500 text-xs">Contact your system administrator.</p>
          <p className="text-gray-400 text-xs font-semibold">Admin-created accounts only.</p>
        </div>
      </div>
    </div>
  );
} 