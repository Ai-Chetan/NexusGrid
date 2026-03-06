import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  User as UserIcon, Mail, Lock, Edit2, CheckCircle2,
  Loader2, Shield, Calendar, Clock,
} from 'lucide-react';
import { profileApi } from '@/lib/api';
import { useAuthStore } from '@/store/authStore';
import { formatDateTime, cn } from '@/lib/utils';
import PageHeader from '@/components/common/PageHeader';
import toast from 'react-hot-toast';

// ─── Schemas ─────────────────────────────────────────────────────────────────

const usernameSchema = z.object({
  new_value: z.string().min(3, 'Username must be at least 3 characters'),
});
const emailSchema = z.object({
  new_value: z.string().email('Enter a valid email address'),
});
const passwordSchema = z.object({
  new_value: z.string().min(8, 'Password must be at least 8 characters'),
  confirm: z.string(),
}).refine(d => d.new_value === d.confirm, {
  message: 'Passwords do not match',
  path: ['confirm'],
});
const otpSchema = z.object({
  otp: z.string().length(6, 'OTP must be exactly 6 digits').regex(/^\d+$/, 'OTP must be numeric'),
});

type UsernameForm = z.infer<typeof usernameSchema>;
type EmailForm = z.infer<typeof emailSchema>;
type PasswordForm = z.infer<typeof passwordSchema>;
type OtpForm = z.infer<typeof otpSchema>;

type FieldAction = 'change_username' | 'change_email' | 'change_password';

// ─── Role Badge ───────────────────────────────────────────────────────────────

function RoleBadge({ role }: { role: string }) {
  const colors: Record<string, string> = {
    'Administrator': 'bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300',
    'Lab Incharge': 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300',
    'Lab Assistant': 'bg-teal-100 text-teal-700 dark:bg-teal-900/40 dark:text-teal-300',
    'Students': 'bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300',
    'No Roles': 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400',
  };
  return (
    <span className={cn('inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium', colors[role] ?? colors['No Roles'])}>
      <Shield className="w-3 h-3" />
      {role}
    </span>
  );
}

// ─── OTP Step ────────────────────────────────────────────────────────────────

interface OtpStepProps {
  onSuccess: (updatedUser: unknown) => void;
  onCancel: () => void;
}

