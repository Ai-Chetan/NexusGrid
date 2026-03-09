import { useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useMutation } from '@tanstack/react-query';
import {
  Eye, EyeOff, Loader2, User as UserIcon, Mail, Lock,
  ArrowRight, ArrowLeft, CheckCircle, Shield, Cpu, Network, Activity, KeyRound,
} from 'lucide-react';
import { useAuthStore } from '@/store/authStore';
import { authApi } from '@/lib/api';
import toast from 'react-hot-toast';

// ─── Schema ───────────────────────────────────────────────────────────────────
const schema = z.object({
  username: z
    .string()
    .min(3, 'Username must be at least 3 characters')
    .max(30, 'Username must be 30 characters or less')
    .regex(/^[a-zA-Z0-9_]+$/, 'Only letters, numbers and underscores'),
  email: z.string().min(1, 'Email is required').email('Enter a valid email address'),
  password: z
    .string()
    .min(8, 'Password must be at least 8 characters')
    .regex(/[A-Z]/, 'Must contain at least one uppercase letter')
    .regex(/[0-9]/, 'Must contain at least one number'),
  confirm_password: z.string().min(1, 'Please confirm your password'),
}).refine((d) => d.password === d.confirm_password, {
  message: 'Passwords do not match',
  path: ['confirm_password'],
});

type FormData = z.infer<typeof schema>;

// ─── Password strength helper ─────────────────────────────────────────────────
function getPasswordStrength(pw: string): { label: string; pct: number; color: string } {
  let score = 0;
  if (pw.length >= 8) score++;
  if (/[A-Z]/.test(pw)) score++;
  if (/[0-9]/.test(pw)) score++;
  if (/[^A-Za-z0-9]/.test(pw)) score++;
  if (pw.length >= 12) score++;

  if (score <= 1) return { label: 'Weak', pct: 20,  color: 'bg-red-500' };
  if (score === 2) return { label: 'Fair', pct: 40,  color: 'bg-amber-500' };
  if (score === 3) return { label: 'Good', pct: 65,  color: 'bg-yellow-400' };
  if (score === 4) return { label: 'Strong', pct: 85, color: 'bg-emerald-400' };
  return { label: 'Excellent', pct: 100, color: 'bg-brand-500' };
}

// ─── Requirements list ────────────────────────────────────────────────────────
const REQUIREMENTS = [
  { test: (v: string) => v.length >= 8,       label: 'At least 8 characters' },
  { test: (v: string) => /[A-Z]/.test(v),     label: 'One uppercase letter' },
  { test: (v: string) => /[0-9]/.test(v),     label: 'One number' },
  { test: (v: string) => /[^A-Za-z0-9]/.test(v), label: 'One special character (optional bonus)' },
];

