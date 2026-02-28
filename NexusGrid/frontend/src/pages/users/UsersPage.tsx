import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Users, Search, Loader2, RefreshCw, ShieldCheck, Building2, UserCheck } from 'lucide-react';
import { usersApi } from '@/lib/api';
import { cn, formatDate } from '@/lib/utils';
import type { User } from '@/types';
import PageHeader from '@/components/common/PageHeader';
import ErrorState from '@/components/common/ErrorState';
import EmptyState from '@/components/common/EmptyState';
import toast from 'react-hot-toast';

const ROLES = ['Administrator', 'Lab Incharge', 'Lab Assistant', 'Students', 'No Roles'];

const roleColor: Record<string, string> = {
  'Administrator': 'bg-red-100 text-red-700 border-red-200',
  'Lab Incharge':  'bg-violet-100 text-violet-700 border-violet-200',
  'Lab Assistant': 'bg-blue-100 text-blue-700 border-blue-200',
  'Students':      'bg-emerald-100 text-emerald-700 border-emerald-200',
  'No Roles':      'bg-slate-100 text-slate-600 border-slate-200',
};

// ─── Stat Card ────────────────────────────────────────────────────────────────
function StatCard({ icon: Icon, label, value, color }: {
  icon: React.ElementType; label: string; value: number; color: string;
}) {
  return (
    <div className="card p-5 flex items-center gap-4">
      <div className={`w-10 h-10 ${color} rounded-xl flex items-center justify-center shrink-0`}>
        <Icon className="w-5 h-5 text-white" />
      </div>
      <div>
        <p className="text-2xl font-bold text-slate-900">{value}</p>
        <p className="text-xs text-slate-500">{label}</p>
      </div>
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

// ─── Main Page ─────────────────────────────────────────────────────────────────
export default function UsersPage() {
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('all');

  const { data: users = [], isLoading, isError, refetch } = useQuery({
    queryKey: ['users'],
    queryFn: () => usersApi.list().then(r => r.data),
  });

  const { data: stats } = useQuery({
    queryKey: ['privileges-stats'],
    queryFn: () => usersApi.privilegesStats().then(r => r.data),
  });

  const filtered = users.filter(u => {
    const matchSearch =
      u.username.toLowerCase().includes(search.toLowerCase()) ||
      u.email.toLowerCase().includes(search.toLowerCase());
    const matchRole = roleFilter === 'all' || u.role === roleFilter;
    return matchSearch && matchRole;
  });

  return (
    <div className="space-y-5 animate-fade-in">
      <PageHeader
        title="User Privileges"
        description="Manage user accounts and assign roles."
        actions={
          <button onClick={() => refetch()} className="btn-secondary">
            <RefreshCw className="w-4 h-4" /> Refresh
          </button>
        }
      />

      {/* Stats */}
      {stats && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
          <StatCard icon={Users} label="Total Users" value={stats.total_users} color="bg-brand-600" />
          <StatCard icon={ShieldCheck} label="Unassigned" value={stats.unassigned_users} color="bg-amber-500" />
          <StatCard icon={Building2} label="Total Labs" value={stats.total_labs} color="bg-violet-500" />
          <StatCard icon={UserCheck} label="Labs w/o Instructor" value={stats.labs_without_instructor} color="bg-red-500" />
          <StatCard icon={UserCheck} label="Labs w/o Assistant" value={stats.labs_without_assistant} color="bg-orange-500" />
        </div>
      )}

      {/* Filters */}
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
        <span className="text-xs text-slate-500 ml-auto">
          {filtered.length} user{filtered.length !== 1 ? 's' : ''}
        </span>
      </div>

      {/* Table */}
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
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  {['User', 'Email', 'Role', 'Staff', 'Joined'].map(h => (
                    <th key={h} className="px-4 py-3 table-header">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filtered.map(user => (
                  <tr key={user.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-full bg-brand-100 flex items-center justify-center shrink-0">
                          <span className="text-xs font-bold text-brand-700">
                            {user.username.charAt(0).toUpperCase()}
                          </span>
                        </div>
                        <div>
                          <p className="text-sm font-medium text-slate-800">{user.username}</p>
                          {user.is_superuser && (
                            <p className="text-xs text-red-500">Superuser</p>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-sm text-slate-600">{user.email}</span>
                    </td>
                    <td className="px-4 py-3">
                      <RoleCell user={user} />
                    </td>
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
