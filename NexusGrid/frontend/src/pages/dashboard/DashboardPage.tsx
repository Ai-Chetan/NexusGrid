import { useQuery } from '@tanstack/react-query';
import {
  ResponsiveContainer, AreaChart, Area, CartesianGrid, XAxis, YAxis,
  Tooltip, PieChart, Pie, Cell, Legend,
} from 'recharts';
import {
  Monitor, AlertTriangle, Package, Building2,
  TrendingUp, Clock, CheckCircle2, XCircle,
  ArrowUpRight, Zap,
} from 'lucide-react';
import { dashboardApi } from '@/lib/api';
import { timeAgo, statusColors } from '@/lib/utils';
import StatusBadge from '@/components/common/StatusBadge';
import ErrorState from '@/components/common/ErrorState';
import { useTheme } from '@/hooks/useTheme';
import type { DashboardMetrics } from '@/types';

// ─── Metric Card ─────────────────────────────────────────────────────────────
interface MetricCardProps {
  label: string;
  value: number | string;
  sub?: string;
  icon: React.ElementType;
  color: string;
  pct?: number;
}

function MetricCard({ label, value, sub, icon: Icon, color, pct }: MetricCardProps) {
  return (
    <div className="card p-5">
      <div className="flex items-start justify-between gap-3">
        <div className={`w-10 h-10 ${color} rounded-xl flex items-center justify-center shrink-0`}>
          <Icon className="w-5 h-5 text-white" />
        </div>
        {pct !== undefined && (
          <span className="text-xs font-medium text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full">
            {pct}%
          </span>
        )}
      </div>
      <div className="mt-3">
        <p className="text-2xl font-bold text-slate-900">{value}</p>
        <p className="text-sm font-medium text-slate-700 mt-0.5">{label}</p>
        {sub && <p className="text-xs text-slate-500 mt-1">{sub}</p>}
      </div>
    </div>
  );
}

// ─── Donut Chart ─────────────────────────────────────────────────────────────
const FAULT_TYPE_COLORS = ['#3b82f6', '#f59e0b', '#10b981'];
const FAULT_STATUS_COLORS = ['#ef4444', '#f59e0b', '#3b82f6', '#10b981', '#94a3b8'];

function DonutChart({ data, colors, title }: {
  data: { name: string; value: number }[];
  colors: string[];
  title: string;
}) {
  const { theme } = useTheme();
  const dark = theme === 'dark';
  const ttStyle = {
    fontSize: 12, borderRadius: 8, border: 'none',
    boxShadow: '0 4px 20px rgba(0,0,0,.15)',
    backgroundColor: dark ? '#1e293b' : '#ffffff',
    color: dark ? '#f1f5f9' : '#0f172a',
  };
  return (
    <div className="card p-5">
      <p className="text-sm font-semibold text-slate-700 mb-4">{title}</p>
      <ResponsiveContainer width="100%" height={200}>
        <PieChart>
          <Pie
            data={data}
            cx="50%"
            cy="50%"
            innerRadius={55}
            outerRadius={80}
            paddingAngle={3}
            dataKey="value"
          >
            {data.map((_, i) => (
              <Cell key={i} fill={colors[i % colors.length]} />
            ))}
          </Pie>
          <Tooltip contentStyle={ttStyle} />
          <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 12 }} />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}