// ─── Left Panel ───────────────────────────────────────────────────────────────
function LeftPanel() {
  const PERKS = [
    { icon: Activity, title: 'Real-Time Dashboard',  desc: 'Monitor every machine live the moment you sign in.' },
    { icon: Shield,   title: 'Role-Based Security',  desc: 'Granular permissions keep your data safe and scoped.' },
    { icon: Cpu,      title: 'Agent-Powered Data',   desc: 'Lightweight agents push telemetry automatically—no manual input.' },
    { icon: Network,  title: 'Multi-Lab Management', desc: 'Manage dozens of labs across campuses from one account.' },
  ];

  return (
    <div className="hidden lg:flex h-screen flex-col justify-between gap-8 p-10 xl:p-12 bg-gradient-to-br from-slate-950 via-brand-950 to-slate-900 relative overflow-hidden">
      {/* Grid */}
      <div
        className="absolute inset-0 pointer-events-none opacity-30"
        style={{
          backgroundImage:
            'linear-gradient(rgba(59,130,246,0.12) 1px, transparent 1px), linear-gradient(90deg, rgba(59,130,246,0.12) 1px, transparent 1px)',
          backgroundSize: '40px 40px',
        }}
      />
      <div className="absolute top-0 right-0 w-80 h-80 bg-brand-500/15 rounded-full blur-3xl" />
      <div className="absolute bottom-0 left-0 w-64 h-64 bg-violet-500/10 rounded-full blur-3xl" />

      {/* Logo */}
      <div className="relative flex items-center gap-3">
        <img src="/favicon.svg" alt="NexusGrid logo" className="w-10 h-10 rounded-xl shadow-lg shadow-brand-600/50" />
        <div>
          <p className="text-white font-bold text-lg leading-tight">NexusGrid</p>
          <p className="text-brand-300 text-xs">System Monitoring and Management Platform</p>
        </div>
      </div>

      {/* Copy */}
      <div className="relative">
        <h2 className="text-2xl xl:text-3xl font-extrabold text-white leading-tight mb-3">
          Join NexusGrid and<br />
          <span className="bg-gradient-to-r from-emerald-300 via-cyan-300 to-brand-300 bg-clip-text text-transparent">
            transform your labs
          </span>
        </h2>
        <p className="text-slate-400 text-sm leading-relaxed mb-6 max-w-sm">
          Create your account and get instant access to the most comprehensive
          academic lab management platform.
        </p>

        <div className="grid grid-cols-2 gap-3">
          {PERKS.map(({ icon: Icon, title, desc }) => (
            <div key={title} className="bg-white/5 border border-white/8 rounded-2xl p-3">
              <div className="w-7 h-7 bg-brand-600/25 rounded-xl flex items-center justify-center mb-2">
                <Icon className="w-4 h-4 text-brand-400" />
              </div>
              <p className="text-white text-xs font-semibold mb-1">{title}</p>
              <p className="text-slate-500 text-xs leading-relaxed">{desc}</p>
            </div>
          ))}
        </div>

          {/* Role info */}
          <div className="flex items-start gap-3 px-4 py-3 bg-brand-600/10 border border-brand-500/20 rounded-xl mt-6">
            <Shield className="w-4 h-4 text-brand-400 shrink-0 mt-0.5" />
            <p className="text-xs text-slate-500 leading-relaxed">
              New accounts are assigned the <span className="text-brand-300 font-semibold">No Roles</span> role
              by default. An administrator will assign the appropriate role after registration.
            </p>
          </div>

          {/* Trust strip */}
          <div className="mt-5 flex items-center justify-center gap-4 flex-wrap">
            {[
              { icon: Shield,      text: 'No spam ever' },
              { icon: CheckCircle, text: 'Free to use' },
              { icon: CheckCircle, text: 'Secure & encrypted' },
            ].map(({ icon: Icon, text }) => (
              <div key={text} className="flex items-center gap-1.5 text-slate-400 text-xs">
                <Icon className="w-3 h-3 text-emerald-500" />
                {text}
              </div>
            ))}
          </div>

        <p className="mt-5 text-xs text-slate-400 text-center">
          © {new Date().getFullYear()} NexusGrid. All rights reserved.
        </p>
      </div>
    </div>
  );
}

