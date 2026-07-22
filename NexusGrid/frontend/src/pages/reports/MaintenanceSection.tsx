import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Download, FileText, Monitor, Printer, Wrench } from 'lucide-react';
import { adminApi, labsApi, privilegesApi, reportsApi } from '@/lib/api';
import { buildCsvSection, downloadCsv } from '@/lib/csv';
import { generatePdfReport } from '@/lib/pdfReport';
import { useAuthStore } from '@/store/authStore';
import toast from 'react-hot-toast';
import type { Lab } from '@/types';

interface SummaryRow {
  period: string;
  faults_reported: number;
  faults_resolved: number;
  resources_requested: number;
  resources_fulfilled: number;
}
interface SummaryData {
  period: 'weekly' | 'monthly';
  scope: { user?: { id: number; username: string; role: string }; lab?: { id: number; name: string } };
  generated_at: string;
  rows: SummaryRow[];
  totals: Omit<SummaryRow, 'period'>;
}
interface StaffRow { user_id: number; username: string; role: string }
interface CostItem {
  resource_id: number; requested_at: string; resource_name: string; system_name: string;
  lab_name: string; requested_by: string; quantity: number;
  unit_cost: number | null; line_total: number | null; status: string;
}
interface CostDepartment { department: string; items: CostItem[]; subtotal: number; items_without_cost: number }
interface CostReport {
  start: string | null; end: string | null; generated_at: string;
  departments: CostDepartment[]; grand_total: number;
}
interface PcLabRow { lab_id: number; lab_name: string; total: number; working: number; inactive: number; not_working: number; under_maintenance: number }
interface PcStatusData {
  generated_at: string; total: number; working: number; inactive: number;
  not_working: number; under_maintenance: number; per_lab: PcLabRow[];
}

function SectionCard({ icon: Icon, title, actions, children }: {
  icon: React.ElementType; title: string; actions?: React.ReactNode; children: React.ReactNode;
}) {
  return (
    <div className="card p-5 space-y-4">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-2">
          <Icon className="w-4 h-4 text-slate-500" />
          <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-200">{title}</h3>
        </div>
        {actions}
      </div>
      {children}
    </div>
  );
}

/**
 * Maintenance reporting merged into Reports:
 * - Weekly/monthly maintenance summary (assistant's own work, a specific lab, or global for admin).
 * - Admin: overall PC status counts with per-lab breakdown.
 * - Admin: printable, read-only replacement-cost report grouped by department (building).
 */
