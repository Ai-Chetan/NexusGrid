import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  AlertTriangle,
  Building2,
  Calendar,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Edit3,
  Loader2,
  PlusCircle,
  RefreshCw,
  Search,
  Settings,
  ShieldCheck,
  Trash2,
  UserCheck,
  Users,
  XCircle,
} from 'lucide-react';
import { labsApi, privilegesApi, usersApi } from '@/lib/api';
import { cn, formatDate } from '@/lib/utils';
import type { Lab, LabAssignment, PrivilegesConfig, User } from '@/types';
import EmptyState from '@/components/common/EmptyState';
import ErrorState from '@/components/common/ErrorState';
import Modal from '@/components/common/Modal';
import PageHeader from '@/components/common/PageHeader';
import toast from 'react-hot-toast';

const ROLES = ['Administrator', 'Lab Incharge', 'Lab Assistant', 'Students', 'No Roles'] as const;
const ASSIGNABLE_ROLES = ['Lab Incharge', 'Lab Assistant'];

type RoleType = 'incharge' | 'assistant';
type LabFilter = 'all' | 'fully_assigned' | 'incomplete' | 'needs_incharge' | 'needs_assistant';

type AssignForm = {
  user: number;
  start_date?: string;
  end_date?: string;
};

type CreateUserForm = {
  username: string;
  email: string;
  role: User['role'];
  password: string;
  confirm_password: string;
};

const assignSchema = z
  .object({
    user: z.coerce.number().min(1, 'Select a user'),
    start_date: z.string().optional(),
    end_date: z.string().optional(),
  })
  .superRefine((data, ctx) => {
    if (data.start_date && data.end_date && data.end_date < data.start_date) {
      ctx.addIssue({ code: 'custom', path: ['end_date'], message: 'End date must be after start date.' });
    }
  });

const createUserSchema = z
  .object({
    username: z.string().min(3, 'Username must be at least 3 characters.'),
    email: z.string().email('Enter a valid email address.'),
    role: z.enum(ROLES),
    password: z.string().min(8, 'Password must be at least 8 characters.'),
    confirm_password: z.string().min(8, 'Confirm password is required.'),
  })
  .superRefine((data, ctx) => {
    if (data.password !== data.confirm_password) {
      ctx.addIssue({ code: 'custom', path: ['confirm_password'], message: 'Passwords do not match.' });
    }
  });

function CreateUserModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const qc = useQueryClient();
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<CreateUserForm>({
    resolver: zodResolver(createUserSchema),
    defaultValues: {
      username: '',
      email: '',
      role: 'Students',
      password: '',
      confirm_password: '',
    },
  });

  const createMutation = useMutation({
    mutationFn: (payload: CreateUserForm) => usersApi.create(payload),
    onSuccess: (res) => {
      invalidatePrivileges(qc);
      toast.success(`User ${res.data.username} created.`);
      reset();
      onClose();
    },
    onError: (err: unknown) => {
      const data = (err as { response?: { data?: Record<string, string[] | string> } })?.response?.data;
      const first = data ? Object.values(data)[0] : null;
      const message = Array.isArray(first) ? first[0] : first;
      toast.error(String(message ?? 'Failed to create user'));
    },
  });

  return (
    <Modal open={open} onClose={onClose} title="Create User" size="md">
      <form onSubmit={handleSubmit((d) => createMutation.mutate(d))} className="space-y-4">
        <div>
          <label className="label">Username</label>
          <input className="input" {...register('username')} />
          {errors.username && <p className="text-xs text-red-500 mt-1">{errors.username.message}</p>}
        </div>
        <div>
          <label className="label">Email</label>
          <input className="input" type="email" {...register('email')} />
          {errors.email && <p className="text-xs text-red-500 mt-1">{errors.email.message}</p>}
        </div>
        <div>
          <label className="label">Role</label>
          <select className="input" {...register('role')}>
            {ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
          </select>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label">Password</label>
            <input className="input" type="password" {...register('password')} />
            {errors.password && <p className="text-xs text-red-500 mt-1">{errors.password.message}</p>}
          </div>
          <div>
            <label className="label">Confirm Password</label>
            <input className="input" type="password" {...register('confirm_password')} />
            {errors.confirm_password && <p className="text-xs text-red-500 mt-1">{errors.confirm_password.message}</p>}
          </div>
        </div>
        <div className="flex gap-2 pt-1">
          <button type="button" onClick={onClose} className="btn-secondary flex-1">Cancel</button>
          <button type="submit" disabled={isSubmitting || createMutation.isPending} className="btn-primary flex-1">
            {createMutation.isPending ? 'Creating...' : 'Create User'}
          </button>
        </div>
      </form>
    </Modal>
  );
}

