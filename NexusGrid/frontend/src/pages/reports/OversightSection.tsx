import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Activity, Download, FileSpreadsheet, Wallet } from 'lucide-react';
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

function SectionCard({ icon: Icon, title, children }: { icon: React.ElementType; title: string; children: React.ReactNode }) {
  return (
    <div className="card p-5 space-y-4">
      <div className="flex items-center gap-2">
        <Icon className="w-4 h-4 text-slate-500" />
        <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-200">{title}</h3>
      </div>
      {children}
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
    // Assistants always generate their own sheet; admins pick a staff member.
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
      <div className="card p-4 flex flex-wrap items-end gap-3">
        <div>
          <label className="label">From</label>
          <input type="date" className="input" value={start} max={end} onChange={(e) => setStart(e.target.value)} />
        </div>
        <div>
          <label className="label">To</label>
          <input type="date" className="input" value={end} min={start} onChange={(e) => setEnd(e.target.value)} />
        </div>
      </div>

      {/* Staff activity — admin only */}
      {isAdmin && (
        <SectionCard icon={Activity} title="Staff Activity">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-slate-500 border-b border-slate-200 dark:border-slate-700">
                  <th className="py-2 pr-4">User</th>
                  <th className="py-2 pr-4">Role</th>
                  <th className="py-2 pr-4">Faults Reported</th>
                  <th className="py-2 pr-4">Faults Resolved</th>
                  <th className="py-2 pr-4">Resources Requested</th>
                </tr>
              </thead>
              <tbody>
                {staff.map((s) => (
                  <tr key={s.user_id} className="border-b border-slate-100 dark:border-slate-800">
                    <td className="py-2 pr-4 font-medium text-slate-800 dark:text-slate-200">{s.username}</td>
                    <td className="py-2 pr-4 text-slate-500">{s.role}</td>
                    <td className="py-2 pr-4">{s.faults_reported}</td>
                    <td className="py-2 pr-4">{s.faults_resolved}</td>
                    <td className="py-2 pr-4">{s.resources_requested}</td>
                  </tr>
                ))}
                {!staff.length && (
                  <tr><td colSpan={5} className="py-4 text-center text-slate-400">No staff activity in this range.</td></tr>
                )}
              </tbody>
            </table>
          </div>
          <div className="flex justify-end">
            <button type="button" className="btn-primary" onClick={exportStaff}>
              <Download className="w-4 h-4" /> Export CSV
            </button>
          </div>
        </SectionCard>
      )}

      {/* Task sheet — admin picks staff; assistant gets their own */}
      <SectionCard icon={FileSpreadsheet} title={isAdmin ? 'Generate Task Sheet' : 'Generate My Task Sheet'}>
        <div className="flex flex-wrap items-end gap-3">
          {isAdmin && (
            <div className="min-w-[220px]">
              <label className="label">Staff member</label>
              <select className="input" value={taskUserId} onChange={(e) => setTaskUserId(e.target.value ? Number(e.target.value) : '')}>
                <option value="">Select…</option>
                {staff.map((s) => (
                  <option key={s.user_id} value={s.user_id}>{s.username} ({s.role})</option>
                ))}
              </select>
            </div>
          )}
          <button type="button" className="btn-primary" disabled={isAdmin && !taskUserId} onClick={exportTaskSheet}>
            <Download className="w-4 h-4" /> Download Task Sheet
          </button>
        </div>
        <p className="text-xs text-slate-400">
          Uses the date range above. Includes all faults and resource requests
          {isAdmin ? ' for the selected staff member.' : ' you reported or handled.'}
        </p>
      </SectionCard>

      {/* Budget summary — admin only */}
      {isAdmin && (
        <SectionCard icon={Wallet} title="Monthly Resource Demand & Budget">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-slate-500 border-b border-slate-200 dark:border-slate-700">
                  <th className="py-2 pr-4">Month</th>
                  <th className="py-2 pr-4">Requests</th>
                  <th className="py-2 pr-4">Distinct Requesters</th>
                  <th className="py-2 pr-4">Total Cost</th>
                </tr>
              </thead>
              <tbody>
                {budget?.months.map((m) => (
                  <tr key={m.month} className="border-b border-slate-100 dark:border-slate-800">
                    <td className="py-2 pr-4 font-medium text-slate-800 dark:text-slate-200">{m.month}</td>
                    <td className="py-2 pr-4">{m.request_count}</td>
                    <td className="py-2 pr-4">{m.distinct_requesters}</td>
                    <td className="py-2 pr-4">{m.total_cost.toFixed(2)}</td>
                  </tr>
                ))}
                {!budget?.months.length && (
                  <tr><td colSpan={4} className="py-4 text-center text-slate-400">No resource requests in this range.</td></tr>
                )}
              </tbody>
              {budget && budget.months.length > 0 && (
                <tfoot>
                  <tr className="font-semibold text-slate-800 dark:text-slate-200">
                    <td className="py-2 pr-4">Grand Total</td>
                    <td /><td />
                    <td className="py-2 pr-4">{budget.grand_total_cost.toFixed(2)}</td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
          <div className="flex justify-end">
            <button type="button" className="btn-primary" onClick={exportBudget}>
              <Download className="w-4 h-4" /> Export CSV
            </button>
          </div>
        </SectionCard>
      )}
    </div>
  );
}