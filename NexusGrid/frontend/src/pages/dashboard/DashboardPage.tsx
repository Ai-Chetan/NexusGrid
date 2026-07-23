import { useQuery } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ResponsiveContainer, AreaChart, Area, CartesianGrid, XAxis, YAxis,
  Tooltip, PieChart, Pie, Cell, Legend, BarChart, Bar,
} from 'recharts';
import {
  Monitor, AlertTriangle, Package, Building2,
  TrendingUp, Clock, CheckCircle2, XCircle,
  Zap, Filter, ArrowRight, ShieldCheck, RefreshCw, User as UserIcon,
} from 'lucide-react';
import { dashboardApi, layoutApi } from '@/lib/api';
import { timeAgo, cn } from '@/lib/utils';
import StatusBadge from '@/components/common/StatusBadge';
import ErrorState from '@/components/common/ErrorState';
import { useTheme } from '@/hooks/useTheme';
import { useAuthStore } from '@/store/authStore';
import type { DashboardFilterParams, DashboardMetrics, LayoutItem } from '@/types';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function greeting(): string {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
}

const FAULT_TYPE_COLORS = ['#3b82f6', '#f59e0b', '#10b981'];
const FAULT_STATUS_COLORS: Record<string, string> = {
  unaddressed: '#ef4444',
  'in-progress': '#f59e0b',
  scheduled: '#3b82f6',
  resolved: '#10b981',
  ignored: '#94a3b8',
};

// ─── KPI Card ────────────────────────────────────────────────────────────────

function KpiCard({
  label, value, sub, icon: Icon, iconBg, to, bar,
}: {
  label: string;
  value: number | string;
  sub?: string;
  icon: React.ElementType;
  iconBg: string;
  to?: string;
  bar?: { pct: number; color: string };
}) {
  const body = (
    <div className="card p-4 h-full group hover:shadow-md transition-all">
      <div className="flex items-center gap-3">
        <div className={cn('w-10 h-10 rounded-xl flex items-center justify-center shrink-0', iconBg)}>
          <Icon className="w-5 h-5 text-white" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-2xl font-bold text-slate-900 dark:text-slate-100 leading-tight tabular-nums">{value}</p>
          <p className="text-xs font-medium text-slate-600 dark:text-slate-400 truncate">{label}</p>
        </div>
        {to && <ArrowRight className="w-4 h-4 text-slate-300 group-hover:text-brand-500 group-hover:translate-x-0.5 transition-all shrink-0" />}
      </div>
      {sub && <p className="text-xs text-slate-400 mt-2 truncate">{sub}</p>}
      {bar && (
        <div className="mt-2 h-1.5 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
          <div className={cn('h-full rounded-full transition-all', bar.color)} style={{ width: `${Math.min(bar.pct, 100)}%` }} />
        </div>
      )}
    </div>
  );
  return to ? <Link to={to} className="block h-full">{body}</Link> : body;
}

// ─── Fleet health bar ────────────────────────────────────────────────────────

function FleetHealth({ systems }: { systems: DashboardMetrics['systems'] }) {
  const segments = [
    { label: 'Active', value: systems.active, color: 'bg-emerald-500' },
    { label: 'Functional (idle)', value: Math.max(systems.functional - systems.active, 0), color: 'bg-sky-400' },
    { label: 'Critical', value: systems.critical, color: 'bg-red-500' },
  ];
  const total = systems.total || 1;
  return (
    <div className="card p-5">
      <div className="flex items-center justify-between mb-1">
        <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">Fleet Health</p>
        <span className="text-xs text-slate-400">{systems.total} systems</span>
      </div>
      <p className="text-xs text-slate-400 mb-4">Utilization {systems.utilization_pct}% · {systems.functional_pct}% functional</p>
      <div className="flex h-3 rounded-full overflow-hidden bg-slate-100 dark:bg-slate-800">
        {segments.map(s => s.value > 0 && (
          <div key={s.label} className={s.color} style={{ width: `${(s.value / total) * 100}%` }} title={`${s.label}: ${s.value}`} />
        ))}
      </div>
      <div className="flex flex-wrap gap-x-4 gap-y-1 mt-3">
        {segments.map(s => (
          <span key={s.label} className="flex items-center gap-1.5 text-xs text-slate-500">
            <span className={cn('w-2 h-2 rounded-full', s.color)} /> {s.label} ({s.value})
          </span>
        ))}
      </div>
    </div>
  );
}

// ─── Fault status breakdown (no chart — bar list) ────────────────────────────

