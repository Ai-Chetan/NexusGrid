import { useState, useMemo } from 'react';
import { useQuery, keepPreviousData } from '@tanstack/react-query';
import {
  BarChart, Bar, PieChart, Pie, Cell, Legend, XAxis, YAxis,
  CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line,
} from 'recharts';
import { RefreshCw, Building2, Layers, LayoutDashboard, BookOpen } from 'lucide-react';
import { reportsApi, layoutApi, labsApi, privilegesApi } from '@/lib/api';
import PageHeader from '@/components/common/PageHeader';
import ErrorState from '@/components/common/ErrorState';
import { useTheme } from '@/hooks/useTheme';
import { useAuthStore } from '@/store/authStore';
import type { LayoutItem, Lab } from '@/types';

const COLORS = ['#3b82f6', '#ef4444', '#f59e0b', '#10b981', '#8b5cf6', '#06b6d4', '#ec4899'];

function Card({ title, children, dark }: { title: string; children: React.ReactNode; dark?: boolean }) {
  return (
    <div className="card p-5">
      <p className={`text-sm font-semibold mb-4 ${dark ? 'text-slate-200' : 'text-slate-700'}`}>{title}</p>
      {children}
    </div>
  );
}

// Tiny select used in the admin filter bar
function FilterSelect({
  label, icon: Icon, value, onChange, disabled, placeholder, options, dark,
}: {
  label: string;
  icon: React.ElementType;
  value: number | '';
  onChange: (v: number | '') => void;
  disabled?: boolean;
  placeholder: string;
  options: { id: number; name: string }[];
  dark: boolean;
}) {
  return (
    <div className="flex flex-col gap-1 min-w-[160px]">
      <label className={`text-xs font-medium flex items-center gap-1 ${dark ? 'text-slate-400' : 'text-slate-500'}`}>
        <Icon className="w-3.5 h-3.5" />
        {label}
      </label>
      <select
        value={value}
        onChange={e => onChange(e.target.value === '' ? '' : Number(e.target.value))}
        disabled={disabled}
        className={`text-sm rounded-lg border px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-500 transition
          ${dark
            ? 'bg-slate-800 border-slate-600 text-slate-200 disabled:text-slate-600'
            : 'bg-white border-slate-300 text-slate-700 disabled:text-slate-400'
          } disabled:cursor-not-allowed`}
      >
        <option value="">{placeholder}</option>
        {options.map(o => (
          <option key={o.id} value={o.id}>{o.name}</option>
        ))}
      </select>
    </div>
  );
}