// ─── Sign Up Page ─────────────────────────────────────────────────────────────
export default function SignUpPage() {
  const { updateUser, user } = useAuthStore();
  const navigate = useNavigate();
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [step, setStep] = useState<'form' | 'otp'>('form');
  const [otp, setOtp] = useState('');
  const [otpError, setOtpError] = useState('');

  const {
    register,
    handleSubmit,
    watch,
    getValues,
    formState: { errors },
  } = useForm<FormData>({ resolver: zodResolver(schema), mode: 'onChange' });

  // Watch password for strength meter
  const watchedPassword = watch('password', '');

  if (user) return <Navigate to="/app/dashboard" replace />;

  const requestOtpMutation = useMutation({
    mutationFn: (data: FormData) => authApi.signupRequestOtp(data),
    onSuccess: () => {
      setStep('otp');
      setOtp('');
      setOtpError('');
      toast.success('Verification code sent to your email!');
    },
    onError: (err: any) => {
      const respData = err?.response?.data;
      if (respData && typeof respData === 'object') {
        const msgs = Object.values(respData).flat().join(' ');
        toast.error(msgs || 'Failed to send OTP.');
      } else {
        toast.error('Failed to send OTP. Please try again.');
      }
    },
  });

  const verifyOtpMutation = useMutation({
    mutationFn: () => authApi.signupVerifyOtp({ otp }),
    onSuccess: (res) => {
      updateUser(res.data.user);
      toast.success('Account created! Welcome to NexusGrid 🎉');
      navigate('/app/dashboard', { replace: true });
    },
    onError: (err: any) => {
      const msg = err?.response?.data?.detail ?? 'Verification failed.';
      setOtpError(msg);
    },
  });

  const onSubmit = (data: FormData) => requestOtpMutation.mutate(data);

  const strength = getPasswordStrength(watchedPassword);

  return (
    <div className="min-h-screen lg:h-screen lg:overflow-hidden grid lg:grid-cols-2">
      <LeftPanel />

      {/* Right — Form */}
      <div className="flex flex-col items-center justify-center min-h-screen lg:min-h-0 lg:h-screen
                      bg-white px-4 sm:px-6 py-8 lg:py-6 relative overflow-y-auto">
        <button
          type="button"
          onClick={() => navigate('/')}
          className="self-start inline-flex items-center gap-2 px-3 py-2 mb-4 text-sm font-medium
                     text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Home
        </button>

        {/* Mobile logo */}
        <div className="lg:hidden flex items-center gap-2.5 mb-8 self-start">
          <img src="/favicon.svg" alt="NexusGrid logo" className="w-9 h-9 rounded-xl shadow-lg shadow-brand-600/40" />
          <span className="text-slate-900 font-bold text-lg">NexusGrid</span>
        </div>

        <div className="w-full max-w-md lg:max-w-lg">
          {/* Header */}
          <div className="mb-6">
            <h1 className="text-2xl font-extrabold text-slate-900 mb-1.5">Create your account</h1>
            <p className="text-slate-500 text-sm">
              Get started with NexusGrid — it's free.
            </p>
          </div>

          {/* Form card */}
          <div className="bg-slate-50 border border-slate-200 rounded-2xl p-6 shadow-2xl">

            {/* ── OTP Step ── */}
            {step === 'otp' ? (
              <div className="space-y-6">
                <div className="flex items-start gap-3 px-4 py-3 bg-brand-600/10 border border-brand-500/20 rounded-xl">
                  <KeyRound className="w-4 h-4 text-brand-400 shrink-0 mt-0.5" />
                  <p className="text-xs text-slate-600 leading-relaxed">
                    A 6-digit verification code was sent to{' '}
                    <span className="font-semibold text-slate-800">{getValues('email')}</span>.
                    Enter it below to complete your registration.
                  </p>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-500 uppercase tracking-widest mb-2">
                    Verification Code
                  </label>
                  <input
                    type="text"
                    inputMode="numeric"
                    maxLength={6}
                    value={otp}
                    onChange={e => { setOtp(e.target.value.replace(/\D/g, '')); setOtpError(''); }}
                    placeholder="Enter 6-digit code"
                    className="w-full px-4 py-3 bg-slate-100 border border-slate-300 hover:border-slate-400 rounded-xl
                               text-slate-900 text-center tracking-[0.5em] text-lg font-mono
                               focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent transition-all"
                    autoFocus
                  />
                  {otpError && <p className="mt-1.5 text-xs text-red-400">⚠ {otpError}</p>}
                </div>

                <button
                  type="button"
                  onClick={() => verifyOtpMutation.mutate()}
                  disabled={otp.length !== 6 || verifyOtpMutation.isPending}
                  className="group w-full flex items-center justify-center gap-2.5 py-3.5
                             bg-brand-600 hover:bg-brand-500 disabled:opacity-50 disabled:pointer-events-none
                             text-white font-semibold text-sm rounded-xl transition-all
                             shadow-lg shadow-brand-600/30 hover:shadow-brand-500/40
                             focus:outline-none focus:ring-2 focus:ring-brand-400"
                >
                  {verifyOtpMutation.isPending ? (
                    <><Loader2 className="w-4 h-4 animate-spin" /> Verifying…</>
                  ) : (
                    <><CheckCircle className="w-4 h-4" /> Create Account</>
                  )}
                </button>

                <div className="flex items-center justify-between text-xs text-slate-500">
                  <button
                    type="button"
                    onClick={() => setStep('form')}
                    className="hover:text-slate-700 transition-colors"
                  >
                    ← Edit details
                  </button>
                  <button
                    type="button"
                    disabled={requestOtpMutation.isPending}
                    onClick={() => requestOtpMutation.mutate(getValues())}
                    className="text-brand-500 hover:text-brand-400 font-medium transition-colors disabled:opacity-50"
                  >
                    {requestOtpMutation.isPending ? 'Sending…' : 'Resend code'}
                  </button>
                </div>
              </div>
            ) : (
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-5" noValidate>

              {/* Username */}
              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-widest mb-2">
                  Username
                </label>
                <div className="relative">
                  <UserIcon className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <input
                    {...register('username')}
                    type="text"
                    autoComplete="username"
                    placeholder="Enter your desired username"
                    className={`w-full pl-10 pr-4 py-3 bg-slate-100 border rounded-xl text-slate-900 text-sm
                               placeholder:text-slate-400 focus:outline-none focus:ring-2
                               focus:ring-brand-500 focus:border-transparent transition-all
                               ${errors.username ? 'border-red-500/60' : 'border-slate-300 hover:border-slate-400'}`}
                  />
                </div>
                {errors.username && (
                  <p className="mt-1.5 text-xs text-red-400">⚠ {errors.username.message}</p>
                )}
                {!errors.username && (
                  <p className="mt-1 text-xs text-slate-400">Letters, numbers and underscores only</p>
                )}
              </div>

              {/* Email */}
              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-widest mb-2">
                  Email Address
                </label>
                <div className="relative">
                  <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <input
                    {...register('email')}
                    type="email"
                    autoComplete="email"
                    placeholder="Enter your email address"
                    className={`w-full pl-10 pr-4 py-3 bg-slate-100 border rounded-xl text-slate-900 text-sm
                               placeholder:text-slate-400 focus:outline-none focus:ring-2
                               focus:ring-brand-500 focus:border-transparent transition-all
                               ${errors.email ? 'border-red-500/60' : 'border-slate-300 hover:border-slate-400'}`}
                  />
                </div>
                {errors.email && (
                  <p className="mt-1.5 text-xs text-red-400">⚠ {errors.email.message}</p>
                )}
              </div>

              {/* Password */}
              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-widest mb-2">
                  Password
                </label>
                <div className="relative">
                  <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <input
                    {...register('password')}
                    type={showPassword ? 'text' : 'password'}
                    autoComplete="new-password"
                    placeholder="Create a strong password"
                    className={`w-full pl-10 pr-11 py-3 bg-slate-100 border rounded-xl text-slate-900 text-sm
                               placeholder:text-slate-400 focus:outline-none focus:ring-2
                               focus:ring-brand-500 focus:border-transparent transition-all
                               ${errors.password ? 'border-red-500/60' : 'border-slate-300 hover:border-slate-400'}`}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 transition-colors"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>

                {/* Strength meter */}
                {watchedPassword.length > 0 && (
                  <div className="mt-2">
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex gap-1">
                        {[20, 40, 65, 85, 100].map((threshold) => (
                          <div
                            key={threshold}
                            className={`h-1 w-8 rounded-full transition-all ${
                              strength.pct >= threshold ? strength.color : 'bg-slate-200'
                            }`}
                          />
                        ))}
                      </div>
                      <span className={`text-xs font-medium ${
                        strength.pct <= 40 ? 'text-red-400' :
                        strength.pct <= 65 ? 'text-amber-400' :
                        strength.pct <= 85 ? 'text-yellow-300' : 'text-emerald-400'
                      }`}>
                        {strength.label}
                      </span>
                    </div>
                    <ul className="grid grid-cols-2 gap-x-4 gap-y-0.5 mt-2">
                      {REQUIREMENTS.map(({ test, label }) => (
                        <li key={label} className={`flex items-center gap-1.5 text-xs ${
                          test(watchedPassword) ? 'text-emerald-400' : 'text-slate-400'
                        }`}>
                          <CheckCircle className="w-3 h-3 shrink-0" />
                          {label}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {errors.password && (
                  <p className="mt-1.5 text-xs text-red-400">⚠ {errors.password.message}</p>
                )}
              </div>

              {/* Confirm Password */}
              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-widest mb-2">
                  Confirm Password
                </label>
                <div className="relative">
                  <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <input
                    {...register('confirm_password')}
                    type={showConfirm ? 'text' : 'password'}
                    autoComplete="new-password"
                    placeholder="Re-enter your password"
                    className={`w-full pl-10 pr-11 py-3 bg-slate-100 border rounded-xl text-slate-900 text-sm
                               placeholder:text-slate-400 focus:outline-none focus:ring-2
                               focus:ring-brand-500 focus:border-transparent transition-all
                               ${errors.confirm_password ? 'border-red-500/60' : 'border-slate-300 hover:border-slate-400'}`}
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirm((v) => !v)}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 transition-colors"
                  >
                    {showConfirm ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                {errors.confirm_password && (
                  <p className="mt-1.5 text-xs text-red-400">⚠ {errors.confirm_password.message}</p>
                )}
              </div>

              {/* Submit */}
              <button
                type="submit"
                disabled={requestOtpMutation.isPending}
                className="group w-full flex items-center justify-center gap-2.5 py-3.5
                           bg-brand-600 hover:bg-brand-500 disabled:opacity-50 disabled:pointer-events-none
                           text-white font-semibold text-sm rounded-xl transition-all
                           shadow-lg shadow-brand-600/30 hover:shadow-brand-500/40
                           focus:outline-none focus:ring-2 focus:ring-brand-400"
              >
                {requestOtpMutation.isPending ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Sending code…
                  </>
                ) : (
                  <>
                    Send Verification Code
                    <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-0.5" />
                  </>
                )}
              </button>
            </form>
            )}

            {/* Divider */}
            <div className="flex items-center gap-3 my-6">
              <div className="flex-1 h-px bg-slate-200" />
              <span className="text-xs text-slate-400">or</span>
              <div className="flex-1 h-px bg-slate-200" />
            </div>

            {/* Sign in link */}
            <p className="text-center text-sm text-slate-600">
              Already have an account?{' '}
              <Link
                to="/login"
                className="text-brand-400 hover:text-brand-300 font-semibold transition-colors"
              >
                Sign in →
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
