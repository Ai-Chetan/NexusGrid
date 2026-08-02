import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Loader2, Save, Clock, AlertTriangle, Archive, RefreshCw, MousePointerClick } from 'lucide-react';
import { monitoringApi } from '@/lib/api';
import { cn } from '@/lib/utils';
import type { MonitoringConfig } from '@/types';
import toast from 'react-hot-toast';
import { useState, useEffect } from 'react';

function errDetail(err: unknown, fallback: string): string {
  const data = (err as { response?: { data?: Record<string, unknown> } })?.response?.data;
  if (!data) return fallback;
  if (typeof data.detail === 'string') return data.detail;
  const first = Object.values(data)[0];
  if (typeof first === 'string') return first;
  if (Array.isArray(first) && typeof first[0] === 'string') return first[0];
  return fallback;
}

function SettingCard({
  icon: Icon,
  label,
  description,
  children,
}: {
  icon: React.ElementType;
  label: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <div className="card p-5 space-y-4">
      <div className="flex items-start gap-3">
        <div className="w-9 h-9 rounded-lg bg-brand-100 dark:bg-brand-900/40 flex items-center justify-center shrink-0">
          <Icon className="w-4.5 h-4.5 text-brand-600 dark:text-brand-400" />
        </div>
        <div>
          <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-100">{label}</h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{description}</p>
        </div>
      </div>
      <div className="pl-12">{children}</div>
    </div>
  );
}

export default function MonitoringConfigPanel() {
  const qc = useQueryClient();

  const { data: config, isLoading, isError, refetch } = useQuery<MonitoringConfig>({
    queryKey: ['monitoring-config'],
    queryFn: () => monitoringApi.getConfig().then((r) => r.data),
  });

  const [heartbeatInterval, setHeartbeatInterval] = useState<number>(5);
  const [offlineThreshold, setOfflineThreshold] = useState<number>(15);
  const [maxLogRetentionDays, setMaxLogRetentionDays] = useState<number>(90);

  useEffect(() => {
    if (config) {
      setHeartbeatInterval(config.heartbeat_interval_minutes);
      setOfflineThreshold(config.offline_detection_threshold_minutes);
      setMaxLogRetentionDays(config.max_log_retention_days);
    }
  }, [config]);

  const mutation = useMutation({
    mutationFn: (data: Record<string, number>) => monitoringApi.updateConfig(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['monitoring-config'] });
      toast.success('Monitoring configuration saved.');
    },
    onError: (err: unknown) => {
      toast.error(errDetail(err, 'Failed to save monitoring configuration.'));
    },
  });

  const hasChanges = config && (
    heartbeatInterval !== config.heartbeat_interval_minutes ||
    offlineThreshold !== config.offline_detection_threshold_minutes ||
    maxLogRetentionDays !== config.max_log_retention_days
  );

  const handleSave = () => {
    mutation.mutate({
      heartbeat_interval_minutes: heartbeatInterval,
      offline_detection_threshold_minutes: offlineThreshold,
      max_log_retention_days: maxLogRetentionDays,
    });
  };

  if (isLoading) {
    return (
      <div className="p-12 flex flex-col items-center gap-3 text-slate-500">
        <Loader2 className="w-6 h-6 animate-spin" />
        <p className="text-sm">Loading monitoring configuration…</p>
      </div>
    );
  }

  if (isError) {
    return (
      <div className="p-12 flex flex-col items-center gap-3 text-slate-500">
        <AlertTriangle className="w-6 h-6 text-red-500" />
        <p className="text-sm text-red-600 dark:text-red-400">Failed to load configuration.</p>
        <button type="button" className="btn-secondary" onClick={() => refetch()}>
          <RefreshCw className="w-4 h-4" /> Retry
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <SettingCard
        icon={Clock}
        label="Heartbeat Interval"
        description="How often (in minutes) each system sends a heartbeat ping to report its status."
      >
        <label className="block">
          <span className="text-xs font-medium text-slate-600 dark:text-slate-400">Interval (minutes)</span>
          <input
            type="number"
            className="input mt-1 w-32"
            min={1}
            max={60}
            value={heartbeatInterval}
            onChange={(e) => setHeartbeatInterval(Math.max(1, Number(e.target.value)))}
          />
        </label>
      </SettingCard>

      <SettingCard
        icon={AlertTriangle}
        label="Offline Detection Threshold"
        description="Number of minutes without a heartbeat before a system is considered offline."
      >
        <label className="block">
          <span className="text-xs font-medium text-slate-600 dark:text-slate-400">Threshold (minutes)</span>
          <input
            type="number"
            className="input mt-1 w-32"
            min={2}
            max={120}
            value={offlineThreshold}
            onChange={(e) => setOfflineThreshold(Math.max(2, Number(e.target.value)))}
          />
        </label>
      </SettingCard>

      <SettingCard
        icon={Archive}
        label="Max Log Retention"
        description="Monitoring logs older than this many days are automatically purged from the system."
      >
        <label className="block">
          <span className="text-xs font-medium text-slate-600 dark:text-slate-400">Retention (days)</span>
          <input
            type="number"
            className="input mt-1 w-32"
            min={7}
            max={365}
            value={maxLogRetentionDays}
            onChange={(e) => setMaxLogRetentionDays(Math.max(7, Number(e.target.value)))}
          />
        </label>
      </SettingCard>

      {/* Save bar */}
      <div className="flex justify-end pt-2">
        <button
          type="button"
          className={cn('btn-primary', !hasChanges && 'opacity-50 cursor-not-allowed')}
          disabled={!hasChanges || mutation.isPending}
          onClick={handleSave}
        >
          {mutation.isPending ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Save className="w-4 h-4" />
          )}
          Save Changes
        </button>
      </div>
    </div>
  );
}