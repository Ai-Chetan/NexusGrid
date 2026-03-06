import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  Users, Search, Loader2, RefreshCw, ShieldCheck, Building2, UserCheck,
  Settings, PlusCircle, Trash2, Calendar, ChevronDown, ChevronUp, Edit3,
  CheckCircle2, XCircle, AlertTriangle, Layers,
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

// ─── Assignment Slot ──────────────────────────────────────────────────────────
function AssignmentSlot({
  type, assignment, lab, onAssign, onRevoke,
}: {
  type: 'incharge' | 'assistant';
  assignment: Lab['current_incharge'];
  lab: Lab;
  onAssign: (lab: Lab, roleType: 'incharge' | 'assistant') => void;
  onRevoke: (assignmentId: number) => void;
}) {
  const label = type === 'incharge' ? 'Incharge' : 'Assistant';
  const filledClass = type === 'incharge'
    ? 'bg-violet-50 border-violet-200 dark:bg-violet-900/20 dark:border-violet-700'
    : 'bg-blue-50 border-blue-200 dark:bg-blue-900/20 dark:border-blue-700';
  const avatarClass = type === 'incharge'
    ? 'bg-violet-200 dark:bg-violet-800 text-violet-700 dark:text-violet-300'
    : 'bg-blue-200 dark:bg-blue-800 text-blue-700 dark:text-blue-300';
  const textClass = type === 'incharge'
    ? 'text-violet-700 dark:text-violet-300'
    : 'text-blue-700 dark:text-blue-300';
  const assignBtnClass = type === 'incharge'
    ? 'text-violet-600 border-violet-300 dark:border-violet-600 dark:text-violet-400 hover:bg-violet-50 dark:hover:bg-violet-900/20'
    : 'text-blue-600 border-blue-300 dark:border-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20';

  return (
    <div className={cn(
      'flex items-center justify-between gap-2 px-3 py-2 rounded-lg border text-xs',
      assignment
        ? filledClass
        : 'bg-slate-50 border-slate-200 dark:bg-slate-800/40 dark:border-slate-700',
    )}>
      <div className="flex items-center gap-2 min-w-0">
        <span className={cn('font-semibold shrink-0 w-16', assignment ? textClass : 'text-slate-400')}>
          {label}
        </span>
        {assignment ? (
          <div className="flex items-center gap-1.5 min-w-0">
            <div className={cn('w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold shrink-0', avatarClass)}>
              {assignment.username.charAt(0).toUpperCase()}
            </div>
            <span className={cn('font-medium truncate', textClass)}>{assignment.username}</span>
            {assignment.end_date && (
              <span className="text-slate-400 shrink-0 flex items-center gap-0.5">
                <Calendar className="w-2.5 h-2.5" /> {assignment.end_date}
              </span>
            )}
          </div>
        ) : (
          <span className="text-slate-400 italic">Not assigned</span>
        )}
      </div>
      {assignment ? (
        <button
          onClick={() => onRevoke(assignment.assignment_id)}
          title="Revoke assignment"
          className="text-red-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 p-0.5 rounded transition-colors shrink-0"
        >
          <XCircle className="w-3.5 h-3.5" />
        </button>
      ) : (
        <button
          onClick={() => onAssign(lab, type)}
          className={cn('flex items-center gap-1 font-medium px-2 py-0.5 rounded border shrink-0 transition-colors', assignBtnClass)}
        >
          <PlusCircle className="w-3 h-3" /> Assign
        </button>
      )}
    </div>
  );
}

