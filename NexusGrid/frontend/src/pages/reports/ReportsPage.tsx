import { useState, useMemo, useCallback } from 'react';
import { useQuery, keepPreviousData } from '@tanstack/react-query';
import {
  BarChart, Bar, PieChart, Pie, Cell, Legend, XAxis, YAxis,
  CartesianGrid, Tooltip, ResponsiveContainer, Area, AreaChart,
} from 'recharts';
import {
  RefreshCw, Building2, Layers, Calendar, LayoutDashboard, BookOpen,
  FileText, TrendingUp, AlertTriangle, Package, Monitor, Filter, X, Search,
} from 'lucide-react';
import { reportsApi, layoutApi, labsApi, privilegesApi } from '@/lib/api';
import PageHeader from '@/components/common/PageHeader';
import ErrorState from '@/components/common/ErrorState';
import OversightSection from '@/pages/reports/OversightSection';
import { generateHierarchicalPdfReport } from '@/lib/hierarchicalPdfReport';
import { useTheme } from '@/hooks/useTheme';
import { useAuthStore } from '@/store/authStore';
import toast from 'react-hot-toast';
import type { LayoutItem, Lab, ReportsData, ReportsDetailData } from '@/types';

const COLORS = ['#3b82f6', '#ef4444', '#f59e0b', '#10b981', '#8b5cf6', '#06b6d4', '#ec4899'];
const PIE_COLORS = ['#3b82f6', '#ef4444', '#f59e0b', '#10b981', '#8b5cf6', '#06b6d4'];

type ReportFilterParams = {
  building_id?: number;
  floor_id?: number;
  lab_id?: number;
  start_date?: string;
  end_date?: string;
};

// ─── Section wrapper with icon header ─────────────────────────────────────────
function ChartSection({ icon: Icon, title, subtitle, children, className }: {
  icon: React.ElementType;
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={`card overflow-hidden ${className ?? ''}`}>
      <div className="flex items-center gap-3 px-5 pt-5 pb-3">
        <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-blue-50 dark:bg-blue-950/50">
          <Icon className="w-4 h-4 text-blue-600 dark:text-blue-400" />
        </div>
        <div>
          <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-200">{title}</h3>
          {subtitle && <p className="text-xs text-slate-400 dark:text-slate-500">{subtitle}</p>}
        </div>
      </div>
      <div className="px-5 pb-5">{children}</div>
    </div>
  );
}

