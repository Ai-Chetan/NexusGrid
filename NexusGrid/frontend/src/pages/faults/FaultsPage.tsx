import { useState, useEffect, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useSearchParams } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  AlertTriangle, Plus, Search, ChevronLeft, ChevronRight,
  Clock, User, Loader2, RefreshCw, Trash2, Edit2, Wrench,
} from 'lucide-react';
import { faultsApi, layoutApi } from '@/lib/api';
import { timeAgo, cn } from '@/lib/utils';
import { useAuthStore } from '@/store/authStore';
import type { FaultReport, PaginatedResponse, System } from '@/types';
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
  risk_factor: z.coerce.number().int().min(1).max(5).optional(),
  description: z.string().min(10, 'Please provide more detail (min 10 chars)'),
});
type CreateForm = z.infer<typeof createSchema>;

function CreateFaultModal({ open, onClose, showRiskFactor }: { open: boolean; onClose: () => void; showRiskFactor: boolean }) {
  const qc = useQueryClient();
  const [selectedRoom, setSelectedRoom] = useState('');

  const { data: systems = [] } = useQuery<System[]>({
    queryKey: ['systems-list'],
    queryFn: () => layoutApi.getSystems().then(r => r.data),
    enabled: open,
  });

  const { register, handleSubmit, reset, setValue, formState: { errors, isSubmitting } } = useForm<CreateForm>({
    resolver: zodResolver(createSchema),
    defaultValues: { fault_type: 'Hardware', risk_factor: 1 },
  });

  const rooms = [...new Set(
    systems.map(s => s.lab_name).filter(Boolean) as string[]
  )].sort();
  const hasRoomlessSystems = systems.some(s => !s.lab_name);

  const roomSystems = systems.filter(s =>
    selectedRoom === '__none__' ? !s.lab_name : s.lab_name === selectedRoom,
  );

  const handleRoomChange = (room: string) => {
    setSelectedRoom(room);
    setValue('system_id', 0);
  };

  const handleClose = () => {
    reset();
    setSelectedRoom('');
    onClose();
  };

  const mutation = useMutation({
    mutationFn: (data: CreateForm) => faultsApi.create(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['faults'] });
      toast.success('Fault report submitted');
      reset();
      setSelectedRoom('');
      onClose();
    },
    onError: () => toast.error('Failed to submit fault report'),
  });

  return (
    <Modal open={open} onClose={handleClose} title="Report a Fault" size="lg">
      <form onSubmit={handleSubmit(d => mutation.mutate(d))} className="space-y-4">
        <div>
          <label className="label">Room / Lab</label>
          <select
            value={selectedRoom}
            onChange={e => handleRoomChange(e.target.value)}
            className="input"
          >
            <option value="">Select room / lab…</option>
            {rooms.map(r => (
              <option key={r} value={r}>{r}</option>
            ))}
            {hasRoomlessSystems && (
              <option value="__none__">— Unassigned systems —</option>
            )}
          </select>
        </div>

        <div className={selectedRoom ? '' : 'opacity-50 pointer-events-none'}>
          <label className="label">
            System
            {!selectedRoom && <span className="text-slate-400 font-normal ml-1">(select a room first)</span>}
          </label>
          <select {...register('system_id')} className="input" disabled={!selectedRoom}>
            <option value="">Select system…</option>
            {roomSystems.map(s => (
              <option key={s.id} value={s.id}>{s.host_name}</option>
            ))}
          </select>
          {errors.system_id && <p className="mt-1 text-xs text-red-500">{errors.system_id.message}</p>}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="label">Fault Type</label>
            <select {...register('fault_type')} className="input">
              <option value="Hardware">Hardware</option>
              <option value="Software">Software</option>
              <option value="Network">Network</option>
            </select>
          </div>
          {showRiskFactor && (
            <div>
              <label className="label">Risk Factor</label>
              <select {...register('risk_factor')} className="input">
                <option value={1}>1 - Least severe</option>
                <option value={2}>2 - Low</option>
                <option value={3}>3 - Moderate</option>
                <option value={4}>4 - High</option>
                <option value={5}>5 - Critical</option>
              </select>
            </div>
          )}
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
          <button type="button" onClick={handleClose} className="btn-secondary flex-1">Cancel</button>
          <button type="submit" disabled={mutation.isPending} className="btn-primary flex-1">
            {mutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Submit Report'}
          </button>
        </div>
      </form>
    </Modal>
  );
}

