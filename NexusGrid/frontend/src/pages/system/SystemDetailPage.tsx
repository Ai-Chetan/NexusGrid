import { useMemo, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Activity,
  AlertTriangle,
  ArrowLeft,
  Clock,
  Cpu,
  Download,
  HardDrive,
  MemoryStick,
  PackageSearch,
  QrCode,
  Server,
  Timer,
  Zap,
  ChevronDown,
} from 'lucide-react';
import {
  Area,
  AreaChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import QRCode from 'qrcode';
import toast from 'react-hot-toast';
import { faultsApi, layoutApi, resourcesApi } from '@/lib/api';
import { useAuthStore } from '@/store/authStore';
import { downloadQrPrintSheet } from '@/lib/qrPrint';
import type { FaultReport, LayoutItem, MonitoringHistoryResponse, ResourceRequest, SimpleSystem, SystemInfo } from '@/types';
import ErrorState from '@/components/common/ErrorState';
import EmptyState from '@/components/common/EmptyState';
import Modal from '@/components/common/Modal';
import { UptimeDrillDown } from '@/components/analytics/UptimeDrillDown';

function fmtPct(value: number | null | undefined) {
  return value == null ? 'N/A' : `${value.toFixed(1)}%`;
}

function fmtGb(value: number | null | undefined) {
  return value == null ? 'N/A' : `${value.toFixed(2)} GB`;
}

function fmtNumber(value: number | null | undefined) {
  return value == null ? 'N/A' : `${value}`;
}

function fmtTimestamp(value: string | null | undefined) {
  if (!value) return 'N/A';
  return new Date(value).toLocaleString();
}

function fmtUptime(seconds: number | null | undefined) {
  if (seconds == null) return 'N/A';
  const d = Math.floor(seconds / 86400);
  const h = Math.floor((seconds % 86400) / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (d > 0) return `${d}d ${h}h ${m}m`;
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

function fmtHours(hours: number) {
  const h = Math.floor(hours);
  const m = Math.round((hours - h) * 60);
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

function statusColor(value: number | null | undefined) {
  if (value == null) return 'text-slate-500';
  if (value > 85) return 'text-red-600';
  if (value > 65) return 'text-amber-600';
  return 'text-emerald-600';
}

function MetricCard({ label, value, sub, icon: Icon }: { label: string; value: string; sub?: string; icon: React.ElementType }) {
  return (
    <div className="card p-4">
      <div className="flex items-center justify-between">
        <p className="text-xs text-slate-500">{label}</p>
        <Icon className="w-4 h-4 text-slate-400" />
      </div>
      <p className="text-2xl font-bold text-slate-900 mt-2">{value}</p>
      {sub && <p className="text-xs text-slate-500 mt-1">{sub}</p>}
    </div>
  );
}

export default function SystemDetailPage() {
  const { itemId } = useParams<{ itemId: string }>();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const user = useAuthStore(s => s.user);
  const [searchParams] = useSearchParams();
  // Set when the user arrived here by scanning the system's QR/barcode.
  const scannedCode = searchParams.get('scan');
  // Only incharges and assistants may report faults / request resources.
  const canReport = user?.role === 'Lab Incharge' || user?.role === 'Lab Assistant';
  // Admins and assistants may update the PC's working status (also enforced by the API).
  const canUpdateStatus = user?.role === 'Administrator' || user?.role === 'Lab Assistant';

  const itemIdNum = Number(itemId);
  const [qrUrl, setQrUrl] = useState('');
  const [qrModalOpen, setQrModalOpen] = useState(false);
  const [faultModalOpen, setFaultModalOpen] = useState(false);
  const [resourceModalOpen, setResourceModalOpen] = useState(false);
  const [analyticsModalOpen, setAnalyticsModalOpen] = useState(false);
  const [faultType, setFaultType] = useState('Hardware');
  const [faultDesc, setFaultDesc] = useState('');
  const [resourceName, setResourceName] = useState('');
  const [resourceDesc, setResourceDesc] = useState('');

  const createFaultMutation = useMutation({
    mutationFn: (data: { fault_type: string; description: string; system_host_name: string }) =>
      faultsApi.create(data),
    onSuccess: () => {
      toast.success('Fault report submitted successfully');
      setFaultModalOpen(false);
      setFaultDesc('');
      qc.invalidateQueries({ queryKey: ['system-fault-history'] });
    },
    onError: () => {
      toast.error('Failed to submit fault report');
    },
  });

  const createResourceMutation = useMutation({
    mutationFn: (data: { resource_name: string; description: string; system_host_name: string }) =>
      resourcesApi.create(data),
    onSuccess: () => {
      toast.success('Resource request submitted successfully');
      setResourceModalOpen(false);
      setResourceName('');
      setResourceDesc('');
      qc.invalidateQueries({ queryKey: ['system-resource-history'] });
    },
    onError: () => {
      toast.error('Failed to submit resource request');
    },
  });

  const { data: item, isLoading: itemLoading, isError: itemError, refetch: refetchItem } = useQuery<LayoutItem>({
    queryKey: ['layout-item-detail', itemIdNum],
    queryFn: () => layoutApi.getItem(itemIdNum).then((r) => r.data as LayoutItem),
    enabled: Number.isFinite(itemIdNum),
  });

  const { data: breadcrumb = [] } = useQuery({
    queryKey: ['layout-breadcrumb', itemIdNum],
    queryFn: () => layoutApi.getBreadcrumb(itemIdNum).then((r) => r.data as Array<{ id: number; name: string; item_type: string }>),
    enabled: Number.isFinite(itemIdNum),
    retry: false,
  });

  const { data: systems = [] } = useQuery<SimpleSystem[]>({
    queryKey: ['systems-list'],
    queryFn: () => layoutApi.getSystems().then((r) => r.data as SimpleSystem[]),
    staleTime: 5_000,
    refetchInterval: 5_000,
  });

  const system = useMemo(() => systems.find((s) => s.layout_item_id === itemIdNum) ?? null, [systems, itemIdNum]);

  const { data: latest, isError: latestError } = useQuery<SystemInfo>({
    queryKey: ['item-monitoring-latest', itemIdNum],
    queryFn: () => layoutApi.getItemMonitoring(itemIdNum).then((r) => r.data as SystemInfo),
    enabled: Number.isFinite(itemIdNum),
    refetchInterval: 5_000,
  });

  const gpuStats = latest?.gpu_stats ?? [];
  const hasGpu = Boolean(latest?.gpu_available || (gpuStats && gpuStats.length > 0));

  const { data: historyResponse } = useQuery<MonitoringHistoryResponse>({
    queryKey: ['item-monitoring-history', itemIdNum],
    queryFn: () => layoutApi.getItemMonitoringHistory(itemIdNum, 120).then((r) => r.data as MonitoringHistoryResponse),
    enabled: Number.isFinite(itemIdNum),
    refetchInterval: 10_000,
  });

  const history = historyResponse?.history ?? [];



  const { data: faultsResponse } = useQuery<{ results: FaultReport[] }>({
    queryKey: ['system-fault-history', system?.host_name],
    queryFn: () => faultsApi.list({ search: system!.host_name, page_size: 50 }).then((r) => r.data as { results: FaultReport[] }),
    enabled: !!system?.host_name,
    staleTime: 30_000,
  });

  const { data: resourcesResponse } = useQuery<{ results: ResourceRequest[] }>({
    queryKey: ['system-resource-history', system?.host_name],
    queryFn: () => resourcesApi.list({ search: system!.host_name, page_size: 50 }).then((r) => r.data as { results: ResourceRequest[] }),
    enabled: !!system?.host_name,
    staleTime: 30_000,
  });

  const faultHistory = useMemo(() => {
    if (!system?.host_name) return [] as FaultReport[];
    const key = system.host_name.toLowerCase();
    return (faultsResponse?.results ?? []).filter((f) => f.system_host_name?.toLowerCase() === key);
  }, [faultsResponse?.results, system?.host_name]);

  const resourceHistory = useMemo(() => {
    if (!system?.host_name) return [] as ResourceRequest[];
    const key = system.host_name.toLowerCase();
    return (resourcesResponse?.results ?? []).filter((r) => r.system_host_name?.toLowerCase() === key);
  }, [resourcesResponse?.results, system?.host_name]);

  const roomCrumb = [...breadcrumb].reverse().find((c) => c.item_type === 'room');
  const roomName = roomCrumb?.name || system?.lab_name || 'Room';
  const labLocationLine = useMemo(() => {
    if (breadcrumb.length === 0) return roomName;
    const roomIndex = breadcrumb.findIndex((b) => b.item_type === 'room');
    const locationParts = roomIndex >= 0 ? breadcrumb.slice(0, roomIndex + 1) : breadcrumb;
    return locationParts.map((b) => b.name).join(' • ');
  }, [breadcrumb, roomName]);

  const chartData = useMemo(() => {
    return history.map((h) => {
      const dt = new Date(h.timestamp);
      const hh = `${dt.getHours()}`.padStart(2, '0');
      const mm = `${dt.getMinutes()}`.padStart(2, '0');
      return {
        time: `${hh}:${mm}`,
        cpu: h.cpu_usage,
        ram: h.memory_usage_percent,
        ramUsed: h.memory_used,
        ramTotal: h.memory_total,
        disk: h.disk_usage_percent,
        sent: h.bytes_sent,
        received: h.bytes_received,
      };
    });
  }, [history]);

  const ramCapacity = useMemo(() => {
    if (latest?.memory_total) return Math.ceil(latest.memory_total);
    if (chartData.length === 0) return 16;
    const max = Math.max(...chartData.map(d => d.ramTotal || 0));
    return max > 0 ? Math.ceil(max) : 16;
  }, [latest?.memory_total, chartData]);

  const faultMutation = useMutation({
    mutationFn: (payload: { system_id: number; fault_type: string; description: string }) => faultsApi.create(payload),
    onSuccess: () => {
      toast.success('Fault reported successfully.');
      setFaultDesc('');
      qc.invalidateQueries({ queryKey: ['faults'] });
    },
    onError: () => toast.error('Failed to report fault.'),
  });

  const resourceMutation = useMutation({
    mutationFn: (payload: { system_id: number; resource_name: string; description: string }) => resourcesApi.create(payload),
    onSuccess: () => {
      toast.success('Resource request created.');
      setResourceName('');
      setResourceDesc('');
      qc.invalidateQueries({ queryKey: ['resources'] });
    },
    onError: () => toast.error('Failed to request resource.'),
  });

  const statusMutation = useMutation({
    mutationFn: (status: string) => layoutApi.updateSystemStatus(system!.id, status),
    onSuccess: () => {
      toast.success('PC status updated.');
      qc.invalidateQueries({ queryKey: ['systems-list'] });
    },
    onError: () => toast.error('Failed to update PC status.'),
  });

  const ensureQrUrl = async (): Promise<string | null> => {
    if (!system?.unique_code) return null;
    if (qrUrl) return qrUrl;
    try {
      const generated = await QRCode.toDataURL(system.unique_code, {
        width: 320,
        margin: 2,
        errorCorrectionLevel: 'M',
      });
      setQrUrl(generated);
      return generated;
    } catch {
      toast.error('Failed to generate QR code.');
      return null;
    }
  };

  const handleShowQr = async () => {
    const generated = await ensureQrUrl();
    if (!generated) return;
    setQrModalOpen(true);
  };

  const downloadQr = async () => {
    if (!system) return;
    const sourceUrl = await ensureQrUrl();
    if (!sourceUrl) return;

    await downloadQrPrintSheet({
      locationLine: labLocationLine,
      fileNameBase: `${roomName}-${system.host_name}`,
      entries: [
        {
          roomName,
          hostName: system.host_name,
          uniqueCode: system.unique_code,
          qrDataUrl: sourceUrl,
        },
      ],
    });
  };

  if (!Number.isFinite(itemIdNum)) {
    return <ErrorState message="Invalid system id." onRetry={() => navigate('/app/layout')} />;
  }

  if (itemError) {
    return <ErrorState message="Failed to load system details." onRetry={refetchItem} />;
  }

  if (itemLoading || !item) {
    return (
      <div className="card p-6 animate-pulse">
        <div className="h-8 w-64 bg-slate-100 rounded" />
        <div className="mt-4 h-48 bg-slate-100 rounded" />
      </div>
    );
  }

  return (
    <div className="space-y-5 animate-fade-in">
      {/* Header bar */}
      <div className="flex items-center justify-between gap-4">
        <div>
          <button onClick={() => navigate(roomCrumb ? `/app/layout/${roomCrumb.id}` : '/app/layout')} className="inline-flex items-center gap-1.5 text-xs text-slate-500 hover:text-brand-600 mb-2 transition-colors">
            <ArrowLeft className="w-4 h-4" /> Back to Layout
          </button>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">{item.name}</h1>
            {hasGpu ? (
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300">
                <Zap className="w-3 h-3" /> GPU Active
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-400 dark:bg-slate-800 dark:text-slate-500">
                GPU: Not Available
              </span>
            )}
          </div>
          <p className="text-sm text-slate-500 mt-1">
            {item.item_type.replace(/_/g, ' ')}{system?.lab_name ? ` • ${system.lab_name}` : ''}
          </p>
        </div>
        <button onClick={handleShowQr} disabled={!system?.unique_code} className="btn-secondary disabled:opacity-40 disabled:cursor-not-allowed">
          <QrCode className="w-4 h-4" /> Show QR
        </button>
      </div>

      {/* Top Metric Cards */}
      <div className={`grid grid-cols-2 ${hasGpu ? 'md:grid-cols-3 lg:grid-cols-6' : 'lg:grid-cols-5'} gap-4`}>
        <MetricCard
          label="CPU Usage"
          value={fmtPct(latest?.cpu_usage)}
          sub={latest?.processor ? `${latest.processor.replace(/Intel\(R\)|Core\(TM\)|Processor|CPU|12th Gen|11th Gen|10th Gen|13th Gen|14th Gen/gi, '').trim()} (${latest?.cpu_total_cores ?? '?'} cores)` : (latest?.cpu_total_cores ? `${latest.cpu_total_cores} cores` : undefined)}
          icon={Cpu}
        />
        <MetricCard label="Memory Usage" value={fmtPct(latest?.memory_usage_percent)} sub={`${fmtGb(latest?.memory_used)} / ${fmtGb(latest?.memory_total)}`} icon={MemoryStick} />
        {hasGpu && (
          <MetricCard
            label="GPU Usage"
            value={gpuStats && gpuStats.length > 0 ? fmtPct(gpuStats[0].gpu_load_percent) : 'Detected'}
            sub={gpuStats && gpuStats.length > 0 ? `${gpuStats[0].gpu_name} (${gpuStats[0].gpu_temperature ? `${gpuStats[0].gpu_temperature}°C` : 'No temp'})` : 'GPU Available'}
            icon={Zap}
          />
        )}
        <MetricCard label="Disk Usage" value={fmtPct(latest?.disk_usage_percent)} sub={`${fmtGb(latest?.disk_used)} / ${fmtGb(latest?.disk_total)}`} icon={HardDrive} />
        <MetricCard 
          label="Uptime" 
          value={fmtUptime(
            latest?.today_uptime_seconds != null ? latest.today_uptime_seconds : 
            (latest?.boot_time != null ? (() => {
              const now = new Date();
              const midnight = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
              const bootTs = latest.boot_time * 1000;
              return Math.max(0, (now.getTime() - Math.min(bootTs, midnight)) / 1000);
            })() : latest?.uptime_seconds)
          )} 
          sub={latest?.today_uptime_seconds != null || latest?.boot_time != null ? 'Today' : undefined} 
          icon={Timer} 
        />
        <MetricCard label="Last Seen" value={latest ? new Date(latest.timestamp).toLocaleTimeString() : 'N/A'} sub={latest?.ip_address ?? undefined} icon={Clock} />
      </div>

      {/* Snapshot Details */}
      <div className="card p-5">
        <div className="flex items-center justify-between mb-4 border-b border-slate-100 dark:border-slate-800 pb-3">
          <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">System Specifications & Telemetry</p>
          {!hasGpu && (
            <span className="text-xs text-slate-400 bg-slate-100 dark:bg-slate-800 px-2.5 py-1 rounded-md font-mono">
              GPU: Not Available
            </span>
          )}
        </div>
        {!latest ? (
          <p className="text-sm text-slate-500">No latest snapshot available.</p>
        ) : (
          <div className={`grid grid-cols-1 md:grid-cols-2 ${hasGpu ? 'xl:grid-cols-4' : 'xl:grid-cols-3'} gap-6 text-sm`}>
            {/* Column 1: System & Identity */}
            <div className="space-y-2">
              <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">System & Identity</p>
              <p className="flex justify-between"><span className="text-slate-500">Hostname:</span> <span className="font-medium text-slate-800 dark:text-slate-200">{latest.hostname || 'N/A'}</span></p>
              <p className="flex justify-between"><span className="text-slate-500">IP Address:</span> <span className="font-mono text-slate-800 dark:text-slate-200">{latest.ip_address || 'N/A'}</span></p>
              <p className="flex justify-between"><span className="text-slate-500">OS:</span> <span className="font-medium text-slate-800 dark:text-slate-200">{[latest.system, latest.release].filter(Boolean).join(' ') || 'N/A'}</span></p>
              <p className="flex justify-between"><span className="text-slate-500">Architecture:</span> <span className="font-medium text-slate-800 dark:text-slate-200">{latest.architecture || 'N/A'}</span></p>
              <p className="flex justify-between"><span className="text-slate-500">Last Telemetry:</span> <span className="font-medium text-slate-800 dark:text-slate-200">{fmtTimestamp(latest.timestamp)}</span></p>
            </div>

            {/* Column 2: Processor & CPU */}
            <div className="space-y-2">
              <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Processor & CPU</p>
              <p className="flex justify-between items-start gap-2">
                <span className="text-slate-500 shrink-0">Processor:</span>
                <span className="font-bold text-slate-900 dark:text-slate-100 text-right leading-tight break-words">{latest.processor || 'N/A'}</span>
              </p>
              <p className="flex justify-between"><span className="text-slate-500">Cores:</span> <span className="font-medium text-slate-800 dark:text-slate-200">{fmtNumber(latest.cpu_physical_cores)} physical / {fmtNumber(latest.cpu_total_cores)} logical</span></p>
              <p className="flex justify-between"><span className="text-slate-500">Current Freq:</span> <span className="font-medium text-slate-800 dark:text-slate-200">{fmtNumber(latest.cpu_current_freq)} MHz</span></p>
              <p className="flex justify-between"><span className="text-slate-500">Max Freq:</span> <span className="font-medium text-slate-800 dark:text-slate-200">{fmtNumber(latest.cpu_max_freq)} MHz</span></p>
            </div>

            {/* Column 3: Memory & Storage */}
            <div className="space-y-2">
              <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Memory & Storage</p>
              <p className="flex justify-between"><span className="text-slate-500">RAM Total:</span> <span className="font-medium text-slate-800 dark:text-slate-200">{fmtGb(latest.memory_total)}</span></p>
              <p className="flex justify-between"><span className="text-slate-500">RAM Used / Available:</span> <span className="font-medium text-slate-800 dark:text-slate-200">{fmtGb(latest.memory_used)} / {fmtGb(latest.memory_available)}</span></p>
              <p className="flex justify-between"><span className="text-slate-500">Disk Total:</span> <span className="font-medium text-slate-800 dark:text-slate-200">{fmtGb(latest.disk_total)}</span></p>
              <p className="flex justify-between"><span className="text-slate-500">Disk Used / Free:</span> <span className="font-medium text-slate-800 dark:text-slate-200">{fmtGb(latest.disk_used)} / {fmtGb(latest.disk_free)}</span></p>
            </div>

            {/* Column 4: Dedicated GPU (only if detected) */}
            {hasGpu && (
              <div className="space-y-2">
                <p className="text-xs font-bold text-purple-600 dark:text-purple-400 uppercase tracking-wider">Dedicated GPU</p>
                {gpuStats && gpuStats.length > 0 ? (
                  gpuStats.map((gpu) => (
                    <div key={gpu.gpu_id} className="space-y-1.5 pt-1">
                      <p className="font-bold text-slate-900 dark:text-slate-100">{gpu.gpu_name || `GPU #${gpu.gpu_id}`}</p>
                      <p className="flex justify-between"><span className="text-slate-500">GPU Load:</span> <span className="font-medium text-slate-800 dark:text-slate-200">{gpu.gpu_load_percent != null ? `${gpu.gpu_load_percent.toFixed(1)}%` : 'N/A'}</span></p>
                      <p className="flex justify-between"><span className="text-slate-500">VRAM Used:</span> <span className="font-medium text-slate-800 dark:text-slate-200">{(gpu.gpu_memory_used / 1024).toFixed(2)} GB / {(gpu.gpu_memory_total / 1024).toFixed(2)} GB</span></p>
                      <p className="flex justify-between"><span className="text-slate-500">VRAM Usage:</span> <span className="font-medium text-slate-800 dark:text-slate-200">{gpu.gpu_memory_percent != null ? `${gpu.gpu_memory_percent.toFixed(1)}%` : 'N/A'}</span></p>
                      <p className="flex justify-between"><span className="text-slate-500">Temperature:</span> <span className="font-medium text-slate-800 dark:text-slate-200">{gpu.gpu_temperature != null ? `${gpu.gpu_temperature}°C` : 'N/A'}</span></p>
                    </div>
                  ))
                ) : (
                  <p className="text-xs text-purple-600 dark:text-purple-400 font-medium">GPU Detected</p>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {canReport && (
        <div className="card p-5 space-y-4">
          <p className="text-sm font-semibold text-slate-700">Quick Reporting</p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="rounded-lg border border-slate-200 p-3 space-y-2">
              <p className="text-xs font-semibold text-slate-700">Report Fault</p>
              <select value={faultType} onChange={(e) => setFaultType(e.target.value)} className="input">
                <option value="Hardware">Hardware</option>
                <option value="Software">Software</option>
                <option value="Network">Network</option>
              </select>
              <textarea
                className="input min-h-[82px] resize-none"
                value={faultDesc}
                onChange={(e) => setFaultDesc(e.target.value)}
                placeholder="Describe the issue..."
              />
              <button
                onClick={() => system && faultMutation.mutate({ system_id: system.id, fault_type: faultType, description: faultDesc })}
                disabled={!system || !faultDesc.trim() || faultMutation.isPending}
                className="btn-danger w-full"
              >
                <AlertTriangle className="w-4 h-4" /> Submit Fault
              </button>
            </div>

            <div className="rounded-lg border border-slate-200 p-3 space-y-2">
              <p className="text-xs font-semibold text-slate-700">Request Resource</p>
              <input
                className="input"
                value={resourceName}
                onChange={(e) => setResourceName(e.target.value)}
                placeholder="Resource name"
              />
              <textarea
                className="input min-h-[82px] resize-none"
                value={resourceDesc}
                onChange={(e) => setResourceDesc(e.target.value)}
                placeholder="Describe resource needed..."
              />
              <button
                onClick={() => system && resourceMutation.mutate({ system_id: system.id, resource_name: resourceName, description: resourceDesc })}
                disabled={!system || !resourceName.trim() || !resourceDesc.trim() || resourceMutation.isPending}
                className="btn-primary w-full"
              >
                <PackageSearch className="w-4 h-4" /> Request Resource
              </button>
            </div>
          </div>
          {!system && <p className="text-xs text-amber-600">System record is missing for this layout item, so reporting is disabled.</p>}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* CPU */}
        <div className="card p-5">
          <div className="flex items-center justify-between mb-3">
            <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">CPU Usage</p>
            <Cpu className="w-4 h-4 text-slate-400" />
          </div>
          {chartData.length === 0 ? (
            <EmptyState
              icon={<Server className="w-6 h-6" />}
              title="No data"
              description="Waiting for snapshots."
            />
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <LineChart data={chartData} margin={{ top: 10, right: 10, left: -15, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="time" tick={{ fontSize: 11, fill: '#64748b' }} />
                <YAxis domain={[0, 100]} tick={{ fontSize: 11, fill: '#64748b' }} tickFormatter={(val) => `${val}%`} />
                <Tooltip formatter={(val: number) => [`${val.toFixed(1)}%`, 'CPU Usage']} />
                <Line type="monotone" dataKey="cpu" name="CPU" stroke="#ef4444" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* RAM */}
        <div className="card p-5">
          <div className="flex items-center justify-between mb-3">
            <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">Memory Usage</p>
            <MemoryStick className="w-4 h-4 text-slate-400" />
          </div>
          {chartData.length === 0 ? (
            <EmptyState
              icon={<Server className="w-6 h-6" />}
              title="No data"
              description="Waiting for snapshots."
            />
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <LineChart data={chartData} margin={{ top: 10, right: 10, left: -15, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="time" tick={{ fontSize: 11, fill: '#64748b' }} />
                <YAxis domain={[0, ramCapacity]} tick={{ fontSize: 11, fill: '#64748b' }} tickFormatter={(val) => `${val}GB`} />
                <Tooltip formatter={(val: number) => [`${val.toFixed(2)} GB`, 'RAM Used']} />
                <Line type="monotone" dataKey="ramUsed" name="RAM" stroke="#3b82f6" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Disk */}
        <div className="card p-5">
          <div className="flex items-center justify-between mb-3">
            <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">Disk Usage</p>
            <HardDrive className="w-4 h-4 text-slate-400" />
          </div>
          {chartData.length === 0 ? (
            <EmptyState
              icon={<Server className="w-6 h-6" />}
              title="No data"
              description="Waiting for snapshots."
            />
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <LineChart data={chartData} margin={{ top: 10, right: 10, left: -15, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="time" tick={{ fontSize: 11, fill: '#64748b' }} />
                <YAxis domain={[0, 100]} tick={{ fontSize: 11, fill: '#64748b' }} tickFormatter={(val) => `${val}%`} />
                <Tooltip formatter={(val: number) => [`${val.toFixed(1)}%`, 'Disk Usage']} />
                <Line type="monotone" dataKey="disk" name="Disk" stroke="#8b5cf6" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* Analytics Uptime Drill Down */}
      <div className="card p-5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm">
         <UptimeDrillDown itemId={itemIdNum} hostname={system?.host_name || ''} />
      </div>

      <div className="grid gap-4">
        <div className="card p-5">
          <p className="text-sm font-semibold text-slate-700 mb-3">Network Throughput History</p>
          {chartData.length === 0 ? (
            <p className="text-sm text-slate-500">No network history yet.</p>
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <AreaChart data={chartData} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="sentGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.35} />
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="recvGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#06b6d4" stopOpacity={0.35} />
                    <stop offset="95%" stopColor="#06b6d4" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="time" tick={{ fontSize: 11, fill: '#64748b' }} />
                <YAxis tick={{ fontSize: 11, fill: '#64748b' }} />
                <Tooltip />
                <Area type="monotone" dataKey="sent" stroke="#10b981" fill="url(#sentGrad)" name="Bytes Sent" />
                <Area type="monotone" dataKey="received" stroke="#06b6d4" fill="url(#recvGrad)" name="Bytes Received" />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      <div className="card p-5">
        <details className="group">
          <summary className="text-sm font-semibold text-slate-700 cursor-pointer list-none flex items-center justify-between outline-none">
            Recent Snapshots
            <span className="transition group-open:rotate-180">
              <ChevronDown className="w-4 h-4 text-slate-400" />
            </span>
          </summary>
          <div className="mt-4">
            {history.length === 0 ? (
              <p className="text-sm text-slate-500">No historical snapshots yet.</p>
            ) : (
              <div className="overflow-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-slate-500 border-b border-slate-200">
                      <th className="py-2 pr-3">Timestamp</th>
                      <th className="py-2 pr-3">CPU</th>
                      <th className="py-2 pr-3">RAM</th>
                      <th className="py-2 pr-3">Disk</th>
                      <th className="py-2 pr-3">Users</th>
                    </tr>
                  </thead>
                  <tbody>
                    {history.slice().reverse().slice(0, 5).map((h) => (
                      <tr key={`${h.hostname}-${h.timestamp}`} className="border-b border-slate-100">
                        <td className="py-2 pr-3 text-slate-600">{new Date(h.timestamp).toLocaleString()}</td>
                        <td className="py-2 pr-3">{fmtPct(h.cpu_usage)}</td>
                        <td className="py-2 pr-3">{fmtPct(h.memory_usage_percent)}</td>
                        <td className="py-2 pr-3">{fmtPct(h.disk_usage_percent)}</td>
                        <td className="py-2 pr-3">{h.users_count ?? 0}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </details>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        <div className="card p-5">
          <p className="text-sm font-semibold text-slate-700 mb-3">Fault History ({faultHistory.length})</p>
          {faultHistory.length === 0 ? (
            <p className="text-sm text-slate-500">No fault reports for this system.</p>
          ) : (
            <div className="space-y-2">
              {faultHistory.slice(0, 8).map((fault) => (
                <div key={fault.fault_id} className="rounded-lg border border-slate-200 p-3">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-sm font-medium text-slate-800">{fault.fault_type}</p>
                    <span className="text-xs text-slate-500 capitalize">{fault.status}</span>
                  </div>
                  <p className="text-xs text-slate-600 mt-1">{fault.description}</p>
                  <p className="text-xs text-slate-400 mt-1">{new Date(fault.reported_at).toLocaleString()}</p>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="card p-5">
          <p className="text-sm font-semibold text-slate-700 mb-3">Resource History ({resourceHistory.length})</p>
          {resourceHistory.length === 0 ? (
            <p className="text-sm text-slate-500">No resource requests for this system.</p>
          ) : (
            <div className="space-y-2">
              {resourceHistory.slice(0, 8).map((resource) => (
                <div key={resource.resource_id} className="rounded-lg border border-slate-200 p-3">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-sm font-medium text-slate-800">{resource.resource_name}</p>
                    <span className="text-xs text-slate-500">{resource.status}</span>
                  </div>
                  <p className="text-xs text-slate-600 mt-1">{resource.description}</p>
                  <p className="text-xs text-slate-400 mt-1">{new Date(resource.requested_at).toLocaleString()}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <Modal
        open={qrModalOpen}
        onClose={() => setQrModalOpen(false)}
        title={`${roomName} - ${system?.host_name ?? item.name}`}
        size="sm"
      >
        <div className="space-y-4">
          <div className="rounded-xl border border-slate-200 dark:border-slate-700 p-3 bg-white dark:bg-slate-900">
            {qrUrl ? (
              <img src={qrUrl} alt="System QR" className="w-full h-auto rounded-lg" />
            ) : (
              <div className="h-48 rounded-lg border border-dashed border-slate-200 flex items-center justify-center text-sm text-slate-400">
                Generating QR...
              </div>
            )}
            <p className="text-xs text-center text-slate-500 dark:text-slate-400 mt-2">{system?.unique_code ?? 'N/A'}</p>
          </div>

          <div className="flex gap-2">
            <button onClick={() => setQrModalOpen(false)} className="btn-secondary flex-1">Close</button>
            <button onClick={downloadQr} disabled={!system?.unique_code} className="btn-primary flex-1 disabled:opacity-40 disabled:cursor-not-allowed">
              <Download className="w-4 h-4" /> Download QR
            </button>
          </div>
        </div>
      </Modal>

      {/* Fault Report Modal */}
      <Modal
        open={faultModalOpen}
        onClose={() => setFaultModalOpen(false)}
        title={`Report Hardware Fault - ${system?.host_name ?? item.name}`}
        size="md"
      >
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (!faultDesc.trim()) return;
            createFaultMutation.mutate({
              fault_type: faultType,
              description: faultDesc,
              system_host_name: system?.host_name ?? item.name,
            });
          }}
          className="space-y-4"
        >
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Fault Category</label>
            <select
              value={faultType}
              onChange={(e) => setFaultType(e.target.value)}
              className="w-full text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-2.5"
            >
              <option value="Hardware">Hardware Fault</option>
              <option value="Display / Monitor">Display / Monitor</option>
              <option value="GPU / Graphics">GPU / Graphics Fault</option>
              <option value="Peripherals">Peripherals (Keyboard/Mouse)</option>
              <option value="Network">Network / Connectivity</option>
              <option value="Power / UPS">Power / UPS</option>
              <option value="Other">Other Issue</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Issue Description</label>
            <textarea
              rows={3}
              value={faultDesc}
              onChange={(e) => setFaultDesc(e.target.value)}
              placeholder="Describe the issue observed on this machine..."
              className="w-full text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-2.5"
              required
            />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={() => setFaultModalOpen(false)} className="btn-secondary">Cancel</button>
            <button type="submit" disabled={createFaultMutation.isPending} className="btn-primary">
              {createFaultMutation.isPending ? 'Submitting...' : 'Submit Report'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Resource Request Modal */}
      <Modal
        open={resourceModalOpen}
        onClose={() => setResourceModalOpen(false)}
        title={`Request Resource - ${system?.host_name ?? item.name}`}
        size="md"
      >
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (!resourceName.trim() || !resourceDesc.trim()) return;
            createResourceMutation.mutate({
              resource_name: resourceName,
              description: resourceDesc,
              system_host_name: system?.host_name ?? item.name,
            });
          }}
          className="space-y-4"
        >
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Requested Component / Component Name</label>
            <input
              type="text"
              value={resourceName}
              onChange={(e) => setResourceName(e.target.value)}
              placeholder="e.g. 16GB RAM module, HDMI cable, GPU upgrade..."
              className="w-full text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-2.5"
              required
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Justification / Details</label>
            <textarea
              rows={3}
              value={resourceDesc}
              onChange={(e) => setResourceDesc(e.target.value)}
              placeholder="Provide reason for this resource request..."
              className="w-full text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-2.5"
              required
            />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={() => setResourceModalOpen(false)} className="btn-secondary">Cancel</button>
            <button type="submit" disabled={createResourceMutation.isPending} className="btn-primary">
              {createResourceMutation.isPending ? 'Submitting...' : 'Submit Request'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
