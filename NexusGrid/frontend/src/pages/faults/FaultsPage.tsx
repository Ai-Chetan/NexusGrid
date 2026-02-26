import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  AlertTriangle, Plus, Search, Filter, ChevronLeft, ChevronRight,
  Monitor, Clock, User, Loader2, RefreshCw, CheckCircle2,
} from 'lucide-react';
import { faultsApi, layoutApi } from '@/lib/api';
import { timeAgo, formatDateTime, cn } from '@/lib/utils';
import type { FaultReport } from '@/types';
import PageHeader from '@/components/common/PageHeader';
import StatusBadge from '@/components/common/StatusBadge';
import Modal from '@/components/common/Modal';
import EmptyState from '@/components/common/EmptyState';
import ErrorState from '@/components/common/ErrorState';
import toast from 'react-hot-toast';

// ─── Create Fault Modal ───────────────────────────────────────────────────────
const createSchema = z.object({
  system_id: z.coerce.number().min(1, 'Select a system'),
  fault_type: z.enum(['Hardware', 'Software', 'Network']),
  description: z.string().min(10, 'Please provide more detail (min 10 chars)'),
});
type CreateForm = z.infer<typeof createSchema>;

function CreateFaultModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const qc = useQueryClient();
  const { data: systems = [] } = useQuery({
    queryKey: ['systems-list'],
    queryFn: () => layoutApi.getSystems().then(r => r.data),
    enabled: open,
  });

  const { register, handleSubmit, reset, formState: { errors, isSubmitting } } = useForm<CreateForm>({
    resolver: zodResolver(createSchema),
    defaultValues: { fault_type: 'Hardware' },
  });

  const mutation = useMutation({
    mutationFn: (data: CreateForm) => faultsApi.create(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['faults'] });
      toast.success('Fault report submitted');
      reset();
      onClose();
    },
    onError: () => toast.error('Failed to submit fault report'),
  });

  return (
    <Modal open={open} onClose={onClose} title="Report a Fault" size="lg">
      <form onSubmit={handleSubmit(d => mutation.mutate(d))} className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div className="col-span-2">
            <label className="label">System</label>
            <select {...register('system_id')} className="input">
              <option value="">Select system…</option>
              {systems.map(s => (
                <option key={s.id} value={s.id}>
                  {s.host_name}{s.lab_name ? ` — ${s.lab_name}` : ''}
                </option>
              ))}
            </select>
            {errors.system_id && <p className="mt-1 text-xs text-red-500">{errors.system_id.message}</p>}
          </div>

          <div>
            <label className="label">Fault Type</label>
            <select {...register('fault_type')} className="input">
              <option value="Hardware">Hardware</option>
              <option value="Software">Software</option>
              <option value="Network">Network</option>
            </select>
          </div>
        </div>

        <div>
          <label className="label">Description</label>
          <textarea
            {...register('description')}
            rows={4}
            className="input resize-none"
            placeholder="Describe the fault in detail…"
          />
          {errors.description && <p className="mt-1 text-xs text-red-500">{errors.description.message}</p>}
        </div>

        <div className="flex gap-2 pt-1">
          <button type="button" onClick={onClose} className="btn-secondary flex-1">Cancel</button>
          <button type="submit" disabled={mutation.isPending} className="btn-primary flex-1">
            {mutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Submit Report'}
          </button>
        </div>
      </form>
    </Modal>
  );
}

// ─── Update Status Modal ──────────────────────────────────────────────────────
function UpdateStatusModal({ fault, onClose }: { fault: FaultReport | null; onClose: () => void }) {
  const qc = useQueryClient();
  const [newStatus, setNewStatus] = useState<string>(fault?.status ?? 'unaddressed');
  const [resolution, setResolution] = useState<string>('');

  const mutation = useMutation({
    mutationFn: () => faultsApi.updateStatus(fault!.fault_id, {
      status: newStatus,
      resolution_summary: resolution,
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['faults'] });
      toast.success('Fault status updated');
      onClose();
    },
    onError: () => toast.error('Failed to update status'),
  });

  if (!fault) return null;

  return (
    <Modal open={!!fault} onClose={onClose} title="Update Fault Status" size="sm">
      <div className="space-y-4">
        <div className="p-3 bg-slate-50 rounded-xl">
          <p className="text-xs text-slate-500">Fault on</p>
          <p className="text-sm font-semibold text-slate-800">{fault.system_host_name}</p>
          {fault.lab_name && <p className="text-xs text-slate-500">{fault.lab_name}</p>}
        </div>

        <div>
          <label className="label">New Status</label>
          <select value={newStatus} onChange={e => setNewStatus(e.target.value)} className="input">
            <option value="unaddressed">Unaddressed</option>
            <option value="in-progress">In Progress</option>
            <option value="scheduled">Scheduled</option>
            <option value="resolved">Resolved</option>
            <option value="ignored">Ignored</option>
          </select>
        </div>

        {newStatus === 'resolved' && (
          <div>
            <label className="label">Resolution Summary</label>
            <textarea
              value={resolution}
              onChange={e => setResolution(e.target.value)}
              rows={3}
              className="input resize-none"
              placeholder="Describe how the fault was resolved…"
            />
          </div>
        )}

        <div className="flex gap-2 pt-1">
          <button onClick={onClose} className="btn-secondary flex-1">Cancel</button>
          <button onClick={() => mutation.mutate()} className="btn-primary flex-1"
            disabled={mutation.isPending || (newStatus === 'resolved' && !resolution.trim())}>
            {mutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Update'}
          </button>
        </div>
      </div>
    </Modal>
  );
}

