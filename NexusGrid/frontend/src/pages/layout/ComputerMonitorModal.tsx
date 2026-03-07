import { useQuery } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import {
  X, Monitor, Cpu, HardDrive, Wifi, Users, Clock,
  ChevronDown, ChevronUp, Activity, Server as ServerIcon,
  AlertTriangle, PackageSearch, QrCode, Download,
} from 'lucide-react';
import { layoutApi } from '@/lib/api';
import type { SystemInfo, LayoutItem, SimpleSystem } from '@/types';
import { timeAgo, cn } from '@/lib/utils';
import { safeFileName } from '@/lib/qr';
import QRCode from 'qrcode';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function fmt(n: number | null | undefined, decimals = 1): string {
  return n != null ? n.toFixed(decimals) : '—';
}
function fmtGb(n: number | null | undefined): string {
  return n != null ? `${n.toFixed(2)} GB` : '—';
}
function fmtMhz(n: number | null | undefined): string {
  return n != null ? `${(n / 1000).toFixed(2)} GHz` : '—';
}
function fmtBytes(n: number | null | undefined): string {
  if (n == null) return '—';
  if (n >= 1e12) return `${(n / 1e12).toFixed(2)} TB`;
  if (n >= 1e9)  return `${(n / 1e9).toFixed(2)} GB`;
  if (n >= 1e6)  return `${(n / 1e6).toFixed(2)} MB`;
  if (n >= 1e3)  return `${(n / 1e3).toFixed(2)} KB`;
  return `${n} B`;
}

// ─── Gauge Ring ───────────────────────────────────────────────────────────────
function GaugeRing({ value, color, size = 72 }: { value: number | null; color: string; size?: number }) {
  const pct = Math.min(value ?? 0, 100);
  const r = (size - 10) / 2;
  const c = 2 * Math.PI * r;
  const dash = (pct / 100) * c;

  return (
    <svg width={size} height={size} className="shrink-0">
      <g transform={`rotate(-90 ${size / 2} ${size / 2})`}>
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="currentColor"
          strokeWidth={8}
          className="text-slate-100 dark:text-slate-700"
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={color}
          strokeWidth={8}
          strokeDasharray={`${dash} ${c - dash}`}
          strokeLinecap="round"
          style={{ transition: 'stroke-dasharray 0.6s ease' }}
        />
      </g>
      <text
        x={size / 2}
        y={size / 2}
        textAnchor="middle"
        dominantBaseline="middle"
        style={{ fontSize: 13, fontWeight: 700, fill: color }}
      >
        {value != null ? `${value.toFixed(0)}%` : '—'}
      </text>
    </svg>
  );
}

// ─── Gauge Bar ────────────────────────────────────────────────────────────────
function GaugeBar({ value, color, label }: { value: number | null; color: string; label: string }) {
  const pct = Math.min(value ?? 0, 100);
  return (
    <div className="space-y-1">
      <div className="flex justify-between text-xs">
        <span className="text-slate-500 dark:text-slate-400 font-medium">{label}</span>
        <span className="font-semibold text-slate-700 dark:text-slate-200">
          {value != null ? `${value.toFixed(1)}%` : '—'}
        </span>
      </div>
      <div className="h-2 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-500"
          style={{ width: `${pct}%`, background: color }}
        />
      </div>
    </div>
  );
}

// ─── Info Row ─────────────────────────────────────────────────────────────────
function InfoRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between py-1.5 border-b border-slate-100 dark:border-slate-700/50 last:border-0">
      <span className="text-xs text-slate-500 dark:text-slate-400">{label}</span>
      <span className="text-xs font-medium text-slate-800 dark:text-slate-200 text-right max-w-[60%] truncate">{value ?? '—'}</span>
    </div>
  );
}