const roleTone: Record<string, string> = {
  Administrator: 'bg-red-100 text-red-700 border-red-200',
  'Lab Incharge': 'bg-violet-100 text-violet-700 border-violet-200',
  'Lab Assistant': 'bg-blue-100 text-blue-700 border-blue-200',
  Students: 'bg-emerald-100 text-emerald-700 border-emerald-200',
  'No Roles': 'bg-slate-100 text-slate-600 border-slate-200',
};

function invalidatePrivileges(qc: ReturnType<typeof useQueryClient>, labId?: number) {
  qc.invalidateQueries({ queryKey: ['labs'] });
  qc.invalidateQueries({ queryKey: ['privileges-stats'] });
  qc.invalidateQueries({ queryKey: ['users'] });
  qc.invalidateQueries({ queryKey: ['assignments'] });
  if (labId) qc.invalidateQueries({ queryKey: ['assignments', labId] });
}

function StatCard({
  icon: Icon,
  label,
  value,
  color,
}: {
  icon: React.ElementType;
  label: string;
  value: number | string;
  color: string;
}) {
  return (
    <div className="card p-4 flex items-center gap-3">
      <div className={cn('w-10 h-10 rounded-xl flex items-center justify-center shrink-0', color)}>
        <Icon className="w-5 h-5 text-white" />
      </div>
      <div>
        <p className="text-lg font-bold text-slate-900 dark:text-slate-100 leading-tight">{value}</p>
        <p className="text-xs text-slate-500">{label}</p>
      </div>
    </div>
  );
}

