import { useEffect, useMemo, useState } from 'react';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  AlertTriangle,
  Building2,
  Loader2,
  MoreHorizontal,
  Pencil,
  PlusCircle,
  RefreshCw,
  Search,
  Shield,
  ShieldCheck,
  Trash2,
  UserCheck,
  Users,
  X,
} from 'lucide-react';
import { labsApi, usersApi } from '@/lib/api';
import { cn, formatDate } from '@/lib/utils';
import { useAuthStore } from '@/store/authStore';
import type { User } from '@/types';
import EmptyState from '@/components/common/EmptyState';
import ErrorState from '@/components/common/ErrorState';
import Modal from '@/components/common/Modal';
import PageHeader from '@/components/common/PageHeader';
import toast from 'react-hot-toast';

const ROLES = ['Administrator', 'Lab Incharge', 'Lab Assistant', 'Students', 'No Roles'] as const;
const ASSIGNABLE_ROLES = ['Lab Incharge', 'Lab Assistant'];

const roleTone: Record<string, string> = {
  Administrator: 'bg-red-100 text-red-700 border-red-200 dark:bg-red-900/30 dark:text-red-300 dark:border-red-800',
  'Lab Incharge': 'bg-violet-100 text-violet-700 border-violet-200 dark:bg-violet-900/30 dark:text-violet-300 dark:border-violet-800',
  'Lab Assistant': 'bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-900/30 dark:text-blue-300 dark:border-blue-800',
  Students: 'bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-300 dark:border-emerald-800',
  'No Roles': 'bg-slate-100 text-slate-600 border-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:border-slate-700',
};

function invalidatePrivileges(qc: ReturnType<typeof useQueryClient>) {
  qc.invalidateQueries({ queryKey: ['labs'] });
  qc.invalidateQueries({ queryKey: ['privileges-stats'] });
  qc.invalidateQueries({ queryKey: ['users'] });
  qc.invalidateQueries({ queryKey: ['assignments'] });
}

function errDetail(err: unknown, fallback: string): string {
  const data = (err as { response?: { data?: Record<string, unknown> } })?.response?.data;
  if (!data) return fallback;
  if (typeof data.detail === 'string') return data.detail;
  const first = Object.values(data)[0];
  if (typeof first === 'string') return first;
  if (Array.isArray(first) && typeof first[0] === 'string') return first[0];
  return fallback;
}

function RoleBadge({ role }: { role: string }) {
  return (
    <span className={cn('badge', roleTone[role] ?? roleTone['No Roles'])}>
      {role}
    </span>
  );
}

function Avatar({ name, size = 'md' }: { name: string; size?: 'sm' | 'md' | 'lg' }) {
  const dim = size === 'lg' ? 'w-12 h-12 text-base' : size === 'sm' ? 'w-8 h-8 text-xs' : 'w-9 h-9 text-sm';
  return (
    <div className={cn(
      'rounded-full bg-gradient-to-br from-brand-500 to-brand-700 flex items-center justify-center shrink-0 text-white font-bold shadow-sm',
      dim,
    )}>
      {name.charAt(0).toUpperCase()}
    </div>
  );
}

function StatCard({
  icon: Icon,
  label,
  value,
  color,
  warn,
}: {
  icon: React.ElementType;
  label: string;
  value: number | string;
  color: string;
  warn?: boolean;
}) {
  return (
    <div className={cn(
      'card p-4 flex items-center gap-3 transition-shadow hover:shadow-md',
      warn && Number(value) > 0 && 'ring-1 ring-amber-300 dark:ring-amber-700',
    )}>
      <div className={cn('w-10 h-10 rounded-xl flex items-center justify-center shrink-0 shadow-sm', color)}>
        <Icon className="w-5 h-5 text-white" />
      </div>
      <div className="min-w-0">
        <p className="text-xl font-bold text-slate-900 dark:text-slate-100 leading-tight tabular-nums">{value}</p>
        <p className="text-xs text-slate-500 truncate">{label}</p>
      </div>
    </div>
  );
}

// ─── Delete User Modal ────────────────────────────────────────────────────────