// ─── Activity Feed ────────────────────────────────────────────────────────────
function ActivityFeed({ items }: { items: DashboardMetrics['recent_activity'] }) {
  return (
    <div className="card p-5">
      <div className="flex items-center justify-between mb-4">
        <p className="text-sm font-semibold text-slate-700 mb-4">Recent Activity</p>
        <Clock className="w-4 h-4 text-slate-400" />
      </div>
      <div className="space-y-3">
        {items.length === 0 && (
          <p className="text-sm text-slate-400 text-center py-4">No recent activity</p>
        )}
        {items.map((item, i) => (
          <div key={i} className="flex items-start gap-3">
            <div className={`mt-0.5 w-7 h-7 rounded-full flex items-center justify-center shrink-0 ${
              item.type === 'fault' ? 'bg-red-100' : 'bg-blue-100'
            }`}>
              {item.type === 'fault'
                ? <AlertTriangle className="w-3.5 h-3.5 text-red-600" />
                : <Package className="w-3.5 h-3.5 text-blue-600" />
              }
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-slate-800 truncate">{item.title}</p>
              <p className="text-xs text-slate-500 truncate">{item.subtitle}</p>
            </div>
            <div className="text-right shrink-0">
              <StatusBadge status={item.status} />
              <p className="text-xs text-slate-400 mt-1">{timeAgo(item.time)}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Main ─────────────────────────────────────────────────────────────────────
export default function DashboardPage() {
  const { theme } = useTheme();
  const dark = theme === 'dark';

  const gridStroke   = dark ? '#334155' : '#cbd5e1';
  const tickFill     = dark ? '#64748b' : '#94a3b8';
  const tooltipStyle = {
    fontSize: 12, borderRadius: 8, border: 'none',
    boxShadow: '0 4px 20px rgba(0,0,0,.15)',
    backgroundColor: dark ? '#1e293b' : '#ffffff',
    color: dark ? '#f1f5f9' : '#0f172a',
  };
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['dashboard-metrics'],
    queryFn: () => dashboardApi.metrics().then((r) => r.data),
    refetchInterval: 60_000,
  });

  if (isLoading) {
    return (
      <div className="space-y-4 animate-pulse">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-28 bg-white rounded-xl border border-slate-200" />
          ))}
        </div>
      </div>
    );
  }

  if (isError || !data) {
    return <ErrorState message="Failed to load dashboard metrics." onRetry={refetch} />;
  }

  const { systems, faults, resources, labs_total, fault_trend, resource_trend,
          fault_by_type, fault_by_status, recent_activity } = data;

  const trendData = fault_trend.map((f, i) => ({
    month: f.month,
    faults: f.count,
    resources: resource_trend[i]?.count ?? 0,
  }));

  const faultTypeData = Object.entries(fault_by_type).map(([name, value]) => ({ name, value }));
  const faultStatusData = Object.entries(fault_by_status).map(([name, value]) => ({
    name: name.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase()),
    value,
  }));

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Metric Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard
          label="Total Systems"
          value={systems.total}
          sub={`${systems.functional} functional`}
          icon={Monitor}
          color="bg-brand-600"
          pct={systems.functional_pct}
        />
        <MetricCard
          label="Active Now"
          value={systems.active}
          sub={`${systems.utilization_pct}% utilization`}
          icon={Zap}
          color="bg-emerald-500"
          pct={systems.active_pct}
        />
        <MetricCard
          label="Open Faults"
          value={faults.open}
          sub={`${faults.total} total reported`}
          icon={AlertTriangle}
          color="bg-red-500"
        />
        <MetricCard
          label="Pending Resources"
          value={resources.pending}
          sub={`${resources.total} total requests`}
          icon={Package}
          color="bg-amber-500"
        />
      </div>

      {/* Second row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard
          label="Total Labs"
          value={labs_total}
          icon={Building2}
          color="bg-violet-500"
        />
        <MetricCard
          label="Critical Systems"
          value={systems.critical}
          sub="non-functional"
          icon={XCircle}
          color="bg-rose-500"
          pct={systems.critical_pct}
        />
        <MetricCard
          label="Resolved Faults"
          value={(fault_by_status['resolved'] ?? 0)}
          icon={CheckCircle2}
          color="bg-teal-500"
        />
        <MetricCard
          label="Fulfilled Requests"
          value={0}
          icon={TrendingUp}
          color="bg-indigo-500"
        />
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Trend Chart */}
        <div className="lg:col-span-2 card p-5">
          <div className="flex items-center justify-between mb-4">
            <p className="text-sm font-semibold text-slate-700">Activity Trend (6 months)</p>
            <ArrowUpRight className="w-4 h-4 text-slate-400" />
          </div>
          {trendData.length === 0 ? (
            <div className="h-48 flex items-center justify-center text-sm text-slate-400">
              No trend data available
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <AreaChart data={trendData} margin={{ top: 5, right: 10, bottom: 0, left: -10 }}>
                <defs>
                  <linearGradient id="faultGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#ef4444" stopOpacity={0.15} />
                    <stop offset="95%" stopColor="#ef4444" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="resourceGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.15} />
                    <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke={gridStroke} />
                <XAxis dataKey="month" tick={{ fontSize: 11, fill: tickFill }} tickLine={false} axisLine={false} />
                <YAxis tick={{ fontSize: 11, fill: tickFill }} tickLine={false} axisLine={false} />
                <Tooltip contentStyle={tooltipStyle} />
                <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 12 }} />
                <Area type="monotone" dataKey="faults" name="Faults" stroke="#ef4444" strokeWidth={2} fill="url(#faultGrad)" />
                <Area type="monotone" dataKey="resources" name="Resources" stroke="#3b82f6" strokeWidth={2} fill="url(#resourceGrad)" />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Fault by Type */}
        <DonutChart
          data={faultTypeData}
          colors={FAULT_TYPE_COLORS}
          title="Faults by Type"
        />
      </div>

      {/* Bottom Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <DonutChart
          data={faultStatusData}
          colors={FAULT_STATUS_COLORS}
          title="Faults by Status"
        />
        <ActivityFeed items={recent_activity} />
      </div>
    </div>
  );
}