export default function MaintenanceSection() {
  const user = useAuthStore((s) => s.user);
  const isAdmin = user?.role === 'Administrator';

  const today = new Date().toISOString().slice(0, 10);
  const quarterAgo = new Date(Date.now() - 90 * 864e5).toISOString().slice(0, 10);
  const [start, setStart] = useState(quarterAgo);
  const [end, setEnd] = useState(today);
  const [period, setPeriod] = useState<'weekly' | 'monthly'>('monthly');
  const [staffId, setStaffId] = useState<number | ''>('');
  const [labId, setLabId] = useState<number | ''>('');

  const { data: staff = [] } = useQuery<StaffRow[]>({
    queryKey: ['admin-staff-activity', start, end],
    queryFn: () => adminApi.staffActivity({ start, end }).then((r) => r.data.staff as StaffRow[]),
    enabled: isAdmin,
  });
  const assistants = staff.filter((s) => s.role === 'Lab Assistant');

  const { data: allLabs = [] } = useQuery<Lab[]>({
    queryKey: ['labs'],
    queryFn: () => labsApi.list().then((r) => r.data),
    enabled: isAdmin,
    staleTime: 10 * 60 * 1000,
  });

  const { data: myAssignments = [] } = useQuery({
    queryKey: ['my-assignments'],
    queryFn: () => privilegesApi.getAssignments().then((r) => r.data as { id: number; lab: number; lab_name: string }[]),
    enabled: !isAdmin,
    staleTime: 5 * 60 * 1000,
  });

  const labOptions = useMemo(() => {
    if (isAdmin) return allLabs.map((l) => ({ id: l.id, name: l.lab_name }));
    const seen = new Set<number>();
    return myAssignments
      .filter((a) => (seen.has(a.lab) ? false : (seen.add(a.lab), true)))
      .map((a) => ({ id: a.lab, name: a.lab_name }));
  }, [isAdmin, allLabs, myAssignments]);

  const summaryParams = useMemo(() => ({
    period, start, end,
    ...(isAdmin && staffId ? { user_id: Number(staffId) } : {}),
    ...(labId ? { lab_id: Number(labId) } : {}),
  }), [period, start, end, isAdmin, staffId, labId]);

  const { data: summary, isLoading: summaryLoading } = useQuery<SummaryData>({
    queryKey: ['maintenance-summary', summaryParams],
    queryFn: () => reportsApi.maintenanceSummary(summaryParams).then((r) => r.data),
  });

  const { data: pc } = useQuery<PcStatusData>({
    queryKey: ['pc-status'],
    queryFn: () => reportsApi.pcStatus().then((r) => r.data),
    enabled: isAdmin,
    staleTime: 60 * 1000,
  });

  const { data: costs } = useQuery<CostReport>({
    queryKey: ['replacement-costs', start, end],
    queryFn: () => reportsApi.replacementCosts({ start, end }).then((r) => r.data),
    enabled: isAdmin,
  });

  const scopeText = summary?.scope.lab
    ? `Lab: ${summary.scope.lab.name}`
    : summary?.scope.user
    ? `${summary.scope.user.username} (${summary.scope.user.role})`
    : 'All labs and staff';

  const exportSummary = () => {
    if (!summary?.rows.length) return toast.error('No maintenance activity in this range.');
    downloadCsv(
      [
        `Maintenance Summary (${summary.period}) — ${scopeText} — ${start} to ${end}`,
        buildCsvSection('', ['Period', 'Faults Reported', 'Faults Resolved', 'Resources Requested', 'Resources Fulfilled'],
          summary.rows.map((r) => [r.period, r.faults_reported, r.faults_resolved, r.resources_requested, r.resources_fulfilled])),
        `Totals,${summary.totals.faults_reported},${summary.totals.faults_resolved},${summary.totals.resources_requested},${summary.totals.resources_fulfilled}`,
      ],
      `nexusgrid_maintenance_${summary.period}_${start}_${end}.csv`,
    );
    toast.success('Maintenance summary CSV downloaded.');
  };

  const downloadSummaryPdf = () => {
    if (!summary?.rows.length) return toast.error('No maintenance activity in this range.');
    generatePdfReport({
      title: `Maintenance Summary (${summary.period === 'weekly' ? 'Weekly' : 'Monthly'})`,
      subtitle: scopeText,
      meta: [`Range: ${start} to ${end}`],
      stats: [
        { label: 'Faults Reported', value: String(summary.totals.faults_reported) },
        { label: 'Faults Resolved', value: String(summary.totals.faults_resolved) },
        { label: 'Resources Requested', value: String(summary.totals.resources_requested) },
        { label: 'Resources Fulfilled', value: String(summary.totals.resources_fulfilled) },
      ],
      tables: [{
        columns: [
          { header: summary.period === 'weekly' ? 'Week' : 'Month', key: 'period' },
          { header: 'Faults Reported', key: 'fr', align: 'right', width: 90 },
          { header: 'Faults Resolved', key: 'fres', align: 'right', width: 90 },
          { header: 'Req. Requested', key: 'rr', align: 'right', width: 90 },
          { header: 'Req. Fulfilled', key: 'rf', align: 'right', width: 90 },
        ],
        rows: summary.rows.map((r) => ({
          period: r.period, fr: r.faults_reported, fres: r.faults_resolved,
          rr: r.resources_requested, rf: r.resources_fulfilled,
        })),
        footer: {
          period: 'Totals',
          fr: summary.totals.faults_reported, fres: summary.totals.faults_resolved,
          rr: summary.totals.resources_requested, rf: summary.totals.resources_fulfilled,
        },
      }],
      fileName: `nexusgrid_maintenance_${summary.period}_${start}_${end}.pdf`,
    });
    toast.success('Maintenance summary PDF downloaded.');
  };

  const printCostReport = () => {
    if (!costs || !costs.departments.length) return toast.error('No replacement requests in this range.');
    const esc = (v: unknown) => String(v ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    const money = (v: number | null) => (v == null ? '—' : v.toFixed(2));
    const sections = costs.departments.map((d) => `
      <h2>${esc(d.department)}</h2>
      <table>
        <thead><tr><th>Date</th><th>Part / Resource</th><th>System</th><th>Lab</th><th>Requested By</th><th>Status</th><th class="num">Qty</th><th class="num">Unit Cost</th><th class="num">Line Total</th></tr></thead>
        <tbody>
          ${d.items.map((i) => `<tr><td>${esc(i.requested_at.slice(0, 10))}</td><td>${esc(i.resource_name)}</td><td>${esc(i.system_name)}</td><td>${esc(i.lab_name)}</td><td>${esc(i.requested_by)}</td><td>${esc(i.status)}</td><td class="num">${i.quantity}</td><td class="num">${money(i.unit_cost)}</td><td class="num">${money(i.line_total)}</td></tr>`).join('')}
        </tbody>
        <tfoot><tr><td colspan="8">Subtotal — ${esc(d.department)}${d.items_without_cost ? ` (${d.items_without_cost} item(s) without cost excluded)` : ''}</td><td class="num">${d.subtotal.toFixed(2)}</td></tr></tfoot>
      </table>`).join('');
    const html = `<!doctype html><html><head><title>Replacement Cost Report</title><style>
      body{font-family:Helvetica,Arial,sans-serif;color:#0f172a;margin:32px;}
      h1{font-size:20px;margin:0 0 4px;} .meta{color:#475569;font-size:12px;margin-bottom:20px;}
      h2{font-size:14px;margin:24px 0 8px;}
      table{width:100%;border-collapse:collapse;font-size:11px;}
      th,td{border:1px solid #cbd5e1;padding:5px 7px;text-align:left;}
      th{background:#f1f5f9;} .num{text-align:right;}
      tfoot td{font-weight:bold;background:#f8fafc;}
      .grand{margin-top:24px;font-size:14px;font-weight:bold;text-align:right;}
      @media print{body{margin:12mm;}}
    </style></head><body>
      <h1>NexusGrid — Replacement Cost Report</h1>
      <div class="meta">Replacement/resource requests raised by Lab Assistants, grouped by department.<br/>
        Range: ${esc(costs.start ?? 'beginning')} to ${esc(costs.end ?? 'today')} &nbsp;•&nbsp; Generated: ${esc(new Date(costs.generated_at).toLocaleString())}</div>
      ${sections}
      <div class="grand">Grand Total: ${costs.grand_total.toFixed(2)}</div>
    </body></html>`;
    const w = window.open('', '_blank', 'width=980,height=760');
    if (!w) return toast.error('Popup blocked — allow popups to print the report.');
    w.document.write(html);
    w.document.close();
    w.focus();
    w.print();
  };

  const downloadCostPdf = () => {
    if (!costs?.departments.length) return toast.error('No replacement requests in this range.');
    const money = (v: number | null) => (v == null ? '-' : v.toFixed(2));
    generatePdfReport({
      title: 'Replacement Cost Report',
      subtitle: 'Requests raised by Lab Assistants, grouped by department',
      meta: [
        `Range: ${costs.start ?? 'beginning'} to ${costs.end ?? 'today'}`,
        `Grand Total: ${costs.grand_total.toFixed(2)}`,
      ],
      stats: [
        { label: 'Departments', value: String(costs.departments.length) },
        { label: 'Requests', value: String(costs.departments.reduce((a, d) => a + d.items.length, 0)) },
        { label: 'Grand Total', value: costs.grand_total.toFixed(2) },
      ],
      tables: costs.departments.map((d) => ({
        title: `${d.department}${d.items_without_cost ? `  (${d.items_without_cost} item(s) without cost)` : ''}`,
        columns: [
          { header: 'Date', key: 'date', width: 58 },
          { header: 'Part / Resource', key: 'name' },
          { header: 'Lab', key: 'lab', width: 85 },
          { header: 'Requested By', key: 'by', width: 80 },
          { header: 'Qty', key: 'qty', align: 'right' as const, width: 32 },
          { header: 'Unit Cost', key: 'unit', align: 'right' as const, width: 55 },
          { header: 'Line Total', key: 'line', align: 'right' as const, width: 60 },
        ],
        rows: d.items.map((i) => ({
          date: i.requested_at.slice(0, 10), name: i.resource_name, lab: i.lab_name,
          by: i.requested_by, qty: i.quantity, unit: money(i.unit_cost), line: money(i.line_total),
        })),
        footer: { name: `Subtotal — ${d.department}`, line: d.subtotal.toFixed(2) },
      })),
      fileName: `nexusgrid_replacement_costs_${start}_${end}.pdf`,
    });
    toast.success('Replacement cost PDF downloaded.');
  };

  const downloadPcStatusPdf = () => {
    if (!pc) return toast.error('PC status not loaded yet.');
    generatePdfReport({
      title: 'PC Status Overview',
      subtitle: 'Fleet-wide system status',
      meta: [`Data as of: ${new Date(pc.generated_at).toLocaleString()}`],
      stats: [
        { label: 'Total PCs', value: String(pc.total) },
        { label: 'Working', value: String(pc.working) },
        { label: 'Not Working', value: String(pc.not_working) },
        { label: 'Inactive', value: String(pc.inactive) },
        { label: 'Under Maintenance', value: String(pc.under_maintenance) },
      ],
      tables: [{
        title: 'Per-Lab Breakdown',
        columns: [
          { header: 'Lab', key: 'lab' },
          { header: 'Total', key: 't', align: 'right', width: 55 },
          { header: 'Working', key: 'w', align: 'right', width: 65 },
          { header: 'Not Working', key: 'nw', align: 'right', width: 75 },
          { header: 'Inactive', key: 'i', align: 'right', width: 65 },
          { header: 'Maintenance', key: 'm', align: 'right', width: 80 },
        ],
        rows: pc.per_lab.map((l) => ({
          lab: l.lab_name, t: l.total, w: l.working,
          nw: l.not_working, i: l.inactive, m: l.under_maintenance,
        })),
      }],
      fileName: 'nexusgrid_pc_status.pdf',
    });
    toast.success('PC status PDF downloaded.');
  };

  const pcCards = pc ? [
    { label: 'Total PCs', value: pc.total, color: 'text-violet-500' },
    { label: 'Working', value: pc.working, color: 'text-emerald-500' },
    { label: 'Not Working', value: pc.not_working, color: 'text-red-500' },
    { label: 'Inactive', value: pc.inactive, color: 'text-slate-500' },
    { label: 'Under Maintenance', value: pc.under_maintenance, color: 'text-amber-500' },
  ] : [];

  return (
    <div className="space-y-5">
      {/* Maintenance summary — admin (any scope) + assistant (own work / own labs) */}
      <SectionCard
        icon={Wrench}
        title="Maintenance Summary"
        actions={
          <div className="flex gap-2">
            <button type="button" className="btn-secondary" onClick={exportSummary}>
              <Download className="w-4 h-4" /> Export CSV
            </button>
            <button type="button" className="btn-primary" onClick={downloadSummaryPdf}>
              <FileText className="w-4 h-4" /> Download PDF
            </button>
          </div>
        }
      >
        <div className="flex flex-wrap items-end gap-3">
          <div>
            <label className="label">Group by</label>
            <div className="flex rounded-lg overflow-hidden border border-slate-200 dark:border-slate-700">
              {(['weekly', 'monthly'] as const).map((p) => (
                <button
                  key={p} type="button" onClick={() => setPeriod(p)}
                  className={`px-3 py-2 text-xs font-medium transition-colors ${period === p
                    ? 'bg-blue-600 text-white'
                    : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'}`}
                >
                  {p === 'weekly' ? 'Weekly' : 'Monthly'}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="label">From</label>
            <input type="date" className="input" value={start} max={end} onChange={(e) => setStart(e.target.value)} />
          </div>
          <div>
            <label className="label">To</label>
            <input type="date" className="input" value={end} min={start} onChange={(e) => setEnd(e.target.value)} />
          </div>
          {isAdmin && (
            <div className="min-w-[200px]">
              <label className="label">Lab assistant</label>
              <select className="input" value={staffId} onChange={(e) => setStaffId(e.target.value ? Number(e.target.value) : '')}>
                <option value="">All assistants</option>
                {assistants.map((s) => (
                  <option key={s.user_id} value={s.user_id}>{s.username}</option>
                ))}
              </select>
            </div>
          )}
          <div className="min-w-[200px]">
            <label className="label">Lab</label>
            <select className="input" value={labId} onChange={(e) => setLabId(e.target.value ? Number(e.target.value) : '')}>
              <option value="">{isAdmin ? 'All labs' : 'My work (all my labs)'}</option>
              {labOptions.map((l) => (
                <option key={l.id} value={l.id}>{l.name}</option>
              ))}
            </select>
          </div>
        </div>

        <p className="text-xs text-slate-400">Scope: {scopeText}</p>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-slate-500 border-b border-slate-200 dark:border-slate-700">
                <th className="py-2 pr-4">{period === 'weekly' ? 'Week' : 'Month'}</th>
                <th className="py-2 pr-4">Faults Reported</th>
                <th className="py-2 pr-4">Faults Resolved</th>
                <th className="py-2 pr-4">Resources Requested</th>
                <th className="py-2 pr-4">Resources Fulfilled</th>
              </tr>
            </thead>
            <tbody>
              {(summary?.rows ?? []).map((r) => (
                <tr key={r.period} className="border-b border-slate-100 dark:border-slate-800">
                  <td className="py-2 pr-4 font-medium text-slate-800 dark:text-slate-200">{r.period}</td>
                  <td className="py-2 pr-4">{r.faults_reported}</td>
                  <td className="py-2 pr-4">{r.faults_resolved}</td>
                  <td className="py-2 pr-4">{r.resources_requested}</td>
                  <td className="py-2 pr-4">{r.resources_fulfilled}</td>
                </tr>
              ))}
              {!summaryLoading && !summary?.rows.length && (
                <tr><td colSpan={5} className="py-4 text-center text-slate-400">No maintenance activity in this range.</td></tr>
              )}
            </tbody>
            {summary && summary.rows.length > 0 && (
              <tfoot>
                <tr className="font-semibold text-slate-800 dark:text-slate-200">
                  <td className="py-2 pr-4">Totals</td>
                  <td className="py-2 pr-4">{summary.totals.faults_reported}</td>
                  <td className="py-2 pr-4">{summary.totals.faults_resolved}</td>
                  <td className="py-2 pr-4">{summary.totals.resources_requested}</td>
                  <td className="py-2 pr-4">{summary.totals.resources_fulfilled}</td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </SectionCard>

      {/* PC status overview — admin only */}
      {isAdmin && (
        <SectionCard
          icon={Monitor}
          title="PC Status Overview"
          actions={
            <button type="button" className="btn-primary" onClick={downloadPcStatusPdf}>
              <FileText className="w-4 h-4" /> Download PDF
            </button>
          }
        >
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
            {pcCards.map((c) => (
              <div key={c.label} className="p-4 rounded-xl text-center bg-slate-50 dark:bg-slate-800">
                <p className={`text-2xl font-bold ${c.color}`}>{c.value}</p>
                <p className="text-xs mt-1 text-slate-500 dark:text-slate-400">{c.label}</p>
              </div>
            ))}
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-slate-500 border-b border-slate-200 dark:border-slate-700">
                  <th className="py-2 pr-4">Lab</th>
                  <th className="py-2 pr-4">Total</th>
                  <th className="py-2 pr-4">Working</th>
                  <th className="py-2 pr-4">Not Working</th>
                  <th className="py-2 pr-4">Inactive</th>
                  <th className="py-2 pr-4">Under Maintenance</th>
                </tr>
              </thead>
              <tbody>
                {(pc?.per_lab ?? []).map((l) => (
                  <tr key={l.lab_id} className="border-b border-slate-100 dark:border-slate-800">
                    <td className="py-2 pr-4 font-medium text-slate-800 dark:text-slate-200">{l.lab_name}</td>
                    <td className="py-2 pr-4">{l.total}</td>
                    <td className="py-2 pr-4 text-emerald-600">{l.working}</td>
                    <td className="py-2 pr-4 text-red-600">{l.not_working}</td>
                    <td className="py-2 pr-4">{l.inactive}</td>
                    <td className="py-2 pr-4 text-amber-600">{l.under_maintenance}</td>
                  </tr>
                ))}
                {!pc?.per_lab.length && (
                  <tr><td colSpan={6} className="py-4 text-center text-slate-400">No systems assigned to labs yet.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </SectionCard>
      )}

      {/* Replacement-cost report — admin only, printable & read-only */}
      {isAdmin && (
        <SectionCard
          icon={Printer}
          title="Replacement Cost Report (by Department)"
          actions={
            <div className="flex gap-2">
              <button type="button" className="btn-secondary" onClick={printCostReport}>
                <Printer className="w-4 h-4" /> Print
              </button>
              <button type="button" className="btn-primary" onClick={downloadCostPdf}>
                <FileText className="w-4 h-4" /> Download PDF
              </button>
            </div>
          }
        >
          <p className="text-xs text-slate-400">
            Replacement/resource requests raised by lab assistants in the date range above,
            grouped by department with per-part and total costs. The printout is read-only.
          </p>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-slate-500 border-b border-slate-200 dark:border-slate-700">
                  <th className="py-2 pr-4">Department</th>
                  <th className="py-2 pr-4">Requests</th>
                  <th className="py-2 pr-4">Without Cost</th>
                  <th className="py-2 pr-4">Subtotal</th>
                </tr>
              </thead>
              <tbody>
                {(costs?.departments ?? []).map((d) => (
                  <tr key={d.department} className="border-b border-slate-100 dark:border-slate-800">
                    <td className="py-2 pr-4 font-medium text-slate-800 dark:text-slate-200">{d.department}</td>
                    <td className="py-2 pr-4">{d.items.length}</td>
                    <td className="py-2 pr-4">{d.items_without_cost}</td>
                    <td className="py-2 pr-4">{d.subtotal.toFixed(2)}</td>
                  </tr>
                ))}
                {!costs?.departments.length && (
                  <tr><td colSpan={4} className="py-4 text-center text-slate-400">No assistant-raised requests in this range.</td></tr>
                )}
              </tbody>
              {costs && costs.departments.length > 0 && (
                <tfoot>
                  <tr className="font-semibold text-slate-800 dark:text-slate-200">
                    <td className="py-2 pr-4">Grand Total</td>
                    <td /><td />
                    <td className="py-2 pr-4">{costs.grand_total.toFixed(2)}</td>
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