// ─── Edit Fault Modal (Incharge edits own fault) ─────────────────────────────
function EditFaultModal({ fault, onClose }: { fault: FaultReport | null; onClose: () => void }) {
  const qc = useQueryClient();
  const [description, setDescription] = useState(fault?.description ?? '');
  const [faultType, setFaultType] = useState<string>(fault?.fault_type ?? 'Hardware');

  const mutation = useMutation({
    mutationFn: () => faultsApi.updateStatus(fault!.fault_id, {
      description,
      fault_type: faultType,
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['faults'] });
      toast.success('Fault report updated');
      onClose();
    },
    onError: () => toast.error('Failed to update fault'),
  });

  if (!fault) return null;

  return (
    <Modal open={!!fault} onClose={onClose} title="Edit Fault Report" size="sm">
      <div className="space-y-4">
        <div className="p-3 bg-slate-50 dark:bg-slate-800 rounded-xl">
          <p className="text-xs text-slate-500">Fault on</p>
          <p className="text-sm font-semibold text-slate-800 dark:text-slate-200">{fault.system_host_name}</p>
          {fault.lab_name && <p className="text-xs text-slate-500">{fault.lab_name}</p>}
        </div>
        <div>
          <label className="label">Fault Type</label>
          <select value={faultType} onChange={e => setFaultType(e.target.value)} className="input">
            <option value="Hardware">Hardware</option>
            <option value="Software">Software</option>
            <option value="Network">Network</option>
          </select>
        </div>
        <div>
          <label className="label">Description</label>
          <textarea
            value={description}
            onChange={e => setDescription(e.target.value)}
            rows={4}
            className="input resize-none"
          />
        </div>
        <div className="flex gap-2 pt-1">
          <button onClick={onClose} className="btn-secondary flex-1">Cancel</button>
          <button onClick={() => mutation.mutate()} className="btn-primary flex-1" disabled={mutation.isPending}>
            {mutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Save'}
          </button>
        </div>
      </div>
    </Modal>
  );
}