function OtpStep({ onSuccess, onCancel }: OtpStepProps) {
  const { register, handleSubmit, formState: { errors } } = useForm<OtpForm>({
    resolver: zodResolver(otpSchema),
  });

  const verifyMutation = useMutation({
    mutationFn: (data: OtpForm) => profileApi.verifyOtp({ otp: data.otp }),
    onSuccess: (res) => {
      onSuccess(res.data.user);
    },
    onError: (err: unknown) => {
      const msg = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
      toast.error(msg ?? 'Verification failed.');
    },
  });

  return (
    <form onSubmit={handleSubmit(d => verifyMutation.mutate(d))} className="mt-4 space-y-3">
      <p className="text-sm text-slate-600 dark:text-slate-400">
        A 6-digit OTP has been sent to your registered email. Enter it below to confirm the change.
      </p>
      <div>
        <input
          {...register('otp')}
          type="text"
          inputMode="numeric"
          maxLength={6}
          placeholder="Enter 6-digit OTP"
          className="w-full sm:w-48 px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-600
                     bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100
                     text-center tracking-widest text-lg font-mono
                     focus:outline-none focus:ring-2 focus:ring-brand-500"
        />
        {errors.otp && <p className="mt-1 text-xs text-red-500">{errors.otp.message}</p>}
      </div>
      <div className="flex items-center gap-2">
        <button
          type="submit"
          disabled={verifyMutation.isPending}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-brand-600 text-white text-sm font-medium
                     hover:bg-brand-700 disabled:opacity-60 transition-colors"
        >
          {verifyMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
          Verify & Save
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="px-4 py-2 rounded-lg border border-slate-300 dark:border-slate-600 text-sm font-medium
                     text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700/50 transition-colors"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}

// ─── Change Username Section ──────────────────────────────────────────────────

function ChangeUsernameSection({ currentUsername, onUpdated }: { currentUsername: string; onUpdated: (u: unknown) => void }) {
  const [step, setStep] = useState<'idle' | 'form' | 'otp'>('idle');

  const { register, handleSubmit, getValues, formState: { errors } } = useForm<UsernameForm>({
    resolver: zodResolver(usernameSchema),
    defaultValues: { new_value: currentUsername },
  });

  const requestMutation = useMutation({
    mutationFn: (data: UsernameForm) =>
      profileApi.requestOtp({ action: 'change_username', new_value: data.new_value }),
    onSuccess: () => {
      toast.success('OTP sent to your email');
      setStep('otp');
    },
    onError: (err: unknown) => {
      const data = (err as { response?: { data?: Record<string, string> } })?.response?.data;
      const msg = data?.new_value ?? data?.detail ?? 'Failed to send OTP.';
      toast.error(msg);
    },
  });

  if (step === 'idle') {
    return (
      <button
        onClick={() => setStep('form')}
        className="inline-flex items-center gap-1.5 text-xs text-brand-600 dark:text-brand-400
                   hover:underline font-medium"
      >
        <Edit2 className="w-3.5 h-3.5" /> Change
      </button>
    );
  }

  if (step === 'form') {
    return (
      <form onSubmit={handleSubmit(d => requestMutation.mutate(d))} className="mt-3 space-y-2">
        <input
          {...register('new_value')}
          type="text"
          placeholder="New username"
          className="w-full sm:w-64 px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-600
                     bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 text-sm
                     focus:outline-none focus:ring-2 focus:ring-brand-500"
        />
        {errors.new_value && <p className="text-xs text-red-500">{errors.new_value.message}</p>}
        <div className="flex items-center gap-2">
          <button
            type="submit"
            disabled={requestMutation.isPending}
            className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-brand-600 text-white text-sm font-medium
                       hover:bg-brand-700 disabled:opacity-60 transition-colors"
          >
            {requestMutation.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : null}
            Send OTP
          </button>
          <button type="button" onClick={() => setStep('idle')}
            className="px-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-600 text-sm
                       text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors">
            Cancel
          </button>
        </div>
      </form>
    );
  }

  // OTP step
  return (
    <OtpStep
      onSuccess={(user) => { onUpdated(user); setStep('idle'); toast.success('Username updated!'); }}
      onCancel={() => setStep('idle')}
    />
  );
}

// ─── Change Email Section ─────────────────────────────────────────────────────

function ChangeEmailSection({ currentEmail, onUpdated }: { currentEmail: string; onUpdated: (u: unknown) => void }) {
  const [step, setStep] = useState<'idle' | 'form' | 'otp'>('idle');

  const { register, handleSubmit, formState: { errors } } = useForm<EmailForm>({
    resolver: zodResolver(emailSchema),
    defaultValues: { new_value: currentEmail },
  });

  const requestMutation = useMutation({
    mutationFn: (data: EmailForm) =>
      profileApi.requestOtp({ action: 'change_email', new_value: data.new_value }),
    onSuccess: () => {
      toast.success('OTP sent to your current email');
      setStep('otp');
    },
    onError: (err: unknown) => {
      const data = (err as { response?: { data?: Record<string, string> } })?.response?.data;
      const msg = data?.new_value ?? data?.detail ?? 'Failed to send OTP.';
      toast.error(msg);
    },
  });

  if (step === 'idle') {
    return (
      <button
        onClick={() => setStep('form')}
        className="inline-flex items-center gap-1.5 text-xs text-brand-600 dark:text-brand-400
                   hover:underline font-medium"
      >
        <Edit2 className="w-3.5 h-3.5" /> Change
      </button>
    );
  }

  if (step === 'form') {
    return (
      <form onSubmit={handleSubmit(d => requestMutation.mutate(d))} className="mt-3 space-y-2">
        <input
          {...register('new_value')}
          type="email"
          placeholder="New email address"
          className="w-full sm:w-72 px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-600
                     bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 text-sm
                     focus:outline-none focus:ring-2 focus:ring-brand-500"
        />
        {errors.new_value && <p className="text-xs text-red-500">{errors.new_value.message}</p>}
        <div className="flex items-center gap-2">
          <button
            type="submit"
            disabled={requestMutation.isPending}
            className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-brand-600 text-white text-sm font-medium
                       hover:bg-brand-700 disabled:opacity-60 transition-colors"
          >
            {requestMutation.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : null}
            Send OTP
          </button>
          <button type="button" onClick={() => setStep('idle')}
            className="px-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-600 text-sm
                       text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors">
            Cancel
          </button>
        </div>
      </form>
    );
  }

  return (
    <OtpStep
      onSuccess={(user) => { onUpdated(user); setStep('idle'); toast.success('Email updated!'); }}
      onCancel={() => setStep('idle')}
    />
  );
}

// ─── Change Password Section ──────────────────────────────────────────────────

function ChangePasswordSection({ onUpdated }: { onUpdated: (u: unknown) => void }) {
  const [step, setStep] = useState<'idle' | 'form' | 'otp'>('idle');

  const { register, handleSubmit, formState: { errors } } = useForm<PasswordForm>({
    resolver: zodResolver(passwordSchema),
  });

  const requestMutation = useMutation({
    mutationFn: (data: PasswordForm) =>
      profileApi.requestOtp({ action: 'change_password', new_value: data.new_value }),
    onSuccess: () => {
      toast.success('OTP sent to your email');
      setStep('otp');
    },
    onError: (err: unknown) => {
      const data = (err as { response?: { data?: Record<string, string> } })?.response?.data;
      const msg = data?.new_value ?? data?.detail ?? 'Failed to send OTP.';
      toast.error(msg);
    },
  });

  if (step === 'idle') {
    return (
      <button
        onClick={() => setStep('form')}
        className="inline-flex items-center gap-1.5 text-xs text-brand-600 dark:text-brand-400
                   hover:underline font-medium"
      >
        <Edit2 className="w-3.5 h-3.5" /> Change Password
      </button>
    );
  }

  if (step === 'form') {
    return (
      <form onSubmit={handleSubmit(d => requestMutation.mutate(d))} className="mt-3 space-y-2">
        <div>
          <input
            {...register('new_value')}
            type="password"
            placeholder="New password (min 8 chars)"
            className="w-full sm:w-72 px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-600
                       bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 text-sm
                       focus:outline-none focus:ring-2 focus:ring-brand-500"
          />
          {errors.new_value && <p className="mt-0.5 text-xs text-red-500">{errors.new_value.message}</p>}
        </div>
        <div>
          <input
            {...register('confirm')}
            type="password"
            placeholder="Confirm new password"
            className="w-full sm:w-72 px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-600
                       bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 text-sm
                       focus:outline-none focus:ring-2 focus:ring-brand-500"
          />
          {errors.confirm && <p className="mt-0.5 text-xs text-red-500">{errors.confirm.message}</p>}
        </div>
        <div className="flex items-center gap-2">
          <button
            type="submit"
            disabled={requestMutation.isPending}
            className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-brand-600 text-white text-sm font-medium
                       hover:bg-brand-700 disabled:opacity-60 transition-colors"
          >
            {requestMutation.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : null}
            Send OTP
          </button>
          <button type="button" onClick={() => setStep('idle')}
            className="px-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-600 text-sm
                       text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors">
            Cancel
          </button>
        </div>
      </form>
    );
  }

  return (
    <OtpStep
      onSuccess={(user) => { onUpdated(user); setStep('idle'); toast.success('Password updated!'); }}
      onCancel={() => setStep('idle')}
    />
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function ProfilePage() {
  const { user, updateUser } = useAuthStore();

  if (!user) return null;

  const handleUpdated = (updatedUser: unknown) => {
    updateUser(updatedUser as import('@/types').User);
  };

  return (
    <div className="max-w-2xl mx-auto">
      <PageHeader
        title="My Profile"
        description="View your account details and update your credentials."
      />

      {/* ── Avatar + Name Card ── */}
      <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700/60 p-6 mb-4">
        <div className="flex items-center gap-5">
          <div className="w-16 h-16 rounded-full bg-brand-100 dark:bg-brand-900/40 flex items-center justify-center shrink-0">
            <span className="text-2xl font-bold text-brand-700 dark:text-brand-300">
              {user.username.charAt(0).toUpperCase()}
            </span>
          </div>
          <div>
            <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100">{user.username}</h2>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">{user.email}</p>
            <div className="mt-2">
              <RoleBadge role={user.role} />
            </div>
          </div>
        </div>
      </div>

      {/* ── Account Info ── */}
      <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700/60 divide-y divide-slate-100 dark:divide-slate-700/60 mb-4">
        <div className="px-6 py-3">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">
            Account Info
          </h3>
        </div>

        {/* Member since */}
        <div className="flex items-start justify-between px-6 py-4 gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <Calendar className="w-4 h-4 text-slate-400 shrink-0" />
            <div>
              <p className="text-xs font-medium text-slate-500 dark:text-slate-400">Member since</p>
              <p className="text-sm text-slate-800 dark:text-slate-200 mt-0.5">
                {formatDateTime(user.date_joined)}
              </p>
            </div>
          </div>
        </div>

        {/* Last login */}
        <div className="flex items-start justify-between px-6 py-4 gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <Clock className="w-4 h-4 text-slate-400 shrink-0" />
            <div>
              <p className="text-xs font-medium text-slate-500 dark:text-slate-400">Last login</p>
              <p className="text-sm text-slate-800 dark:text-slate-200 mt-0.5">
                {user.last_login ? formatDateTime(user.last_login) : 'N/A'}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* ── Credentials ── */}
      <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700/60 divide-y divide-slate-100 dark:divide-slate-700/60">
        <div className="px-6 py-3">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">
            Credentials
          </h3>
        </div>

        {/* Username */}
        <div className="px-6 py-4">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-center gap-3 min-w-0">
              <UserIcon className="w-4 h-4 text-slate-400 shrink-0" />
              <div>
                <p className="text-xs font-medium text-slate-500 dark:text-slate-400">Username</p>
                <p className="text-sm font-medium text-slate-800 dark:text-slate-200 mt-0.5">{user.username}</p>
              </div>
            </div>
            <div className="shrink-0 mt-1">
              <ChangeUsernameSection currentUsername={user.username} onUpdated={handleUpdated} />
            </div>
          </div>
        </div>

        {/* Email */}
        <div className="px-6 py-4">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-center gap-3 min-w-0">
              <Mail className="w-4 h-4 text-slate-400 shrink-0" />
              <div>
                <p className="text-xs font-medium text-slate-500 dark:text-slate-400">Email</p>
                <p className="text-sm font-medium text-slate-800 dark:text-slate-200 mt-0.5 break-all">{user.email}</p>
              </div>
            </div>
            <div className="shrink-0 mt-1">
              <ChangeEmailSection currentEmail={user.email} onUpdated={handleUpdated} />
            </div>
          </div>
        </div>

        {/* Password */}
        <div className="px-6 py-4">
          <div className="flex items-center gap-3">
            <Lock className="w-4 h-4 text-slate-400 shrink-0" />
            <div>
              <p className="text-xs font-medium text-slate-500 dark:text-slate-400">Password</p>
              <p className="text-sm text-slate-800 dark:text-slate-200 mt-0.5">••••••••</p>
            </div>
          </div>
          <div className="mt-2 ml-7">
            <ChangePasswordSection onUpdated={handleUpdated} />
          </div>
        </div>
      </div>
    </div>
  );
}