function AssignModal({
  open,
  onClose,
  lab,
  roleType,
}: {
  open: boolean;
  onClose: () => void;
  lab: Lab;
  roleType: RoleType;
}) {
  const qc = useQueryClient();
  const label = roleType === 'incharge' ? 'Lab Incharge' : 'Lab Assistant';

  const { data: users = [], isLoading: usersLoading } = useQuery<User[]>({
    queryKey: ['users', 'role', label],
    queryFn: () => usersApi.list({ role: label }).then((r) => r.data),
    enabled: open,
  });

  const { data: config } = useQuery<PrivilegesConfig>({
    queryKey: ['privileges-config'],
    queryFn: () => privilegesApi.getConfig().then((r) => r.data),
    enabled: open,
  });

  const limit = roleType === 'incharge'
    ? config?.max_labs_per_incharge ?? 5
    : config?.max_labs_per_assistant ?? 3;

  const { register, handleSubmit, reset, formState: { errors, isSubmitting } } = useForm<AssignForm>({
    resolver: zodResolver(assignSchema),
  });

  const mutation = useMutation({
    mutationFn: (data: AssignForm) => privilegesApi.createAssignment({
      lab: lab.id,
      user: data.user,
      role_type: roleType,
      start_date: data.start_date || null,
      end_date: data.end_date || null,
    }),
    onSuccess: () => {
      invalidatePrivileges(qc, lab.id);
      toast.success(`${label} assigned to ${lab.lab_name}`);
      reset();
      onClose();
    },
    onError: (err: unknown) => {
      const msg = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
      toast.error(msg ?? 'Failed to assign');
    },
  });

  return (
    <Modal open={open} onClose={onClose} title={`Assign ${label} - ${lab.lab_name}`} size="md">
      <form onSubmit={handleSubmit((d) => mutation.mutate(d))} className="space-y-4">
        <div className="flex items-center gap-2 rounded-lg p-3 text-xs bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-400">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          Each user can handle up to <strong>{limit}</strong> labs as {label}.
        </div>

        <div>
          <label className="label">Select {label}</label>
          {usersLoading ? (
            <div className="text-sm text-slate-500 py-2 flex items-center gap-2">
              <Loader2 className="w-4 h-4 animate-spin" /> Loading users...
            </div>
          ) : users.length === 0 ? (
            <p className="text-sm text-slate-500 py-2">No users with this role found.</p>
          ) : (
            <select {...register('user')} className="input">
              <option value="">Select user...</option>
              {users.map((u) => (
                <option key={u.id} value={u.id}>{u.username} ({u.email})</option>
              ))}
            </select>
          )}
          {errors.user && <p className="text-xs text-red-500 mt-1">{errors.user.message}</p>}
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label">Start Date</label>
            <input type="date" {...register('start_date')} className="input" />
          </div>
          <div>
            <label className="label">End Date</label>
            <input type="date" {...register('end_date')} className="input" />
            {errors.end_date && <p className="text-xs text-red-500 mt-1">{errors.end_date.message}</p>}
          </div>
        </div>

        <div className="flex gap-2 pt-1">
          <button type="button" onClick={onClose} className="btn-secondary flex-1">Cancel</button>
          <button
            type="submit"
            disabled={isSubmitting || mutation.isPending || users.length === 0}
            className="btn-primary flex-1 flex items-center justify-center gap-1.5"
          >
            {mutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <PlusCircle className="w-4 h-4" />}
            Assign
          </button>
        </div>
      </form>
    </Modal>
  );
}

