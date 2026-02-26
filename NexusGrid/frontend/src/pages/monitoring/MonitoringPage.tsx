import { useQuery } from '@tanstack/react-query';
import { Activity, RefreshCw, Wifi, WifiOff, Clock } from 'lucide-react';
import { monitoringApi } from '@/lib/api';
import { timeAgo, cn } from '@/lib/utils';
import type { SystemInfo } from '@/types';
import PageHeader from '@/components/common/PageHeader';
import ErrorState from '@/components/common/ErrorState';
import EmptyState from '@/components/common/EmptyState';

// ─── Gauge Bar ────────────────────────────────────────────────────────────────
function GaugeBar({ value, color }: { value: number | null; color: string }) {
  const pct = value ?? 0;
  return (
    <div>
      <div className="flex justify-between mb-1">
        <span className="text-xs text-slate-500">
          {value !== null ? `${pct.toFixed(1)}%` : 'N/A'}
        </span>
      </div>
      <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-500 ${color}`}
          style={{ width: `${Math.min(pct, 100)}%` }}
        />
      </div>
    </div>
  );
}

// ─── System Card ──────────────────────────────────────────────────────────────
function SystemCard({ info }: { info: SystemInfo }) {
  const isOnline = !!info.hostname;
  const cpuColor =
    (info.cpu_usage ?? 0) > 85 ? 'bg-red-500' :
    (info.cpu_usage ?? 0) > 60 ? 'bg-amber-500' : 'bg-emerald-500';
  const ramColor =
    (info.ram_usage ?? 0) > 85 ? 'bg-red-500' :
    (info.ram_usage ?? 0) > 60 ? 'bg-amber-500' : 'bg-brand-500';
  const diskColor =
    (info.disk_usage ?? 0) > 85 ? 'bg-red-500' :
    (info.disk_usage ?? 0) > 60 ? 'bg-amber-500' : 'bg-violet-500';

  return (
    <div className="card p-4 space-y-4">
      {/* Header */}
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-sm font-semibold text-slate-900 truncate">{info.hostname}</p>
          {info.ip_address && (
            <p className="text-xs text-slate-500 font-mono">{info.ip_address}</p>
          )}
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
          <span className="text-xs text-emerald-600 font-medium">Live</span>
        </div>
      </div>

      {/* OS */}
      {(info.os_name || info.os_version) && (
        <div className="px-3 py-2 bg-slate-50 rounded-lg">
          <p className="text-xs text-slate-600">
            {[info.os_name, info.os_version].filter(Boolean).join(' ')}
          </p>
        </div>
      )}

      {/* Metrics */}
      <div className="space-y-2.5">
        <div>
          <div className="flex justify-between mb-1">
            <span className="text-xs font-medium text-slate-600">CPU</span>
            <span className="text-xs font-semibold text-slate-800">
              {info.cpu_usage !== null ? `${info.cpu_usage.toFixed(1)}%` : '—'}
            </span>
          </div>
          <GaugeBar value={info.cpu_usage} color={cpuColor} />
        </div>
        <div>
          <div className="flex justify-between mb-1">
            <span className="text-xs font-medium text-slate-600">RAM</span>
            <span className="text-xs font-semibold text-slate-800">
              {info.ram_usage !== null ? `${info.ram_usage.toFixed(1)}%` : '—'}
            </span>
          </div>
          <GaugeBar value={info.ram_usage} color={ramColor} />
        </div>
        <div>
          <div className="flex justify-between mb-1">
            <span className="text-xs font-medium text-slate-600">Disk</span>
            <span className="text-xs font-semibold text-slate-800">
              {info.disk_usage !== null ? `${info.disk_usage.toFixed(1)}%` : '—'}
            </span>
          </div>
          <GaugeBar value={info.disk_usage} color={diskColor} />
        </div>
      </div>

      {/* Last seen */}
      <div className="flex items-center gap-1.5 text-xs text-slate-400 pt-1 border-t border-slate-100">
        <Clock className="w-3 h-3" />
        {timeAgo(info.timestamp)}
      </div>
    </div>
  );
}

// ─── Main Page ─────────────────────────────────────────────────────────────────
export default function MonitoringPage() {
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['monitoring'],
    queryFn: () => monitoringApi.latest().then(r => r.data),
    refetchInterval: 30_000, // auto-refresh every 30s
  });

  const systems = data?.systems ?? [];

  // Summary stats
  const highCpu = systems.filter(s => (s.cpu_usage ?? 0) > 85).length;
  const highRam = systems.filter(s => (s.ram_usage ?? 0) > 85).length;
  const highDisk = systems.filter(s => (s.disk_usage ?? 0) > 85).length;

  return (
    <div className="space-y-5 animate-fade-in">
      <PageHeader
        title="Live Monitoring"
        description="Real-time hardware metrics from monitored systems."
        actions={
          <button onClick={() => refetch()} className="btn-secondary">
            <RefreshCw className="w-4 h-4" /> Refresh
          </button>
        }
      />

      {/* Quick stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { label: 'Online Systems', value: systems.length, color: 'bg-emerald-100 text-emerald-700' },
          { label: 'CPU > 85%', value: highCpu, color: 'bg-red-100 text-red-700' },
          { label: 'RAM > 85%', value: highRam, color: 'bg-amber-100 text-amber-700' },
          { label: 'Disk > 85%', value: highDisk, color: 'bg-orange-100 text-orange-700' },
        ].map(s => (
          <div key={s.label} className={cn('card p-4 text-center', s.color)}>
            <p className="text-2xl font-bold">{s.value}</p>
            <p className="text-xs font-medium mt-1 opacity-80">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Grid */}
      {isError ? (
        <ErrorState message="Failed to load monitoring data." onRetry={refetch} />
      ) : isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="h-48 bg-white rounded-xl border border-slate-200 animate-pulse" />
          ))}
        </div>
      ) : systems.length === 0 ? (
        <EmptyState
          icon={<Activity className="w-7 h-7" />}
          title="No systems reporting data"
          description="Install the monitoring agent on lab computers to see live metrics here."
        />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {systems.map(info => (
            <SystemCard key={info.hostname} info={info} />
          ))}
        </div>
      )}

      <p className="text-xs text-slate-400 text-center">Auto-refreshes every 30 seconds</p>
    </div>
  );
}
