import { useQuery } from '@tanstack/react-query';
import {
  BarChart, Bar, PieChart, Pie, Cell, Legend, XAxis, YAxis,
  CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line,
} from 'recharts';
import { BarChart3, RefreshCw } from 'lucide-react';
import { reportsApi } from '@/lib/api';
import PageHeader from '@/components/common/PageHeader';
import ErrorState from '@/components/common/ErrorState';

const COLORS = ['#3b82f6', '#ef4444', '#f59e0b', '#10b981', '#8b5cf6', '#06b6d4', '#ec4899'];

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="card p-5">
      <p className="text-sm font-semibold text-slate-700 mb-4">{title}</p>
      {children}
    </div>
  );
}

export default function ReportsPage() {
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['reports'],
    queryFn: () => reportsApi.get().then(r => r.data),
  });

  if (isError) return <ErrorState message="Failed to load reports data." onRetry={refetch} />;

  const skeletonChart = (
    <div className="h-48 bg-slate-100 rounded-xl animate-pulse" />
  );

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

  const tooltipStyle = {
    fontSize: 12, borderRadius: 8, border: 'none',
    boxShadow: '0 4px 20px rgba(0,0,0,.1)',
  };

  return (
    <div className="space-y-5 animate-fade-in">
      <PageHeader
        title="Reports & Analytics"
        description="Visual overview of faults, resources, and system status."
        actions={
          <button onClick={() => refetch()} className="btn-secondary">
            <RefreshCw className="w-4 h-4" /> Refresh
          </button>
        }
      />

      {/* Row 1 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Fault Monthly Trend */}
        <Card title="Monthly Fault Trend by Type">
          {isLoading ? skeletonChart : (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={faultTrendData} barSize={14}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#94a3b8' }} tickLine={false} axisLine={false} />
                <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} tickLine={false} axisLine={false} />
                <Tooltip contentStyle={tooltipStyle} />
                <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 12 }} />
                {types.map((t, i) => (
                  <Bar key={t} dataKey={t} name={t} fill={COLORS[i % COLORS.length]} radius={[4, 4, 0, 0]} />
                ))}
              </BarChart>
            </ResponsiveContainer>
          )}
        </Card>

        {/* Resource Monthly Trend */}
        <Card title="Monthly Resource Requests">
          {isLoading ? skeletonChart : (
            <ResponsiveContainer width="100%" height={220}>
              <LineChart data={resourceTrend}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#94a3b8' }} tickLine={false} axisLine={false} />
                <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} tickLine={false} axisLine={false} />
                <Tooltip contentStyle={tooltipStyle} />
                <Line type="monotone" dataKey="count" name="Requests" stroke="#3b82f6" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          )}
        </Card>
      </div>

      {/* Row 2 */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Fault by Status */}
        <Card title="Faults by Status">
          {isLoading ? skeletonChart : (
            <ResponsiveContainer width="100%" height={180}>
              <PieChart>
                <Pie data={faultByStatusData} cx="50%" cy="50%" innerRadius={45} outerRadius={65}
                  paddingAngle={3} dataKey="value">
                  {faultByStatusData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                </Pie>
                <Tooltip contentStyle={tooltipStyle} />
                <Legend iconType="circle" iconSize={7} wrapperStyle={{ fontSize: 11 }} />
              </PieChart>
            </ResponsiveContainer>
          )}
        </Card>

        {/* Fault by Type */}
        <Card title="Faults by Type">
          {isLoading ? skeletonChart : (
            <ResponsiveContainer width="100%" height={180}>
              <PieChart>
                <Pie data={faultByTypeData} cx="50%" cy="50%" innerRadius={45} outerRadius={65}
                  paddingAngle={3} dataKey="value">
                  {faultByTypeData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                </Pie>
                <Tooltip contentStyle={tooltipStyle} />
                <Legend iconType="circle" iconSize={7} wrapperStyle={{ fontSize: 11 }} />
              </PieChart>
            </ResponsiveContainer>
          )}
        </Card>

        {/* Resource by Status */}
        <Card title="Resources by Status">
          {isLoading ? skeletonChart : (
            <ResponsiveContainer width="100%" height={180}>
              <PieChart>
                <Pie data={resourceByStatusData} cx="50%" cy="50%" innerRadius={45} outerRadius={65}
                  paddingAngle={3} dataKey="value">
                  {resourceByStatusData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                </Pie>
                <Tooltip contentStyle={tooltipStyle} />
                <Legend iconType="circle" iconSize={7} wrapperStyle={{ fontSize: 11 }} />
              </PieChart>
            </ResponsiveContainer>
          )}
        </Card>

        {/* System by Status */}
        <Card title="Systems by Status">
          {isLoading ? skeletonChart : (
            <ResponsiveContainer width="100%" height={180}>
              <PieChart>
                <Pie data={systemByStatusData} cx="50%" cy="50%" innerRadius={45} outerRadius={65}
                  paddingAngle={3} dataKey="value">
                  {systemByStatusData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                </Pie>
                <Tooltip contentStyle={tooltipStyle} />
                <Legend iconType="circle" iconSize={7} wrapperStyle={{ fontSize: 11 }} />
              </PieChart>
            </ResponsiveContainer>
          )}
        </Card>
      </div>

      {/* Summary Table */}
      {!isLoading && data && (
        <div className="card p-5">
          <p className="text-sm font-semibold text-slate-700 mb-4">Summary Table</p>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {[
              { label: 'Total Faults', value: Object.values(data.fault_by_status).reduce((a, b) => a + b, 0), color: 'text-red-600' },
              { label: 'Resolved Faults', value: data.fault_by_status['resolved'] ?? 0, color: 'text-emerald-600' },
              { label: 'Total Resource Requests', value: Object.values(data.resource_by_status).reduce((a, b) => a + b, 0), color: 'text-blue-600' },
              { label: 'Total Systems', value: Object.values(data.system_by_status).reduce((a, b) => a + b, 0), color: 'text-violet-600' },
            ].map(item => (
              <div key={item.label} className="p-4 bg-slate-50 rounded-xl text-center">
                <p className={`text-2xl font-bold ${item.color}`}>{item.value}</p>
                <p className="text-xs text-slate-500 mt-1">{item.label}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
