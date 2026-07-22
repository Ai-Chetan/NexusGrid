import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { Activity, RefreshCw, Clock, Search, ChevronDown, ChevronRight, Building2 } from 'lucide-react';
import { monitoringApi, layoutApi } from '@/lib/api';
import { timeAgo, cn } from '@/lib/utils';
import type { SystemInfo, SimpleSystem } from '@/types';
import PageHeader from '@/components/common/PageHeader';
import ErrorState from '@/components/common/ErrorState';
import EmptyState from '@/components/common/EmptyState';

// ─── Small usage pill ─────────────────────────────────────────────────────────
function UsagePill({ label, value }: { label: string; value: number | null }) {
  const tone =
    value == null ? 'bg-slate-100 text-slate-400 dark:bg-slate-800' :
    value > 85 ? 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300' :
    value > 60 ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300' :
    'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300';
  return (
    <span className={cn('inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-medium tabular-nums', tone)}>
      <span className="opacity-70">{label}</span>
      {value != null ? `${value.toFixed(0)}%` : '—'}
    </span>
  );
}

// ─── Compact system row ───────────────────────────────────────────────────────
function SystemRow({
  info,
  onOpen,
  clickable,
}: {
  info: SystemInfo;
  onOpen?: () => void;
  clickable?: boolean;
}) {
  const ramUsage = info.memory_usage_percent ?? info.ram_usage ?? null;
  const diskUsage = info.disk_usage_percent ?? info.disk_usage ?? null;

  return (
    <button
      type="button"
      onClick={onOpen}
      disabled={!clickable || !onOpen}
      className={cn(
        'w-full flex items-center gap-3 px-3 py-2.5 text-left rounded-lg border border-transparent transition',
        clickable
          ? 'hover:border-brand-300 hover:bg-brand-50/50 dark:hover:bg-brand-900/10 cursor-pointer'
          : 'cursor-default',
      )}
    >
      <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse shrink-0" />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-slate-800 dark:text-slate-200 truncate">{info.hostname}</p>
        <p className="text-xs text-slate-400 font-mono truncate">{info.ip_address ?? ''}</p>
      </div>
      <div className="hidden sm:flex items-center gap-1.5 shrink-0">
        <UsagePill label="CPU" value={info.cpu_usage ?? null} />
        <UsagePill label="RAM" value={ramUsage} />
        <UsagePill label="Disk" value={diskUsage} />
      </div>
      <span className="hidden md:flex items-center gap-1 text-xs text-slate-400 shrink-0 w-24 justify-end">
        <Clock className="w-3 h-3" /> {timeAgo(info.timestamp)}
      </span>
    </button>
  );
}