function DeleteUserModal({
  user,
  open,
  onClose,
}: {
  user: User | null;
  open: boolean;
  onClose: () => void;
}) {
  const qc = useQueryClient();
  const [confirmText, setConfirmText] = useState('');

  const deleteMut = useMutation({
    mutationFn: () => usersApi.delete(user!.id),
    onSuccess: () => {
      invalidatePrivileges(qc);
      toast.success(`User "${user!.username}" deleted.`);
      setConfirmText('');
      onClose();
    },
    onError: (err: unknown) => {
      toast.error(errDetail(err, 'Failed to delete user.'));
    },
  });

  if (!user) return null;

  const hasLabs = (user.assigned_labs?.length ?? 0) > 0;
  const canSubmit = confirmText === user.username && !deleteMut.isPending;

  return (
    <Modal open={open} onClose={() => { setConfirmText(''); onClose(); }} title="Delete User" size="sm">
      <div className="space-y-4">
        <div className="flex items-start gap-3 rounded-xl border border-red-200 dark:border-red-900/50 bg-red-50 dark:bg-red-950/30 p-3">
          <AlertTriangle className="w-5 h-5 text-red-600 dark:text-red-400 shrink-0 mt-0.5" />
          <div className="text-sm text-red-700 dark:text-red-300">
            <p className="font-semibold">This cannot be undone.</p>
            <p className="mt-1 text-red-600/90 dark:text-red-400/90">
              Permanently deletes <strong>{user.username}</strong> and their lab assignments
              {hasLabs ? ` (${user.assigned_labs!.join(', ')})` : ''}.
              Related fault reports and resource requests will also be removed.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3 p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700">
          <Avatar name={user.username} />
          <div className="min-w-0">
            <p className="text-sm font-semibold text-slate-800 dark:text-slate-100 truncate">{user.username}</p>
            <p className="text-xs text-slate-500 truncate">{user.email}</p>
            <div className="mt-1"><RoleBadge role={user.role} /></div>
          </div>
        </div>

        <div>
          <label className="label">
            Type <span className="font-mono text-red-600 dark:text-red-400">{user.username}</span> to confirm
          </label>
          <input
            className="input"
            value={confirmText}
            onChange={(e) => setConfirmText(e.target.value)}
            placeholder={user.username}
            autoFocus
            autoComplete="off"
            onKeyDown={(e) => {
              if (e.key === 'Enter' && canSubmit) deleteMut.mutate();
            }}
          />
        </div>

        <div className="flex justify-end gap-2 pt-1">
          <button
            type="button"
            className="btn-secondary"
            onClick={() => { setConfirmText(''); onClose(); }}
            disabled={deleteMut.isPending}
          >
            Cancel
          </button>
          <button
            type="button"
            className="btn-danger"
            disabled={!canSubmit}
            onClick={() => deleteMut.mutate()}
          >
            {deleteMut.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
            Delete User
          </button>
        </div>
      </div>
    </Modal>
  );
}

// ─── Edit User Modal (Role & Lab Assignments) ────────────────────────────────

function EditUserModal({
  user,
  open,
  onClose,
}: {
  user: User | null;
  open: boolean;
  onClose: () => void;
}) {
  const qc = useQueryClient();
  const [role, setRole] = useState<User['role']>(user?.role ?? 'No Roles');
  const [selectedLabs, setSelectedLabs] = useState<string[]>(user?.assigned_labs ?? []);
  const [confirmRevoke, setConfirmRevoke] = useState(false);

  const { data: labs = [], isLoading: isLoadingLabs } = useQuery<{ id: number; lab_name: string; lab_code: string }[]>({
    queryKey: ['labs'],
    queryFn: () => labsApi.list().then((r) => r.data),
    enabled: open,
  });

  useEffect(() => {
    if (user && open) {
      setRole(user.role);
      setSelectedLabs(user.assigned_labs ?? []);
      setConfirmRevoke(false);
    }
  }, [user, open]);

  const isAssignableRole = ASSIGNABLE_ROLES.includes(role);
  const roleChanged = user ? role !== user.role : false;
  const labsChanged = user
    ? JSON.stringify([...(selectedLabs ?? [])].sort()) !== JSON.stringify([...(user.assigned_labs ?? [])].sort())
    : false;
  const isChanged = roleChanged || labsChanged;

  const willRevoke = roleChanged && ASSIGNABLE_ROLES.includes(user?.role ?? '') && !isAssignableRole;

  const mutation = useMutation({
    mutationFn: (payload: { role: string; assigned_labs: string[] }) =>
      usersApi.update(user!.id, payload),
    onSuccess: (res) => {
      invalidatePrivileges(qc);
      const revoked = res.data.revoked_assignments as number | undefined;
      toast.success(
        revoked && revoked > 0
          ? `User privileges updated. ${revoked} assignment${revoked > 1 ? 's' : ''} revoked.`
          : `User privileges updated successfully.`,
      );
      onClose();
    },
    onError: (err: unknown) => {
      toast.error(errDetail(err, 'Failed to update user.'));
    },
  });

  if (!user) return null;

  const toggleLab = (labName: string) => {
    setSelectedLabs((prev) =>
      prev.includes(labName) ? prev.filter((l) => l !== labName) : [...prev, labName]
    );
  };

  const selectAllLabs = () => {
    setSelectedLabs(labs.map((l) => l.lab_name));
  };

  const clearAllLabs = () => {
    setSelectedLabs([]);
  };

  const save = () => {
    if (!isChanged) {
      onClose();
      return;
    }
    if (willRevoke && !confirmRevoke) {
      setConfirmRevoke(true);
      return;
    }
    mutation.mutate({
      role,
      assigned_labs: isAssignableRole ? selectedLabs : [],
    });
  };

  return (
    <Modal open={open} onClose={onClose} title="Edit User Privileges" size="md">
      <div className="space-y-4">
        {/* User preview header */}
        <div className="flex items-center gap-3 p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700">
          <Avatar name={user.username} />
          <div className="min-w-0">
            <p className="text-sm font-semibold text-slate-800 dark:text-slate-100 truncate">{user.username}</p>
            <p className="text-xs text-slate-500 truncate">{user.email}</p>
            <div className="mt-1 flex items-center gap-2">
              <RoleBadge role={user.role} />
              {user.assigned_labs && user.assigned_labs.length > 0 && (
                <span className="text-xs text-slate-500">
                  ({user.assigned_labs.length} lab{user.assigned_labs.length > 1 ? 's' : ''} assigned)
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Role dropdown */}
        <div>
          <label className="label">User Role</label>
          <select
            className="input"
            value={role}
            onChange={(e) => {
              setRole(e.target.value as User['role']);
              setConfirmRevoke(false);
            }}
          >
            {ROLES.map((r) => (
              <option key={r} value={r}>{r}</option>
            ))}
          </select>
        </div>

        {/* Lab Multi-select Section */}
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label className="label mb-0">Assigned Labs</label>
            {isAssignableRole && labs.length > 0 && (
              <div className="flex items-center gap-2 text-xs">
                <button
                  type="button"
                  onClick={selectAllLabs}
                  className="text-brand-600 dark:text-brand-400 hover:underline font-medium"
                >
                  Select All
                </button>
                <span className="text-slate-300 dark:text-slate-600">•</span>
                <button
                  type="button"
                  onClick={clearAllLabs}
                  className="text-slate-500 hover:underline font-medium"
                >
                  Clear
                </button>
              </div>
            )}
          </div>

          {!isAssignableRole ? (
            <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700/80 text-xs text-slate-500">
              Lab assignments are only available for <strong>Lab Incharge</strong> and <strong>Lab Assistant</strong> roles.
            </div>
          ) : isLoadingLabs ? (
            <div className="p-4 flex items-center justify-center gap-2 text-xs text-slate-500 border border-slate-200 dark:border-slate-700 rounded-xl">
              <Loader2 className="w-4 h-4 animate-spin" /> Loading labs…
            </div>
          ) : labs.length === 0 ? (
            <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700/80 text-xs text-slate-500">
              No labs found in system layout. Create labs in System Layout first.
            </div>
          ) : (
            <div className="max-h-48 overflow-y-auto border border-slate-200 dark:border-slate-700 rounded-xl p-2.5 space-y-1 bg-white dark:bg-slate-800/50">
              {labs.map((lab) => {
                const isSelected = selectedLabs.includes(lab.lab_name);
                return (
                  <label
                    key={lab.id}
                    className={cn(
                      'flex items-center justify-between p-2 rounded-lg text-xs cursor-pointer transition-colors border select-none',
                      isSelected
                        ? 'bg-brand-50/80 border-brand-200 dark:bg-brand-950/40 dark:border-brand-800 text-brand-900 dark:text-brand-200'
                        : 'bg-transparent border-transparent hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300'
                    )}
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => toggleLab(lab.lab_name)}
                        className="rounded border-slate-300 text-brand-600 focus:ring-brand-500"
                      />
                      <span className="font-medium truncate">{lab.lab_name}</span>
                    </div>
                    {lab.lab_code && (
                      <span className="text-[10px] text-slate-400 font-mono uppercase bg-slate-100 dark:bg-slate-700 px-1.5 py-0.5 rounded ml-2">
                        {lab.lab_code}
                      </span>
                    )}
                  </label>
                );
              })}
            </div>
          )}
        </div>

        {willRevoke && (
          <div className="rounded-xl border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/30 p-3 text-sm text-amber-800 dark:text-amber-300">
            <div className="flex gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
              <p>
                Changing from <strong>{user.role}</strong> to <strong>{role}</strong> will revoke all existing lab assignments for this user
                {user.assigned_labs && user.assigned_labs.length > 0
                  ? `: ${user.assigned_labs.join(', ')}`
                  : ''}.
              </p>
            </div>
            {confirmRevoke && (
              <p className="mt-2 text-xs font-medium">Click Confirm again to proceed.</p>
            )}
          </div>
        )}

        <div className="flex justify-end gap-2 pt-2">
          <button type="button" className="btn-secondary" onClick={onClose} disabled={mutation.isPending}>
            Cancel
          </button>
          <button
            type="button"
            className={cn(willRevoke && confirmRevoke ? 'btn-danger' : 'btn-primary')}
            onClick={save}
            disabled={mutation.isPending || !isChanged}
          >
            {mutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Shield className="w-4 h-4" />}
            {willRevoke && confirmRevoke ? 'Confirm Revocation' : 'Save Changes'}
          </button>
        </div>
      </div>
    </Modal>
  );
}

// ─── Create User Modal ────────────────────────────────────────────────────────

function CreateUserModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const qc = useQueryClient();
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<string>('No Roles');
  const [created, setCreated] = useState<{ username: string; email: string; password: string; role: string } | null>(null);

  const createMut = useMutation({
    mutationFn: () => usersApi.create({ username, email, password, role }),
    onSuccess: () => {
      setCreated({ username, email, password, role });
      qc.invalidateQueries({ queryKey: ['users'] });
      qc.invalidateQueries({ queryKey: ['privileges-stats'] });
      toast.success('Account created.');
    },
    onError: (err: unknown) => {
      toast.error(errDetail(err, 'Failed to create account.'));
    },
  });

  const reset = () => {
    setUsername('');
    setEmail('');
    setPassword('');
    setRole('No Roles');
    setCreated(null);
  };

  const handleClose = () => {
    reset();
    onClose();
  };

  const credentialsText = created
    ? `NexusGrid Account\nUsername: ${created.username}\nEmail: ${created.email}\nPassword: ${created.password}\nRole: ${created.role}`
    : '';

  return (
    <Modal open={open} onClose={handleClose} title={created ? 'Account Created' : 'Create Account'}>
      {created ? (
        <div className="space-y-4">
          <div className="flex items-start gap-3 rounded-xl border border-emerald-200 dark:border-emerald-900/50 bg-emerald-50 dark:bg-emerald-950/30 p-3">
            <UserCheck className="w-5 h-5 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
            <p className="text-sm text-emerald-800 dark:text-emerald-300">
              Share these credentials securely. The password will not be shown again.
            </p>
          </div>
          <pre className="text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-4 whitespace-pre-wrap font-mono">
            {credentialsText}
          </pre>
          <div className="flex justify-end gap-2">
            <button
              className="btn-secondary"
              onClick={() => {
                navigator.clipboard.writeText(credentialsText);
                toast.success('Credentials copied.');
              }}
            >
              Copy Credentials
            </button>
            <button className="btn-primary" onClick={handleClose}>Done</button>
          </div>
        </div>
      ) : (
        <form
          className="space-y-3"
          onSubmit={(e) => {
            e.preventDefault();
            createMut.mutate();
          }}
        >
          <div>
            <label className="label">Username</label>
            <input
              className="input"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              minLength={3}
              required
              autoFocus
              placeholder="e.g. jdoe"
            />
          </div>
          <div>
            <label className="label">Email</label>
            <input
              type="email"
              className="input"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              placeholder="user@college.edu"
            />
          </div>
          <div>
            <label className="label">Password</label>
            <input
              type="text"
              className="input font-mono"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              minLength={8}
              required
              placeholder="Min 8 characters"
            />
          </div>
          <div>
            <label className="label">Role</label>
            <select className="input" value={role} onChange={(e) => setRole(e.target.value)}>
              {ROLES.map((r) => (
                <option key={r} value={r}>{r}</option>
              ))}
            </select>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" className="btn-secondary" onClick={handleClose}>Cancel</button>
            <button type="submit" className="btn-primary" disabled={createMut.isPending}>
              {createMut.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <PlusCircle className="w-4 h-4" />}
              Create Account
            </button>
          </div>
        </form>
      )}
    </Modal>
  );
}

