import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Loader2, Save, Users, Building2, UserCheck, ShieldCheck } from 'lucide-react';
import { privilegesApi } from '@/lib/api';
import { cn } from '@/lib/utils';
import type { PrivilegesConfig } from '@/types';
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

export default function PrivilegesConfigPanel() {
  const qc = useQueryClient();

  const { data: config, isLoading, isError, refetch } = useQuery<PrivilegesConfig>({
    queryKey: ['privileges-config'],
    queryFn: () => privilegesApi.getConfig().then((r) => r.data),
  });

  const [maxLabsPerIncharge, setMaxLabsPerIncharge] = useState<number>(3);
  const [maxLabsPerAssistant, setMaxLabsPerAssistant] = useState<number>(3);
  const [maxInchargesPerLab, setMaxInchargesPerLab] = useState<number>(1);
  const [maxAssistantsPerLab, setMaxAssistantsPerLab] = useState<number>(2);

  useEffect(() => {
    if (config) {
      setMaxLabsPerIncharge(config.max_labs_per_incharge);
      setMaxLabsPerAssistant(config.max_labs_per_assistant);
      setMaxInchargesPerLab(config.max_incharges_per_lab);
      setMaxAssistantsPerLab(config.max_assistants_per_lab);
    }
  }, [config]);

  const mutation = useMutation({
    mutationFn: (data: Record<string, number>) => privilegesApi.updateConfig(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['privileges-config'] });
      toast.success('Privileges configuration saved.');
    },
    onError: (err: unknown) => {
      toast.error(errDetail(err, 'Failed to save privileges configuration.'));
    },
  });

  const hasChanges = config && (
    maxLabsPerIncharge !== config.max_labs_per_incharge ||
    maxLabsPerAssistant !== config.max_labs_per_assistant ||
    maxInchargesPerLab !== config.max_incharges_per_lab ||
    maxAssistantsPerLab !== config.max_assistants_per_lab
  );

  const handleSave = () => {
    mutation.mutate({
      max_labs_per_incharge: maxLabsPerIncharge,
      max_labs_per_assistant: maxLabsPerAssistant,
      max_incharges_per_lab: maxInchargesPerLab,
      max_assistants_per_lab: maxAssistantsPerLab,
    });
  };

  if (isLoading) {
    return (
      <div className="p-12 flex flex-col items-center gap-3 text-slate-500">
        <Loader2 className="w-6 h-6 animate-spin" />
        <p className="text-sm">Loading privileges configuration…</p>
      </div>
    );
  }

  if (isError) {
    return (
      <div className="p-12 flex flex-col items-center gap-3 text-slate-500">
        <Loader2 className="w-6 h-6 text-red-500" />
        <p className="text-sm text-red-600 dark:text-red-400">Failed to load configuration.</p>
        <button type="button" className="btn-secondary" onClick={() => refetch()}>
          <Loader2 className="w-4 h-4" /> Retry
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <SettingCard
        icon={Users}
        label="Max Labs Per In-Charge"
        description="Maximum number of labs that a single Lab In-Charge can be assigned to."
      >
        <label className="block">
          <span className="text-xs font-medium text-slate-600 dark:text-slate-400">Max labs</span>
          <input
            type="number"
            className="input mt-1 w-32"
            min={1}
            max={20}
            value={maxLabsPerIncharge}
            onChange={(e) => setMaxLabsPerIncharge(Math.max(1, Number(e.target.value)))}
          />
        </label>
      </SettingCard>

      <SettingCard
        icon={UserCheck}
        label="Max Labs Per Assistant"
        description="Maximum number of labs that a single Lab Assistant can be assigned to."
      >
        <label className="block">
          <span className="text-xs font-medium text-slate-600 dark:text-slate-400">Max labs</span>
          <input
            type="number"
            className="input mt-1 w-32"
            min={1}
            max={20}
            value={maxLabsPerAssistant}
            onChange={(e) => setMaxLabsPerAssistant(Math.max(1, Number(e.target.value)))}
          />
        </label>
      </SettingCard>

      <SettingCard
        icon={ShieldCheck}
        label="Max In-Charges Per Lab"
        description="Maximum number of Lab In-Charges that can be assigned to a single lab."
      >
        <label className="block">
          <span className="text-xs font-medium text-slate-600 dark:text-slate-400">Max in-charges</span>
          <input
            type="number"
            className="input mt-1 w-32"
            min={1}
            max={10}
            value={maxInchargesPerLab}
            onChange={(e) => setMaxInchargesPerLab(Math.max(1, Number(e.target.value)))}
          />
        </label>
      </SettingCard>

      <SettingCard
        icon={Building2}
        label="Max Assistants Per Lab"
        description="Maximum number of Lab Assistants that can be assigned to a single lab."
      >
        <label className="block">
          <span className="text-xs font-medium text-slate-600 dark:text-slate-400">Max assistants</span>
          <input
            type="number"
            className="input mt-1 w-32"
            min={1}
            max={10}
            value={maxAssistantsPerLab}
            onChange={(e) => setMaxAssistantsPerLab(Math.max(1, Number(e.target.value)))}
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