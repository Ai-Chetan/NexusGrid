import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  Users, Search, Loader2, RefreshCw, ShieldCheck, Building2, UserCheck,
  Settings, PlusCircle, Trash2, Calendar, ChevronDown, ChevronUp, Edit3,
  CheckCircle2, XCircle, AlertTriangle,
} from 'lucide-react';
import { usersApi, privilegesApi, labsApi } from '@/lib/api';
import { cn, formatDate } from '@/lib/utils';
import type { User, Lab, LabAssignment, PrivilegesConfig } from '@/types';
import PageHeader from '@/components/common/PageHeader';
import ErrorState from '@/components/common/ErrorState';
import EmptyState from '@/components/common/EmptyState';
import Modal from '@/components/common/Modal';
import toast from 'react-hot-toast';

// ─── Constants ────────────────────────────────────────────────────────────────
const ROLES = ['Administrator', 'Lab Incharge', 'Lab Assistant', 'Students', 'No Roles'];

const roleColor: Record<string, string> = {
  Administrator: 'bg-red-100 text-red-700 border-red-200',
  'Lab Incharge': 'bg-violet-100 text-violet-700 border-violet-200',
  'Lab Assistant': 'bg-blue-100 text-blue-700 border-blue-200',
  Students: 'bg-emerald-100 text-emerald-700 border-emerald-200',
  'No Roles': 'bg-slate-100 text-slate-600 border-slate-200',
};

// ─── Stat Card ────────────────────────────────────────────────────────────────
function StatCard({ icon: Icon, label, value, color, sub }: {
  icon: React.ElementType; label: string; value: number | string; color: string; sub?: string;
}) {
  return (
    <div className="card p-4 flex items-center gap-3.5">
      <div className={`w-10 h-10 ${color} rounded-xl flex items-center justify-center shrink-0`}>
        <Icon className="w-5 h-5 text-white" />
      </div>
      <div className="min-w-0">
        <p className="text-xl font-bold text-slate-900 dark:text-slate-100 leading-tight">{value}</p>
        <p className="text-xs text-slate-500 truncate">{label}</p>
        {sub && <p className="text-xs text-slate-400">{sub}</p>}
      </div>
    </div>
  );
}

// ─── Assign Modal ─────────────────────────────────────────────────────────────
const assignSchema = z.object({
  user: z.coerce.number().min(1, 'Select a user'),
  start_date: z.string().optional(),
  end_date: z.string().optional(),
}).superRefine((data, ctx) => {
  if (data.start_date && data.end_date && data.end_date < data.start_date) {
    ctx.addIssue({ code: 'custom', path: ['end_date'], message: 'End date must be after start date.' });
  }
});
type AssignForm = z.infer<typeof assignSchema>;

interface AssignModalProps {
  open: boolean;
  onClose: () => void;
  lab: Lab;
  roleType: 'incharge' | 'assistant';
}

