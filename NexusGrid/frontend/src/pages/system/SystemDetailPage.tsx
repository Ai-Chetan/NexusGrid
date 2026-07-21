import { useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
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
import { downloadQrPrintSheet } from '@/lib/qrPrint';
import type { FaultReport, LayoutItem, MonitoringHistoryResponse, ResourceRequest, SimpleSystem, SystemInfo } from '@/types';
import ErrorState from '@/components/common/ErrorState';
import EmptyState from '@/components/common/EmptyState';
import Modal from '@/components/common/Modal';

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

  const itemIdNum = Number(itemId);
  const [qrUrl, setQrUrl] = useState('');
  const [qrModalOpen, setQrModalOpen] = useState(false);
  const [faultType, setFaultType] = useState('Hardware');
  const [faultDesc, setFaultDesc] = useState('');
  const [resourceName, setResourceName] = useState('');
  const [resourceDesc, setResourceDesc] = useState('');

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
    staleTime: 60_000,
  });

  const system = useMemo(() => systems.find((s) => s.layout_item_id === itemIdNum) ?? null, [systems, itemIdNum]);

  const { data: latest, isError: latestError } = useQuery<SystemInfo>({
    queryKey: ['item-monitoring-latest', itemIdNum],
    queryFn: () => layoutApi.getItemMonitoring(itemIdNum).then((r) => r.data as SystemInfo),
    enabled: Number.isFinite(itemIdNum),
    refetchInterval: 30_000,
  });

  const { data: historyResponse } = useQuery<MonitoringHistoryResponse>({
    queryKey: ['item-monitoring-history', itemIdNum],
    queryFn: () => layoutApi.getItemMonitoringHistory(itemIdNum, 120).then((r) => r.data as MonitoringHistoryResponse),
    enabled: Number.isFinite(itemIdNum),
    refetchInterval: 60_000,
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
        disk: h.disk_usage_percent,
        sent: h.bytes_sent,
        received: h.bytes_received,
      };
    });
  }, [history]);

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
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <button onClick={() => navigate(roomCrumb ? `/app/layout/${roomCrumb.id}` : '/app/layout')} className="btn-secondary mb-3">
            <ArrowLeft className="w-4 h-4" /> Back to Layout
          </button>
          <h1 className="text-2xl font-bold text-slate-900">{item.name}</h1>
          <p className="text-sm text-slate-500 mt-1">
            {item.item_type.replace(/_/g, ' ')}{system?.lab_name ? ` • ${system.lab_name}` : ''}
          </p>
        </div>
        <button onClick={handleShowQr} disabled={!system?.unique_code} className="btn-secondary disabled:opacity-40 disabled:cursor-not-allowed">
          <QrCode className="w-4 h-4" /> Show QR
        </button>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard label="CPU Usage" value={fmtPct(latest?.cpu_usage)} sub={latest?.cpu_total_cores ? `${latest.cpu_total_cores} cores` : undefined} icon={Cpu} />
        <MetricCard label="Memory Usage" value={fmtPct(latest?.memory_usage_percent)} sub={`${fmtGb(latest?.memory_used)} / ${fmtGb(latest?.memory_total)}`} icon={MemoryStick} />
        <MetricCard label="Disk Usage" value={fmtPct(latest?.disk_usage_percent)} sub={`${fmtGb(latest?.disk_used)} / ${fmtGb(latest?.disk_total)}`} icon={HardDrive} />
        <MetricCard label="Last Seen" value={latest ? new Date(latest.timestamp).toLocaleTimeString() : 'N/A'} sub={latest?.ip_address ?? undefined} icon={Clock} />
      </div>

      <div className="card p-5">
        <p className="text-sm font-semibold text-slate-700 mb-4">System Snapshot Details</p>
        {!latest ? (
          <p className="text-sm text-slate-500">No latest snapshot available.</p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 text-sm">
            <div className="space-y-1.5">
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Identity</p>
              <p><span className="text-slate-500">Snapshot ID:</span> <span className="font-medium">{fmtNumber(latest.id)}</span></p>
              <p><span className="text-slate-500">Hostname:</span> <span className="font-medium">{latest.hostname || 'N/A'}</span></p>
              <p><span className="text-slate-500">IP Address:</span> <span className="font-medium">{latest.ip_address || 'N/A'}</span></p>
              <p><span className="text-slate-500">Timestamp:</span> <span className="font-medium">{fmtTimestamp(latest.timestamp)}</span></p>
            </div>

            <div className="space-y-1.5">
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">OS & Hardware</p>
              <p><span className="text-slate-500">System:</span> <span className="font-medium">{latest.system || 'N/A'}</span></p>
              <p><span className="text-slate-500">Release:</span> <span className="font-medium">{latest.release || 'N/A'}</span></p>
              <p><span className="text-slate-500">Version:</span> <span className="font-medium">{latest.version || 'N/A'}</span></p>
              <p><span className="text-slate-500">Machine:</span> <span className="font-medium">{latest.machine || 'N/A'}</span></p>
              <p><span className="text-slate-500">Architecture:</span> <span className="font-medium">{latest.architecture || 'N/A'}</span></p>
              <p><span className="text-slate-500">Processor:</span> <span className="font-medium">{latest.processor || 'N/A'}</span></p>
            </div>

            <div className="space-y-1.5">
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">CPU</p>
              <p><span className="text-slate-500">Usage:</span> <span className="font-medium">{fmtPct(latest.cpu_usage)}</span></p>
              <p><span className="text-slate-500">Current Freq:</span> <span className="font-medium">{fmtNumber(latest.cpu_current_freq)}</span></p>
              <p><span className="text-slate-500">Max Freq:</span> <span className="font-medium">{fmtNumber(latest.cpu_max_freq)}</span></p>
              <p><span className="text-slate-500">Min Freq:</span> <span className="font-medium">{fmtNumber(latest.cpu_min_freq)}</span></p>
              <p><span className="text-slate-500">Physical Cores:</span> <span className="font-medium">{fmtNumber(latest.cpu_physical_cores)}</span></p>
              <p><span className="text-slate-500">Total Cores:</span> <span className="font-medium">{fmtNumber(latest.cpu_total_cores)}</span></p>
            </div>

            <div className="space-y-1.5">
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Memory</p>
              <p><span className="text-slate-500">Usage:</span> <span className="font-medium">{fmtPct(latest.memory_usage_percent)}</span></p>
              <p><span className="text-slate-500">Total:</span> <span className="font-medium">{fmtGb(latest.memory_total)}</span></p>
              <p><span className="text-slate-500">Used:</span> <span className="font-medium">{fmtGb(latest.memory_used)}</span></p>
              <p><span className="text-slate-500">Available:</span> <span className="font-medium">{fmtGb(latest.memory_available)}</span></p>
            </div>

            <div className="space-y-1.5">
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Disk</p>
              <p><span className="text-slate-500">Usage:</span> <span className="font-medium">{fmtPct(latest.disk_usage_percent)}</span></p>
              <p><span className="text-slate-500">Total:</span> <span className="font-medium">{fmtGb(latest.disk_total)}</span></p>
              <p><span className="text-slate-500">Used:</span> <span className="font-medium">{fmtGb(latest.disk_used)}</span></p>
              <p><span className="text-slate-500">Free:</span> <span className="font-medium">{fmtGb(latest.disk_free)}</span></p>
            </div>

            <div className="space-y-1.5">
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Network & Users</p>
              <p><span className="text-slate-500">Bytes Sent:</span> <span className="font-medium">{fmtNumber(latest.bytes_sent)}</span></p>
              <p><span className="text-slate-500">Bytes Received:</span> <span className="font-medium">{fmtNumber(latest.bytes_received)}</span></p>
              <p><span className="text-slate-500">Users Count:</span> <span className="font-medium">{fmtNumber(latest.users_count)}</span></p>
              <p><span className="text-slate-500">Logged In Users:</span> <span className="font-medium">{latest.logged_in_users || 'N/A'}</span></p>
            </div>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
        <div className="card p-5 xl:col-span-2">
          <div className="flex items-center justify-between mb-3">
            <p className="text-sm font-semibold text-slate-700">Performance Trend</p>
            <Activity className="w-4 h-4 text-slate-400" />
          </div>
          {chartData.length === 0 ? (
            <EmptyState
              icon={<Server className="w-6 h-6" />}
              title="No historical data"
              description="Waiting for monitoring snapshots for this system."
            />
          ) : (
            <ResponsiveContainer width="100%" height={260}>
              <LineChart data={chartData} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="time" tick={{ fontSize: 11, fill: '#64748b' }} />
                <YAxis domain={[0, 100]} tick={{ fontSize: 11, fill: '#64748b' }} />
                <Tooltip />
                <Line type="monotone" dataKey="cpu" name="CPU" stroke="#ef4444" strokeWidth={2} dot={false} />
                <Line type="monotone" dataKey="ram" name="RAM" stroke="#3b82f6" strokeWidth={2} dot={false} />
                <Line type="monotone" dataKey="disk" name="Disk" stroke="#8b5cf6" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          )}
        </div>

        <div className="card p-5 space-y-3">
          <p className="text-sm font-semibold text-slate-700">Current Health</p>
          <div className="rounded-lg border border-slate-200 p-3">
            <p className="text-xs text-slate-500">CPU</p>
            <p className={`text-xl font-semibold ${statusColor(latest?.cpu_usage)}`}>{fmtPct(latest?.cpu_usage)}</p>
          </div>
          <div className="rounded-lg border border-slate-200 p-3">
            <p className="text-xs text-slate-500">Memory</p>
            <p className={`text-xl font-semibold ${statusColor(latest?.memory_usage_percent)}`}>{fmtPct(latest?.memory_usage_percent)}</p>
          </div>
          <div className="rounded-lg border border-slate-200 p-3">
            <p className="text-xs text-slate-500">Disk</p>
            <p className={`text-xl font-semibold ${statusColor(latest?.disk_usage_percent)}`}>{fmtPct(latest?.disk_usage_percent)}</p>
          </div>
          {latestError && (
            <p className="text-xs text-amber-600">No live monitoring snapshot available right now.</p>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
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
      </div>

      <div className="card p-5">
        <p className="text-sm font-semibold text-slate-700 mb-3">Recent Snapshots</p>
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
                {history.slice().reverse().slice(0, 20).map((h) => (
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
    </div>
  );
}
