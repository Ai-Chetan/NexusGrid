import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Download, FileSpreadsheet, Wallet, Calendar, Users } from 'lucide-react';
import { adminApi } from '@/lib/api';
import { buildCsvSection, downloadCsv } from '@/lib/csv';
import { useAuthStore } from '@/store/authStore';
import toast from 'react-hot-toast';

interface StaffRow {
  user_id: number;
  username: string;
  role: string;
  faults_reported: number;
  faults_resolved: number;
  resources_requested: number;
}
interface BudgetMonth {
  month: string;
  request_count: number;
  distinct_requesters: number;
  total_cost: number;
}
interface TaskSheet {
  user: { id: number; username: string; role: string };
  start: string;
  end: string;
  faults: {
    fault_id: number; reported_at: string; system_name: string; lab_name: string;
    fault_type: string; risk_factor: string; status: string; description: string;
  }[];
  resources: {
    resource_id: number; requested_at: string; system_name: string; lab_name: string;
    resource_name: string; quantity: number; cost: number | null; status: string; description: string;
  }[];
  totals: { faults: number; resources: number };
}

function SectionCard({ icon: Icon, title, subtitle, actions, children }: {
  icon: React.ElementType; title: string; subtitle?: string; actions?: React.ReactNode; children: React.ReactNode;
}) {
  return (
    <div className="card overflow-hidden">
      <div className="flex items-center justify-between gap-2 flex-wrap px-5 pt-5 pb-3">
        <div className="flex items-center gap-3">
          <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-blue-50 dark:bg-blue-950/50">
            <Icon className="w-4 h-4 text-blue-600 dark:text-blue-400" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-200">{title}</h3>
            {subtitle && <p className="text-xs text-slate-400 dark:text-slate-500">{subtitle}</p>}
          </div>
        </div>
        {actions && <div className="flex gap-2">{actions}</div>}
      </div>
      <div className="px-5 pb-5">{children}</div>
    </div>
  );
}

/**
 * Oversight tools merged into Reports.
 * Admin: staff activity table, task sheet for any staff, budget summary.
 * Lab Assistant: only their own task sheet (custom date range).
 */
