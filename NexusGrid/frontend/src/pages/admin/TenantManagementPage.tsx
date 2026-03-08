import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Database, Globe, PlusCircle, RefreshCw, ShieldAlert, Trash2 } from 'lucide-react';
import toast from 'react-hot-toast';

import PageHeader from '@/components/common/PageHeader';
import { tenantControlApi } from '@/lib/api';
import type { CreateTenantPayload, TenantPackageRecord, TenantRecord } from '@/types';

interface TenantListResponse {
  results: TenantRecord[];
}

interface PackageListResponse {
  results: TenantPackageRecord[];
}

const initialForm: CreateTenantPayload = {
  slug: '',
  name: '',
  domain: '',
  admin_username: '',
  admin_email: '',
  admin_password: '',
  package_code: 'starter',
  db_name: '',
  db_user: '',
  db_password: '',
};

export default function TenantManagementPage() {
  const [form, setForm] = useState<CreateTenantPayload>(initialForm);
  const [generatedPassword, setGeneratedPassword] = useState<string | null>(null);
  const queryClient = useQueryClient();

  const { data: tenantData, isLoading: isTenantLoading } = useQuery<TenantListResponse>({
    queryKey: ['control-tenants'],
    queryFn: () => tenantControlApi.listTenants().then((r) => r.data as TenantListResponse),
    refetchInterval: 20_000,
  });

  const { data: packageData } = useQuery<PackageListResponse>({
    queryKey: ['control-packages'],
    queryFn: () => tenantControlApi.listPackages().then((r) => r.data as PackageListResponse),
  });

  const createMutation = useMutation({
    mutationFn: () => tenantControlApi.createTenant(form as unknown as Record<string, unknown>),
    onSuccess: (response) => {
      const generated = response.data?.generated_admin_password as string | undefined;
      setGeneratedPassword(generated ?? null);
      toast.success('Tenant provisioned successfully.');
      setForm(initialForm);
      queryClient.invalidateQueries({ queryKey: ['control-tenants'] });
    },
    onError: (err: any) => {
      const detail = err?.response?.data?.detail || 'Failed to create tenant.';
      toast.error(String(detail));
    },
  });

  const deprovisionMutation = useMutation({
    mutationFn: ({ slug, dropDb }: { slug: string; dropDb: boolean }) =>
      tenantControlApi.deprovisionTenant(slug, { delete: true, drop_db: dropDb }),
    onSuccess: () => {
      toast.success('Tenant deprovisioned.');
      queryClient.invalidateQueries({ queryKey: ['control-tenants'] });
    },
    onError: (err: any) => {
      const detail = err?.response?.data?.detail || 'Failed to deprovision tenant.';
      toast.error(String(detail));
    },
  });

  const toggleStatusMutation = useMutation({
    mutationFn: ({ slug, status }: { slug: string; status: 'active' | 'suspended' }) =>
      tenantControlApi.updateTenant(slug, { status }),
    onSuccess: () => {
      toast.success('Tenant status updated.');
      queryClient.invalidateQueries({ queryKey: ['control-tenants'] });
    },
    onError: (err: any) => {
      const detail = err?.response?.data?.detail || 'Failed to update tenant status.';
      toast.error(String(detail));
    },
  });

  const tenants = tenantData?.results ?? [];
  const packages = packageData?.results ?? [];

  const hasAnyTenant = tenants.length > 0;
  const activeCount = useMemo(() => tenants.filter((t) => t.status === 'active').length, [tenants]);

  return (
    <div className="space-y-5 animate-fade-in">
      <PageHeader
        title="Tenant Management"
        description="Create and operate tenants, database bindings, domains, and lifecycle from one place."
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
        <div className="card p-4 flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-brand-100 dark:bg-brand-900/30 flex items-center justify-center">
            <Database className="w-5 h-5 text-brand-700 dark:text-brand-300" />
          </div>
          <div>
            <p className="text-lg font-bold text-slate-900 dark:text-slate-100">{tenants.length}</p>
            <p className="text-xs text-slate-500">Total Tenants</p>
          </div>
        </div>
        <div className="card p-4 flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center">
            <Globe className="w-5 h-5 text-emerald-700 dark:text-emerald-300" />
          </div>
          <div>
            <p className="text-lg font-bold text-slate-900 dark:text-slate-100">{activeCount}</p>
            <p className="text-xs text-slate-500">Active Tenants</p>
          </div>
        </div>
        <div className="card p-4 flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center">
            <ShieldAlert className="w-5 h-5 text-amber-700 dark:text-amber-300" />
          </div>
          <div>
            <p className="text-lg font-bold text-slate-900 dark:text-slate-100">{Math.max(tenants.length - activeCount, 0)}</p>
            <p className="text-xs text-slate-500">Non-Active Tenants</p>
          </div>
        </div>
      </div>

      <div className="card p-5 space-y-4">
        <div className="flex items-center gap-2">
          <PlusCircle className="w-4 h-4 text-slate-500" />
          <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-200">Provision Tenant</h3>
        </div>

        {generatedPassword && (
          <div className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
            Generated admin password: <span className="font-mono font-semibold">{generatedPassword}</span>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <Input label="Slug" value={form.slug ?? ''} onChange={(v) => setForm((s) => ({ ...s, slug: v }))} />
          <Input label="Name" value={form.name ?? ''} onChange={(v) => setForm((s) => ({ ...s, name: v }))} />
          <Input label="Domain (host only)" value={form.domain ?? ''} onChange={(v) => setForm((s) => ({ ...s, domain: v }))} />
          <Select
            label="Package"
            value={form.package_code ?? 'starter'}
            options={packages.map((p) => ({ label: `${p.code} ${p.is_active ? '' : '(inactive)'}`.trim(), value: p.code }))}
            onChange={(v) => setForm((s) => ({ ...s, package_code: v }))}
          />
          <Input label="Admin Username" value={form.admin_username ?? ''} onChange={(v) => setForm((s) => ({ ...s, admin_username: v }))} />
          <Input label="Admin Email" value={form.admin_email ?? ''} onChange={(v) => setForm((s) => ({ ...s, admin_email: v }))} />
          <Input label="Admin Password (optional)" value={form.admin_password ?? ''} onChange={(v) => setForm((s) => ({ ...s, admin_password: v }))} />
          <Input label="DB Password" value={form.db_password ?? ''} onChange={(v) => setForm((s) => ({ ...s, db_password: v }))} />
          <Input label="DB Name (optional)" value={form.db_name ?? ''} onChange={(v) => setForm((s) => ({ ...s, db_name: v }))} />
          <Input label="DB User (optional)" value={form.db_user ?? ''} onChange={(v) => setForm((s) => ({ ...s, db_user: v }))} />
        </div>

        <div className="flex justify-end gap-2">
          <button
            type="button"
            className="btn-secondary"
            onClick={() => setForm(initialForm)}
            disabled={createMutation.isPending}
          >
            Reset
          </button>
          <button
            type="button"
            className="btn-primary"
            onClick={() => createMutation.mutate()}
            disabled={createMutation.isPending}
          >
            {createMutation.isPending ? 'Provisioning...' : 'Create Tenant'}
          </button>
        </div>
      </div>

      <div className="card p-5 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-200">Existing Tenants</h3>
          <button
            type="button"
            className="btn-secondary"
            onClick={() => queryClient.invalidateQueries({ queryKey: ['control-tenants'] })}
          >
            <RefreshCw className="w-4 h-4" /> Refresh
          </button>
        </div>

        {!hasAnyTenant && !isTenantLoading && (
          <p className="text-sm text-slate-500">No tenants found yet.</p>
        )}

        <div className="space-y-3">
          {tenants.map((tenant) => (
            <div key={tenant.slug} className="rounded-lg border border-slate-200 dark:border-slate-700 p-4 space-y-3">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                    {tenant.name} <span className="text-slate-500">({tenant.slug})</span>
                  </p>
                  <p className="text-xs text-slate-500">
                    {tenant.db_name} @ {tenant.db_host}:{tenant.db_port} as {tenant.db_user}
                  </p>
                  <p className="text-xs text-slate-500">Package: {tenant.active_package ?? 'none'}</p>
                </div>
                <span className={`px-2 py-1 rounded-full text-xs font-medium ${statusPillClass(tenant.status)}`}>
                  {tenant.status}
                </span>
              </div>

              <div className="flex flex-wrap gap-2">
                {tenant.domains.map((d) => (
                  <span key={d.id} className="inline-flex items-center rounded-md bg-slate-100 dark:bg-slate-800 px-2 py-1 text-xs">
                    {d.domain}
                  </span>
                ))}
              </div>

              <div className="flex flex-wrap gap-2">
                {tenant.status === 'active' ? (
                  <button
                    type="button"
                    className="btn-secondary"
                    onClick={() => toggleStatusMutation.mutate({ slug: tenant.slug, status: 'suspended' })}
                    disabled={toggleStatusMutation.isPending}
                  >
                    Suspend
                  </button>
                ) : (
                  <button
                    type="button"
                    className="btn-secondary"
                    onClick={() => toggleStatusMutation.mutate({ slug: tenant.slug, status: 'active' })}
                    disabled={toggleStatusMutation.isPending}
                  >
                    Activate
                  </button>
                )}

                <button
                  type="button"
                  className="btn-secondary text-rose-700"
                  onClick={() => deprovisionMutation.mutate({ slug: tenant.slug, dropDb: false })}
                  disabled={deprovisionMutation.isPending}
                >
                  <Trash2 className="w-4 h-4" /> Deprovision
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function Input({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return (
    <div>
      <label className="label">{label}</label>
      <input className="input" value={value} onChange={(e) => onChange(e.target.value)} />
    </div>
  );
}

function Select({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: Array<{ label: string; value: string }>;
  onChange: (value: string) => void;
}) {
  return (
    <div>
      <label className="label">{label}</label>
      <select className="input" value={value} onChange={(e) => onChange(e.target.value)}>
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
    </div>
  );
}

function statusPillClass(status: string): string {
  switch (status) {
    case 'active':
      return 'bg-emerald-100 text-emerald-700';
    case 'failed':
    case 'deleted':
      return 'bg-rose-100 text-rose-700';
    case 'suspended':
      return 'bg-amber-100 text-amber-700';
    default:
      return 'bg-slate-100 text-slate-700';
  }
}