function AssignModal({ open, onClose, lab, roleType }: AssignModalProps) {
  const qc = useQueryClient();
  const roleLabel = roleType === 'incharge' ? 'Lab Incharge' : 'Lab Assistant';
  const userRole = roleType === 'incharge' ? 'Lab Incharge' : 'Lab Assistant';

  const { data: eligibleUsers = [], isLoading: usersLoading } = useQuery<User[]>({
    queryKey: ['users', 'role', userRole],
    queryFn: () => usersApi.list({ role: userRole }).then(r => r.data),
    enabled: open,
  });

  const { data: config } = useQuery<PrivilegesConfig>({
    queryKey: ['privileges-config'],
    queryFn: () => privilegesApi.getConfig().then(r => r.data),
    enabled: open,
  });

  const limit = roleType === 'incharge'
    ? config?.max_labs_per_incharge ?? 5
    : config?.max_labs_per_assistant ?? 3;

  const { register, handleSubmit, reset, formState: { errors, isSubmitting } } = useForm<AssignForm>({
    resolver: zodResolver(assignSchema),
  });

  const mutation = useMutation({
    mutationFn: (data: AssignForm) =>
      privilegesApi.createAssignment({
        lab: lab.id,
        user: data.user,
        role_type: roleType,
        start_date: data.start_date || null,
        end_date: data.end_date || null,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['labs'] });
      qc.invalidateQueries({ queryKey: ['assignments', lab.id] });
      qc.invalidateQueries({ queryKey: ['privileges-stats'] });
      toast.success(`${roleLabel} assigned to ${lab.lab_name}`);
      reset();
      onClose();
    },
    onError: (err: unknown) => {
      const msg = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
      toast.error(msg ?? 'Failed to assign');
    },
  });

  return (
    <Modal open={open} onClose={onClose} title={`Assign ${roleLabel} — ${lab.lab_name}`} size="md">
      <form onSubmit={handleSubmit(d => mutation.mutate(d))} className="space-y-4">
        <div className="flex items-center gap-2 p-3 bg-amber-50 dark:bg-amber-900/20 rounded-lg text-xs text-amber-700 dark:text-amber-400">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          Each user can handle up to <strong>{limit} labs</strong> concurrently as {roleLabel}.
        </div>

        <div>
          <label className="label">Select {roleLabel}</label>
          {usersLoading ? (
            <div className="flex items-center gap-2 text-sm text-slate-500 py-2">
              <Loader2 className="w-4 h-4 animate-spin" /> Loading users…
            </div>
          ) : eligibleUsers.length === 0 ? (
            <p className="text-sm text-slate-500 py-2">
              No users with the "{userRole}" role found. Assign that role first in the Users tab.
            </p>
          ) : (
            <select {...register('user')} className="input">
              <option value="">Select user…</option>
              {eligibleUsers.map(u => (
                <option key={u.id} value={u.id}>
                  {u.username} ({u.email})
                </option>
              ))}
            </select>
          )}
          {errors.user && <p className="text-xs text-red-500 mt-1">{errors.user.message}</p>}
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label">Start Date <span className="text-slate-400 font-normal">(optional)</span></label>
            <input type="date" {...register('start_date')} className="input" />
            <p className="text-xs text-slate-400 mt-0.5">Leave blank to start immediately</p>
          </div>
          <div>
            <label className="label">End Date <span className="text-slate-400 font-normal">(optional)</span></label>
            <input type="date" {...register('end_date')} className="input" />
            <p className="text-xs text-slate-400 mt-0.5">Leave blank for indefinite</p>
            {errors.end_date && <p className="text-xs text-red-500">{errors.end_date.message}</p>}
          </div>
        </div>

        <div className="flex gap-2 pt-1">
          <button type="button" onClick={onClose} className="btn-secondary flex-1">Cancel</button>
          <button
            type="submit"
            disabled={isSubmitting || mutation.isPending || eligibleUsers.length === 0}
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

// ─── Assignment History Modal ─────────────────────────────────────────────────
function HistoryModal({ open, onClose, lab }: { open: boolean; onClose: () => void; lab: Lab }) {
  const qc = useQueryClient();
  const { data: assignments = [], isLoading } = useQuery<LabAssignment[]>({
    queryKey: ['assignments', lab.id],
    queryFn: () => privilegesApi.getAssignments(lab.id).then(r => r.data),
    enabled: open,
  });

  const revokeMutation = useMutation({
    mutationFn: (id: number) => privilegesApi.deleteAssignment(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['assignments', lab.id] });
      qc.invalidateQueries({ queryKey: ['labs'] });
      qc.invalidateQueries({ queryKey: ['privileges-stats'] });
      toast.success('Assignment revoked');
    },
    onError: () => toast.error('Failed to revoke assignment'),
  });

  return (
    <Modal open={open} onClose={onClose} title={`Assignments — ${lab.lab_name}`} size="lg">
      {isLoading ? (
        <div className="flex items-center justify-center py-8 text-slate-500">
          <Loader2 className="w-5 h-5 animate-spin mr-2" /> Loading…
        </div>
      ) : assignments.length === 0 ? (
        <EmptyState
          icon={<UserCheck className="w-6 h-6" />}
          title="No assignments yet"
          description="Use the Assign buttons to add an incharge or assistant."
        />
      ) : (
        <div className="space-y-2 max-h-96 overflow-y-auto pr-1">
          {assignments.map(a => (
            <div
              key={a.id}
              className={cn(
                'flex items-center gap-3 p-3 rounded-lg border text-sm',
                a.is_active
                  ? 'bg-emerald-50 dark:bg-emerald-900/20 border-emerald-200 dark:border-emerald-700'
                  : 'bg-slate-50 dark:bg-slate-800/40 border-slate-200 dark:border-slate-700 opacity-60',
              )}
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-medium text-slate-800 dark:text-slate-200">{a.username}</span>
                  <span className={cn('badge text-xs', a.role_type === 'incharge'
                    ? 'bg-violet-100 text-violet-700 border-violet-200'
                    : 'bg-blue-100 text-blue-700 border-blue-200')}>
                    {a.role_type === 'incharge' ? 'Incharge' : 'Assistant'}
                  </span>
                  {a.is_active
                    ? <span className="badge text-xs bg-emerald-100 text-emerald-700 border-emerald-200">Active</span>
                    : <span className="badge text-xs bg-slate-100 text-slate-500 border-slate-200">Expired</span>
                  }
                </div>
                <p className="text-xs text-slate-500 mt-0.5">
                  {a.start_date ? `From ${a.start_date}` : 'Immediate'}
                  {a.end_date ? ` · Until ${a.end_date}` : ' · Indefinite'}
                  {a.assigned_by_username && ` · Assigned by ${a.assigned_by_username}`}
                </p>
              </div>
              <button
                onClick={() => revokeMutation.mutate(a.id)}
                disabled={revokeMutation.isPending}
                className="text-red-500 hover:text-red-700 transition-colors shrink-0 p-1.5 hover:bg-red-50 dark:hover:bg-red-900/20 rounded"
                title="Revoke assignment"
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

// ─── Config Panel ─────────────────────────────────────────────────────────────
function ConfigPanel({ config }: { config: PrivilegesConfig }) {
  const qc = useQueryClient();
  const [editing, setEditing] = useState(false);
  const [inchargeLimit, setInchargeLimit] = useState(config.max_labs_per_incharge);
  const [assistantLimit, setAssistantLimit] = useState(config.max_labs_per_assistant);

  const mutation = useMutation({
    mutationFn: () => privilegesApi.updateConfig({
      max_labs_per_incharge: inchargeLimit,
      max_labs_per_assistant: assistantLimit,
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
        <div className="flex items-center gap-2">
          <Settings className="w-4 h-4 text-slate-500" />
          <span className="text-sm font-semibold text-slate-700 dark:text-slate-300">Assignment Limits</span>
        </div>
        {!editing ? (
          <button
            onClick={() => setEditing(true)}
            className="flex items-center gap-1 text-xs text-brand-600 hover:text-brand-700 font-medium"
          >
            <Edit3 className="w-3.5 h-3.5" /> Edit
          </button>
        ) : (
          <div className="flex gap-3">
            <button
              onClick={() => mutation.mutate()}
              disabled={mutation.isPending}
              className="flex items-center gap-1 text-xs text-emerald-600 hover:text-emerald-700 font-medium"
            >
              {mutation.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
              Save
            </button>
            <button
              onClick={() => {
                setInchargeLimit(config.max_labs_per_incharge);
                setAssistantLimit(config.max_labs_per_assistant);
                setEditing(false);
              }}
              className="flex items-center gap-1 text-xs text-slate-500 hover:text-slate-700"
            >
              <XCircle className="w-3.5 h-3.5" /> Cancel
            </button>
          </div>
        )}
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="text-xs text-slate-500 block mb-1">Max labs per Lab Incharge</label>
          {editing ? (
            <input
              type="number" min={1} max={50} value={inchargeLimit}
              onChange={e => setInchargeLimit(Number(e.target.value))}
              className="input py-1.5 text-sm w-24"
            />
          ) : (
            <span className="text-2xl font-bold text-violet-600">{config.max_labs_per_incharge}</span>
          )}
        </div>
        <div>
          <label className="text-xs text-slate-500 block mb-1">Max labs per Lab Assistant</label>
          {editing ? (
            <input
              type="number" min={1} max={50} value={assistantLimit}
              onChange={e => setAssistantLimit(Number(e.target.value))}
              className="input py-1.5 text-sm w-24"
            />
          ) : (
            <span className="text-2xl font-bold text-blue-600">{config.max_labs_per_assistant}</span>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Lab Assignment Row ────────────────────────────────────────────────────────
function LabAssignmentRow({ lab, onAssign, onHistory }: {
  lab: Lab;
  onAssign: (lab: Lab, roleType: 'incharge' | 'assistant') => void;
  onHistory: (lab: Lab) => void;
}) {
  const qc = useQueryClient();

  const revokeMutation = useMutation({
    mutationFn: (assignmentId: number) => privilegesApi.deleteAssignment(assignmentId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['labs'] });
      qc.invalidateQueries({ queryKey: ['privileges-stats'] });
      toast.success('Assignment revoked');
    },
    onError: () => toast.error('Failed to revoke'),
  });

  const renderSlot = (type: 'incharge' | 'assistant', assignment: Lab['current_incharge']) => {
    const badgeClass = type === 'incharge'
      ? 'bg-violet-100 text-violet-700 border-violet-200 dark:bg-violet-900/30 dark:text-violet-300'
      : 'bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-900/30 dark:text-blue-300';
    const label = type === 'incharge' ? 'Incharge' : 'Assistant';

    if (assignment) {
      return (
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-full bg-slate-200 dark:bg-slate-700 flex items-center justify-center shrink-0">
            <span className="text-xs font-bold text-slate-600 dark:text-slate-300">
              {assignment.username.charAt(0).toUpperCase()}
            </span>
          </div>
          <div>
            <p className="text-xs font-medium text-slate-800 dark:text-slate-200 leading-tight">{assignment.username}</p>
            {assignment.end_date && (
              <p className="text-xs text-slate-400 flex items-center gap-0.5">
                <Calendar className="w-2.5 h-2.5" /> until {assignment.end_date}
              </p>
            )}
          </div>
          <button
            onClick={() => revokeMutation.mutate(assignment.assignment_id)}
            disabled={revokeMutation.isPending}
            className="text-xs text-red-500 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-900/20 px-1.5 py-0.5 rounded transition-colors ml-1"
          >
            Revoke
          </button>
        </div>
      );
    }

    return (
      <button
        onClick={() => onAssign(lab, type)}
        className={cn('flex items-center gap-1 text-xs px-2.5 py-1 rounded-full border font-medium transition-colors hover:opacity-80', badgeClass)}
      >
        <PlusCircle className="w-3 h-3" /> Assign {label}
      </button>
    );
  };

  return (
    <tr className="hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors">
      <td className="px-4 py-3">
        <p className="text-sm font-semibold text-slate-800 dark:text-slate-200">{lab.lab_name}</p>
        <p className="text-xs text-slate-500">
          {lab.parent_name ? `${lab.parent_name} · ` : ''}{lab.systems_count} system{lab.systems_count !== 1 ? 's' : ''}
          {lab.lab_code && ` · ${lab.lab_code}`}
        </p>
      </td>
      <td className="px-4 py-3">{renderSlot('incharge', lab.current_incharge)}</td>
      <td className="px-4 py-3">{renderSlot('assistant', lab.current_assistant)}</td>
      <td className="px-4 py-3">
        <button
          onClick={() => onHistory(lab)}
          className="text-xs text-slate-500 hover:text-brand-600 flex items-center gap-1 transition-colors"
        >
          <Calendar className="w-3.5 h-3.5" /> History
        </button>
      </td>
    </tr>
  );
}

// ─── Lab Assignments Tab ───────────────────────────────────────────────────────
function LabAssignmentsTab() {
  const [labSearch, setLabSearch] = useState('');
  const [assignTarget, setAssignTarget] = useState<{ lab: Lab; roleType: 'incharge' | 'assistant' } | null>(null);
  const [historyLab, setHistoryLab] = useState<Lab | null>(null);
  const [configOpen, setConfigOpen] = useState(true);

  const { data: labs = [], isLoading: labsLoading, isError: labsError, refetch: refetchLabs } =
    useQuery<Lab[]>({
      queryKey: ['labs'],
      queryFn: () => labsApi.list().then(r => r.data),
    });

  const { data: config } = useQuery<PrivilegesConfig>({
    queryKey: ['privileges-config'],
    queryFn: () => privilegesApi.getConfig().then(r => r.data),
  });

  const filtered = labs.filter(l =>
    l.lab_name.toLowerCase().includes(labSearch.toLowerCase()) ||
    (l.lab_code ?? '').toLowerCase().includes(labSearch.toLowerCase()) ||
    (l.parent_name ?? '').toLowerCase().includes(labSearch.toLowerCase()),
  );

  const fullyAssigned = labs.filter(l => l.current_incharge && l.current_assistant).length;
  const noIncharge = labs.filter(l => !l.current_incharge).length;
  const noAssistant = labs.filter(l => !l.current_assistant).length;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <StatCard icon={Building2} label="Total Labs" value={labs.length} color="bg-slate-500" />
        <StatCard icon={CheckCircle2} label="Fully Assigned" value={fullyAssigned} color="bg-emerald-500" />
        <StatCard icon={UserCheck} label="Without Incharge" value={noIncharge} color="bg-violet-500" />
        <StatCard icon={UserCheck} label="Without Assistant" value={noAssistant} color="bg-blue-500" />
      </div>

      {config && (
        <div>
          <button
            onClick={() => setConfigOpen(o => !o)}
            className="flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-700 mb-2 transition-colors"
          >
            <Settings className="w-3.5 h-3.5" />
            Assignment Limits
            {configOpen ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          </button>
          {configOpen && <ConfigPanel config={config} />}
        </div>
      )}

      <div className="card overflow-hidden">
        <div className="p-4 border-b border-slate-200 dark:border-slate-700 flex items-center gap-3">
          <div className="relative flex-1 max-w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input value={labSearch} onChange={e => setLabSearch(e.target.value)} placeholder="Search labs…" className="input pl-9 text-sm" />
          </div>
          <span className="text-xs text-slate-500 ml-auto">{filtered.length} lab{filtered.length !== 1 ? 's' : ''}</span>
          <button onClick={() => refetchLabs()} className="btn-secondary text-xs px-2.5 py-1.5"><RefreshCw className="w-3.5 h-3.5" /></button>
        </div>

        {labsError ? (
          <ErrorState message="Failed to load labs." onRetry={refetchLabs} />
        ) : labsLoading ? (
          <div className="p-8 text-center text-sm text-slate-500 flex items-center justify-center gap-2">
            <Loader2 className="w-4 h-4 animate-spin" /> Loading labs…
          </div>
        ) : filtered.length === 0 ? (
          <EmptyState icon={<Building2 className="w-6 h-6" />} title="No labs found" description="No labs match your search." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-slate-50 dark:bg-slate-800/50 border-b border-slate-200 dark:border-slate-700">
                <tr>
                  {['Lab', 'Lab Incharge', 'Lab Assistant', 'History'].map(h => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-700/50">
                {filtered.map(lab => (
                  <LabAssignmentRow
                    key={lab.id}
                    lab={lab}
                    onAssign={(l, r) => setAssignTarget({ lab: l, roleType: r })}
                    onHistory={l => setHistoryLab(l)}
                  />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {assignTarget && (
        <AssignModal
          open
          onClose={() => setAssignTarget(null)}
          lab={assignTarget.lab}
          roleType={assignTarget.roleType}
        />
      )}
      {historyLab && (
        <HistoryModal open onClose={() => setHistoryLab(null)} lab={historyLab} />
      )}
    </div>
  );
}

// ─── Role Update Cell ─────────────────────────────────────────────────────────
function RoleCell({ user }: { user: User }) {
  const qc = useQueryClient();
  const [editing, setEditing] = useState(false);
  const [role, setRole] = useState<string>(user.role);

  const mutation = useMutation({
    mutationFn: (newRole: string) => usersApi.update(user.id, { role: newRole }),
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ['users'] });
      qc.invalidateQueries({ queryKey: ['privileges-stats'] });
      setEditing(false);
      toast.success(`Role updated to ${res.data.role}`);
    },
    onError: () => toast.error('Failed to update role'),
  });

  if (editing) {
    return (
      <div className="flex items-center gap-2">
        <select
          value={role}
          onChange={e => setRole(e.target.value)}
          className="input text-xs py-1.5 px-2 w-40"
          autoFocus
        >
          {ROLES.map(r => <option key={r} value={r}>{r}</option>)}
        </select>
        <button
          onClick={() => mutation.mutate(role)}
          disabled={mutation.isPending}
          className="text-xs text-brand-600 font-medium hover:underline"
        >
          {mutation.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : 'Save'}
        </button>
        <button
          onClick={() => { setRole(user.role); setEditing(false); }}
          className="text-xs text-slate-400 hover:text-slate-600 transition-colors"
        >
          Cancel
        </button>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <span className={cn('badge', roleColor[user.role] ?? 'bg-slate-100 text-slate-600 border-slate-200')}>
        {user.role}
      </span>
      <button
        onClick={() => setEditing(true)}
        className="text-xs text-slate-400 hover:text-brand-600 transition-colors"
      >
        Edit
      </button>
    </div>
  );
}

// ─── Users Tab ────────────────────────────────────────────────────────────────
function UsersTab() {
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('all');

  const { data: users = [], isLoading, isError, refetch } = useQuery<User[]>({
    queryKey: ['users'],
    queryFn: () => usersApi.list().then(r => r.data),
  });

  const filtered = users.filter(u => {
    const matchSearch =
      u.username.toLowerCase().includes(search.toLowerCase()) ||
      u.email.toLowerCase().includes(search.toLowerCase());
    const matchRole = roleFilter === 'all' || u.role === roleFilter;
    return matchSearch && matchRole;
  });

  return (
    <div className="space-y-4">
      <div className="card p-4 flex flex-wrap gap-3 items-center">
        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search by username or email…"
            className="input pl-9"
          />
        </div>
        <select value={roleFilter} onChange={e => setRoleFilter(e.target.value)} className="input w-44">
          <option value="all">All Roles</option>
          {ROLES.map(r => <option key={r} value={r}>{r}</option>)}
        </select>
        <button onClick={() => refetch()} className="btn-secondary"><RefreshCw className="w-4 h-4" /></button>
        <span className="text-xs text-slate-500 ml-auto">
          {filtered.length} user{filtered.length !== 1 ? 's' : ''}
        </span>
      </div>

      <div className="card overflow-hidden">
        {isError ? (
          <ErrorState message="Failed to load users." onRetry={refetch} />
        ) : isLoading ? (
          <div className="p-8 text-center text-sm text-slate-500">Loading…</div>
        ) : filtered.length === 0 ? (
          <EmptyState
            icon={<Users className="w-7 h-7" />}
            title="No users found"
            description="Try adjusting your search or filters."
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-slate-50 dark:bg-slate-800/50 border-b border-slate-200 dark:border-slate-700">
                <tr>
                  {['User', 'Email', 'Role', 'Staff', 'Joined'].map(h => (
                    <th key={h} className="px-4 py-3 table-header">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-700/50">
                {filtered.map(user => (
                  <tr key={user.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-full bg-brand-100 dark:bg-brand-900/40 flex items-center justify-center shrink-0">
                          <span className="text-xs font-bold text-brand-700 dark:text-brand-300">
                            {user.username.charAt(0).toUpperCase()}
                          </span>
                        </div>
                        <div>
                          <p className="text-sm font-medium text-slate-800 dark:text-slate-200">{user.username}</p>
                          {user.is_superuser && <p className="text-xs text-red-500">Superuser</p>}
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-sm text-slate-600 dark:text-slate-400">{user.email}</span>
                    </td>
                    <td className="px-4 py-3"><RoleCell user={user} /></td>
                    <td className="px-4 py-3">
                      <span className={cn('badge text-xs',
                        user.is_staff
                          ? 'bg-emerald-100 text-emerald-700 border-emerald-200'
                          : 'bg-slate-100 text-slate-500 border-slate-200'
                      )}>
                        {user.is_staff ? 'Yes' : 'No'}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-xs text-slate-500">{formatDate(user.date_joined)}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Main Page ─────────────────────────────────────────────────────────────────
export default function UsersPage() {
  const [activeTab, setActiveTab] = useState<'assignments' | 'users'>('assignments');

  const { data: stats } = useQuery({
    queryKey: ['privileges-stats'],
    queryFn: () => usersApi.privilegesStats().then(r => r.data),
  });

  const tabs: { key: 'assignments' | 'users'; label: string; icon: React.ElementType }[] = [
    { key: 'assignments', label: 'Lab Assignments', icon: Building2 },
    { key: 'users', label: 'Users', icon: Users },
  ];

  return (
    <div className="space-y-5 animate-fade-in">
      <PageHeader
        title="User Privileges"
        description="Manage user roles and assign lab incharges and assistants."
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
            <Icon className="w-4 h-4" />{label}
          </button>
        ))}
      </div>

      {activeTab === 'assignments' ? <LabAssignmentsTab /> : <UsersTab />}
    </div>
  );
}