// ─── Main Page ─────────────────────────────────────────────────────────────────
export default function MonitoringPage() {
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [showHighOnly, setShowHighOnly] = useState(false);
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});

  const { data, isLoading, isError, refetch } = useQuery<{ systems: SystemInfo[] }>({
    queryKey: ['monitoring'],
    queryFn: () => monitoringApi.latest().then(r => r.data),
    refetchInterval: 30_000, // auto-refresh every 30s
  });

  const { data: knownSystems = [] } = useQuery<SimpleSystem[]>({
    queryKey: ['systems-list'],
    queryFn: () => layoutApi.getSystems().then(r => r.data as SimpleSystem[]),
    staleTime: 60_000,
  });

  const rawSystems = data?.systems ?? [];

  // Deduplicate: keep the latest snapshot per hostname
  const systems = useMemo(() => Object.values(
    rawSystems.reduce<Record<string, SystemInfo>>((acc, s) => {
      const key = s.hostname ?? s.ip_address ?? String(Math.random());
      if (!acc[key] || s.timestamp > acc[key].timestamp) acc[key] = s;
      return acc;
    }, {})
  ), [rawSystems]);

  const systemByHostname = useMemo(() => knownSystems.reduce<Record<string, SimpleSystem>>((acc, system) => {
    const key = (system.host_name ?? '').trim().toLowerCase();
    if (!key) return acc;
    acc[key] = system;
    return acc;
  }, {}), [knownSystems]);

  const isHigh = (s: SystemInfo) =>
    (s.cpu_usage ?? 0) > 85 ||
    ((s.memory_usage_percent ?? s.ram_usage ?? 0) > 85) ||
    ((s.disk_usage_percent ?? s.disk_usage ?? 0) > 85);

  // Summary stats
  const highCpu = systems.filter(s => (s.cpu_usage ?? 0) > 85).length;
  const highRam = systems.filter(s => ((s.memory_usage_percent ?? s.ram_usage ?? 0) > 85)).length;
  const highDisk = systems.filter(s => ((s.disk_usage_percent ?? s.disk_usage ?? 0) > 85)).length;

  // Filter + group by lab so 100+ systems stay navigable
  const grouped = useMemo(() => {
    const q = search.trim().toLowerCase();
    const filtered = systems.filter(s => {
      if (showHighOnly && !isHigh(s)) return false;
      if (!q) return true;
      return (s.hostname ?? '').toLowerCase().includes(q) ||
             (s.ip_address ?? '').toLowerCase().includes(q);
    });
    const groups: Record<string, SystemInfo[]> = {};
    for (const s of filtered) {
      const mapped = systemByHostname[(s.hostname ?? '').trim().toLowerCase()];
      const lab = mapped?.lab_name ?? 'Unassigned';
      (groups[lab] ??= []).push(s);
    }
    for (const list of Object.values(groups)) {
      list.sort((a, b) => (a.hostname ?? '').localeCompare(b.hostname ?? ''));
    }
    return Object.entries(groups).sort(([a], [b]) => a.localeCompare(b));
  }, [systems, search, showHighOnly, systemByHostname]);

  const openSystemDetail = (info: SystemInfo) => {
    const key = (info.hostname ?? '').trim().toLowerCase();
    const mapped = systemByHostname[key];
    if (!mapped?.layout_item_id) return;
    navigate(`/app/system/${mapped.layout_item_id}`);
  };

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
          { label: 'Online Systems', value: systems.length, color: 'bg-emerald-50 text-emerald-700' },
          { label: 'CPU > 85%',      value: highCpu,        color: 'bg-red-50 text-red-700' },
          { label: 'RAM > 85%',      value: highRam,        color: 'bg-amber-50 text-amber-700' },
          { label: 'Disk > 85%',     value: highDisk,       color: 'bg-orange-50 text-orange-700' },
        ].map(s => (
          <div key={s.label} className={cn('card p-4 text-center', s.color)}>
            <p className="text-2xl font-bold">{s.value}</p>
            <p className="text-xs font-medium mt-1 opacity-80">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Toolbar */}
      <div className="card p-3 flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-52 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            className="input pl-9"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search hostname or IP..."
          />
        </div>
        <button
          onClick={() => setShowHighOnly(v => !v)}
          className={cn(
            'px-3 py-1.5 rounded-full text-xs border transition-colors',
            showHighOnly
              ? 'bg-red-600 text-white border-red-600'
              : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300',
          )}
        >
          High usage only
        </button>
        <span className="text-xs text-slate-500 ml-auto">
          {grouped.reduce((n, [, list]) => n + list.length, 0)} systems shown
        </span>
      </div>

      {/* Grouped list */}
      {isError ? (
        <ErrorState message="Failed to load monitoring data." onRetry={refetch} />
      ) : isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-12 bg-white rounded-xl border border-slate-200 animate-pulse" />
          ))}
        </div>
      ) : systems.length === 0 ? (
        <EmptyState
          icon={<Activity className="w-7 h-7" />}
          title="No systems reporting data"
          description="Install the monitoring agent on lab computers to see live metrics here."
        />
      ) : grouped.length === 0 ? (
        <EmptyState
          icon={<Search className="w-7 h-7" />}
          title="No systems match your filters"
          description="Try a different search or turn off the high usage filter."
        />
      ) : (
        <div className="space-y-4">
          {grouped.map(([lab, list]) => {
            const isCollapsed = collapsed[lab] ?? false;
            const highCount = list.filter(isHigh).length;
            return (
              <section key={lab} className="card overflow-hidden">
                <button
                  type="button"
                  onClick={() => setCollapsed(c => ({ ...c, [lab]: !isCollapsed }))}
                  className="w-full flex items-center gap-2 px-4 py-3 bg-slate-50 dark:bg-slate-800/50 border-b border-slate-200 dark:border-slate-700 text-left"
                >
                  {isCollapsed ? <ChevronRight className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
                  <Building2 className="w-4 h-4 text-slate-500" />
                  <span className="text-sm font-semibold text-slate-700 dark:text-slate-300">{lab}</span>
                  <span className="text-xs px-1.5 py-0.5 rounded-full bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300">
                    {list.length}
                  </span>
                  {highCount > 0 && (
                    <span className="text-xs px-1.5 py-0.5 rounded-full bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300">
                      {highCount} high
                    </span>
                  )}
                </button>
                {!isCollapsed && (
                  <div className="divide-y divide-slate-100 dark:divide-slate-800 p-1">
                    {list.map(info => (
                      <SystemRow
                        key={`${info.hostname ?? info.ip_address}-${info.timestamp}`}
                        info={info}
                        clickable={!!systemByHostname[(info.hostname ?? '').trim().toLowerCase()]?.layout_item_id}
                        onOpen={() => openSystemDetail(info)}
                      />
                    ))}
                  </div>
                )}
              </section>
            );
          })}
        </div>
      )}

      <p className="text-xs text-slate-400 text-center">Auto-refreshes every 30 seconds</p>
    </div>
  );
}