// ─── Update Status Modal (Assistant/Admin) ────────────────────────────────────
function UpdateStatusModal({ fault, onClose }: { fault: FaultReport | null; onClose: () => void }) {
  const qc = useQueryClient();
  const [newStatus, setNewStatus] = useState<string>(fault?.status ?? 'unaddressed');
  const [resolution, setResolution] = useState<string>('');
  const [riskFactor, setRiskFactor] = useState<number>(fault?.risk_factor ?? 1);

  const mutation = useMutation({
    mutationFn: () => faultsApi.updateStatus(fault!.fault_id, {
      status: newStatus,
      resolution_summary: resolution,
      risk_factor: riskFactor,
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
        <div className="p-3 bg-slate-50 dark:bg-slate-800 rounded-xl">
          <p className="text-xs text-slate-500">Fault on</p>
          <p className="text-sm font-semibold text-slate-800 dark:text-slate-200">{fault.system_host_name}</p>
          {fault.lab_name && <p className="text-xs text-slate-500">{fault.lab_name}</p>}
        </div>

        <div>
          <label className="label">Risk Factor</label>
          <select value={riskFactor} onChange={e => setRiskFactor(Number(e.target.value))} className="input">
            <option value={1}>1 - Least severe</option>
            <option value={2}>2 - Low</option>
            <option value={3}>3 - Moderate</option>
            <option value={4}>4 - High</option>
            <option value={5}>5 - Critical</option>
          </select>
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
function FaultRow({
  fault,
  onUpdate,
  onEdit,
  onDelete,
  canUpdateStatus,
  canEditDelete,
  highlighted,
  rowRef,
}: {
  fault: FaultReport;
  onUpdate: (f: FaultReport) => void;
  onEdit: (f: FaultReport) => void;
  onDelete: (f: FaultReport) => void;
  canUpdateStatus: boolean;
  canEditDelete: boolean;
  highlighted?: boolean;
  rowRef?: React.Ref<HTMLTableRowElement>;
}) {
  const riskTone =
    fault.risk_factor >= 5 ? 'bg-red-100 text-red-700 border-red-200' :
    fault.risk_factor >= 4 ? 'bg-orange-100 text-orange-700 border-orange-200' :
    fault.risk_factor >= 3 ? 'bg-amber-100 text-amber-700 border-amber-200' :
    'bg-slate-100 text-slate-700 border-slate-200';

  return (
    <tr
      ref={rowRef as React.RefObject<HTMLTableRowElement>}
      className={cn(
        'transition-colors',
        highlighted
          ? 'bg-amber-50 dark:bg-amber-900/20 ring-2 ring-inset ring-amber-400 dark:ring-amber-500 animate-highlight-pulse'
          : 'hover:bg-slate-50 dark:hover:bg-slate-800/30',
      )}
    >
      <td className="px-4 py-3">
        <div>
          <p className="text-sm font-medium text-slate-800 dark:text-slate-200">{fault.system_host_name}</p>
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
        <p className="text-sm text-slate-600 dark:text-slate-400 truncate">{fault.description}</p>
      </td>
      <td className="px-4 py-3">
        <span className={cn('badge', riskTone)}>{fault.risk_factor}</span>
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
        {fault.resolved?.resolved_by_username && (
          <div className="flex items-center gap-1 text-xs text-emerald-600 mt-0.5">
            <Wrench className="w-3 h-3" />
            {fault.resolved.resolved_by_username}
          </div>
        )}
      </td>
      <td className="px-4 py-3">
        <div className="flex items-center gap-1.5">
          {canUpdateStatus && (
            <button onClick={() => onUpdate(fault)} className="btn-secondary text-xs py-1 px-2">
              Update
            </button>
          )}
          {canEditDelete && (
            <>
              <button
                onClick={() => onEdit(fault)}
                className="text-slate-400 hover:text-brand-600 p-1 rounded hover:bg-brand-50 dark:hover:bg-brand-900/20"
                title="Edit"
              >
                <Edit2 className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => onDelete(fault)}
                className="text-slate-400 hover:text-red-500 p-1 rounded hover:bg-red-50 dark:hover:bg-red-900/20"
                title="Delete"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </>
          )}
        </div>
      </td>
    </tr>
  );
}

// ─── Main Page ─────────────────────────────────────────────────────────────────
const STATUS_OPTIONS = ['all', 'unaddressed', 'in-progress', 'scheduled', 'resolved', 'ignored'];
const TIME_OPTIONS = ['all', 'today', 'week', 'month'];

export default function FaultsPage() {
  const user = useAuthStore(s => s.user);
  const isAdmin = user?.role === 'Administrator';
  const isIncharge = user?.role === 'Lab Incharge';
  const isAssistant = user?.role === 'Lab Assistant';

  const [searchParams, setSearchParams] = useSearchParams();
  const highlightId = searchParams.get('highlight') ? Number(searchParams.get('highlight')) : null;
  const [activeHighlight, setActiveHighlight] = useState<number | null>(highlightId);
  const highlightRowRef = useRef<HTMLTableRowElement | null>(null);

  const [createOpen, setCreateOpen] = useState(false);
  const [updateFault, setUpdateFault] = useState<FaultReport | null>(null);
  const [editFault, setEditFault] = useState<FaultReport | null>(null);
  const [deleteFault, setDeleteFault] = useState<FaultReport | null>(null);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('all');
  const [time, setTime] = useState('all');
  const [sort, setSort] = useState('newest');
  const [page, setPage] = useState(1);

  const qc = useQueryClient();

  const { data, isLoading, isError, refetch } = useQuery<PaginatedResponse<FaultReport>>({
    queryKey: ['faults', { search, status, time, sort, page }],
    queryFn: ({ signal }) => faultsApi.list({ search, status, time, sort, page, page_size: 15 }, signal).then(r => r.data),
    placeholderData: prev => prev,
  });

  // Scroll to + briefly highlight the row from a notification deep-link
  useEffect(() => {
    if (!activeHighlight || !data?.results) return;
    const exists = data.results.some(f => f.fault_id === activeHighlight);
    if (!exists) return;
    // Give the DOM a tick to render before scrolling
    const timer = setTimeout(() => {
      highlightRowRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 120);
    // Clear highlight and URL param after 4 s
    const clearTimer = setTimeout(() => {
      setActiveHighlight(null);
      setSearchParams(prev => { prev.delete('highlight'); return prev; }, { replace: true });
    }, 4000);
    return () => { clearTimeout(timer); clearTimeout(clearTimer); };
  }, [activeHighlight, data]);

  const deleteMutation = useMutation({
    mutationFn: (id: number) => faultsApi.delete(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['faults'] });
      toast.success('Fault report deleted');
      setDeleteFault(null);
    },
    onError: () => toast.error('Failed to delete fault report'),
  });

  // Incharge can only edit/delete their own faults; only assistants handle status
  const canUpdateStatus = isAssistant;
  const canEditDelete = isIncharge;

  return (
    <div className="space-y-5 animate-fade-in">
      <PageHeader
        title="Fault Reports"
        description="Track and manage system fault reports across all labs."
        actions={
          isIncharge || isAssistant ? (
            <button onClick={() => setCreateOpen(true)} className="btn-primary">
              <Plus className="w-4 h-4" /> Report Fault
            </button>
          ) : undefined
        }
      />

      {/* Filters */}
      <div className="card p-4 flex flex-wrap gap-3 items-center">
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
                <thead className="bg-slate-50 dark:bg-slate-800/50 border-b border-slate-200 dark:border-slate-700">
                  <tr>
                    {['System', 'Type', 'Description', 'Risk', 'Status', 'Reported / Handled By', ''].map(h => (
                      <th key={h} className="px-4 py-3 table-header">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-700/50">
                  {data?.results.map(fault => {
                    const isHighlighted = activeHighlight === fault.fault_id;
                    return (
                      <FaultRow
                        key={fault.fault_id}
                        fault={fault}
                        onUpdate={setUpdateFault}
                        onEdit={setEditFault}
                        onDelete={setDeleteFault}
                        canUpdateStatus={canUpdateStatus}
                        canEditDelete={canEditDelete && fault.reported_by_username === user?.username}
                        highlighted={isHighlighted}
                        rowRef={isHighlighted ? highlightRowRef : undefined}
                      />
                    );
                  })}
                </tbody>
              </table>
            </div>

            {data && data.total_pages > 1 && (
              <div className="px-4 py-3 border-t border-slate-100 dark:border-slate-700 flex items-center justify-between">
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
      <CreateFaultModal open={createOpen} onClose={() => setCreateOpen(false)} showRiskFactor={!isIncharge} />
      <UpdateStatusModal fault={updateFault} onClose={() => setUpdateFault(null)} />
      <EditFaultModal fault={editFault} onClose={() => setEditFault(null)} />

      {/* Delete Confirmation */}
      {deleteFault && (
        <Modal open onClose={() => setDeleteFault(null)} title="Delete Fault Report" size="sm">
          <div className="space-y-4">
            <p className="text-sm text-slate-600 dark:text-slate-400">
              Are you sure you want to delete this fault report for <strong>{deleteFault.system_host_name}</strong>?
              This action cannot be undone.
            </p>
            <div className="flex gap-2">
              <button onClick={() => setDeleteFault(null)} className="btn-secondary flex-1">Cancel</button>
              <button
                onClick={() => deleteMutation.mutate(deleteFault.fault_id)}
                disabled={deleteMutation.isPending}
                className="btn-danger flex-1"
              >
                {deleteMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Delete'}
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}