export default function ReportsPage() {
  const { theme } = useTheme();
  const dark = theme === 'dark';
  const user = useAuthStore(s => s.user);
  const isAdmin = user?.role === 'Administrator';
  const isRestricted = user?.role === 'Lab Incharge' || user?.role === 'Lab Assistant';

  // ── Admin filter state ──────────────────────────────────────────────────
  const [selectedBuilding, setSelectedBuilding] = useState<number | ''>('');
  const [selectedFloor, setSelectedFloor]     = useState<number | ''>('');
  const [selectedLab, setSelectedLab]         = useState<number | ''>('');

  // ── Incharge/Assistant filter state ────────────────────────────────────
  const [selectedRestrictedLab, setSelectedRestrictedLab] = useState<number | ''>('');

  // ── Fetch this user's own active assignments (incharge / assistant) ─────
  const { data: myAssignments = [] } = useQuery({
    queryKey: ['my-assignments'],
    queryFn: () => privilegesApi.getAssignments().then(r => r.data as { id: number; lab: number; lab_name: string }[]),
    enabled: isRestricted,
    staleTime: 5 * 60 * 1000,
  });

  // Deduplicate by lab id (a user may have incharge + assistant on the same lab)
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
    queryKey: ['layout-floors', selectedBuilding],
    queryFn: () => layoutApi.getItems({ parent_id: selectedBuilding as number }).then(r =>
      (r.data as LayoutItem[]).filter(i => i.item_type === 'floor'),
    ),
    enabled: isAdmin && !!selectedBuilding,
    staleTime: 10 * 60 * 1000,
  });

  // Defer fetching all labs until a building is actually selected in the filter
  const { data: allLabs = [] } = useQuery<Lab[]>({
    queryKey: ['labs'],
    queryFn: () => labsApi.list().then(r => r.data),
    enabled: isAdmin && !!selectedBuilding,
    staleTime: 10 * 60 * 1000,
  });

  const labsForFloor = useMemo((): Lab[] => {
    if (!selectedFloor) return [];
    return allLabs.filter(l => l.floor_id === selectedFloor);
  }, [allLabs, selectedFloor]);

  // ── Derive report query params from admin filter selection ───────────────
  const reportParams = useMemo(() => {
    if (isRestricted) {
      return selectedRestrictedLab ? { lab_id: selectedRestrictedLab as number } : undefined;
    }
    if (!isAdmin) return undefined;
    if (selectedLab)      return { lab_id: selectedLab as number };
    if (selectedFloor)    return { floor_id: selectedFloor as number };
    if (selectedBuilding) return { building_id: selectedBuilding as number };
    return undefined;
  }, [isAdmin, isRestricted, selectedBuilding, selectedFloor, selectedLab, selectedRestrictedLab]);

  // ── Scope label shown in the header description ─────────────────────────
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
    if (selectedBuilding) {
      const b = buildings.find(b => b.id === selectedBuilding);
      if (b) parts.push(b.name);
    }
    if (selectedFloor) {
      const f = floors.find(f => f.id === selectedFloor);
      if (f) parts.push(f.name);
    }
    if (selectedLab) {
      const l = labsForFloor.find(l => l.id === selectedLab);
      if (l) parts.push(l.lab_name);
    }
    return parts.length ? parts.join(' › ') : null;
  }, [isAdmin, isRestricted, selectedBuilding, selectedFloor, selectedLab, selectedRestrictedLab, buildings, floors, labsForFloor, myLabs]);

  const gridStroke   = dark ? '#334155' : '#cbd5e1';
  const tickFill     = dark ? '#64748b' : '#94a3b8';
  const tooltipStyle = {
    fontSize: 12, borderRadius: 8,
    boxShadow: '0 4px 20px rgba(0,0,0,.18)',
    backgroundColor: dark ? '#1e293b' : '#ffffff',
    color: dark ? '#f1f5f9' : '#0f172a',
    border: `1px solid ${dark ? '#334155' : '#e2e8f0'}`,
  };
  const tooltipLabelStyle = { color: dark ? '#cbd5e1' : '#374151', fontWeight: 600 };
  const tooltipItemStyle  = { color: dark ? '#94a3b8' : '#475569' };
  const tooltipCursor     = { fill: dark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)' };
  const tooltipProps = {
    contentStyle:  tooltipStyle,
    labelStyle:    tooltipLabelStyle,
    itemStyle:     tooltipItemStyle,
    cursor:        tooltipCursor,
  };
  const legendStyle = (size: number) => ({
    fontSize: size,
    color: dark ? '#94a3b8' : '#475569',
  });

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['reports', reportParams],
    queryFn: () => reportsApi.get(reportParams).then(r => r.data),
    // Match backend cache TTL — don't re-fetch data that's still fresh
    staleTime: 5 * 60 * 1000,
    // Keep the previous result visible while a new filter selection loads
    placeholderData: keepPreviousData,
  });

  if (isError) return <ErrorState message="Failed to load reports data." onRetry={refetch} />;

  const skeletonChart = (
    <div className={`h-48 rounded-xl animate-pulse ${dark ? 'bg-slate-700' : 'bg-slate-100'}`} />
  );

  const isFiltered = isRestricted
    ? !!selectedRestrictedLab
    : !!(selectedBuilding || selectedFloor || selectedLab);

  // Pivot fault_monthly into chart series
  const faultMonthly = data?.fault_monthly ?? [];
  const months = [...new Set(faultMonthly.map(x => x.month))];
  const types = [...new Set(faultMonthly.map(x => x.type))];
  const faultTrendData = months.map(m => {
    const row: Record<string, any> = { month: m };
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

  return (
    <div className="space-y-5 animate-fade-in">
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
          <button onClick={() => refetch()} className="btn-secondary">
            <RefreshCw className="w-4 h-4" /> Refresh
          </button>
        }
      />

      {/* Admin scope-filter bar */}
      {isAdmin && (
        <div className={`card p-4 flex flex-wrap items-end gap-4`}>
          <FilterSelect
            label="Building" icon={Building2}
            value={selectedBuilding}
            onChange={v => { setSelectedBuilding(v); setSelectedFloor(''); setSelectedLab(''); }}
            placeholder="All buildings"
            options={buildings.map(b => ({ id: b.id, name: b.name }))}
            dark={dark}
          />
          <FilterSelect
            label="Floor" icon={Layers}
            value={selectedFloor}
            onChange={v => { setSelectedFloor(v); setSelectedLab(''); }}
            disabled={!selectedBuilding}
            placeholder={selectedBuilding ? 'All floors' : 'Select building first'}
            options={floors.map(f => ({ id: f.id, name: f.name }))}
            dark={dark}
          />
          <FilterSelect
            label="Lab" icon={BookOpen}
            value={selectedLab}
            onChange={setSelectedLab}
            disabled={!selectedFloor}
            placeholder={selectedFloor ? 'All labs' : 'Select floor first'}
            options={labsForFloor.map(l => ({ id: l.id, name: l.lab_name }))}
            dark={dark}
          />
          {isFiltered && (
            <button
              onClick={() => { setSelectedBuilding(''); setSelectedFloor(''); setSelectedLab(''); }}
              className={`text-xs px-3 py-1.5 rounded-lg border transition self-end
                ${dark ? 'border-slate-600 text-slate-400 hover:text-slate-200 hover:border-slate-400' : 'border-slate-300 text-slate-500 hover:text-slate-700 hover:border-slate-400'}`}
            >
              Clear filter
            </button>
          )}
        </div>
      )}

      {/* Incharge / Assistant lab-picker filter bar */}
      {isRestricted && myLabs.length > 0 && (
        <div className={`card p-4 flex flex-wrap items-end gap-4`}>
          <FilterSelect
            label="Lab" icon={BookOpen}
            value={selectedRestrictedLab}
            onChange={setSelectedRestrictedLab}
            placeholder="All my assigned labs"
            options={myLabs.map(a => ({ id: a.lab, name: a.lab_name }))}
            dark={dark}
          />
          {isFiltered && (
            <button
              onClick={() => setSelectedRestrictedLab('')}
              className={`text-xs px-3 py-1.5 rounded-lg border transition self-end
                ${dark ? 'border-slate-600 text-slate-400 hover:text-slate-200 hover:border-slate-400' : 'border-slate-300 text-slate-500 hover:text-slate-700 hover:border-slate-400'}`}
            >
              Clear filter
            </button>
          )}
        </div>
      )}

      {/* Info banner for incharge/assistant showing scope */}
      {isRestricted && (
        <div className={`flex items-center gap-2 px-4 py-3 rounded-xl text-sm
          ${dark ? 'bg-blue-950 text-blue-300 border border-blue-800' : 'bg-blue-50 text-blue-700 border border-blue-200'}`}>
          <LayoutDashboard className="w-4 h-4 shrink-0" />
          <span>
            {selectedRestrictedLab
              ? `Filtered to: ${myLabs.find(l => l.lab === selectedRestrictedLab)?.lab_name ?? 'selected lab'}`
              : 'Statistics cover all labs you are currently assigned to.'}
          </span>
        </div>
      )}

      {/* Row 1 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Fault Monthly Trend */}
        <Card title="Monthly Fault Trend by Type" dark={dark}>
          {isLoading ? skeletonChart : (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={faultTrendData} barSize={14}>
                <CartesianGrid strokeDasharray="3 3" stroke={gridStroke} />
                <XAxis dataKey="month" tick={{ fontSize: 11, fill: tickFill }} tickLine={false} axisLine={false} />
                <YAxis tick={{ fontSize: 11, fill: tickFill }} tickLine={false} axisLine={false} />
                <Tooltip {...tooltipProps} />
                <Legend iconType="circle" iconSize={8} wrapperStyle={legendStyle(12)} />
                {types.map((t, i) => (
                  <Bar key={t} dataKey={t} name={t} fill={COLORS[i % COLORS.length]} radius={[4, 4, 0, 0]} />
                ))}
              </BarChart>
            </ResponsiveContainer>
          )}
        </Card>

        {/* Resource Monthly Trend */}
        <Card title="Monthly Resource Requests" dark={dark}>
          {isLoading ? skeletonChart : (
            <ResponsiveContainer width="100%" height={220}>
              <LineChart data={resourceTrend}>
                <CartesianGrid strokeDasharray="3 3" stroke={gridStroke} />
                <XAxis dataKey="month" tick={{ fontSize: 11, fill: tickFill }} tickLine={false} axisLine={false} />
                <YAxis tick={{ fontSize: 11, fill: tickFill }} tickLine={false} axisLine={false} />
                <Tooltip {...tooltipProps} />
                <Line type="monotone" dataKey="count" name="Requests" stroke="#3b82f6" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          )}
        </Card>
      </div>

      {/* Row 2 */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Fault by Status */}
        <Card title="Faults by Status" dark={dark}>
          {isLoading ? skeletonChart : (
            <ResponsiveContainer width="100%" height={180}>
              <PieChart>
                <Pie data={faultByStatusData} cx="50%" cy="50%" innerRadius={45} outerRadius={65}
                  paddingAngle={3} dataKey="value">
                  {faultByStatusData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                </Pie>
                <Tooltip {...tooltipProps} />
                <Legend iconType="circle" iconSize={7} wrapperStyle={legendStyle(11)} />
              </PieChart>
            </ResponsiveContainer>
          )}
        </Card>

        {/* Fault by Type */}
        <Card title="Faults by Type" dark={dark}>
          {isLoading ? skeletonChart : (
            <ResponsiveContainer width="100%" height={180}>
              <PieChart>
                <Pie data={faultByTypeData} cx="50%" cy="50%" innerRadius={45} outerRadius={65}
                  paddingAngle={3} dataKey="value">
                  {faultByTypeData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                </Pie>
                <Tooltip {...tooltipProps} />
                <Legend iconType="circle" iconSize={7} wrapperStyle={legendStyle(11)} />
              </PieChart>
            </ResponsiveContainer>
          )}
        </Card>

        {/* Resource by Status */}
        <Card title="Resources by Status" dark={dark}>
          {isLoading ? skeletonChart : (
            <ResponsiveContainer width="100%" height={180}>
              <PieChart>
                <Pie data={resourceByStatusData} cx="50%" cy="50%" innerRadius={45} outerRadius={65}
                  paddingAngle={3} dataKey="value">
                  {resourceByStatusData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                </Pie>
                <Tooltip {...tooltipProps} />
                <Legend iconType="circle" iconSize={7} wrapperStyle={legendStyle(11)} />
              </PieChart>
            </ResponsiveContainer>
          )}
        </Card>

        {/* System by Status */}
        <Card title="Systems by Status" dark={dark}>
          {isLoading ? skeletonChart : (
            <ResponsiveContainer width="100%" height={180}>
              <PieChart>
                <Pie data={systemByStatusData} cx="50%" cy="50%" innerRadius={45} outerRadius={65}
                  paddingAngle={3} dataKey="value">
                  {systemByStatusData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                </Pie>
                <Tooltip {...tooltipProps} />
                <Legend iconType="circle" iconSize={7} wrapperStyle={legendStyle(11)} />
              </PieChart>
            </ResponsiveContainer>
          )}
        </Card>
      </div>

      {/* Summary Table */}
      {!isLoading && data && (
        <div className="card p-5">
          <p className={`text-sm font-semibold mb-4 ${dark ? 'text-slate-200' : 'text-slate-700'}`}>Summary Table</p>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {[
              { label: 'Total Faults', value: Object.values(data.fault_by_status).reduce((a, b) => a + b, 0), color: 'text-red-500' },
              { label: 'Resolved Faults', value: data.fault_by_status['resolved'] ?? 0, color: 'text-emerald-500' },
              { label: 'Total Resource Requests', value: Object.values(data.resource_by_status).reduce((a, b) => a + b, 0), color: 'text-blue-500' },
              { label: 'Total Systems', value: Object.values(data.system_by_status).reduce((a, b) => a + b, 0), color: 'text-violet-500' },
            ].map(item => (
              <div key={item.label} className={`p-4 rounded-xl text-center ${dark ? 'bg-slate-800' : 'bg-slate-50'}`}>
                <p className={`text-2xl font-bold ${item.color}`}>{item.value}</p>
                <p className={`text-xs mt-1 ${dark ? 'text-slate-400' : 'text-slate-500'}`}>{item.label}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