// ─── Lab Card ─────────────────────────────────────────────────────────────────
function LabCard({ lab, onAssign, onHistory }: {
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

  const hasIncharge = !!lab.current_incharge;
  const hasAssistant = !!lab.current_assistant;
  const statusDot = hasIncharge && hasAssistant
    ? 'bg-emerald-500'
    : !hasIncharge && !hasAssistant
    ? 'bg-red-400'
    : 'bg-amber-400';

  return (
    <div className="card p-4 space-y-3 hover:shadow-md transition-shadow">
      <div className="flex items-start gap-3">
        <div className="relative shrink-0">
          <div className="w-9 h-9 rounded-xl bg-violet-100 dark:bg-violet-900/30 flex items-center justify-center">
            <Building2 className="w-4 h-4 text-violet-600 dark:text-violet-400" />
          </div>
          <span className={cn('absolute -top-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2 border-white dark:border-slate-900', statusDot)} />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5 flex-wrap">
            <p className="text-sm font-semibold text-slate-800 dark:text-slate-200 truncate">{lab.lab_name}</p>
            {lab.lab_code && (
              <span className="text-xs px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400 font-mono leading-none">
                {lab.lab_code}
              </span>
            )}
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            {lab.systems_count} system{lab.systems_count !== 1 ? 's' : ''}
          </p>
        </div>
        <button
          onClick={() => onHistory(lab)}
          className="text-slate-400 hover:text-brand-600 transition-colors shrink-0 p-1 rounded hover:bg-slate-100 dark:hover:bg-slate-700"
          title="View assignment history"
        >
          <Calendar className="w-3.5 h-3.5" />
        </button>
      </div>
      <div className="space-y-1.5">
        <AssignmentSlot
          type="incharge"
          assignment={lab.current_incharge}
          lab={lab}
          onAssign={onAssign}
          onRevoke={(id) => revokeMutation.mutate(id)}
        />
        <AssignmentSlot
          type="assistant"
          assignment={lab.current_assistant}
          lab={lab}
          onAssign={onAssign}
          onRevoke={(id) => revokeMutation.mutate(id)}
        />
      </div>
    </div>
  );
}

// ─── Lab Assignments Tab ───────────────────────────────────────────────────────
type LabFilter = 'all' | 'fully_assigned' | 'incomplete' | 'needs_incharge' | 'needs_assistant';

function LabAssignmentsTab() {
  const [labSearch, setLabSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<LabFilter>('all');
  const [assignTarget, setAssignTarget] = useState<{ lab: Lab; roleType: 'incharge' | 'assistant' } | null>(null);
  const [historyLab, setHistoryLab] = useState<Lab | null>(null);
  const [configOpen, setConfigOpen] = useState(false);

  const { data: labs = [], isLoading: labsLoading, isError: labsError, refetch: refetchLabs } =
    useQuery<Lab[]>({
      queryKey: ['labs'],
      queryFn: () => labsApi.list().then(r => r.data),
    });

  const { data: config } = useQuery<PrivilegesConfig>({
    queryKey: ['privileges-config'],
    queryFn: () => privilegesApi.getConfig().then(r => r.data),
  });

  const fullyAssigned = labs.filter(l => l.current_incharge && l.current_assistant).length;
  const noIncharge = labs.filter(l => !l.current_incharge).length;
  const noAssistant = labs.filter(l => !l.current_assistant).length;
  const incomplete = labs.filter(l => !l.current_incharge || !l.current_assistant).length;

  const searchFiltered = labs.filter(l =>
    l.lab_name.toLowerCase().includes(labSearch.toLowerCase()) ||
    (l.lab_code ?? '').toLowerCase().includes(labSearch.toLowerCase()) ||
    (l.parent_name ?? '').toLowerCase().includes(labSearch.toLowerCase()),
  );

  const filtered = searchFiltered.filter(l => {
    if (statusFilter === 'fully_assigned') return l.current_incharge && l.current_assistant;
    if (statusFilter === 'needs_incharge') return !l.current_incharge;
    if (statusFilter === 'needs_assistant') return !l.current_assistant;
    if (statusFilter === 'incomplete') return !l.current_incharge || !l.current_assistant;
    return true;
  });

  const grouped = filtered.reduce<Record<string, { labs: Lab[]; building: string | null }>>((acc, lab) => {
    const key = lab.parent_name ?? 'Others';
    if (!acc[key]) acc[key] = { labs: [], building: lab.building_name ?? null };
    acc[key].labs.push(lab);
    return acc;
  }, {});

  const filterPills: { key: LabFilter; label: string; count: number; active: string }[] = [
    { key: 'all',            label: 'All',            count: labs.length,   active: 'bg-slate-700 text-white border-slate-700' },
    { key: 'fully_assigned', label: 'Fully Assigned', count: fullyAssigned, active: 'bg-emerald-600 text-white border-emerald-600' },
    { key: 'incomplete',     label: 'Incomplete',     count: incomplete,    active: 'bg-amber-500 text-white border-amber-500' },
    { key: 'needs_incharge', label: 'No Incharge',    count: noIncharge,    active: 'bg-violet-600 text-white border-violet-600' },
    { key: 'needs_assistant',label: 'No Assistant',   count: noAssistant,   active: 'bg-blue-600 text-white border-blue-600' },
  ];

  return (
    <div className="space-y-4">
      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <StatCard icon={Building2}   label="Total Labs"        value={labs.length}   color="bg-slate-500" />
        <StatCard icon={CheckCircle2} label="Fully Assigned"   value={fullyAssigned} color="bg-emerald-500" />
        <StatCard icon={UserCheck}   label="Without Incharge"  value={noIncharge}    color="bg-violet-500" />
        <StatCard icon={UserCheck}   label="Without Assistant" value={noAssistant}   color="bg-blue-500" />
      </div>

      {/* Assignment Limits (collapsed by default) */}
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

      {/* Search + Filter pills */}
      <div className="space-y-3">
        <div className="flex items-center gap-3 flex-wrap">
          <div className="relative flex-1 min-w-48 max-w-72">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              value={labSearch}
              onChange={e => setLabSearch(e.target.value)}
              placeholder="Search labs, codes, locations…"
              className="input pl-9 text-sm"
            />
          </div>
          <button onClick={() => refetchLabs()} className="btn-secondary text-xs px-2.5 py-1.5">
            <RefreshCw className="w-3.5 h-3.5" />
          </button>
          <span className="text-xs text-slate-500 ml-auto">
            {filtered.length} lab{filtered.length !== 1 ? 's' : ''}
          </span>
        </div>

        <div className="flex flex-wrap gap-2">
          {filterPills.map(fp => (
            <button
              key={fp.key}
              onClick={() => setStatusFilter(fp.key)}
              className={cn(
                'flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-full border transition-colors',
                statusFilter === fp.key
                  ? fp.active
                  : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-700 hover:border-slate-400 dark:hover:border-slate-500',
              )}
            >
              {fp.label}
              <span className={cn(
                'px-1.5 py-0.5 rounded-full text-xs leading-none min-w-[1.25rem] text-center',
                statusFilter === fp.key ? 'bg-white/25' : 'bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400',
              )}>
                {fp.count}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* Lab Cards grouped by parent */}
      {labsError ? (
        <ErrorState message="Failed to load labs." onRetry={refetchLabs} />
      ) : labsLoading ? (
        <div className="p-8 text-center text-sm text-slate-500 flex items-center justify-center gap-2">
          <Loader2 className="w-4 h-4 animate-spin" /> Loading labs…
        </div>
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={<Building2 className="w-6 h-6" />}
          title={labSearch || statusFilter !== 'all' ? 'No labs match your filters' : 'No labs found'}
          description={labSearch || statusFilter !== 'all' ? 'Clear the search or change the filter.' : 'No labs have been configured yet.'}
        />
      ) : (
        <div className="space-y-6">
          {Object.entries(grouped)
            .sort(([a], [b]) => a.localeCompare(b))
            .map(([parentName, { labs: groupLabs, building }]) => (
              <div key={parentName}>
                <div className="flex items-center gap-2 mb-3">
                  <Layers className="w-3.5 h-3.5 text-slate-400" />
                  <h3 className="text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wide">
                    {parentName}
                  </h3>
                  {building && (
                    <span className="flex items-center gap-1 text-xs text-slate-400 dark:text-slate-500 font-normal normal-case tracking-normal">
                      <Building2 className="w-3 h-3 shrink-0" />
                      {building}
                    </span>
                  )}
                  <span className="text-xs text-slate-400 bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded-full">
                    {groupLabs.length}
                  </span>
                  <div className="flex-1 h-px bg-slate-200 dark:bg-slate-700" />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
                  {groupLabs.map(lab => (
                    <LabCard
                      key={lab.id}
                      lab={lab}
                      onAssign={(l, r) => setAssignTarget({ lab: l, roleType: r })}
                      onHistory={l => setHistoryLab(l)}
                    />
                  ))}
                </div>
              </div>
            ))}
        </div>
      )}

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
const ASSIGNABLE_ROLES = ['Lab Incharge', 'Lab Assistant'];

function RoleCell({ user }: { user: User }) {
  const qc = useQueryClient();
  const [editing, setEditing] = useState(false);
  const [role, setRole] = useState<string>(user.role);
  const [confirming, setConfirming] = useState(false);

  const mutation = useMutation({
    mutationFn: (newRole: string) => usersApi.update(user.id, { role: newRole }),
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ['users'] });
      qc.invalidateQueries({ queryKey: ['privileges-stats'] });
      qc.invalidateQueries({ queryKey: ['assignments'] });
      setEditing(false);
      setConfirming(false);
      const revoked = res.data.revoked_assignments;
      if (revoked > 0) {
        toast.success(`Role updated. ${revoked} lab assignment${revoked > 1 ? 's' : ''} revoked.`);
      } else {
        toast.success(`Role updated to ${res.data.role}`);
      }
    },
    onError: () => { setConfirming(false); toast.error('Failed to update role'); },
  });

  const handleSaveClick = () => {
    if (role === user.role) { setEditing(false); return; }
    if (ASSIGNABLE_ROLES.includes(user.role)) {
      setConfirming(true);
    } else {
      mutation.mutate(role);
    }
  };

  if (editing) {
    if (confirming) {
      return (
        <div className="space-y-2">
          <p className="text-xs text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/30 border border-amber-200 dark:border-amber-700/50 rounded-lg px-3 py-2 max-w-xs">
            <strong>{user.username}</strong> is currently a <strong>{user.role}</strong>.
            Changing their role will <strong>revoke all lab assignments</strong> for this user.
            Are you sure?
          </p>
          <div className="flex items-center gap-2">
            <button
              onClick={() => mutation.mutate(role)}
              disabled={mutation.isPending}
              className="text-xs bg-red-600 hover:bg-red-700 text-white px-3 py-1.5 rounded-lg font-medium flex items-center gap-1.5 transition-colors"
            >
              {mutation.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : null}
              Yes, change role
            </button>
            <button
              onClick={() => setConfirming(false)}
              className="text-xs text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      );
    }

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
          onClick={handleSaveClick}
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