// ─── Summary stat card ────────────────────────────────────────────────────────
function StatCard({ label, value, icon: Icon, color, subtext }: {
  label: string;
  value: number;
  icon: React.ElementType;
  color: string;
  subtext?: string;
}) {
  return (
    <div className="card p-4 flex items-center gap-4">
      <div className={`flex items-center justify-center w-11 h-11 rounded-xl ${color}`}>
        <Icon className="w-5 h-5" />
      </div>
      <div>
        <p className="text-2xl font-bold text-slate-900 dark:text-slate-100">{value}</p>
        <p className="text-xs text-slate-500 dark:text-slate-400">{label}</p>
        {subtext && <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-0.5">{subtext}</p>}
      </div>
    </div>
  );
}

export default function ReportsPage() {
  const { theme } = useTheme();
  const dark = theme === 'dark';
  const user = useAuthStore(s => s.user);
  const isNoRole = user?.role === 'No Roles';
  const isAdmin = user?.role === 'Administrator';
  const isRestricted = user?.role === 'Lab Incharge' || user?.role === 'Lab Assistant';

  if (isNoRole) {
    return (
      <div className="space-y-5 animate-fade-in">
        <PageHeader
          title="Reports & Analytics"
          description="Visual overview of faults, resources, and system status."
        />
        <div className={`flex flex-col items-center justify-center py-20 rounded-xl border
          ${dark
            ? 'bg-slate-900 border-slate-700 text-slate-400'
            : 'bg-white border-slate-200 text-slate-500'
          }`}>
          <LayoutDashboard className="w-10 h-10 mb-4 opacity-30" />
          <p className="text-base font-medium mb-1">No reports available</p>
          <p className="text-sm text-center max-w-xs">
            Your account has no role assigned. Contact an administrator to get access.
          </p>
        </div>
      </div>
    );
  }

  // ── Draft filter state (not applied until Apply is clicked) ──────────────
  const [draftBuilding, setDraftBuilding] = useState<number | ''>('');
  const [draftFloor, setDraftFloor] = useState<number | ''>('');
  const [draftLab, setDraftLab] = useState<number | ''>('');
  const [draftStartDate, setDraftStartDate] = useState('');
  const [draftEndDate, setDraftEndDate] = useState('');

  // ── Applied filter state (used for queries) ─────────────────────────────
  const [appliedBuilding, setAppliedBuilding] = useState<number | ''>('');
  const [appliedFloor, setAppliedFloor] = useState<number | ''>('');
  const [appliedLab, setAppliedLab] = useState<number | ''>('');
  const [appliedStartDate, setAppliedStartDate] = useState('');
  const [appliedEndDate, setAppliedEndDate] = useState('');

  // ── Incharge/Assistant filter state ────────────────────────────────────
  const [selectedRestrictedLab, setSelectedRestrictedLab] = useState<number | ''>('');
  const [exportingPdf, setExportingPdf] = useState(false);

  // ── Fetch this user's own active assignments (incharge / assistant) ─────
  const { data: myAssignments = [] } = useQuery({
    queryKey: ['my-assignments'],
    queryFn: () => privilegesApi.getAssignments().then(r => r.data as { id: number; lab: number; lab_name: string }[]),
    enabled: isRestricted,
    staleTime: 5 * 60 * 1000,
  });

  const myLabs = useMemo(() => {
    const seen = new Set<number>();
    return myAssignments.filter(a => {
      if (seen.has(a.lab)) return false;
      seen.add(a.lab);
      return true;
    });
  }, [myAssignments]);

  // ── Layout data for admin filter dropdowns ──────────────────────────────
  const { data: buildings = [] } = useQuery<LayoutItem[]>({
    queryKey: ['layout-buildings'],
    queryFn: () => layoutApi.getItems().then(r =>
      (r.data as LayoutItem[]).filter(i => i.item_type === 'building'),
    ),
    enabled: isAdmin,
    staleTime: 10 * 60 * 1000,
  });

  const { data: floors = [] } = useQuery<LayoutItem[]>({
    queryKey: ['layout-floors', draftBuilding],
    queryFn: () => layoutApi.getItems({ parent_id: draftBuilding as number }).then(r =>
      (r.data as LayoutItem[]).filter(i => i.item_type === 'floor'),
    ),
    enabled: isAdmin && !!draftBuilding,
    staleTime: 10 * 60 * 1000,
  });

  const { data: allLabs = [] } = useQuery<Lab[]>({
    queryKey: ['labs'],
    queryFn: () => labsApi.list().then(r => r.data),
    enabled: isAdmin && !!draftBuilding,
    staleTime: 10 * 60 * 1000,
  });

  const labsForFloor = useMemo((): Lab[] => {
    if (!draftFloor) return [];
    return allLabs.filter(l => l.floor_id === draftFloor);
  }, [allLabs, draftFloor]);

  // ── Derive report query params from APPLIED filters ─────────────────────
  const reportParams = useMemo<ReportFilterParams | undefined>(() => {
    if (isRestricted) {
      return selectedRestrictedLab ? { lab_id: selectedRestrictedLab as number } : undefined;
    }
    if (!isAdmin) return undefined;
    const params: ReportFilterParams = {};
    if (appliedLab) params.lab_id = appliedLab as number;
    else if (appliedFloor) params.floor_id = appliedFloor as number;
    else if (appliedBuilding) params.building_id = appliedBuilding as number;
    if (appliedStartDate) params.start_date = appliedStartDate;
    if (appliedEndDate) params.end_date = appliedEndDate;
    return Object.keys(params).length > 0 ? params : undefined;
  }, [isAdmin, isRestricted, appliedBuilding, appliedFloor, appliedLab, appliedStartDate, appliedEndDate, selectedRestrictedLab]);

  // ── Apply filter handler ────────────────────────────────────────────────
  const handleApplyFilter = useCallback(() => {
    setAppliedBuilding(draftBuilding);
    setAppliedFloor(draftFloor);
    setAppliedLab(draftLab);
    setAppliedStartDate(draftStartDate);
    setAppliedEndDate(draftEndDate);
  }, [draftBuilding, draftFloor, draftLab, draftStartDate, draftEndDate]);

  // ── Clear filter handler ────────────────────────────────────────────────
  const handleClearFilter = useCallback(() => {
    setDraftBuilding('');
    setDraftFloor('');
    setDraftLab('');
    setDraftStartDate('');
    setDraftEndDate('');
    setAppliedBuilding('');
    setAppliedFloor('');
    setAppliedLab('');
    setAppliedStartDate('');
    setAppliedEndDate('');
  }, []);

  // ── Scope label ─────────────────────────────────────────────────────────
  const scopeLabel = useMemo(() => {
    if (isRestricted) {
      if (selectedRestrictedLab) {
        const l = myLabs.find(l => l.lab === selectedRestrictedLab);
        return l ? l.lab_name : null;
      }
      return null;
    }
    if (!isAdmin) return null;
    const parts: string[] = [];
    if (appliedBuilding) {
      const b = buildings.find(b => b.id === appliedBuilding);
      if (b) parts.push(b.name);
    }
    if (appliedFloor) {
      const f = floors.find(f => f.id === appliedFloor);
      if (f) parts.push(f.name);
    }
    if (appliedLab) {
      const l = labsForFloor.find(l => l.id === appliedLab);
      if (l) parts.push(l.lab_name);
    }
    if (appliedStartDate || appliedEndDate) {
      const dateRange = [appliedStartDate, appliedEndDate].filter(Boolean).join(' → ');
      if (dateRange) parts.push(dateRange);
    }
    return parts.length ? parts.join(' › ') : null;
  }, [isAdmin, isRestricted, appliedBuilding, appliedFloor, appliedLab, appliedStartDate, appliedEndDate, buildings, floors, labsForFloor, myLabs, selectedRestrictedLab]);

  const gridStroke = dark ? '#334155' : '#e2e8f0';
  const tickFill = dark ? '#64748b' : '#94a3b8';
  const tooltipStyle = {
    fontSize: 12, borderRadius: 10,
    boxShadow: '0 8px 30px rgba(0,0,0,.12)',
    backgroundColor: dark ? '#1e293b' : '#ffffff',
    color: dark ? '#f1f5f9' : '#0f172a',
    border: `1px solid ${dark ? '#334155' : '#e2e8f0'}`,
    padding: '10px 14px',
  };
  const tooltipLabelStyle = { color: dark ? '#cbd5e1' : '#374151', fontWeight: 600, marginBottom: 4 };
  const tooltipItemStyle = { color: dark ? '#94a3b8' : '#475569' };
  const tooltipCursor = { fill: dark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.03)' };
  const tooltipProps = {
    contentStyle: tooltipStyle,
    labelStyle: tooltipLabelStyle,
    itemStyle: tooltipItemStyle,
    cursor: tooltipCursor,
  };
  const legendStyle = { fontSize: 11, color: dark ? '#94a3b8' : '#64748b' };

  const { data, isLoading, isError, refetch } = useQuery<ReportsData>({
    queryKey: ['reports', reportParams],
    queryFn: () => reportsApi.get(reportParams).then(r => r.data),
    staleTime: 5 * 60 * 1000,
    placeholderData: keepPreviousData,
  });

  if (isError) return <ErrorState message="Failed to load reports data." onRetry={refetch} />;

  const skeletonChart = (
    <div className={`h-52 rounded-xl animate-pulse ${dark ? 'bg-slate-700/50' : 'bg-slate-100'}`} />
  );

  const isFiltered = isRestricted
    ? !!selectedRestrictedLab
    : !!(appliedBuilding || appliedFloor || appliedLab || appliedStartDate || appliedEndDate);

  // Pivot fault_monthly into chart series
  const faultMonthly = data?.fault_monthly ?? [];
  const months = [...new Set(faultMonthly.map(x => x.month))];
  const types = [...new Set(faultMonthly.map(x => x.type))];
  const faultTrendData = months.map(m => {
    const row: Record<string, string | number> = { month: m };
    types.forEach(t => {
      row[t] = faultMonthly.find(x => x.month === m && x.type === t)?.count ?? 0;
    });
    return row;
  });

  const faultByStatusData = Object.entries(data?.fault_by_status ?? {}).map(([name, value]) => ({
    name: name.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase()),
    value,
  }));

  const faultByTypeData = Object.entries(data?.fault_by_type ?? {}).map(([name, value]) => ({
    name, value,
  }));

  const resourceByStatusData = Object.entries(data?.resource_by_status ?? {}).map(([name, value]) => ({
    name, value,
  }));

  const systemByStatusData = Object.entries(data?.system_by_status ?? {}).map(([name, value]) => ({
    name: name === 'non-functional' ? 'Non-Functional' : name.charAt(0).toUpperCase() + name.slice(1),
    value,
  }));

  const resourceTrend = (data?.resource_monthly ?? []).map(x => ({
    month: x.month,
    count: x.count,
  }));

  const fileScope = scopeLabel
    ? scopeLabel.replace(/[^a-zA-Z0-9-_ ]/g, '').replace(/\s+/g, '_')
    : isRestricted
    ? 'assigned_labs'
    : 'all';

  // Summary numbers from backend
  const summary = data?.summary;

  const fetchExportData = async (): Promise<ReportsDetailData> => {
    const res = await reportsApi.details(reportParams);
    return res.data as ReportsDetailData;
  };

  const downloadDetailedPdf = async () => {
    setExportingPdf(true);
    try {
      const detail = await fetchExportData();
      generateHierarchicalPdfReport({
        title: 'Infrastructure Report',
        subtitle: `Scope: ${scopeLabel ?? (isRestricted ? 'Assigned Labs' : 'All Buildings')}`,
        meta: [
          `Generated: ${detail.generated_at ? new Date(detail.generated_at).toLocaleString() : new Date().toLocaleString()}`,
          ...(appliedStartDate || appliedEndDate
            ? [`Date Range: ${appliedStartDate || 'Start'} → ${appliedEndDate || 'End'}`]
            : []),
        ],
        stats: [
          { label: 'Active Systems', value: String(summary?.active_systems ?? 0), color: 'emerald' },
          { label: 'Faulty Systems', value: String(summary?.non_functional_systems ?? 0), color: 'red' },
          { label: 'Fault Reports', value: String(summary?.total_faults ?? 0), color: 'amber' },
          { label: 'Resource Requests', value: String(summary?.total_resources ?? 0), color: 'blue' },
        ],
        data: detail,
        fileName: `nexusgrid_report_${fileScope}.pdf`,
      });
      toast.success('PDF report downloaded.');
    } catch {
      toast.error('Failed to download PDF report.');
    } finally {
      setExportingPdf(false);
    }
  };

  const inputClasses = `text-sm rounded-lg border px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500/40 transition
    ${dark
      ? 'bg-slate-800 border-slate-600 text-slate-200'
      : 'bg-white border-slate-200 text-slate-700'
    }`;

  return (
    <div className="space-y-6 animate-fade-in">
      <PageHeader
        title="Reports & Analytics"
        description={
          scopeLabel
            ? `Showing statistics for: ${scopeLabel}`
            : isRestricted
            ? 'Showing statistics for all your assigned labs.'
            : 'Visual overview of faults, resources, and system status.'
        }
        actions={
          <div className="flex items-center gap-2">
            <button
              onClick={downloadDetailedPdf}
              className="btn-primary"
              disabled={exportingPdf}
            >
              <FileText className="w-4 h-4" />
              {exportingPdf ? 'Generating...' : 'Download PDF'}
            </button>
            <button
              onClick={() => refetch()}
              className="btn-ghost"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
          </div>
        }
      />

      {/* ── Filter bar (Admin) ─────────────────────────────────────────────── */}
      {isAdmin && (
        <div className={`card p-4`}>
          <div className="flex items-center gap-2 mb-3">
            <Filter className="w-4 h-4 text-slate-400" />
            <span className="text-xs font-medium text-slate-500 dark:text-slate-400">Filter Reports</span>
          </div>
          <div className="flex flex-wrap items-end gap-4">
            {/* Building selector */}
            <div className="flex flex-col gap-1.5 min-w-[160px]">
              <label className={`text-xs font-medium flex items-center gap-1.5 ${dark ? 'text-slate-400' : 'text-slate-500'}`}>
                <Building2 className="w-3.5 h-3.5" />
                Building
              </label>
              <select
                value={draftBuilding}
                onChange={e => { setDraftBuilding(e.target.value === '' ? '' : Number(e.target.value)); setDraftFloor(''); setDraftLab(''); }}
                className={inputClasses}
              >
                <option value="">All Buildings</option>
                {buildings.map(b => (
                  <option key={b.id} value={b.id}>{b.name}</option>
                ))}
              </select>
            </div>

            {/* Floor selector */}
            <div className="flex flex-col gap-1.5 min-w-[140px]">
              <label className={`text-xs font-medium flex items-center gap-1.5 ${dark ? 'text-slate-400' : 'text-slate-500'}`}>
                <Layers className="w-3.5 h-3.5" />
                Floor
              </label>
              <select
                value={draftFloor}
                onChange={e => { setDraftFloor(e.target.value === '' ? '' : Number(e.target.value)); setDraftLab(''); }}
                disabled={!draftBuilding}
                className={`${inputClasses} disabled:cursor-not-allowed disabled:opacity-50`}
              >
                <option value="">{draftBuilding ? 'All Floors' : 'Select building'}</option>
                {floors.map(f => (
                  <option key={f.id} value={f.id}>{f.name}</option>
                ))}
              </select>
            </div>

            {/* Lab selector */}
            <div className="flex flex-col gap-1.5 min-w-[140px]">
              <label className={`text-xs font-medium flex items-center gap-1.5 ${dark ? 'text-slate-400' : 'text-slate-500'}`}>
                <BookOpen className="w-3.5 h-3.5" />
                Lab
              </label>
              <select
                value={draftLab}
                onChange={e => setDraftLab(e.target.value === '' ? '' : Number(e.target.value))}
                disabled={!draftFloor}
                className={`${inputClasses} disabled:cursor-not-allowed disabled:opacity-50`}
              >
                <option value="">{draftFloor ? 'All Labs' : 'Select floor'}</option>
                {labsForFloor.map(l => (
                  <option key={l.id} value={l.id}>{l.lab_name}</option>
                ))}
              </select>
            </div>

            {/* Start Date */}
            <div className="flex flex-col gap-1.5 min-w-[150px]">
              <label className={`text-xs font-medium flex items-center gap-1.5 ${dark ? 'text-slate-400' : 'text-slate-500'}`}>
                <Calendar className="w-3.5 h-3.5" />
                Start Date
              </label>
              <input
                type="date"
                value={draftStartDate}
                onChange={e => setDraftStartDate(e.target.value)}
                className={inputClasses}
              />
            </div>

            {/* End Date */}
            <div className="flex flex-col gap-1.5 min-w-[150px]">
              <label className={`text-xs font-medium flex items-center gap-1.5 ${dark ? 'text-slate-400' : 'text-slate-500'}`}>
                <Calendar className="w-3.5 h-3.5" />
                End Date
              </label>
              <input
                type="date"
                value={draftEndDate}
                onChange={e => setDraftEndDate(e.target.value)}
                className={inputClasses}
              />
            </div>

            {/* Apply button */}
            <button
              onClick={handleApplyFilter}
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-600 text-white text-sm font-medium
                hover:bg-blue-700 transition shadow-sm self-end"
            >
              <Search className="w-4 h-4" />
              Apply
            </button>

            {/* Clear button */}
            {isFiltered && (
              <button
                onClick={handleClearFilter}
                className={`flex items-center gap-1 text-xs px-3 py-2 rounded-lg border transition self-end
                  ${dark ? 'border-slate-600 text-slate-400 hover:text-slate-200 hover:border-slate-400' : 'border-slate-200 text-slate-500 hover:text-slate-700 hover:border-slate-300'}`}
              >
                <X className="w-3 h-3" /> Clear
              </button>
            )}
          </div>
        </div>
      )}

      {/* ── Filter bar (Restricted users) ──────────────────────────────────── */}
      {isRestricted && myLabs.length > 0 && (
        <div className={`card p-4 flex flex-wrap items-end gap-4`}>
          <div className="flex items-center gap-2 mr-2 self-end pb-2">
            <Filter className="w-4 h-4 text-slate-400" />
            <span className="text-xs font-medium text-slate-500 dark:text-slate-400">Filter scope</span>
          </div>
          <div className="flex flex-col gap-1.5 min-w-[200px]">
            <label className={`text-xs font-medium flex items-center gap-1.5 ${dark ? 'text-slate-400' : 'text-slate-500'}`}>
              <BookOpen className="w-3.5 h-3.5" />
              Lab
            </label>
            <select
              value={selectedRestrictedLab}
              onChange={e => setSelectedRestrictedLab(e.target.value === '' ? '' : Number(e.target.value))}
              className={inputClasses}
            >
              <option value="">All my assigned labs</option>
              {myLabs.map(a => (
                <option key={a.lab} value={a.lab}>{a.lab_name}</option>
              ))}
            </select>
          </div>
          {isFiltered && (
            <button
              onClick={() => setSelectedRestrictedLab('')}
              className={`flex items-center gap-1 text-xs px-3 py-2 rounded-lg border transition self-end
                ${dark ? 'border-slate-600 text-slate-400 hover:text-slate-200 hover:border-slate-400' : 'border-slate-200 text-slate-500 hover:text-slate-700 hover:border-slate-300'}`}
            >
              <X className="w-3 h-3" /> Clear
            </button>
          )}
        </div>
      )}

      {/* Scope info banner */}
      {isRestricted && (
        <div className={`flex items-center gap-2.5 px-4 py-3 rounded-xl text-sm
          ${dark ? 'bg-blue-950/50 text-blue-300 border border-blue-800/50' : 'bg-blue-50 text-blue-700 border border-blue-100'}`}>
          <LayoutDashboard className="w-4 h-4 shrink-0" />
          <span>
            {selectedRestrictedLab
              ? `Filtered to: ${myLabs.find(l => l.lab === selectedRestrictedLab)?.lab_name ?? 'selected lab'}`
              : 'Statistics cover all labs you are currently assigned to.'}
          </span>
        </div>
      )}

      {/* ── Summary stat cards ─────────────────────────────────────────────── */}
      {!isLoading && data && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard
            label="Active Systems"
            value={summary?.active_systems ?? 0}
            icon={Monitor}
            color="bg-emerald-50 dark:bg-emerald-950/40 text-emerald-500"
            subtext={`of ${summary?.total_systems ?? 0} total`}
          />
          <StatCard
            label="Faulty Systems"
            value={summary?.non_functional_systems ?? 0}
            icon={AlertTriangle}
            color="bg-red-50 dark:bg-red-950/40 text-red-500"
            subtext={`${summary?.inactive_systems ?? 0} inactive`}
          />
          <StatCard
            label="Fault Reports"
            value={summary?.total_faults ?? 0}
            icon={TrendingUp}
            color="bg-amber-50 dark:bg-amber-950/40 text-amber-500"
            subtext={`${summary?.open_faults ?? 0} open`}
          />
          <StatCard
            label="Resource Requests"
            value={summary?.total_resources ?? 0}
            icon={Package}
            color="bg-blue-50 dark:bg-blue-950/40 text-blue-500"
            subtext={`${summary?.pending_resources ?? 0} pending`}
          />
        </div>
      )}

      {/* ── Charts Row 1: Trends ───────────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <ChartSection
          icon={TrendingUp}
          title="Monthly Fault Trend"
          subtitle="Breakdown by fault type"
        >
          {isLoading ? skeletonChart : (
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={faultTrendData} barSize={16} barGap={2}>
                <CartesianGrid strokeDasharray="3 3" stroke={gridStroke} vertical={false} />
                <XAxis dataKey="month" tick={{ fontSize: 11, fill: tickFill }} tickLine={false} axisLine={false} dy={6} />
                <YAxis tick={{ fontSize: 11, fill: tickFill }} tickLine={false} axisLine={false} dx={-4} allowDecimals={false} />
                <Tooltip {...tooltipProps} />
                <Legend iconType="circle" iconSize={8} wrapperStyle={legendStyle} />
                {types.map((t, i) => (
                  <Bar key={t} dataKey={t} name={t} fill={COLORS[i % COLORS.length]} radius={[4, 4, 0, 0]} />
                ))}
              </BarChart>
            </ResponsiveContainer>
          )}
        </ChartSection>

        <ChartSection
          icon={Package}
          title="Resource Requests Trend"
          subtitle="Monthly request volume"
        >
          {isLoading ? skeletonChart : (
            <ResponsiveContainer width="100%" height={240}>
              <AreaChart data={resourceTrend}>
                <defs>
                  <linearGradient id="resourceGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.2} />
                    <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke={gridStroke} vertical={false} />
                <XAxis dataKey="month" tick={{ fontSize: 11, fill: tickFill }} tickLine={false} axisLine={false} dy={6} />
                <YAxis tick={{ fontSize: 11, fill: tickFill }} tickLine={false} axisLine={false} dx={-4} allowDecimals={false} />
                <Tooltip {...tooltipProps} />
                <Area
                  type="monotone"
                  dataKey="count"
                  name="Requests"
                  stroke="#3b82f6"
                  strokeWidth={2.5}
                  fill="url(#resourceGradient)"
                  dot={{ r: 3, fill: '#3b82f6', strokeWidth: 0 }}
                  activeDot={{ r: 5, fill: '#3b82f6', stroke: '#fff', strokeWidth: 2 }}
                />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </ChartSection>
      </div>

      {/* ── Charts Row 2: Distribution pies ────────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        <ChartSection icon={AlertTriangle} title="Faults by Status">
          {isLoading ? skeletonChart : (
            <ResponsiveContainer width="100%" height={190}>
              <PieChart>
                <Pie data={faultByStatusData} cx="50%" cy="50%" innerRadius={48} outerRadius={70}
                  paddingAngle={3} dataKey="value" strokeWidth={0}>
                  {faultByStatusData.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                </Pie>
                <Tooltip {...tooltipProps} />
                <Legend iconType="circle" iconSize={7} wrapperStyle={legendStyle} />
              </PieChart>
            </ResponsiveContainer>
          )}
        </ChartSection>

        <ChartSection icon={AlertTriangle} title="Faults by Type">
          {isLoading ? skeletonChart : (
            <ResponsiveContainer width="100%" height={190}>
              <PieChart>
                <Pie data={faultByTypeData} cx="50%" cy="50%" innerRadius={48} outerRadius={70}
                  paddingAngle={3} dataKey="value" strokeWidth={0}>
                  {faultByTypeData.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                </Pie>
                <Tooltip {...tooltipProps} />
                <Legend iconType="circle" iconSize={7} wrapperStyle={legendStyle} />
              </PieChart>
            </ResponsiveContainer>
          )}
        </ChartSection>

        <ChartSection icon={Package} title="Resources by Status">
          {isLoading ? skeletonChart : (
            <ResponsiveContainer width="100%" height={190}>
              <PieChart>
                <Pie data={resourceByStatusData} cx="50%" cy="50%" innerRadius={48} outerRadius={70}
                  paddingAngle={3} dataKey="value" strokeWidth={0}>
                  {resourceByStatusData.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                </Pie>
                <Tooltip {...tooltipProps} />
                <Legend iconType="circle" iconSize={7} wrapperStyle={legendStyle} />
              </PieChart>
            </ResponsiveContainer>
          )}
        </ChartSection>

        <ChartSection icon={Monitor} title="Systems by Status">
          {isLoading ? skeletonChart : (
            <ResponsiveContainer width="100%" height={190}>
              <PieChart>
                <Pie data={systemByStatusData} cx="50%" cy="50%" innerRadius={48} outerRadius={70}
                  paddingAngle={3} dataKey="value" strokeWidth={0}>
                  {systemByStatusData.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                </Pie>
                <Tooltip {...tooltipProps} />
                <Legend iconType="circle" iconSize={7} wrapperStyle={legendStyle} />
              </PieChart>
            </ResponsiveContainer>
          )}
        </ChartSection>
      </div>

      {/* ── Oversight section ──────────────────────────────────────────────── */}
      <div className="border-t border-slate-200 dark:border-slate-700 pt-6">
        <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100 mb-4">Oversight & Budgeting</h2>
        <OversightSection />
      </div>
    </div>
  );
}