// ─── Row actions ──────────────────────────────────────────────────────────────

function UserActions({
  user,
  isSelf,
  onEdit,
  onDelete,
}: {
  user: User;
  isSelf: boolean;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const [open, setOpen] = useState(false);

  return (
    <div className="relative flex items-center justify-end gap-1">
      {/* Desktop: always-visible action buttons */}
      <div className="hidden sm:flex items-center gap-1">
        <button
          type="button"
          onClick={onEdit}
          className="btn-ghost px-2 py-1.5 text-xs"
          title="Edit user privileges"
        >
          <Pencil className="w-3.5 h-3.5" />
          Edit
        </button>
        {!isSelf && (
          <button
            type="button"
            onClick={onDelete}
            className="btn-ghost px-2 py-1.5 text-xs text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-950/40"
            title={`Delete ${user.username}`}
          >
            <Trash2 className="w-3.5 h-3.5" />
            Delete
          </button>
        )}
      </div>

      {/* Mobile: overflow menu */}
      <div className="sm:hidden relative">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="p-2 rounded-lg text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
          aria-label="Actions"
        >
          <MoreHorizontal className="w-4 h-4" />
        </button>
        {open && (
          <>
            <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
            <div className="absolute right-0 top-full mt-1 z-20 w-44 card py-1 shadow-lg">
              <button
                type="button"
                className="w-full flex items-center gap-2 px-3 py-2 text-sm text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800"
                onClick={() => { setOpen(false); onEdit(); }}
              >
                <Pencil className="w-3.5 h-3.5" /> Edit privileges
              </button>
              {!isSelf && (
                <button
                  type="button"
                  className="w-full flex items-center gap-2 px-3 py-2 text-sm text-red-600 hover:bg-red-50 dark:hover:bg-red-950/40"
                  onClick={() => { setOpen(false); onDelete(); }}
                >
                  <Trash2 className="w-3.5 h-3.5" /> Delete
                </button>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function UsersPage() {
  const currentUser = useAuthStore((s) => s.user);
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('all');
  const [createOpen, setCreateOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<User | null>(null);
  const [editTarget, setEditTarget] = useState<User | null>(null);

  const { data: stats } = useQuery({
    queryKey: ['privileges-stats'],
    queryFn: () => usersApi.privilegesStats().then((r) => r.data),
  });

  const { data: users = [], isLoading, isError, refetch, isFetching } = useQuery<User[]>({
    queryKey: ['users'],
    queryFn: () => usersApi.list().then((r) => r.data),
  });

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    return users.filter((u) => {
      const matchesSearch =
        !q ||
        u.username.toLowerCase().includes(q) ||
        u.email.toLowerCase().includes(q);
      const matchesRole = roleFilter === 'all' || u.role === roleFilter;
      return matchesSearch && matchesRole;
    });
  }, [users, search, roleFilter]);

  const roleCounts = useMemo(() => {
    const counts: Record<string, number> = { all: users.length };
    for (const r of ROLES) counts[r] = 0;
    for (const u of users) counts[u.role] = (counts[u.role] ?? 0) + 1;
    return counts;
  }, [users]);

  return (
    <div className="space-y-5 animate-fade-in">
      <PageHeader
        title="User Privileges"
        description="Manage accounts, roles, and lab assignments."
        actions={
          <button onClick={() => setCreateOpen(true)} className="btn-primary">
            <PlusCircle className="w-4 h-4" />
            Create Account
          </button>
        }
      />

      {stats && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          <StatCard icon={Users} label="Total Users" value={stats.total_users} color="bg-brand-600" />
          <StatCard icon={ShieldCheck} label="Unassigned" value={stats.unassigned_users} color="bg-amber-500" warn />
          <StatCard icon={Building2} label="Total Labs" value={stats.total_labs} color="bg-violet-500" />
          <StatCard icon={UserCheck} label="Labs w/o Incharge" value={stats.labs_without_instructor} color="bg-red-500" warn />
          <StatCard icon={UserCheck} label="Labs w/o Assistant" value={stats.labs_without_assistant} color="bg-orange-500" warn />
        </div>
      )}

      {/* Filters */}
      <div className="card p-3 sm:p-4 space-y-3">
        <div className="flex flex-wrap gap-2 items-center">
          <div className="relative flex-1 min-w-[12rem]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
            <input
              className="input pl-9 pr-8"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search username or email…"
            />
            {search && (
              <button
                type="button"
                onClick={() => setSearch('')}
                className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded text-slate-400 hover:text-slate-600"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
          <button
            onClick={() => refetch()}
            className="btn-secondary px-3"
            title="Refresh"
            disabled={isFetching}
          >
            <RefreshCw className={cn('w-4 h-4', isFetching && 'animate-spin')} />
          </button>
          <span className="text-xs text-slate-500 tabular-nums ml-auto hidden sm:inline">
            {filtered.length} of {users.length}
          </span>
        </div>

        {/* Role chips */}
        <div className="flex flex-wrap gap-1.5">
          <button
            type="button"
            onClick={() => setRoleFilter('all')}
            className={cn(
              'px-2.5 py-1 rounded-full text-xs font-medium border transition-colors',
              roleFilter === 'all'
                ? 'bg-brand-600 text-white border-brand-600'
                : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:border-brand-400',
            )}
          >
            All <span className="opacity-70">{roleCounts.all ?? 0}</span>
          </button>
          {ROLES.map((r) => (
            <button
              key={r}
              type="button"
              onClick={() => setRoleFilter(r)}
              className={cn(
                'px-2.5 py-1 rounded-full text-xs font-medium border transition-colors',
                roleFilter === r
                  ? 'bg-brand-600 text-white border-brand-600'
                  : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:border-brand-400',
              )}
            >
              {r} <span className="opacity-70">{roleCounts[r] ?? 0}</span>
            </button>
          ))}
        </div>
      </div>

      <CreateUserModal open={createOpen} onClose={() => setCreateOpen(false)} />
      <DeleteUserModal
        user={deleteTarget}
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
      />
      <EditUserModal
        user={editTarget}
        open={!!editTarget}
        onClose={() => setEditTarget(null)}
      />

      {/* User list */}
      <div className="card overflow-hidden">
        {isError ? (
          <ErrorState message="Failed to load users." onRetry={refetch} />
        ) : isLoading ? (
          <div className="p-12 flex flex-col items-center gap-3 text-slate-500">
            <Loader2 className="w-6 h-6 animate-spin" />
            <p className="text-sm">Loading users…</p>
          </div>
        ) : filtered.length === 0 ? (
          <EmptyState
            icon={<Users className="w-7 h-7" />}
            title="No users found"
            description={search || roleFilter !== 'all' ? 'Try different filters.' : 'Create the first account.'}
          />
        ) : (
          <>
            {/* Desktop table */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full">
                <thead className="bg-slate-50 dark:bg-slate-800/50 border-b border-slate-200 dark:border-slate-700">
                  <tr>
                    {['User', 'Role', 'Assigned Labs', 'Joined', 'Actions'].map((h) => (
                      <th key={h} className={cn('px-4 py-3 table-header', h === 'Actions' && 'text-right')}>
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-700/50">
                  {filtered.map((u) => {
                    const isSelf = currentUser?.id === u.id;
                    return (
                      <tr
                        key={u.id}
                        className="hover:bg-slate-50/80 dark:hover:bg-slate-800/30 transition-colors"
                      >
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-3">
                            <Avatar name={u.username} size="sm" />
                            <div className="min-w-0">
                              <div className="flex items-center gap-2">
                                <p className="text-sm font-medium text-slate-800 dark:text-slate-100 truncate">
                                  {u.username}
                                </p>
                                {isSelf && (
                                  <span className="text-[10px] uppercase tracking-wide font-semibold text-brand-600 dark:text-brand-400 bg-brand-50 dark:bg-brand-900/30 px-1.5 py-0.5 rounded">
                                    You
                                  </span>
                                )}
                                {u.is_superuser && (
                                  <span className="text-[10px] uppercase tracking-wide font-semibold text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/30 px-1.5 py-0.5 rounded">
                                    Superuser
                                  </span>
                                )}
                              </div>
                              <p className="text-xs text-slate-500 truncate">{u.email}</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <RoleBadge role={u.role} />
                        </td>
                        <td className="px-4 py-3">
                          {u.assigned_labs && u.assigned_labs.length > 0 ? (
                            <div className="flex flex-wrap gap-1 max-w-xs">
                              {u.assigned_labs.map((lab) => (
                                <span
                                  key={lab}
                                  className="badge text-xs bg-brand-50 text-brand-700 border-brand-200 dark:bg-brand-900/30 dark:text-brand-300 dark:border-brand-800"
                                >
                                  {lab}
                                </span>
                              ))}
                            </div>
                          ) : (
                            <span className="text-xs text-slate-400">—</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-xs text-slate-500 whitespace-nowrap">
                          {formatDate(u.date_joined)}
                        </td>
                        <td className="px-4 py-3">
                          <UserActions
                            user={u}
                            isSelf={isSelf}
                            onEdit={() => setEditTarget(u)}
                            onDelete={() => setDeleteTarget(u)}
                          />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Mobile cards */}
            <div className="md:hidden divide-y divide-slate-100 dark:divide-slate-700/50">
              {filtered.map((u) => {
                const isSelf = currentUser?.id === u.id;
                return (
                  <div key={u.id} className="p-4 space-y-3">
                    <div className="flex items-start gap-3">
                      <Avatar name={u.username} />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">
                            {u.username}
                          </p>
                          {isSelf && (
                            <span className="text-[10px] uppercase tracking-wide font-semibold text-brand-600 bg-brand-50 dark:bg-brand-900/30 px-1.5 py-0.5 rounded">
                              You
                            </span>
                          )}
                          {u.is_superuser && (
                            <span className="text-[10px] uppercase tracking-wide font-semibold text-red-600 bg-red-50 dark:bg-red-900/30 px-1.5 py-0.5 rounded">
                              Superuser
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-slate-500 truncate">{u.email}</p>
                        <div className="mt-1.5 flex items-center gap-2 flex-wrap">
                          <RoleBadge role={u.role} />
                          <span className="text-[11px] text-slate-400">{formatDate(u.date_joined)}</span>
                        </div>
                        {u.assigned_labs && u.assigned_labs.length > 0 && (
                          <div className="flex flex-wrap gap-1 mt-2">
                            {u.assigned_labs.map((lab) => (
                              <span
                                key={lab}
                                className="badge text-xs bg-brand-50 text-brand-700 border-brand-200 dark:bg-brand-900/30 dark:text-brand-300 dark:border-brand-800"
                              >
                                {lab}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                      <UserActions
                        user={u}
                        isSelf={isSelf}
                        onEdit={() => setEditTarget(u)}
                        onDelete={() => setDeleteTarget(u)}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