function HistoryModal({ open, onClose, lab }: { open: boolean; onClose: () => void; lab: Lab }) {
  const qc = useQueryClient();
  const { data: assignments = [], isLoading } = useQuery<LabAssignment[]>({
    queryKey: ['assignments', lab.id],
    queryFn: () => privilegesApi.getAssignments(lab.id).then((r) => r.data),
    enabled: open,
  });

  const revokeMutation = useMutation({
    mutationFn: (id: number) => privilegesApi.deleteAssignment(id),
    onSuccess: () => {
      invalidatePrivileges(qc, lab.id);
      toast.success('Assignment revoked');
    },
    onError: () => toast.error('Failed to revoke assignment'),
  });

  return (
    <Modal open={open} onClose={onClose} title={`Assignments - ${lab.lab_name}`} size="lg">
      {isLoading ? (
        <div className="py-8 text-sm text-slate-500 flex items-center justify-center gap-2">
          <Loader2 className="w-4 h-4 animate-spin" /> Loading...
        </div>
      ) : assignments.length === 0 ? (
        <EmptyState
          icon={<UserCheck className="w-6 h-6" />}
          title="No assignments yet"
          description="Use assign action from lab cards."
        />
      ) : (
        <div className="space-y-2 max-h-96 overflow-y-auto pr-1">
          {assignments.map((a) => (
            <div
              key={a.id}
              className={cn(
                'p-3 rounded-lg border flex items-center gap-3 text-sm',
                a.is_active
                  ? 'bg-emerald-50 dark:bg-emerald-900/20 border-emerald-200 dark:border-emerald-700'
                  : 'bg-slate-50 dark:bg-slate-800/40 border-slate-200 dark:border-slate-700 opacity-70',
              )}
            >
              <div className="flex-1 min-w-0">
                <p className="font-medium text-slate-800 dark:text-slate-200">
                  {a.username} - {a.role_type === 'incharge' ? 'Incharge' : 'Assistant'}
                </p>
                <p className="text-xs text-slate-500 mt-0.5">
                  {a.start_date ? `From ${a.start_date}` : 'Immediate'}
                  {a.end_date ? ` · Until ${a.end_date}` : ' · Indefinite'}
                </p>
              </div>
              <button
                onClick={() => revokeMutation.mutate(a.id)}
                disabled={revokeMutation.isPending}
                className="text-red-500 hover:text-red-700 p-1.5 rounded hover:bg-red-50 dark:hover:bg-red-900/20"
                title="Revoke"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>
      )}
    </Modal>
  );
}

function LimitsCard({ config }: { config: PrivilegesConfig }) {
  const qc = useQueryClient();
  const [editing, setEditing] = useState(false);
  const [incharge, setIncharge] = useState(config.max_labs_per_incharge);
  const [assistant, setAssistant] = useState(config.max_labs_per_assistant);

  const mutation = useMutation({
    mutationFn: () => privilegesApi.updateConfig({
      max_labs_per_incharge: incharge,
      max_labs_per_assistant: assistant,
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['privileges-config'] });
      qc.invalidateQueries({ queryKey: ['privileges-stats'] });
      setEditing(false);
      toast.success('Limits updated');
    },
    onError: () => toast.error('Failed to update limits'),
  });

  return (
    <div className="card p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2 text-sm font-semibold text-slate-700 dark:text-slate-300">
          <Settings className="w-4 h-4 text-slate-500" /> Assignment Limits
        </div>
        {!editing ? (
          <button onClick={() => setEditing(true)} className="text-xs text-brand-600 hover:underline">Edit</button>
        ) : (
          <div className="flex items-center gap-3">
            <button onClick={() => mutation.mutate()} className="text-xs text-emerald-600 hover:underline">Save</button>
            <button
              onClick={() => {
                setIncharge(config.max_labs_per_incharge);
                setAssistant(config.max_labs_per_assistant);
                setEditing(false);
              }}
              className="text-xs text-slate-500 hover:underline"
            >
              Cancel
            </button>
          </div>
        )}
      </div>

      <div className="grid grid-cols-2 gap-4 text-sm">
        <div>
          <p className="text-xs text-slate-500 mb-1">Lab Incharge</p>
          {editing ? (
            <input type="number" min={1} max={50} className="input w-24" value={incharge} onChange={(e) => setIncharge(Number(e.target.value))} />
          ) : (
            <p className="text-xl font-bold text-violet-600">{config.max_labs_per_incharge}</p>
          )}
        </div>
        <div>
          <p className="text-xs text-slate-500 mb-1">Lab Assistant</p>
          {editing ? (
            <input type="number" min={1} max={50} className="input w-24" value={assistant} onChange={(e) => setAssistant(Number(e.target.value))} />
          ) : (
            <p className="text-xl font-bold text-blue-600">{config.max_labs_per_assistant}</p>
          )}
        </div>
      </div>
    </div>
  );
}

function AssignmentSlot({
  title,
  assignment,
  onAssign,
  onRevoke,
}: {
  title: string;
  assignment: Lab['current_incharge'];
  onAssign: () => void;
  onRevoke: (id: number) => void;
}) {
  return (
    <div className={cn(
      'rounded-lg border p-2.5 text-xs flex items-center justify-between gap-2',
      assignment
        ? 'bg-emerald-50/50 border-emerald-200 dark:bg-emerald-900/20 dark:border-emerald-700'
        : 'bg-slate-50 border-slate-200 dark:bg-slate-800/40 dark:border-slate-700',
    )}>
      <div className="min-w-0">
        <p className="font-semibold text-slate-500 uppercase tracking-wide">{title}</p>
        {assignment ? (
          <p className="text-slate-800 dark:text-slate-200 truncate">
            {assignment.username}{assignment.end_date ? ` · until ${assignment.end_date}` : ''}
          </p>
        ) : (
          <p className="text-slate-400">Not assigned</p>
        )}
      </div>

      {assignment ? (
        <button onClick={() => onRevoke(assignment.assignment_id)} className="text-red-500 hover:text-red-700 p-1 rounded" title="Revoke">
          <XCircle className="w-4 h-4" />
        </button>
      ) : (
        <button onClick={onAssign} className="btn-secondary text-xs px-2 py-1">
          <PlusCircle className="w-3 h-3" /> Assign
        </button>
      )}
    </div>
  );
}

function LabCard({
  lab,
  onAssign,
  onHistory,
}: {
  lab: Lab;
  onAssign: (lab: Lab, roleType: RoleType) => void;
  onHistory: (lab: Lab) => void;
}) {
  const qc = useQueryClient();
  const revokeMutation = useMutation({
    mutationFn: (assignmentId: number) => privilegesApi.deleteAssignment(assignmentId),
    onSuccess: () => {
      invalidatePrivileges(qc);
      toast.success('Assignment revoked');
    },
    onError: () => toast.error('Failed to revoke assignment'),
  });

  const complete = !!lab.current_incharge && !!lab.current_assistant;

  return (
    <div className="card p-4 space-y-3 hover:shadow-md transition-shadow">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-slate-800 dark:text-slate-200 truncate">{lab.lab_name}</p>
          <p className="text-xs text-slate-500">
            {lab.lab_code ? `${lab.lab_code} · ` : ''}
            {lab.systems_count} systems
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <span className={cn('w-2.5 h-2.5 rounded-full', complete ? 'bg-emerald-500' : 'bg-amber-400')} />
          <button onClick={() => onHistory(lab)} className="text-slate-400 hover:text-brand-600" title="History">
            <Calendar className="w-4 h-4" />
          </button>
        </div>
      </div>

      <div className="space-y-2">
        <AssignmentSlot
          title="Incharge"
          assignment={lab.current_incharge}
          onAssign={() => onAssign(lab, 'incharge')}
          onRevoke={(id) => revokeMutation.mutate(id)}
        />
        <AssignmentSlot
          title="Assistant"
          assignment={lab.current_assistant}
          onAssign={() => onAssign(lab, 'assistant')}
          onRevoke={(id) => revokeMutation.mutate(id)}
        />
      </div>
    </div>
  );
}

function LabAssignmentsTab() {
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<LabFilter>('all');
  const [assignTarget, setAssignTarget] = useState<{ lab: Lab; roleType: RoleType } | null>(null);
  const [historyLab, setHistoryLab] = useState<Lab | null>(null);
  const [showLimits, setShowLimits] = useState(false);

  const { data: labs = [], isLoading, isError, refetch } = useQuery<Lab[]>({
    queryKey: ['labs'],
    queryFn: () => labsApi.list().then((r) => r.data),
  });

  const { data: config } = useQuery<PrivilegesConfig>({
    queryKey: ['privileges-config'],
    queryFn: () => privilegesApi.getConfig().then((r) => r.data),
  });

  const counts = useMemo(() => {
    const fullyAssigned = labs.filter((l) => l.current_incharge && l.current_assistant).length;
    const needsIncharge = labs.filter((l) => !l.current_incharge).length;
    const needsAssistant = labs.filter((l) => !l.current_assistant).length;
    const incomplete = labs.filter((l) => !l.current_incharge || !l.current_assistant).length;
    return { fullyAssigned, needsIncharge, needsAssistant, incomplete };
  }, [labs]);

  const filtered = useMemo(() => {
    const query = search.toLowerCase();
    return labs
      .filter((l) =>
        l.lab_name.toLowerCase().includes(query) ||
        (l.lab_code ?? '').toLowerCase().includes(query) ||
        (l.parent_name ?? '').toLowerCase().includes(query),
      )
      .filter((l) => {
        if (filter === 'fully_assigned') return !!l.current_incharge && !!l.current_assistant;
        if (filter === 'needs_incharge') return !l.current_incharge;
        if (filter === 'needs_assistant') return !l.current_assistant;
        if (filter === 'incomplete') return !l.current_incharge || !l.current_assistant;
        return true;
      });
  }, [labs, search, filter]);

  const grouped = useMemo(() => {
    return filtered.reduce<Record<string, Lab[]>>((acc, lab) => {
      const key = lab.parent_name ?? 'Others';
      if (!acc[key]) acc[key] = [];
      acc[key].push(lab);
      return acc;
    }, {});
  }, [filtered]);

  const pills: Array<{ key: LabFilter; label: string; value: number }> = [
    { key: 'all', label: 'All', value: labs.length },
    { key: 'fully_assigned', label: 'Fully Assigned', value: counts.fullyAssigned },
    { key: 'incomplete', label: 'Incomplete', value: counts.incomplete },
    { key: 'needs_incharge', label: 'No Incharge', value: counts.needsIncharge },
    { key: 'needs_assistant', label: 'No Assistant', value: counts.needsAssistant },
  ];

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <StatCard icon={Building2} label="Total Labs" value={labs.length} color="bg-slate-500" />
        <StatCard icon={CheckCircle2} label="Fully Assigned" value={counts.fullyAssigned} color="bg-emerald-500" />
        <StatCard icon={UserCheck} label="No Incharge" value={counts.needsIncharge} color="bg-violet-500" />
        <StatCard icon={UserCheck} label="No Assistant" value={counts.needsAssistant} color="bg-blue-500" />
      </div>

      {config && (
        <div>
          <button onClick={() => setShowLimits((v) => !v)} className="text-xs text-slate-500 hover:text-slate-700 flex items-center gap-1 mb-2">
            <Settings className="w-3.5 h-3.5" /> Assignment Limits
            {showLimits ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          </button>
          {showLimits && <LimitsCard config={config} />}
        </div>
      )}

      <div className="card p-3 sm:p-4 space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative flex-1 min-w-52 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              className="input pl-9"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search labs, codes, locations..."
            />
          </div>
          <button onClick={() => refetch()} className="btn-secondary px-3"><RefreshCw className="w-4 h-4" /></button>
          <span className="text-xs text-slate-500 ml-auto">{filtered.length} labs</span>
        </div>

        <div className="flex flex-wrap gap-2">
          {pills.map((pill) => (
            <button
              key={pill.key}
              onClick={() => setFilter(pill.key)}
              className={cn(
                'px-3 py-1.5 rounded-full text-xs border transition-colors',
                filter === pill.key
                  ? 'bg-brand-600 text-white border-brand-600'
                  : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300',
              )}
            >
              {pill.label} ({pill.value})
            </button>
          ))}
        </div>
      </div>

      {isError ? (
        <ErrorState message="Failed to load labs." onRetry={refetch} />
      ) : isLoading ? (
        <div className="card p-8 text-sm text-slate-500 flex items-center justify-center gap-2">
          <Loader2 className="w-4 h-4 animate-spin" /> Loading labs...
        </div>
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={<Building2 className="w-6 h-6" />}
          title="No labs match your filters"
          description="Try changing search or filter."
        />
      ) : (
        <div className="space-y-5">
          {Object.entries(grouped).sort(([a], [b]) => a.localeCompare(b)).map(([name, labsInGroup]) => (
            <section key={name}>
              <div className="flex items-center gap-2 mb-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{name}</p>
                <span className="text-xs px-1.5 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-500">{labsInGroup.length}</span>
                <div className="h-px bg-slate-200 dark:bg-slate-700 flex-1" />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
                {labsInGroup.map((lab) => (
                  <LabCard
                    key={lab.id}
                    lab={lab}
                    onAssign={(l, roleType) => setAssignTarget({ lab: l, roleType })}
                    onHistory={(l) => setHistoryLab(l)}
                  />
                ))}
              </div>
            </section>
          ))}
        </div>
      )}

      {assignTarget && (
        <AssignModal open onClose={() => setAssignTarget(null)} lab={assignTarget.lab} roleType={assignTarget.roleType} />
      )}
      {historyLab && <HistoryModal open onClose={() => setHistoryLab(null)} lab={historyLab} />}
    </div>
  );
}

function RoleCell({ user }: { user: User }) {
  const qc = useQueryClient();
  const [editing, setEditing] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [role, setRole] = useState(user.role);

  const mutation = useMutation({
    mutationFn: (newRole: string) => usersApi.update(user.id, { role: newRole }),
    onSuccess: (res) => {
      invalidatePrivileges(qc);
      setEditing(false);
      setConfirming(false);
      const revoked = res.data.revoked_assignments;
      toast.success(revoked > 0
        ? `Role updated. ${revoked} assignment${revoked > 1 ? 's' : ''} revoked.`
        : `Role updated to ${res.data.role}`);
    },
    onError: () => {
      setConfirming(false);
      toast.error('Failed to update role');
    },
  });

  const save = () => {
    if (role === user.role) {
      setEditing(false);
      return;
    }
    if (ASSIGNABLE_ROLES.includes(user.role)) {
      setConfirming(true);
      return;
    }
    mutation.mutate(role);
  };

  if (editing && confirming) {
    return (
      <div className="space-y-2 max-w-xs">
        <p className="text-xs rounded-lg p-2 border bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-700 text-amber-700 dark:text-amber-400">
          Changing role from <strong>{user.role}</strong> will revoke all assignments for {user.username}.
        </p>
        <div className="flex items-center gap-2">
          <button onClick={() => mutation.mutate(role)} className="btn-danger text-xs px-2 py-1">Confirm</button>
          <button onClick={() => setConfirming(false)} className="text-xs text-slate-500 hover:underline">Cancel</button>
        </div>
      </div>
    );
  }

  if (editing) {
    return (
      <div className="flex items-center gap-2">
        <select value={role} onChange={(e) => setRole(e.target.value as User['role'])} className="input text-xs py-1.5 w-40">
          {ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
        </select>
        <button onClick={save} className="text-xs text-brand-600 hover:underline">Save</button>
        <button
          onClick={() => {
            setRole(user.role);
            setEditing(false);
          }}
          className="text-xs text-slate-500 hover:underline"
        >
          Cancel
        </button>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <span className={cn('badge', roleTone[user.role] ?? 'bg-slate-100 text-slate-600 border-slate-200')}>
        {user.role}
      </span>
      <button onClick={() => setEditing(true)} className="text-xs text-slate-500 hover:text-brand-600">Edit</button>
    </div>
  );
}

function UsersTab() {
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('all');
  const [showCreate, setShowCreate] = useState(false);

  const { data: users = [], isLoading, isError, refetch } = useQuery<User[]>({
    queryKey: ['users'],
    queryFn: () => usersApi.list().then((r) => r.data),
  });

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return users.filter((u) => {
      const matchesSearch = u.username.toLowerCase().includes(q) || u.email.toLowerCase().includes(q);
      const matchesRole = roleFilter === 'all' || u.role === roleFilter;
      return matchesSearch && matchesRole;
    });
  }, [users, search, roleFilter]);

  return (
    <div className="space-y-4">
      <div className="card p-4 flex flex-wrap gap-3 items-center">
        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            className="input pl-9"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search username or email..."
          />
        </div>

        <select value={roleFilter} onChange={(e) => setRoleFilter(e.target.value)} className="input w-44">
          <option value="all">All Roles</option>
          {ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
        </select>

        <button onClick={() => setShowCreate(true)} className="btn-primary px-3">
          <PlusCircle className="w-4 h-4" /> Create User
        </button>

        <button onClick={() => refetch()} className="btn-secondary px-3"><RefreshCw className="w-4 h-4" /></button>
        <span className="text-xs text-slate-500 ml-auto">{filtered.length} users</span>
      </div>

      <div className="card overflow-hidden">
        {isError ? (
          <ErrorState message="Failed to load users." onRetry={refetch} />
        ) : isLoading ? (
          <div className="p-8 text-center text-sm text-slate-500">Loading...</div>
        ) : filtered.length === 0 ? (
          <EmptyState icon={<Users className="w-7 h-7" />} title="No users found" description="Try different filters." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-slate-50 dark:bg-slate-800/50 border-b border-slate-200 dark:border-slate-700">
                <tr>
                  {['User', 'Email', 'Role', 'Staff', 'Joined'].map((h) => (
                    <th key={h} className="px-4 py-3 table-header">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-700/50">
                {filtered.map((u) => (
                  <tr key={u.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-full bg-brand-100 dark:bg-brand-900/40 flex items-center justify-center shrink-0">
                          <span className="text-xs font-bold text-brand-700 dark:text-brand-300">{u.username.charAt(0).toUpperCase()}</span>
                        </div>
                        <div>
                          <p className="text-sm font-medium text-slate-800 dark:text-slate-200">{u.username}</p>
                          {u.is_superuser && <p className="text-xs text-red-500">Superuser</p>}
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-600 dark:text-slate-400">{u.email}</td>
                    <td className="px-4 py-3"><RoleCell user={u} /></td>
                    <td className="px-4 py-3">
                      <span className={cn('badge text-xs', u.is_staff
                        ? 'bg-emerald-100 text-emerald-700 border-emerald-200'
                        : 'bg-slate-100 text-slate-500 border-slate-200')}
                      >
                        {u.is_staff ? 'Yes' : 'No'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-500">{formatDate(u.date_joined)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {showCreate && <CreateUserModal open onClose={() => setShowCreate(false)} />}
    </div>
  );
}

export default function UsersPage() {
  const [activeTab, setActiveTab] = useState<'assignments' | 'users'>('assignments');

  const { data: stats } = useQuery({
    queryKey: ['privileges-stats'],
    queryFn: () => usersApi.privilegesStats().then((r) => r.data),
  });

  const tabs: Array<{ key: 'assignments' | 'users'; label: string; icon: React.ElementType }> = [
    { key: 'assignments', label: 'Lab Assignments', icon: Building2 },
    { key: 'users', label: 'Users', icon: Users },
  ];

  return (
    <div className="space-y-5 animate-fade-in">
      <PageHeader
        title="User Privileges"
        description="Manage roles, lab assignments, and assignment limits."
      />

      {stats && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          <StatCard icon={Users} label="Total Users" value={stats.total_users} color="bg-brand-600" />
          <StatCard icon={ShieldCheck} label="Unassigned Users" value={stats.unassigned_users} color="bg-amber-500" />
          <StatCard icon={Building2} label="Total Labs" value={stats.total_labs} color="bg-violet-500" />
          <StatCard icon={UserCheck} label="Labs w/o Incharge" value={stats.labs_without_instructor} color="bg-red-500" />
          <StatCard icon={UserCheck} label="Labs w/o Assistant" value={stats.labs_without_assistant} color="bg-orange-500" />
        </div>
      )}

      <div className="flex gap-1 border-b border-slate-200 dark:border-slate-700">
        {tabs.map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            onClick={() => setActiveTab(key)}
            className={cn(
              'flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors',
              activeTab === key
                ? 'border-brand-600 text-brand-600'
                : 'border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300',
            )}
          >
            <Icon className="w-4 h-4" /> {label}
          </button>
        ))}
      </div>

      {activeTab === 'assignments' ? <LabAssignmentsTab /> : <UsersTab />}
    </div>
  );
}