// ─── Collapsible Section ──────────────────────────────────────────────────────
function Collapsible({ title, icon: Icon, defaultOpen = false, children }: {
  title: string;
  icon: React.ElementType;
  defaultOpen?: boolean;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="border border-slate-200 dark:border-slate-700 rounded-xl overflow-hidden">
      <button
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center justify-between px-4 py-3 bg-slate-50 dark:bg-slate-800/50 hover:bg-slate-100 dark:hover:bg-slate-700/50 transition-colors"
      >
        <div className="flex items-center gap-2 text-sm font-semibold text-slate-700 dark:text-slate-200">
          <Icon className="w-4 h-4 text-slate-400 dark:text-slate-500" />
          {title}
        </div>
        {open ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
      </button>
      {open && <div className="px-4 py-3">{children}</div>}
    </div>
  );
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────
function Skeleton({ className }: { className?: string }) {
  return <div className={cn('bg-slate-100 dark:bg-slate-700 animate-pulse rounded', className)} />;
}

interface Props {
  itemId: number;
  itemName: string;
  item?: LayoutItem;
  onClose: () => void;
  onFaultCreate?: (item: LayoutItem) => void;
  onResourceCreate?: (item: LayoutItem) => void;
}

export default function ComputerMonitorModal({ itemId, itemName, item, onClose, onFaultCreate, onResourceCreate }: Props) {
  const [showQr, setShowQr] = useState(false);
  const [qrUrl, setQrUrl] = useState('');

  const { data: info, isLoading, isError } = useQuery<SystemInfo>({
    queryKey: ['item-monitoring', itemId],
    queryFn: () => layoutApi.getItemMonitoring(itemId).then(r => r.data),
    refetchInterval: 30_000,
    staleTime: 15_000,
  });

  const { data: systems = [] } = useQuery<SimpleSystem[]>({
    queryKey: ['systems-list'],
    queryFn: () => layoutApi.getSystems().then((r) => r.data as SimpleSystem[]),
    staleTime: 60_000,
  });

  const system = systems.find((s) => s.layout_item_id === itemId) ?? null;

  useEffect(() => {
    let mounted = true;
    if (!showQr || !system?.unique_code) {
      setQrUrl('');
      return;
    }
    QRCode.toDataURL(system.unique_code, {
      width: 260,
      margin: 2,
      errorCorrectionLevel: 'M',
    }).then((url) => {
      if (mounted) setQrUrl(url);
    }).catch(() => {
      // Keep modal usable even if QR render fails.
    });
    return () => {
      mounted = false;
    };
  }, [showQr, system?.unique_code]);

  const handleQrDownload = () => {
    if (!system || !qrUrl) return;
    const a = document.createElement('a');
    a.href = qrUrl;
    a.download = `${safeFileName(system.host_name)}-${system.unique_code}.png`;
    a.click();
  };

  const cpuColor  = (info?.cpu_usage ?? 0) > 85 ? '#ef4444' : (info?.cpu_usage ?? 0) > 60 ? '#f59e0b' : '#10b981';
  const ramColor  = (info?.memory_usage_percent ?? 0) > 85 ? '#ef4444' : (info?.memory_usage_percent ?? 0) > 60 ? '#f59e0b' : '#3b82f6';
  const diskColor = (info?.disk_usage_percent ?? 0) > 85 ? '#ef4444' : (info?.disk_usage_percent ?? 0) > 60 ? '#f59e0b' : '#8b5cf6';

  // Close on backdrop click
  const handleBackdrop = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.target === e.currentTarget) onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm"
      onClick={handleBackdrop}
    >
      <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden border border-slate-200 dark:border-slate-700">

        {/* ── Header ── */}
        <div className="flex items-center gap-3 px-5 py-4 border-b border-slate-200 dark:border-slate-700 shrink-0">
          <div className="w-9 h-9 rounded-lg bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center">
            <Monitor className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="text-base font-bold text-slate-900 dark:text-slate-100 truncate">{itemName}</h2>
            {info && (
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {[info.system, info.release].filter(Boolean).join(' ')} · {info.ip_address ?? 'No IP'}
              </p>
            )}
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {info && (
              <span className="flex items-center gap-1.5 text-xs text-emerald-600 dark:text-emerald-400 font-medium">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                Live
              </span>
            )}
            <button
              onClick={onClose}
              className="w-7 h-7 flex items-center justify-center rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* ── Body ── */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4">

          {isError && (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <Activity className="w-10 h-10 text-slate-300 dark:text-slate-600 mb-3" />
              <p className="text-sm font-medium text-slate-600 dark:text-slate-400">No monitoring data</p>
              <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">
                Ensure the agent is running on <strong>{itemName}</strong>
              </p>
            </div>
          )}

          {isLoading && (
            <div className="space-y-4">
              {/* Gauges skeleton */}
              <div className="grid grid-cols-3 gap-4">
                {[0,1,2].map(i => (
                  <div key={i} className="rounded-xl border border-slate-200 dark:border-slate-700 p-4 flex flex-col items-center gap-2">
                    <Skeleton className="w-[72px] h-[72px] rounded-full" />
                    <Skeleton className="h-3 w-16" />
                    <Skeleton className="h-2 w-24" />
                  </div>
                ))}
              </div>
              <Skeleton className="h-10 w-full rounded-xl" />
              <Skeleton className="h-10 w-full rounded-xl" />
            </div>
          )}

          {info && (
            <>
              {/* ── Quick stats: 3 gauges ── */}
              <div className="grid grid-cols-3 gap-3">
                {[
                  { label: 'CPU', value: info.cpu_usage, color: cpuColor, sub: `${info.cpu_total_cores ?? '?'} cores @ ${fmtMhz(info.cpu_current_freq)}` },
                  { label: 'RAM', value: info.memory_usage_percent, color: ramColor, sub: `${fmtGb(info.memory_used)} / ${fmtGb(info.memory_total)}` },
                  { label: 'Disk', value: info.disk_usage_percent, color: diskColor, sub: `${fmtGb(info.disk_used)} / ${fmtGb(info.disk_total)}` },
                ].map(({ label, value, color, sub }) => (
                  <div key={label} className="rounded-xl border border-slate-200 dark:border-slate-700 p-3 flex flex-col items-center gap-1.5 bg-slate-50/50 dark:bg-slate-800/30">
                    <GaugeRing value={value} color={color} size={80} />
                    <p className="text-xs font-bold text-slate-700 dark:text-slate-200">{label}</p>
                    <p className="text-[10px] text-slate-400 dark:text-slate-500 text-center leading-tight">{sub}</p>
                  </div>
                ))}
              </div>

              {/* ── Bar breakdowns for memory and disk ── */}
              <div className="rounded-xl border border-slate-200 dark:border-slate-700 p-4 space-y-3">
                <p className="text-xs font-semibold text-slate-600 dark:text-slate-300">Resource Details</p>
                <GaugeBar value={info.cpu_usage} color={cpuColor} label="CPU Usage" />
                <GaugeBar value={info.memory_usage_percent} color={ramColor} label="Memory Usage" />
                <GaugeBar value={info.disk_usage_percent} color={diskColor} label="Disk Usage" />
              </div>

              {/* ── Timestamp ── */}
              <div className="flex items-center gap-1.5 text-xs text-slate-400 dark:text-slate-500">
                <Clock className="w-3.5 h-3.5" />
                Last updated {timeAgo(info.timestamp)}
              </div>

              {showQr && system && (
                <div className="rounded-xl border border-slate-200 dark:border-slate-700 p-3 bg-slate-50/60 dark:bg-slate-800/30 max-w-[280px]">
                  {!qrUrl ? (
                    <p className="text-xs text-slate-500 dark:text-slate-400">Generating QR...</p>
                  ) : (
                    <>
                      <img src={qrUrl} alt="System QR" className="w-full h-auto rounded-lg bg-white" />
                      <p className="text-[11px] text-center text-slate-500 dark:text-slate-400 mt-2">{system.unique_code}</p>
                    </>
                  )}
                </div>
              )}

              {/* ── Additional: System ── */}
              <Collapsible title="System" icon={ServerIcon} defaultOpen>
                <div className="space-y-0">
                  <InfoRow label="Hostname" value={info.hostname} />
                  <InfoRow label="IP Address" value={info.ip_address} />
                  <InfoRow label="OS" value={[info.system, info.release].filter(Boolean).join(' ')} />
                  <InfoRow label="Version" value={info.version} />
                  <InfoRow label="Architecture" value={info.architecture} />
                  <InfoRow label="Machine" value={info.machine} />
                  <InfoRow label="Processor" value={info.processor} />
                </div>
              </Collapsible>

              {/* ── Additional: CPU ── */}
              <Collapsible title="CPU Details" icon={Cpu}>
                <div className="space-y-0">
                  <InfoRow label="Physical Cores" value={info.cpu_physical_cores} />
                  <InfoRow label="Total / Logical Cores" value={info.cpu_total_cores} />
                  <InfoRow label="Max Frequency" value={fmtMhz(info.cpu_max_freq)} />
                  <InfoRow label="Min Frequency" value={fmtMhz(info.cpu_min_freq)} />
                  <InfoRow label="Current Frequency" value={fmtMhz(info.cpu_current_freq)} />
                  <InfoRow label="Usage" value={`${fmt(info.cpu_usage)}%`} />
                </div>
              </Collapsible>

              {/* ── Additional: Memory ── */}
              <Collapsible title="Memory Details" icon={Activity}>
                <div className="space-y-0">
                  <InfoRow label="Total" value={fmtGb(info.memory_total)} />
                  <InfoRow label="Used" value={fmtGb(info.memory_used)} />
                  <InfoRow label="Available" value={fmtGb(info.memory_available)} />
                  <InfoRow label="Usage" value={`${fmt(info.memory_usage_percent)}%`} />
                </div>
              </Collapsible>

              {/* ── Additional: Disk ── */}
              <Collapsible title="Disk Details" icon={HardDrive}>
                <div className="space-y-0">
                  <InfoRow label="Total" value={fmtGb(info.disk_total)} />
                  <InfoRow label="Used" value={fmtGb(info.disk_used)} />
                  <InfoRow label="Free" value={fmtGb(info.disk_free)} />
                  <InfoRow label="Usage" value={`${fmt(info.disk_usage_percent)}%`} />
                </div>
              </Collapsible>

              {/* ── Additional: Network ── */}
              <Collapsible title="Network" icon={Wifi}>
                <div className="space-y-0">
                  <InfoRow label="Bytes Sent" value={fmtBytes(info.bytes_sent)} />
                  <InfoRow label="Bytes Received" value={fmtBytes(info.bytes_received)} />
                </div>
              </Collapsible>

              {/* ── Additional: Users ── */}
              <Collapsible title="Logged-in Users" icon={Users}>
                <div className="space-y-0">
                  <InfoRow label="Count" value={info.users_count} />
                  <InfoRow label="Users" value={info.logged_in_users || 'None'} />
                </div>
              </Collapsible>
            </>
          )}
        </div>

        {/* ── Action Footer ── */}
        {item && (
          <div className="flex items-center gap-3 px-5 py-3 border-t border-slate-200 dark:border-slate-700 shrink-0 bg-slate-50 dark:bg-slate-800/50">
            <button
              onClick={() => setShowQr((v) => !v)}
              disabled={!system}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-700/70 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-sm font-medium transition-colors border border-slate-200 dark:border-slate-600 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <QrCode className="w-4 h-4" />
              {showQr ? 'Hide QR' : 'Show QR'}
            </button>
            <button
              onClick={handleQrDownload}
              disabled={!system || !qrUrl}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-700/70 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-sm font-medium transition-colors border border-slate-200 dark:border-slate-600 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Download className="w-4 h-4" />
              Download QR
            </button>
            {onFaultCreate && (
              <button
                onClick={() => { onClose(); onFaultCreate(item); }}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-red-50 hover:bg-red-100 dark:bg-red-900/20 dark:hover:bg-red-900/40 text-red-600 dark:text-red-400 text-sm font-medium transition-colors border border-red-200 dark:border-red-800"
              >
                <AlertTriangle className="w-4 h-4" />
                Report Fault
              </button>
            )}
            {onResourceCreate && (
              <button
                onClick={() => { onClose(); onResourceCreate(item); }}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-blue-50 hover:bg-blue-100 dark:bg-blue-900/20 dark:hover:bg-blue-900/40 text-blue-600 dark:text-blue-400 text-sm font-medium transition-colors border border-blue-200 dark:border-blue-800"
              >
                <PackageSearch className="w-4 h-4" />
                Request Resource
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
