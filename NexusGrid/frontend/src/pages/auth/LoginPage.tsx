import { useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useMutation } from '@tanstack/react-query';
import {
  Zap, Eye, EyeOff, Loader2, Activity, AlertTriangle,
  Package, Map, BarChart3, Users, ArrowRight, CheckCircle, Shield, X, Mail, Lock, KeyRound,
} from 'lucide-react';
import { useAuthStore } from '@/store/authStore';
import { authApi } from '@/lib/api';
import toast from 'react-hot-toast';

// ─── Schema ─────────────────────────────────────────────────────────────────────────────
const schema = z.object({
  username: z.string().min(1, 'Username or email is required'),
  password: z.string().min(1, 'Password is required'),
});
type FormData = z.infer<typeof schema>;

// ─── Forgot Password Modal ──────────────────────────────────────────────────────
function ForgotPasswordModal({ onClose }: { onClose: () => void }) {
  const [step, setStep] = useState<'email' | 'reset'>('email');
  const [email, setEmail] = useState('');
  const [emailError, setEmailError] = useState('');
  const [otp, setOtp] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const requestMutation = useMutation({
    mutationFn: () => authApi.forgotPasswordRequest({ email: email.trim().toLowerCase() }),
    onSuccess: () => {
      setStep('reset');
      setOtp('');
      setFieldErrors({});
      toast.success('OTP sent! Check your email.');
    },
    onError: (err: any) => {
      const data = err?.response?.data;
      const msg = data?.email ?? data?.detail ?? 'Failed to send OTP. Please try again.';
      setEmailError(msg);
    },
  });

  const verifyMutation = useMutation({
    mutationFn: () => authApi.forgotPasswordVerify({
      otp,
      new_password: newPassword,
      confirm_password: confirmPassword,
    }),
    onSuccess: (res) => {
      toast.success(res.data.detail ?? 'Password reset! You can now log in.');
      onClose();
    },
    onError: (err: any) => {
      const data = err?.response?.data;
      if (data && typeof data === 'object') {
        setFieldErrors(data as Record<string, string>);
      } else {
        setFieldErrors({ detail: 'Verification failed. Please try again.' });
      }
    },
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />

      {/* Panel */}
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md p-8 z-10">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 w-8 h-8 flex items-center justify-center rounded-lg
                     text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
        >
          <X className="w-4 h-4" />
        </button>

        {step === 'email' ? (
          <div className="space-y-6">
            <div>
              <h2 className="text-xl font-extrabold text-slate-900 mb-1">Reset your password</h2>
              <p className="text-sm text-slate-500">
                Enter your registered email address and we'll send a 6-digit OTP to reset your password.
              </p>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-widest mb-2">
                Email Address
              </label>
              <div className="relative">
                <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  type="email"
                  value={email}
                  onChange={e => { setEmail(e.target.value); setEmailError(''); }}
                  placeholder="john@university.edu"
                  className={`w-full pl-10 pr-4 py-3 bg-slate-100 border rounded-xl text-slate-900 text-sm
                             placeholder:text-slate-400 focus:outline-none focus:ring-2
                             focus:ring-brand-500 focus:border-transparent transition-all
                             ${emailError ? 'border-red-400' : 'border-slate-300 hover:border-slate-400'}`}
                  autoFocus
                  onKeyDown={e => e.key === 'Enter' && !requestMutation.isPending && requestMutation.mutate()}
                />
              </div>
              {emailError && <p className="mt-1.5 text-xs text-red-400">⚠ {emailError}</p>}
            </div>

            <button
              type="button"
              onClick={() => requestMutation.mutate()}
              disabled={!email.trim() || requestMutation.isPending}
              className="w-full flex items-center justify-center gap-2.5 py-3.5
                         bg-brand-600 hover:bg-brand-500 disabled:opacity-50 disabled:pointer-events-none
                         text-white font-semibold text-sm rounded-xl transition-all
                         shadow-lg shadow-brand-600/30 focus:outline-none focus:ring-2 focus:ring-brand-400"
            >
              {requestMutation.isPending ? (
                <><Loader2 className="w-4 h-4 animate-spin" /> Sending OTP…</>
              ) : (
                <><KeyRound className="w-4 h-4" /> Send OTP</>
              )}
            </button>
          </div>
        ) : (
          <div className="space-y-5">
            <div>
              <h2 className="text-xl font-extrabold text-slate-900 mb-1">Enter your new password</h2>
              <p className="text-sm text-slate-500">
                Check <span className="font-medium text-slate-700">{email}</span> for a 6-digit code.
              </p>
            </div>

            {/* OTP */}
            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-widest mb-2">
                Verification Code
              </label>
              <input
                type="text"
                inputMode="numeric"
                maxLength={6}
                value={otp}
                onChange={e => { setOtp(e.target.value.replace(/\D/g, '')); setFieldErrors({}); }}
                placeholder="6-digit OTP"
                className="w-full px-4 py-3 bg-slate-100 border border-slate-300 hover:border-slate-400 rounded-xl
                           text-slate-900 text-center tracking-[0.5em] text-lg font-mono
                           focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent transition-all"
                autoFocus
              />
              {fieldErrors.detail && <p className="mt-1.5 text-xs text-red-400">⚠ {fieldErrors.detail}</p>}
            </div>

            {/* New Password */}
            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-widest mb-2">
                New Password
              </label>
              <div className="relative">
                <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  type={showNew ? 'text' : 'password'}
                  value={newPassword}
                  onChange={e => { setNewPassword(e.target.value); setFieldErrors({}); }}
                  placeholder="Min 8 characters"
                  className={`w-full pl-10 pr-11 py-3 bg-slate-100 border rounded-xl text-slate-900 text-sm
                             placeholder:text-slate-400 focus:outline-none focus:ring-2
                             focus:ring-brand-500 focus:border-transparent transition-all
                             ${fieldErrors.new_password ? 'border-red-400' : 'border-slate-300 hover:border-slate-400'}`}
                />
                <button type="button" onClick={() => setShowNew(v => !v)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 transition-colors">
                  {showNew ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              {fieldErrors.new_password && <p className="mt-1.5 text-xs text-red-400">⚠ {fieldErrors.new_password}</p>}
            </div>

            {/* Confirm Password */}
            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-widest mb-2">
                Confirm Password
              </label>
              <div className="relative">
                <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  type={showConfirm ? 'text' : 'password'}
                  value={confirmPassword}
                  onChange={e => { setConfirmPassword(e.target.value); setFieldErrors({}); }}
                  placeholder="Re-enter new password"
                  className={`w-full pl-10 pr-11 py-3 bg-slate-100 border rounded-xl text-slate-900 text-sm
                             placeholder:text-slate-400 focus:outline-none focus:ring-2
                             focus:ring-brand-500 focus:border-transparent transition-all
                             ${fieldErrors.confirm_password ? 'border-red-400' : 'border-slate-300 hover:border-slate-400'}`}
                />
                <button type="button" onClick={() => setShowConfirm(v => !v)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 transition-colors">
                  {showConfirm ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              {fieldErrors.confirm_password && <p className="mt-1.5 text-xs text-red-400">⚠ {fieldErrors.confirm_password}</p>}
            </div>

            <button
              type="button"
              onClick={() => verifyMutation.mutate()}
              disabled={otp.length !== 6 || !newPassword || !confirmPassword || verifyMutation.isPending}
              className="w-full flex items-center justify-center gap-2.5 py-3.5
                         bg-brand-600 hover:bg-brand-500 disabled:opacity-50 disabled:pointer-events-none
                         text-white font-semibold text-sm rounded-xl transition-all
                         shadow-lg shadow-brand-600/30 focus:outline-none focus:ring-2 focus:ring-brand-400"
            >
              {verifyMutation.isPending ? (
                <><Loader2 className="w-4 h-4 animate-spin" /> Resetting…</>
              ) : (
                <><CheckCircle className="w-4 h-4" /> Reset Password</>
              )}
            </button>

            <div className="flex items-center justify-between text-xs text-slate-500">
              <button type="button" onClick={() => setStep('email')}
                className="hover:text-slate-700 transition-colors">
                ← Change email
              </button>
              <button
                type="button"
                disabled={requestMutation.isPending}
                onClick={() => requestMutation.mutate()}
                className="text-brand-500 hover:text-brand-400 font-medium transition-colors disabled:opacity-50"
              >
                {requestMutation.isPending ? 'Sending…' : 'Resend OTP'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Feature highlight data ───────────────────────────────────────────────────
const HIGHLIGHTS = [
  { icon: Activity,      label: 'Live system monitoring across all labs' },
  { icon: AlertTriangle, label: 'Instant fault reporting & tracking' },
  { icon: Package,       label: 'Resource request & approval workflow' },
  { icon: Map,           label: 'Interactive drag-and-drop lab floor plans' },
  { icon: BarChart3,     label: 'Analytics, reports & PDF export' },
  { icon: Users,         label: 'Role-based access for 5 user types' },
];

// ─── Left Panel ───────────────────────────────────────────────────────────────
function LeftPanel() {
  return (
    <div className="hidden lg:flex flex-col justify-between p-12 bg-gradient-to-br from-brand-950 via-brand-900 to-slate-900 relative overflow-hidden">
      {/* Grid overlay */}
      <div
        className="absolute inset-0 pointer-events-none opacity-40"
        style={{
          backgroundImage:
            'linear-gradient(rgba(59,130,246,0.12) 1px, transparent 1px), linear-gradient(90deg, rgba(59,130,246,0.12) 1px, transparent 1px)',
          backgroundSize: '40px 40px',
        }}
      />
      {/* Glow blobs */}
      <div className="absolute top-10 right-10 w-72 h-72 bg-brand-500/20 rounded-full blur-3xl" />
      <div className="absolute bottom-20 left-10 w-56 h-56 bg-violet-500/15 rounded-full blur-3xl" />

      {/* Logo */}
      <div className="relative flex items-center gap-3">
        <div className="w-10 h-10 bg-brand-600 rounded-xl flex items-center justify-center shadow-lg shadow-brand-600/50">
          <Zap className="w-5 h-5 text-white" strokeWidth={2.5} />
        </div>
        <div>
          <p className="text-white font-bold text-lg leading-tight">NexusGrid</p>
          <p className="text-brand-300 text-xs">Lab Management Platform</p>
        </div>
      </div>

      {/* Main copy */}
      <div className="relative">
        <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-brand-500/20 border border-brand-400/30
                        rounded-full text-brand-300 text-xs font-semibold mb-6">
          <span className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-pulse" />
          Trusted by institutions nationwide
        </div>
        <h2 className="text-3xl xl:text-4xl font-extrabold text-white leading-tight mb-4">
          One platform for<br />
          <span className="bg-gradient-to-r from-brand-300 via-cyan-300 to-violet-300 bg-clip-text text-transparent">
            every lab, every system
          </span>
        </h2>
        <p className="text-slate-400 text-sm leading-relaxed mb-10 max-w-sm">
          Monitor machines in real time, report faults instantly, manage resources and visualise
          your entire lab layout — all from a single, secure dashboard.
        </p>
        <ul className="space-y-3.5">
          {HIGHLIGHTS.map(({ icon: Icon, label }) => (
            <li key={label} className="flex items-center gap-3 text-sm text-slate-300">
              <div className="w-7 h-7 rounded-lg bg-brand-600/30 flex items-center justify-center shrink-0">
                <Icon className="w-3.5 h-3.5 text-brand-400" />
              </div>
              {label}
            </li>
          ))}
        </ul>
      </div>

      {/* Bottom testimonial */}
      <div className="relative bg-white/5 border border-white/10 rounded-2xl p-5 backdrop-blur-sm">
        <div className="flex gap-1 mb-2">
          {[...Array(5)].map((_, i) => (
            <span key={i} className="text-amber-400 text-xs">★</span>
          ))}
        </div>
        <p className="text-slate-300 text-xs leading-relaxed italic">
          "NexusGrid replaced three separate tools. Our technicians now identify and resolve
          lab issues in half the time."
        </p>
        <p className="text-brand-400 text-xs font-semibold mt-2">— IT Manager, Faculty of Computing</p>
      </div>
    </div>
  );
}

// ─── Login Page ────────────────────────────────────────────────────────────────
export default function LoginPage() {
  const { login, user } = useAuthStore();
  const navigate = useNavigate();
  const [showPassword, setShowPassword] = useState(false);
  const [forgotOpen, setForgotOpen] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({ resolver: zodResolver(schema) });

  if (user) return <Navigate to="/app/dashboard" replace />;

  const onSubmit = async (data: FormData) => {
    try {
      await login(data.username, data.password);
      toast.success('Welcome back!');
      navigate('/app/dashboard', { replace: true });
    } catch (err: any) {
      const msg = err?.response?.data?.detail ?? 'Login failed. Please check your credentials.';
      toast.error(msg);
    }
  };

  return (
    <div className="min-h-screen grid lg:grid-cols-2">
      <LeftPanel />

      {forgotOpen && <ForgotPasswordModal onClose={() => setForgotOpen(false)} />}

      {/* Right — Form */}
      <div className="flex flex-col items-center justify-center min-h-screen
                      bg-white px-6 py-12 relative">
        {/* Mobile logo */}
        <div className="lg:hidden flex items-center gap-2.5 mb-10 self-start">
          <div className="w-9 h-9 bg-brand-600 rounded-xl flex items-center justify-center shadow-lg shadow-brand-600/40">
            <Zap className="w-4 h-4 text-white" strokeWidth={2.5} />
          </div>
          <span className="text-slate-900 font-bold text-lg">NexusGrid</span>
        </div>

        <div className="w-full max-w-md">
          {/* Header */}
          <div className="mb-8">
            <h1 className="text-2xl font-extrabold text-slate-900 mb-1.5">Welcome back</h1>
            <p className="text-slate-500 text-sm">
              Sign in to your NexusGrid account to continue.
            </p>
          </div>

          {/* Form card */}
          <div className="bg-slate-50 border border-slate-200 rounded-2xl p-8 shadow-2xl">
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-5" noValidate>
              {/* Username / Email */}
              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-widest mb-2">
                  Username or Email
                </label>
                <input
                  {...register('username')}
                  type="text"
                  autoComplete="username"
                  placeholder="e.g. john_smith or john@uni.edu"
                  className={`w-full px-4 py-3 bg-slate-100 border rounded-xl text-slate-900 text-sm
                             placeholder:text-slate-400 focus:outline-none focus:ring-2
                             focus:ring-brand-500 focus:border-transparent transition-all
                             ${errors.username ? 'border-red-500/60' : 'border-slate-300 hover:border-slate-400'}`}
                />
                {errors.username && (
                  <p className="mt-1.5 text-xs text-red-400">⚠ {errors.username.message}</p>
                )}
              </div>

              {/* Password */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="block text-xs font-semibold text-slate-500 uppercase tracking-widest">
                    Password
                  </label>
                  <button
                    type="button"
                    className="text-xs text-brand-400 hover:text-brand-300 transition-colors"
                    onClick={() => setForgotOpen(true)}
                  >
                    Forgot password?
                  </button>
                </div>
                <div className="relative">
                  <input
                    {...register('password')}
                    type={showPassword ? 'text' : 'password'}
                    autoComplete="current-password"
                    placeholder="Enter your password"
                    className={`w-full px-4 py-3 bg-slate-100 border rounded-xl text-slate-900 text-sm
                               placeholder:text-slate-400 pr-11 focus:outline-none focus:ring-2
                               focus:ring-brand-500 focus:border-transparent transition-all
                               ${errors.password ? 'border-red-500/60' : 'border-slate-300 hover:border-slate-400'}`}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400
                               hover:text-slate-700 transition-colors"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                {errors.password && (
                  <p className="mt-1.5 text-xs text-red-400">⚠ {errors.password.message}</p>
                )}
              </div>

              {/* Submit */}
              <button
                type="submit"
                disabled={isSubmitting}
                className="group w-full flex items-center justify-center gap-2.5 py-3.5
                           bg-brand-600 hover:bg-brand-500 disabled:opacity-50 disabled:pointer-events-none
                           text-white font-semibold text-sm rounded-xl transition-all
                           shadow-lg shadow-brand-600/30 hover:shadow-brand-500/40
                           focus:outline-none focus:ring-2 focus:ring-brand-400"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Signing in…
                  </>
                ) : (
                  <>
                    Sign In
                    <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-0.5" />
                  </>
                )}
              </button>
            </form>

            {/* Divider */}
            <div className="flex items-center gap-3 my-6">
              <div className="flex-1 h-px bg-slate-200" />
              <span className="text-xs text-slate-400">or</span>
              <div className="flex-1 h-px bg-slate-200" />
            </div>

            {/* Sign up link */}
            <p className="text-center text-sm text-slate-600">
              Don't have an account?{' '}
              <Link
                to="/signup"
                className="text-brand-400 hover:text-brand-300 font-semibold transition-colors"
              >
                Create one free →
              </Link>
            </p>
          </div>

          {/* Trust strip */}
          <div className="mt-8 flex items-center justify-center gap-6 flex-wrap">
            {[
              { icon: Shield,       text: 'Secure login' },
              { icon: CheckCircle,  text: 'Role-based access' },
              { icon: CheckCircle,  text: 'Session protected' },
            ].map(({ icon: Icon, text }) => (
              <div key={text} className="flex items-center gap-1.5 text-slate-400 text-xs">
                <Icon className="w-3 h-3 text-emerald-500" />
                {text}
              </div>
            ))}
          </div>
        </div>

        <p className="absolute bottom-5 text-xs text-slate-400">
          © {new Date().getFullYear()} NexusGrid. All rights reserved.
        </p>
      </div>
    </div>
  );
}
