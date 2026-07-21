import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Building2,
  Loader2,
  PlusCircle,
  RefreshCw,
  Search,
  ShieldCheck,
  Trash2,
  UserCheck,
  Users,
} from 'lucide-react';
import { usersApi } from '@/lib/api';
import { cn, formatDate } from '@/lib/utils';
import type { User } from '@/types';
import EmptyState from '@/components/common/EmptyState';
import ErrorState from '@/components/common/ErrorState';
import Modal from '@/components/common/Modal';
import PageHeader from '@/components/common/PageHeader';
import toast from 'react-hot-toast';

const ROLES = ['Administrator', 'Lab Incharge', 'Lab Assistant', 'Students', 'No Roles'] as const;
const ASSIGNABLE_ROLES = ['Lab Incharge', 'Lab Assistant'];

const roleTone: Record<string, string> = {
  Administrator: 'bg-red-100 text-red-700 border-red-200',
  'Lab Incharge': 'bg-violet-100 text-violet-700 border-violet-200',
  'Lab Assistant': 'bg-blue-100 text-blue-700 border-blue-200',
  Students: 'bg-emerald-100 text-emerald-700 border-emerald-200',
  'No Roles': 'bg-slate-100 text-slate-600 border-slate-200',
};

function invalidatePrivileges(qc: ReturnType<typeof useQueryClient>) {
  qc.invalidateQueries({ queryKey: ['labs'] });
  qc.invalidateQueries({ queryKey: ['privileges-stats'] });
  qc.invalidateQueries({ queryKey: ['users'] });
  qc.invalidateQueries({ queryKey: ['assignments'] });
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

function DeleteUserButton({ user }: { user: User }) {
  const qc = useQueryClient();
  const [confirming, setConfirming] = useState(false);

  const deleteMut = useMutation({
    mutationFn: () => usersApi.delete(user.id),
    onSuccess: () => {
      invalidatePrivileges(qc);
      toast.success(`User "${user.username}" deleted.`);
    },
    onError: (err: unknown) => {
      const msg = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
      toast.error(msg ?? 'Failed to delete user.');
    },
  });

  if (confirming) {
    return (
      <div className="flex items-center gap-1.5">
        <button
          onClick={() => deleteMut.mutate()}
          disabled={deleteMut.isPending}
          className="text-xs px-2 py-1 rounded bg-red-600 text-white hover:bg-red-700 disabled:opacity-50"
        >
          {deleteMut.isPending ? '...' : 'Confirm'}
        </button>
        <button
          onClick={() => setConfirming(false)}
          className="text-xs text-slate-500 hover:underline"
        >
          Cancel
        </button>
      </div>
    );
  }

  return (
    <button
      onClick={() => setConfirming(true)}
      className="text-slate-400 hover:text-red-500 transition-colors p-1 rounded hover:bg-red-50 dark:hover:bg-red-950/30"
      title={`Delete ${user.username}`}
    >
      <Trash2 className="w-4 h-4" />
    </button>
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
      const data = (err as { response?: { data?: Record<string, string> } })?.response?.data;
      const msg = data ? Object.values(data)[0] : 'Failed to create account.';
      toast.error(String(msg));
    },
  });

  const reset = () => {
    setUsername(''); setEmail(''); setPassword(''); setRole('No Roles'); setCreated(null);
  };

  const handleClose = () => { reset(); onClose(); };

  const credentialsText = created
    ? `NexusGrid Account\nUsername: ${created.username}\nEmail: ${created.email}\nPassword: ${created.password}\nRole: ${created.role}`
    : '';

  return (
    <Modal open={open} onClose={handleClose} title={created ? 'Account Created' : 'Create Account'}>
      {created ? (
        <div className="space-y-4">
          <p className="text-sm text-slate-600 dark:text-slate-400">
            Share these credentials with the user securely. The password will not be shown again.
          </p>
          <pre className="text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-3 whitespace-pre-wrap">
            {credentialsText}
          </pre>
          <div className="flex justify-end gap-2">
            <button
              className="btn-secondary"
              onClick={() => {
                navigator.clipboard.writeText(credentialsText);
                toast.success('Credentials copied to clipboard.');
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
          onSubmit={(e) => { e.preventDefault(); createMut.mutate(); }}
        >
          <div>
            <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Username</label>
            <input className="input mt-1" value={username} onChange={(e) => setUsername(e.target.value)} minLength={3} required />
          </div>
          <div>
            <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Email</label>
            <input type="email" className="input mt-1" value={email} onChange={(e) => setEmail(e.target.value)} required />
          </div>
          <div>
            <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Password</label>
            <input type="text" className="input mt-1" value={password} onChange={(e) => setPassword(e.target.value)} minLength={8} required
                   placeholder="Min 8 characters" />
          </div>
          <div>
            <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Role</label>
            <select className="input mt-1" value={role} onChange={(e) => setRole(e.target.value)}>
              {ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
            </select>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" className="btn-secondary" onClick={handleClose}>Cancel</button>
            <button type="submit" className="btn-primary" disabled={createMut.isPending}>
              {createMut.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <PlusCircle className="w-4 h-4" />}
              Create
            </button>
          </div>
        </form>
      )}
    </Modal>
  );
}

export default function UsersPage() {
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('all');
  const [createOpen, setCreateOpen] = useState(false);

  const { data: stats } = useQuery({
    queryKey: ['privileges-stats'],
    queryFn: () => usersApi.privilegesStats().then((r) => r.data),
  });

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
    <div className="space-y-5 animate-fade-in">
      <PageHeader
        title="User Privileges"
        description="Manage users and their roles. Lab assignments are managed from System Layout."
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

        <button onClick={() => refetch()} className="btn-secondary px-3"><RefreshCw className="w-4 h-4" /></button>
        <button onClick={() => setCreateOpen(true)} className="btn-primary">
          <PlusCircle className="w-4 h-4" /> Create Account
        </button>
        <span className="text-xs text-slate-500 ml-auto">{filtered.length} users</span>
      </div>

      <CreateUserModal open={createOpen} onClose={() => setCreateOpen(false)} />

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
                  {['User', 'Email', 'Role', 'Assigned Labs', 'Staff', 'Joined', ''].map((h) => (
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
                      {u.assigned_labs && u.assigned_labs.length > 0 ? (
                        <div className="flex flex-wrap gap-1">
                          {u.assigned_labs.map((lab) => (
                            <span key={lab} className="badge text-xs bg-brand-50 text-brand-700 border-brand-200 dark:bg-brand-900/30 dark:text-brand-300 dark:border-brand-800">
                              {lab}
                            </span>
                          ))}
                        </div>
                      ) : (
                        <span className="text-xs text-slate-400">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <span className={cn('badge text-xs', u.is_staff
                        ? 'bg-emerald-100 text-emerald-700 border-emerald-200'
                        : 'bg-slate-100 text-slate-500 border-slate-200')}
                      >
                        {u.is_staff ? 'Yes' : 'No'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-500">{formatDate(u.date_joined)}</td>
                    <td className="px-4 py-3 text-right">
                      <DeleteUserButton user={u} />
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