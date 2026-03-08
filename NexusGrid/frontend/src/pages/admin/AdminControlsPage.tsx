import { useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { BellRing, Megaphone, Send, Shield, Users, Activity } from 'lucide-react';
import { dashboardApi, notificationsApi, usersApi } from '@/lib/api';
import type { DashboardMetrics } from '@/types';
import PageHeader from '@/components/common/PageHeader';
import toast from 'react-hot-toast';

interface PrivilegesStats {
  total_users: number;
  unassigned_users: number;
  total_labs: number;
  labs_without_instructor: number;
  labs_without_assistant: number;
}

function StatTile({ icon: Icon, title, value }: { icon: React.ElementType; title: string; value: number | string }) {
  return (
    <div className="card p-4 flex items-center gap-3">
      <div className="w-9 h-9 rounded-lg bg-brand-100 dark:bg-brand-900/30 flex items-center justify-center">
        <Icon className="w-4 h-4 text-brand-700 dark:text-brand-300" />
      </div>
      <div>
        <p className="text-lg font-bold text-slate-900 dark:text-slate-100 leading-tight">{value}</p>
        <p className="text-xs text-slate-500">{title}</p>
      </div>
    </div>
  );
}

export default function AdminControlsPage() {
  const [message, setMessage] = useState('');
  const [targetUrl, setTargetUrl] = useState('/app/dashboard');

  const { data: stats } = useQuery<PrivilegesStats>({
    queryKey: ['privileges-stats'],
    queryFn: () => usersApi.privilegesStats().then((r) => r.data as PrivilegesStats),
  });

  const { data: metrics } = useQuery<DashboardMetrics>({
    queryKey: ['admin-controls-dashboard-metrics'],
    queryFn: () => dashboardApi.metrics().then((r) => r.data as DashboardMetrics),
  });

  const { data: unreadPage } = useQuery<{ count: number }>({
    queryKey: ['admin-controls-unread-notifications'],
    queryFn: () => notificationsApi.list({ unread: true, page: 1, page_size: 1 }).then((r) => r.data),
    refetchInterval: 30_000,
  });

  const broadcastMutation = useMutation({
    mutationFn: () => notificationsApi.createAdminMessage({
      message: message.trim(),
      send_to_all: true,
      target_url: targetUrl,
    }),
    onSuccess: () => {
      setMessage('');
      toast.success('Broadcast sent to all users');
    },
    onError: () => toast.error('Failed to send broadcast'),
  });

  return (
    <div className="space-y-5 animate-fade-in">
      <PageHeader
        title="Admin Controls"
        description="Operational console for announcements, platform health, and quick administrative actions."
      />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatTile icon={Users} title="Total Users" value={stats?.total_users ?? 0} />
        <StatTile icon={Shield} title="Unassigned Users" value={stats?.unassigned_users ?? 0} />
        <StatTile icon={Activity} title="Open Faults" value={metrics?.faults.open ?? 0} />
        <StatTile icon={BellRing} title="Unread Notifications" value={unreadPage?.count ?? 0} />
      </div>

      <div className="card p-5 space-y-4">
        <div className="flex items-center gap-2">
          <Megaphone className="w-4 h-4 text-slate-500" />
          <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-200">Broadcast Message</h3>
        </div>

        <div>
          <label className="label">Redirect target when clicked</label>
          <select className="input" value={targetUrl} onChange={(e) => setTargetUrl(e.target.value)}>
            <option value="/app/dashboard">Dashboard</option>
            <option value="/app/faults">Fault Reports</option>
            <option value="/app/resources">Resources</option>
            <option value="/app/reports">Reports</option>
            <option value="/app/monitoring">Monitoring</option>
            <option value="/app/users">User Privileges</option>
          </select>
        </div>

        <div>
          <label className="label">Message for all users</label>
          <textarea
            rows={4}
            className="input resize-none"
            placeholder="Example: Maintenance today at 6 PM. Save your work before 5:45 PM."
            value={message}
            onChange={(e) => setMessage(e.target.value)}
          />
        </div>

        <div className="flex justify-end">
          <button
            type="button"
            className="btn-primary"
            disabled={broadcastMutation.isPending || !message.trim()}
            onClick={() => broadcastMutation.mutate()}
          >
            {broadcastMutation.isPending ? 'Sending...' : (
              <>
                <Send className="w-4 h-4" /> Send Broadcast
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