export default function OversightSection() {
  const user = useAuthStore((s) => s.user);
  const isAdmin = user?.role === 'Administrator';

  const today = new Date().toISOString().slice(0, 10);
  const monthAgo = new Date(Date.now() - 30 * 864e5).toISOString().slice(0, 10);
  const [start, setStart] = useState(monthAgo);
  const [end, setEnd] = useState(today);
  const [taskUserId, setTaskUserId] = useState<number | ''>('');

  const range = { start, end };

  const { data: staff = [] } = useQuery<StaffRow[]>({
    queryKey: ['admin-staff-activity', start, end],
    queryFn: () => adminApi.staffActivity(range).then((r) => r.data.staff as StaffRow[]),
    enabled: isAdmin,
  });

  const { data: budget } = useQuery<{ months: BudgetMonth[]; grand_total_cost: number }>({
    queryKey: ['admin-budget-summary', start, end],
    queryFn: () => adminApi.budgetSummary(range).then((r) => r.data),
    enabled: isAdmin,
  });

  const exportStaff = () => {
    if (!staff.length) return toast.error('No staff activity to export.');
    downloadCsv(
      [
        `Staff Activity ${start} to ${end}`,
        buildCsvSection('', ['User', 'Role', 'Faults Reported', 'Faults Resolved', 'Resources Requested'],
          staff.map((s) => [s.username, s.role, s.faults_reported, s.faults_resolved, s.resources_requested])),
      ],
      `nexusgrid_staff_activity_${start}_${end}.csv`,
    );
    toast.success('Staff activity CSV downloaded.');
  };

  const exportBudget = () => {
    if (!budget?.months.length) return toast.error('No budget data to export.');
    downloadCsv(
      [
        `Budget Summary ${start} to ${end}`,
        buildCsvSection('', ['Month', 'Requests', 'Distinct Requesters', 'Total Cost'],
          budget.months.map((m) => [m.month, m.request_count, m.distinct_requesters, m.total_cost.toFixed(2)])),
        `Grand Total,,,${budget.grand_total_cost.toFixed(2)}`,
      ],
      `nexusgrid_budget_summary_${start}_${end}.csv`,
    );
    toast.success('Budget summary CSV downloaded.');
  };

  const exportTaskSheet = async () => {
    const targetId = isAdmin ? taskUserId : user?.id;
    if (!targetId) return toast.error('Pick a staff member first.');
    try {
      const { data } = await adminApi.taskSheet({ user_id: Number(targetId), start, end });
      const sheet = data as TaskSheet;
      downloadCsv(
        [
          `Task Sheet — ${sheet.user.username} (${sheet.user.role}) ${sheet.start} to ${sheet.end}`,
          '',
          buildCsvSection('FAULTS', ['ID', 'Reported', 'System', 'Lab', 'Type', 'Risk', 'Status', 'Description'],
            sheet.faults.map((f) => [f.fault_id, f.reported_at, f.system_name, f.lab_name, f.fault_type, f.risk_factor, f.status, f.description])),
          buildCsvSection('RESOURCES', ['ID', 'Requested', 'System', 'Lab', 'Resource', 'Qty', 'Cost', 'Status', 'Description'],
            sheet.resources.map((r) => [r.resource_id, r.requested_at, r.system_name, r.lab_name, r.resource_name, r.quantity, r.cost ?? '', r.status, r.description])),
          `Totals,Faults ${sheet.totals.faults},Resources ${sheet.totals.resources}`,
        ],
        `nexusgrid_tasksheet_${sheet.user.username}_${start}_${end}.csv`,
      );
      toast.success('Task sheet CSV downloaded.');
    } catch {
      toast.error('Failed to generate task sheet.');
    }
  };

  return (
    <div className="space-y-5">
      {/* Shared date range */}
      <div className="card p-4">
        <div className="flex items-center gap-2 mb-3">
          <Calendar className="w-4 h-4 text-slate-400" />
          <span className="text-xs font-medium text-slate-500 dark:text-slate-400">Date range for oversight reports</span>
        </div>
        <div className="flex flex-wrap items-end gap-3">
          <div>
            <label className="label text-xs">From</label>
            <input type="date" className="input text-xs py-1.5" value={start} max={end} onChange={(e) => setStart(e.target.value)} />
          </div>
          <div>
            <label className="label text-xs">To</label>
            <input type="date" className="input text-xs py-1.5" value={end} min={start} onChange={(e) => setEnd(e.target.value)} />
          </div>
        </div>
      </div>

      {/* Staff activity — admin only */}
      {isAdmin && (
        <SectionCard
          icon={Users}
          title="Staff Activity"
          subtitle="Fault and resource contributions per team member"
          actions={
            <button type="button" className="btn-secondary text-xs" onClick={exportStaff}>
              <Download className="w-3.5 h-3.5" /> CSV
            </button>
          }
        >
          <div className="overflow-x-auto rounded-lg border border-slate-200 dark:border-slate-700">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider bg-slate-50 dark:bg-slate-800/80">
                  <th className="py-3 px-4">User</th>
                  <th className="py-3 px-4">Role</th>
                  <th className="py-3 px-4">Faults Reported</th>
                  <th className="py-3 px-4">Faults Resolved</th>
                  <th className="py-3 px-4">Resources Requested</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {staff.map((s) => (
                  <tr key={s.user_id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors">
                    <td className="py-2.5 px-4 font-medium text-slate-800 dark:text-slate-200">{s.username}</td>
                    <td className="py-2.5 px-4">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium
                        ${s.role === 'Administrator' ? 'bg-violet-50 text-violet-700 dark:bg-violet-950/40 dark:text-violet-400'
                        : s.role === 'Lab Incharge' ? 'bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-400'
                        : s.role === 'Lab Assistant' ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400'
                        : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400'}`}>
                        {s.role}
                      </span>
                    </td>
                    <td className="py-2.5 px-4 text-red-600 dark:text-red-400 font-medium">{s.faults_reported}</td>
                    <td className="py-2.5 px-4 text-emerald-600 dark:text-emerald-400 font-medium">{s.faults_resolved}</td>
                    <td className="py-2.5 px-4 text-blue-600 dark:text-blue-400 font-medium">{s.resources_requested}</td>
                  </tr>
                ))}
                {!staff.length && (
                  <tr><td colSpan={5} className="py-8 text-center text-slate-400">No staff activity in this range.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </SectionCard>
      )}

      {/* Task sheet — admin picks staff; assistant gets their own */}
      <SectionCard
        icon={FileSpreadsheet}
        title={isAdmin ? 'Generate Task Sheet' : 'Generate My Task Sheet'}
        subtitle="Detailed fault and resource log for a team member"
      >
        <div className="flex flex-wrap items-end gap-3">
          {isAdmin && (
            <div className="min-w-[220px]">
              <label className="label text-xs">Staff member</label>
              <select className="input text-xs py-1.5" value={taskUserId} onChange={(e) => setTaskUserId(e.target.value ? Number(e.target.value) : '')}>
                <option value="">Select…</option>
                {staff.map((s) => (
                  <option key={s.user_id} value={s.user_id}>{s.username} ({s.role})</option>
                ))}
              </select>
            </div>
          )}
          <button type="button" className="btn-primary text-xs" disabled={isAdmin && !taskUserId} onClick={exportTaskSheet}>
            <Download className="w-3.5 h-3.5" /> Download Task Sheet
          </button>
        </div>
        <p className="text-xs text-slate-400 mt-2">
          Uses the date range above. Includes all faults and resource requests
          {isAdmin ? ' for the selected staff member.' : ' you reported or handled.'}
        </p>
      </SectionCard>

      {/* Budget summary — admin only */}
      {isAdmin && (
        <SectionCard
          icon={Wallet}
          title="Monthly Resource Demand & Budget"
          subtitle="Cost tracking across resource requests"
          actions={
            <button type="button" className="btn-secondary text-xs" onClick={exportBudget}>
              <Download className="w-3.5 h-3.5" /> CSV
            </button>
          }
        >
          <div className="overflow-x-auto rounded-lg border border-slate-200 dark:border-slate-700">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider bg-slate-50 dark:bg-slate-800/80">
                  <th className="py-3 px-4">Month</th>
                  <th className="py-3 px-4">Requests</th>
                  <th className="py-3 px-4">Distinct Requesters</th>
                  <th className="py-3 px-4">Total Cost</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {budget?.months.map((m) => (
                  <tr key={m.month} className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors">
                    <td className="py-2.5 px-4 font-medium text-slate-800 dark:text-slate-200">{m.month}</td>
                    <td className="py-2.5 px-4">{m.request_count}</td>
                    <td className="py-2.5 px-4">{m.distinct_requesters}</td>
                    <td className="py-2.5 px-4 font-semibold text-slate-800 dark:text-slate-200">₹{m.total_cost.toFixed(2)}</td>
                  </tr>
                ))}
                {!budget?.months.length && (
                  <tr><td colSpan={4} className="py-8 text-center text-slate-400">No resource requests in this range.</td></tr>
                )}
              </tbody>
              {budget && budget.months.length > 0 && (
                <tfoot>
                  <tr className="font-semibold text-slate-800 dark:text-slate-200 bg-slate-50 dark:bg-slate-800/80 border-t-2 border-slate-200 dark:border-slate-700">
                    <td className="py-3 px-4">Grand Total</td>
                    <td /><td />
                    <td className="py-3 px-4 text-lg">₹{budget.grand_total_cost.toFixed(2)}</td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        </SectionCard>
      )}
    </div>
  );
}