function FaultBreakdownList({ byStatus }: { byStatus: Record<string, number> }) {
  const total = Object.values(byStatus).reduce((a, b) => a + b, 0) || 1;
  const order = ['unaddressed', 'in-progress', 'scheduled', 'resolved', 'ignored'];
  const rows = order.filter(k => byStatus[k]).map(k => ({ key: k, value: byStatus[k] }));
  return (
    <div className="card p-5">
      <p className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-4">Faults by Status</p>
      {rows.length === 0 ? (
        <p className="text-sm text-slate-400 text-center py-6">No faults recorded</p>
      ) : (
        <div className="space-y-3">
          {rows.map(({ key, value }) => (
            <div key={key}>
              <div className="flex items-center justify-between text-xs mb-1">
                <span className="capitalize text-slate-600 dark:text-slate-400">{key.replace(/-/g, ' ')}</span>
                <span className="font-semibold text-slate-800 dark:text-slate-200 tabular-nums">{value}</span>
              </div>
              <div className="h-2 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                <div
                  className="h-full rounded-full"
                  style={{ width: `${(value / total) * 100}%`, backgroundColor: FAULT_STATUS_COLORS[key] ?? '#94a3b8' }}
                />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Activity feed ───────────────────────────────────────────────────────────

function ActivityFeed({ items, title = 'Recent Activity' }: {
  items: DashboardMetrics['recent_activity'];
  title?: string;
}) {
  return (
    <div className="card p-5">
      <div className="flex items-center justify-between mb-4">
        <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">{title}</p>
        <Clock className="w-4 h-4 text-slate-400" />
      </div>
      {items.length === 0 ? (
        <p className="text-sm text-slate-400 text-center py-6">No recent activity</p>
      ) : (
        <div className="relative">
          <div className="absolute left-[13px] top-2 bottom-2 w-px bg-slate-100 dark:bg-slate-800" />
          <div className="space-y-4">
            {items.map((item, i) => (
              <div key={i} className="flex items-start gap-3 relative">
                <div className={cn(
                  'mt-0.5 w-7 h-7 rounded-full flex items-center justify-center shrink-0 ring-4 ring-white dark:ring-slate-900 z-10',
                  item.type === 'fault' ? 'bg-red-100 dark:bg-red-900/50' : 'bg-blue-100 dark:bg-blue-900/50',
                )}>
                  {item.type === 'fault'
                    ? <AlertTriangle className="w-3.5 h-3.5 text-red-600 dark:text-red-400" />
                    : <Package className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-slate-800 dark:text-slate-200 truncate">{item.title}</p>
                  <p className="text-xs text-slate-500 truncate flex items-center gap-1 flex-wrap">
                    <UserIcon className="w-3 h-3 shrink-0" />
                    <span>Created by <span className="font-medium text-slate-600 dark:text-slate-400">{item.user}</span></span>
                    <span className="text-slate-300 dark:text-slate-600">·</span>
                    {item.assignee ? (
                      <span>Handled by <span className="font-medium text-slate-600 dark:text-slate-400">{item.assignee}</span></span>
                    ) : (
                      <span className="italic text-slate-400">Unassigned</span>
                    )}
                  </p>
                </div>
                <div className="text-right shrink-0">
                  <StatusBadge status={item.status} />
                  <p className="text-xs text-slate-400 mt-1">{timeAgo(item.time)}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Filters ─────────────────────────────────────────────────────────────────

function useLayoutFilterOptions(enabled: boolean, buildingId: string, floorId: string) {
  const { data: rootItems = [] } = useQuery<LayoutItem[]>({
    queryKey: ['layout-items-root-dashboard'],
    queryFn: () => layoutApi.getItems({ parent_id: null }).then((r) => r.data as LayoutItem[]),
    enabled,
    staleTime: 60_000,
  });
  const { data: floorItems = [] } = useQuery<LayoutItem[]>({
    queryKey: ['layout-items-floor-dashboard', buildingId],
    queryFn: () => layoutApi.getItems({ parent_id: Number(buildingId) }).then((r) => r.data as LayoutItem[]),
    enabled: enabled && !!buildingId,
    staleTime: 60_000,
  });
  const { data: roomItems = [] } = useQuery<LayoutItem[]>({
    queryKey: ['layout-items-room-dashboard', floorId],
    queryFn: () => layoutApi.getItems({ parent_id: Number(floorId) }).then((r) => r.data as LayoutItem[]),
    enabled: enabled && !!floorId,
    staleTime: 60_000,
  });
  return {
    buildings: rootItems.filter((i) => i.item_type === 'building'),
    floors: floorItems.filter((i) => i.item_type === 'floor'),
    rooms: roomItems.filter((i) => i.item_type === 'room'),
  };
}

// ─── Main ────────────────────────────────────────────────────────────────────

export default function DashboardPage() {
  const { theme } = useTheme();
  const dark = theme === 'dark';
  const user = useAuthStore(s => s.user);
  const role = user?.role ?? 'No Roles';
  const isNoRole = role === 'No Roles';
  const isAdmin = role === 'Administrator';
  const isIncharge = role === 'Lab Incharge';
  const isAssistant = role === 'Lab Assistant';

  // Draft filter state (edited freely) vs applied state (fires the query).
  const [draft, setDraft] = useState({ buildingId: '', floorId: '', roomId: '', startDate: '', endDate: '' });
  const [applied, setApplied] = useState(draft);
  const [showFilters, setShowFilters] = useState(false);

  const { buildings, floors, rooms } = useLayoutFilterOptions(!isNoRole, draft.buildingId, draft.floorId);

  const metricParams = useMemo<DashboardFilterParams>(() => {
    const params: DashboardFilterParams = {};
    if (applied.buildingId) params.building_id = Number(applied.buildingId);
    if (applied.floorId) params.floor_id = Number(applied.floorId);
    if (applied.roomId) params.room_id = Number(applied.roomId);
    if (applied.startDate) params.start_date = applied.startDate;
    if (applied.endDate) params.end_date = applied.endDate;
    return params;
  }, [applied]);

  const hasActiveFilters = Object.keys(metricParams).length > 0;
  const hasDateFilter = !!(applied.startDate || applied.endDate);

  const { data, isLoading, isError, refetch, isFetching } = useQuery<DashboardMetrics>({
    queryKey: ['dashboard-metrics', metricParams],
    queryFn: () => dashboardApi.metrics(metricParams).then((r) => r.data),
    refetchInterval: 3_000,
    enabled: !isNoRole,
  });

  const tooltipStyle = {
    fontSize: 12, borderRadius: 8, border: 'none',
    boxShadow: '0 4px 20px rgba(0,0,0,.15)',
    backgroundColor: dark ? '#1e293b' : '#ffffff',
    color: dark ? '#f1f5f9' : '#0f172a',
  };
  const tooltipTextStyle = { color: dark ? '#f8fafc' : '#0f172a' };
  const gridStroke = dark ? '#334155' : '#e2e8f0';
  const tickFill = dark ? '#64748b' : '#94a3b8';

  // ── No role gate ────────────────────────────────────────────────────────
  if (isNoRole) {
    return (
      <div className="flex items-center justify-center min-h-[60vh] animate-fade-in">
        <div className="card p-8 max-w-md text-center space-y-4">
          <div className="w-14 h-14 mx-auto bg-amber-100 dark:bg-amber-900/40 rounded-full flex items-center justify-center">
            <AlertTriangle className="w-7 h-7 text-amber-600 dark:text-amber-400" />
          </div>
          <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">No Role Assigned</h2>
          <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
            Your account doesn't have a role yet, so NexusGrid features are unavailable.
            Please contact an administrator to get a role assigned to your account.
          </p>
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="space-y-4 animate-pulse">
        <div className="h-16 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800" />
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="h-28 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800" />
          ))}
        </div>
        <div className="h-64 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800" />
      </div>
    );
  }

  if (isError || !data) {
    return <ErrorState message="Failed to load dashboard metrics." onRetry={refetch} />;
  }

  const { systems, faults, resources, labs_total, fault_trend, resource_trend,
          fault_by_type, fault_by_status, recent_activity, today } = data;

  // Activity cards: today's numbers by default; range totals when a date filter is applied.
  const activityCards = hasDateFilter
    ? {
        title: 'Selected Period',
        faultsReported: faults.total,
        faultsResolved: fault_by_status['resolved'] ?? 0,
        requestsRaised: resources.total,
        requestsFulfilled: resources.fulfilled ?? 0,
      }
    : {
        title: 'Today',
        faultsReported: today?.faults_reported ?? 0,
        faultsResolved: today?.faults_resolved ?? 0,
        requestsRaised: today?.resources_requested ?? 0,
        requestsFulfilled: today?.resources_fulfilled ?? 0,
      };

  const trendData = fault_trend.map((f, i) => ({
    month: f.month,
    faults: f.count,
    resources: resource_trend[i]?.count ?? 0,
  }));
  const faultTypeData = Object.entries(fault_by_type).map(([name, value]) => ({ name, value }));

  return (
    <div className="space-y-5 animate-fade-in">
      {/* ── Header ── */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex-1 min-w-52">
          <h1 className="text-xl font-bold text-slate-900 dark:text-slate-100">
            {greeting()}, {user?.username}
          </h1>
          <p className="text-sm text-slate-500 mt-0.5">
            {isAdmin && 'Organization-wide overview of systems, faults, and resources.'}
            {isIncharge && 'Status of your labs and your submitted reports.'}
            {isAssistant && 'Your assigned labs, open faults, and pending requests.'}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => refetch()} className="btn-secondary" title="Refresh">
            <RefreshCw className={cn('w-4 h-4', isFetching && 'animate-spin')} />
          </button>
          <button
            type="button"
            className={cn('btn-secondary', hasActiveFilters && 'ring-2 ring-brand-500')}
            onClick={() => setShowFilters(p => !p)}
          >
            <Filter className="w-4 h-4" />
            Filters{hasActiveFilters ? ' •' : ''}
          </button>
        </div>
      </div>

      {/* ── Compact filter bar (apply-on-click) ── */}
      {showFilters && (
        <div className="card px-3 py-2.5 flex flex-wrap items-center gap-2">
          <select
            className="input !w-auto !py-1.5 text-sm" value={draft.buildingId}
            onChange={(e) => setDraft(d => ({ ...d, buildingId: e.target.value, floorId: '', roomId: '' }))}
          >
            <option value="">All Buildings</option>
            {buildings.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
          </select>
          <select
            className="input !w-auto !py-1.5 text-sm" value={draft.floorId} disabled={!draft.buildingId}
            onChange={(e) => setDraft(d => ({ ...d, floorId: e.target.value, roomId: '' }))}
          >
            <option value="">All Floors</option>
            {floors.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
          </select>
          <select
            className="input !w-auto !py-1.5 text-sm" value={draft.roomId} disabled={!draft.floorId}
            onChange={(e) => setDraft(d => ({ ...d, roomId: e.target.value }))}
          >
            <option value="">All Rooms</option>
            {rooms.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
          </select>
          <input
            type="date" className="input !w-auto !py-1.5 text-sm" value={draft.startDate}
            max={draft.endDate || undefined}
            onChange={(e) => setDraft(d => ({ ...d, startDate: e.target.value }))}
          />
          <span className="text-xs text-slate-400">to</span>
          <input
            type="date" className="input !w-auto !py-1.5 text-sm" value={draft.endDate}
            min={draft.startDate || undefined}
            onChange={(e) => setDraft(d => ({ ...d, endDate: e.target.value }))}
          />
          <div className="flex items-center gap-2 ml-auto">
            <button
              type="button" className="btn-secondary !py-1.5 text-sm"
              onClick={() => {
                const empty = { buildingId: '', floorId: '', roomId: '', startDate: '', endDate: '' };
                setDraft(empty);
                setApplied(empty);
              }}
            >
              Reset
            </button>
            <button type="button" className="btn-primary !py-1.5 text-sm" onClick={() => setApplied(draft)}>
              Apply
            </button>
          </div>
        </div>
      )}

      {/* ── Primary KPI row: current state ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard
          label="Active Systems"
          value={systems.active}
          sub={`${systems.active_pct}% of ${systems.total} systems online`}
          icon={Zap}
          iconBg="bg-emerald-500"
          bar={{ pct: systems.active_pct, color: 'bg-emerald-500' }}
        />
        <KpiCard
          label="Faulty Systems"
          value={systems.critical}
          sub={`${systems.critical_pct}% flagged high-risk`}
          icon={XCircle}
          iconBg="bg-red-500"
          to="/app/faults"
          bar={{ pct: systems.critical_pct, color: 'bg-red-500' }}
        />
        <KpiCard
          label="Open Faults"
          value={faults.open}
          sub={`${faults.total} reported in total`}
          icon={AlertTriangle}
          iconBg="bg-orange-500"
          to="/app/faults"
        />
        <KpiCard
          label="Pending Requests"
          value={resources.pending}
          sub={`${resources.fulfilled ?? 0} fulfilled · ${resources.total} total`}
          icon={Package}
          iconBg="bg-amber-500"
          to="/app/resources"
        />
      </div>

      {/* ── Activity KPI row: today by default, range when date filter applied ── */}
      <div>
        <p className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-2">
          {activityCards.title}
        </p>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <KpiCard label="Faults Reported" value={activityCards.faultsReported} icon={AlertTriangle} iconBg="bg-rose-500" to="/app/faults" />
          <KpiCard label="Faults Resolved" value={activityCards.faultsResolved} icon={CheckCircle2} iconBg="bg-emerald-600" to="/app/faults" />
          <KpiCard label="Requests Raised" value={activityCards.requestsRaised} icon={Package} iconBg="bg-sky-500" to="/app/resources" />
          <KpiCard label="Requests Fulfilled" value={activityCards.requestsFulfilled} icon={TrendingUp} iconBg="bg-indigo-500" to="/app/resources" />
        </div>
      </div>

      {/* ── Admin: secondary KPIs + charts ── */}
      {isAdmin && (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <KpiCard label="Total Labs" value={labs_total} icon={Building2} iconBg="bg-violet-500" to="/app/layout" />
            <KpiCard
              label="Functional Systems" value={systems.functional}
              sub={`${systems.functional_pct}% of fleet`} icon={Monitor} iconBg="bg-brand-600"
              bar={{ pct: systems.functional_pct, color: 'bg-brand-600' }}
            />
            <KpiCard label="Resolved Faults" value={fault_by_status['resolved'] ?? 0}
              sub="All-time resolutions" icon={ShieldCheck} iconBg="bg-teal-500" to="/app/reports" />
            <KpiCard label="Fulfilled Requests" value={resources.fulfilled ?? 0}
              sub={`of ${resources.total} total`} icon={TrendingUp} iconBg="bg-fuchsia-500" to="/app/reports" />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <div className="lg:col-span-2 card p-5">
              <p className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-4">Activity Trend (6 months)</p>
              {trendData.length === 0 ? (
                <div className="h-52 flex items-center justify-center text-sm text-slate-400">No trend data available</div>
              ) : (
                <ResponsiveContainer width="100%" height={230}>
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
                    <YAxis tick={{ fontSize: 11, fill: tickFill }} tickLine={false} axisLine={false} allowDecimals={false} />
                    <Tooltip contentStyle={tooltipStyle} labelStyle={tooltipTextStyle} itemStyle={tooltipTextStyle} />
                    <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 12 }} />
                    <Area type="monotone" dataKey="faults" name="Faults" stroke="#ef4444" strokeWidth={2} fill="url(#faultGrad)" />
                    <Area type="monotone" dataKey="resources" name="Resources" stroke="#3b82f6" strokeWidth={2} fill="url(#resourceGrad)" />
                  </AreaChart>
                </ResponsiveContainer>
              )}
            </div>

            <div className="card p-5">
              <p className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-4">Faults by Type</p>
              {faultTypeData.length === 0 ? (
                <div className="h-52 flex items-center justify-center text-sm text-slate-400">No fault data</div>
              ) : (
                <ResponsiveContainer width="100%" height={230}>
                  <PieChart>
                    <Pie data={faultTypeData} cx="50%" cy="50%" innerRadius={55} outerRadius={80} paddingAngle={3} dataKey="value">
                      {faultTypeData.map((_, i) => <Cell key={i} fill={FAULT_TYPE_COLORS[i % FAULT_TYPE_COLORS.length]} />)}
                    </Pie>
                    <Tooltip contentStyle={tooltipStyle} labelStyle={tooltipTextStyle} itemStyle={tooltipTextStyle} />
                    <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 12 }} />
                  </PieChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>
        </>
      )}

      {/* ── Assistant: system-focused stats, no statistical graphs ── */}
      {isAssistant && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <FleetHealth systems={systems} />
          <FaultBreakdownList byStatus={fault_by_status} />
          <div className="card p-5">
            <p className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-4">Faults by Type</p>
            {faultTypeData.length === 0 ? (
              <p className="text-sm text-slate-400 text-center py-6">No fault data</p>
            ) : (
              <ResponsiveContainer width="100%" height={180}>
                <BarChart data={faultTypeData} margin={{ top: 5, right: 5, bottom: 0, left: -25 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke={gridStroke} vertical={false} />
                  <XAxis dataKey="name" tick={{ fontSize: 11, fill: tickFill }} tickLine={false} axisLine={false} />
                  <YAxis tick={{ fontSize: 11, fill: tickFill }} tickLine={false} axisLine={false} allowDecimals={false} />
                  <Tooltip contentStyle={tooltipStyle} labelStyle={tooltipTextStyle} itemStyle={tooltipTextStyle} cursor={{ fill: 'transparent' }} />
                  <Bar dataKey="value" name="Faults" radius={[6, 6, 0, 0]}>
                    {faultTypeData.map((_, i) => <Cell key={i} fill={FAULT_TYPE_COLORS[i % FAULT_TYPE_COLORS.length]} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>
      )}

      {/* ── Incharge: fleet snapshot only (no statistics) ── */}
      {isIncharge && <FleetHealth systems={systems} />}

      {/* ── Recent activity ── */}
      <ActivityFeed
        items={recent_activity}
        title={isIncharge ? 'My Reports & Requests' : 'Recent Activity'}
      />
    </div>
  );
}