// ─── Fault Row ────────────────────────────────────────────────────────────────
function FaultRow({ fault, onUpdate }: { fault: FaultReport; onUpdate: (f: FaultReport) => void }) {
  return (
    <tr className="hover:bg-slate-50 transition-colors">
      <td className="px-4 py-3">
        <span className="text-xs font-mono text-slate-400">#{fault.fault_id}</span>
      </td>
      <td className="px-4 py-3">
        <div>
          <p className="text-sm font-medium text-slate-800">{fault.system_host_name}</p>
          {fault.lab_name && <p className="text-xs text-slate-500">{fault.lab_name}</p>}
        </div>
      </td>
      <td className="px-4 py-3">
        <span className={cn('badge',
          fault.fault_type === 'Hardware' ? 'bg-red-50 text-red-700 border-red-200' :
          fault.fault_type === 'Software' ? 'bg-blue-50 text-blue-700 border-blue-200' :
          'bg-amber-50 text-amber-700 border-amber-200'
        )}>{fault.fault_type}</span>
      </td>
      <td className="px-4 py-3 max-w-xs">
        <p className="text-sm text-slate-600 truncate">{fault.description}</p>
      </td>
      <td className="px-4 py-3">
        <StatusBadge status={fault.status} />
      </td>
      <td className="px-4 py-3">
        <div className="flex items-center gap-1 text-xs text-slate-500">
          <User className="w-3 h-3" />
          {fault.reported_by_username}
        </div>
        <div className="flex items-center gap-1 text-xs text-slate-400 mt-0.5">
          <Clock className="w-3 h-3" />
          {timeAgo(fault.reported_at)}
        </div>
      </td>
      <td className="px-4 py-3">
        <button
          onClick={() => onUpdate(fault)}
          className="btn-secondary text-xs py-1 px-2"
        >
          Update
        </button>
      </td>
    </tr>
  );
}

// ─── Main Page ─────────────────────────────────────────────────────────────────
const STATUS_OPTIONS = ['all', 'unaddressed', 'in-progress', 'scheduled', 'resolved', 'ignored'];
const TIME_OPTIONS = ['all', 'today', 'week', 'month'];

export default function FaultsPage() {
  const [createOpen, setCreateOpen] = useState(false);
  const [updateFault, setUpdateFault] = useState<FaultReport | null>(null);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('all');
  const [time, setTime] = useState('all');
  const [sort, setSort] = useState('newest');
  const [page, setPage] = useState(1);

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['faults', { search, status, time, sort, page }],
    queryFn: () => faultsApi.list({ search, status, time, sort, page, page_size: 15 }).then(r => r.data),
    placeholderData: prev => prev,
  });

  return (
    <div className="space-y-5 animate-fade-in">
      <PageHeader
        title="Fault Reports"
        description="Track and manage system fault reports across all labs."
        actions={
          <button onClick={() => setCreateOpen(true)} className="btn-primary">
            <Plus className="w-4 h-4" /> Report Fault
          </button>
        }
      />

      {/* Filters */}
      <div className="card p-4 flex flex-wrap gap-3 items-center">
        {/* Search */}
        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            value={search}
            onChange={e => { setSearch(e.target.value); setPage(1); }}
            placeholder="Search systems, labs, fault type…"
            className="input pl-9"
          />
        </div>

        <select value={status} onChange={e => { setStatus(e.target.value); setPage(1); }} className="input w-40">
          {STATUS_OPTIONS.map(s => (
            <option key={s} value={s}>{s === 'all' ? 'All Statuses' : s.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}</option>
          ))}
        </select>

        <select value={time} onChange={e => { setTime(e.target.value); setPage(1); }} className="input w-36">
          {TIME_OPTIONS.map(t => (
            <option key={t} value={t}>{t === 'all' ? 'All Time' : t.charAt(0).toUpperCase() + t.slice(1)}</option>
          ))}
        </select>

        <select value={sort} onChange={e => setSort(e.target.value)} className="input w-36">
          <option value="newest">Newest First</option>
          <option value="oldest">Oldest First</option>
        </select>

        <button onClick={() => refetch()} className="btn-ghost px-3">
          <RefreshCw className="w-4 h-4" />
        </button>
      </div>

      {/* Table */}
      <div className="card overflow-hidden">
        {isError ? (
          <ErrorState message="Failed to load fault reports." onRetry={refetch} />
        ) : isLoading ? (
          <div className="p-8 text-center text-sm text-slate-500">Loading…</div>
        ) : data?.results.length === 0 ? (
          <EmptyState
            icon={<AlertTriangle className="w-7 h-7" />}
            title="No fault reports found"
            description="Reports matching your filters will appear here."
          />
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-slate-50 border-b border-slate-200">
                  <tr>
                    {['ID', 'System', 'Type', 'Description', 'Status', 'Reported By', ''].map(h => (
                      <th key={h} className="px-4 py-3 table-header">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {data?.results.map(fault => (
                    <FaultRow key={fault.fault_id} fault={fault} onUpdate={setUpdateFault} />
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {data && data.total_pages > 1 && (
              <div className="px-4 py-3 border-t border-slate-100 flex items-center justify-between">
                <p className="text-xs text-slate-500">
                  {data.count} total · page {data.page} of {data.total_pages}
                </p>
                <div className="flex items-center gap-1">
                  <button
                    disabled={page === 1}
                    onClick={() => setPage(p => p - 1)}
                    className="btn-ghost p-1.5 disabled:opacity-40"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <button
                    disabled={page === data.total_pages}
                    onClick={() => setPage(p => p + 1)}
                    className="btn-ghost p-1.5 disabled:opacity-40"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* Modals */}
      <CreateFaultModal open={createOpen} onClose={() => setCreateOpen(false)} />
      <UpdateStatusModal fault={updateFault} onClose={() => setUpdateFault(null)} />
    </div>
  );
}
