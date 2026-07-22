/**
 * Inline lab assignment section (admin only), shown inside System Layout
 * when viewing a room/lab. No separate page — assignments are managed
 * directly where the lab is.
 */
import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  AlertTriangle,
  History,
  Loader2,
  Plus,
  PlusCircle,
  Trash2,
  UserCheck,
  UserCog,
  Wrench,
  X,
} from 'lucide-react';
import { labsApi, privilegesApi, usersApi } from '@/lib/api';
import { cn } from '@/lib/utils';
import type { Lab, LabAssignment, PrivilegesConfig, User } from '@/types';
import EmptyState from '@/components/common/EmptyState';
import Modal from '@/components/common/Modal';
import toast from 'react-hot-toast';

type RoleType = 'incharge' | 'assistant';

type AssignForm = {
  user: number;
  start_date?: string;
  end_date?: string;
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

function invalidatePrivileges(qc: ReturnType<typeof useQueryClient>, labId?: number) {
  qc.invalidateQueries({ queryKey: ['labs'] });
  qc.invalidateQueries({ queryKey: ['privileges-stats'] });
  qc.invalidateQueries({ queryKey: ['users'] });
  qc.invalidateQueries({ queryKey: ['assignments'] });
  if (labId) qc.invalidateQueries({ queryKey: ['assignments', labId] });
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
    <Modal open={open} onClose={onClose} title={`Assignment History - ${lab.lab_name}`} size="lg">
      {isLoading ? (
        <div className="py-8 text-sm text-slate-500 flex items-center justify-center gap-2">
          <Loader2 className="w-4 h-4 animate-spin" /> Loading...
        </div>
      ) : assignments.length === 0 ? (
        <EmptyState
          icon={<UserCheck className="w-6 h-6" />}
          title="No assignments yet"
          description="Assign an incharge or assistant from the lab view."
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
              <span className={cn('text-xs px-2 py-0.5 rounded-full',
                a.is_active
                  ? 'bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300'
                  : 'bg-slate-200 dark:bg-slate-700 text-slate-500 dark:text-slate-400')}>
                {a.is_active ? 'Active' : 'Inactive'}
              </span>
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

function AssignmentSlot({
  title,
  icon: Icon,
  accent,
  assignment,
  onAssign,
  onRevoke,
}: {
  title: string;
  icon: React.ElementType;
  accent: 'violet' | 'blue';
  assignment: Lab['current_incharge'];
  onAssign: () => void;
  onRevoke: (id: number) => void;
}) {
  const accentClasses = accent === 'violet'
    ? 'bg-violet-100 dark:bg-violet-900/40 text-violet-700 dark:text-violet-300'
    : 'bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300';

  if (!assignment) {
    return (
      <button
        onClick={onAssign}
        className="group flex items-center gap-2 pl-1.5 pr-3 py-1.5 rounded-full border border-dashed border-slate-300 dark:border-slate-600 text-slate-400 dark:text-slate-500 hover:border-brand-400 hover:text-brand-600 dark:hover:text-brand-400 hover:bg-brand-50/50 dark:hover:bg-brand-900/10 transition-colors"
        title={`Assign ${title}`}
      >
        <span className="w-6 h-6 rounded-full flex items-center justify-center bg-slate-100 dark:bg-slate-800 group-hover:bg-brand-100 dark:group-hover:bg-brand-900/30 transition-colors">
          <Plus className="w-3.5 h-3.5" />
        </span>
        <span className="text-xs font-medium">{title}</span>
      </button>
    );
  }

  return (
    <div
      className="group flex items-center gap-2 pl-1.5 pr-2 py-1.5 rounded-full border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800/60 shadow-sm"
      title={`${title}: ${assignment.username}${assignment.end_date ? ` (until ${assignment.end_date})` : ''}`}
    >
      <span className={cn('w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-bold', accentClasses)}>
        {assignment.username.charAt(0).toUpperCase()}
      </span>
      <span className="flex flex-col leading-tight">
        <span className="text-[10px] font-semibold uppercase tracking-wide text-slate-400 flex items-center gap-1">
          <Icon className="w-3 h-3" /> {title}
        </span>
        <span className="text-xs font-medium text-slate-800 dark:text-slate-200 max-w-32 truncate">
          {assignment.username}
        </span>
      </span>
      <button
        onClick={() => onRevoke(assignment.assignment_id)}
        className="opacity-0 group-hover:opacity-100 transition-opacity text-slate-400 hover:text-red-500 p-0.5 rounded-full hover:bg-red-50 dark:hover:bg-red-900/20"
        title={`Revoke ${title}`}
      >
        <X className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}

/**
 * Compact inline bar rendered in LayoutPage when an admin is viewing a room.
 * Matches the current layout room to its Lab record by name and lets the
 * admin assign/revoke incharge & assistant and view full history in place.
 */
export default function LabAssignmentSection({ labName }: { labName: string }) {
  const qc = useQueryClient();
  const [assignTarget, setAssignTarget] = useState<RoleType | null>(null);
  const [historyOpen, setHistoryOpen] = useState(false);

  const { data: labs = [], isLoading } = useQuery<Lab[]>({
    queryKey: ['labs'],
    queryFn: () => labsApi.list().then((r) => r.data),
    staleTime: 60_000,
  });

  const lab = labs.find((l) => l.lab_name.toLowerCase() === labName.toLowerCase());

  const revokeMutation = useMutation({
    mutationFn: (assignmentId: number) => privilegesApi.deleteAssignment(assignmentId),
    onSuccess: () => {
      invalidatePrivileges(qc, lab?.id);
      toast.success('Assignment revoked');
    },
    onError: () => toast.error('Failed to revoke assignment'),
  });

  if (isLoading || !lab) return null; // ponytail: name-based lab match; upgrade to layout_item_id link if names diverge

  return (
    <>
      <div className="flex flex-wrap items-center gap-2">
        <AssignmentSlot
          title="Incharge"
          icon={UserCog}
          accent="violet"
          assignment={lab.current_incharge}
          onAssign={() => setAssignTarget('incharge')}
          onRevoke={(id) => revokeMutation.mutate(id)}
        />
        <AssignmentSlot
          title="Assistant"
          icon={Wrench}
          accent="blue"
          assignment={lab.current_assistant}
          onAssign={() => setAssignTarget('assistant')}
          onRevoke={(id) => revokeMutation.mutate(id)}
        />
        <button
          onClick={() => setHistoryOpen(true)}
          className="w-8 h-8 rounded-full flex items-center justify-center border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800/60 text-slate-500 hover:text-brand-600 dark:hover:text-brand-400 hover:border-brand-300 dark:hover:border-brand-700 shadow-sm transition-colors"
          title="Assignment history"
        >
          <History className="w-4 h-4" />
        </button>
      </div>

      {assignTarget && (
        <AssignModal open onClose={() => setAssignTarget(null)} lab={lab} roleType={assignTarget} />
      )}
      {historyOpen && <HistoryModal open onClose={() => setHistoryOpen(false)} lab={lab} />}
    </>
  );
}