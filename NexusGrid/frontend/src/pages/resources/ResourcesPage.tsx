import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  Package, Plus, Search, ChevronLeft, ChevronRight,
  Clock, User, Loader2, RefreshCw, Trash2, Edit2, Wrench,
} from 'lucide-react';
import { resourcesApi, layoutApi } from '@/lib/api';
import { timeAgo, cn } from '@/lib/utils';
import { useAuthStore } from '@/store/authStore';
import type { PaginatedResponse, ResourceRequest, System } from '@/types';
import PageHeader from '@/components/common/PageHeader';
import StatusBadge from '@/components/common/StatusBadge';
import Modal from '@/components/common/Modal';
import EmptyState from '@/components/common/EmptyState';
import ErrorState from '@/components/common/ErrorState';
import toast from 'react-hot-toast';

// ─── Create Resource Modal ─────────────────────────────────────────────────────
const createSchema = z.object({
  system_id: z.coerce.number().min(1, 'Select a system'),
  resource_name: z.string().min(2, 'Resource name required'),
  description: z.string().min(5, 'Description required'),
  quantity: z.coerce.number().min(1, 'Quantity must be at least 1'),
});
type CreateForm = z.infer<typeof createSchema>;

function CreateResourceModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const qc = useQueryClient();
  const [selectedRoom, setSelectedRoom] = useState('');

  const { data: systems = [] } = useQuery<System[]>({
    queryKey: ['systems-list'],
    queryFn: () => layoutApi.getSystems().then(r => r.data),
    enabled: open,
  });

  const { register, handleSubmit, reset, setValue, formState: { errors, isSubmitting } } = useForm<CreateForm>({
    resolver: zodResolver(createSchema),
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
    mutationFn: (data: CreateForm) => resourcesApi.create(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['resources'] });
      toast.success('Resource request submitted');
      reset();
      setSelectedRoom('');
      onClose();
    },
    onError: () => toast.error('Failed to submit resource request'),
  });

  return (
    <Modal open={open} onClose={handleClose} title="New Resource Request" size="lg">
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

        <div>
          <label className="label">Resource Name</label>
          <input
            {...register('resource_name')}
            type="text"
            className="input"
            placeholder="e.g. RAM Upgrade, New Keyboard, Network Cable"
          />
          {errors.resource_name && <p className="mt-1 text-xs text-red-500">{errors.resource_name.message}</p>}
        </div>

        <div>
          <label className="label">Quantity</label>
          <input
            {...register('quantity')}
            type="number"
            min={1}
            defaultValue={1}
            className="input"
          />
          {errors.quantity && <p className="mt-1 text-xs text-red-500">{errors.quantity.message}</p>}
        </div>

        <div>
          <label className="label">Description</label>
          <textarea
            {...register('description')}
            rows={3}
            className="input resize-none"
            placeholder="Provide full details of the resource needed…"
          />
          {errors.description && <p className="mt-1 text-xs text-red-500">{errors.description.message}</p>}
        </div>

        <div className="flex gap-2 pt-1">
          <button type="button" onClick={handleClose} className="btn-secondary flex-1">Cancel</button>
          <button type="submit" disabled={mutation.isPending} className="btn-primary flex-1">
            {mutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Submit Request'}
          </button>
        </div>
      </form>
    </Modal>
  );
}

// ─── Edit Resource Modal (Incharge edits own request) ────────────────────────
function EditResourceModal({ resource, onClose }: { resource: ResourceRequest | null; onClose: () => void }) {
  const qc = useQueryClient();
  const [resourceName, setResourceName] = useState(resource?.resource_name ?? '');
  const [description, setDescription] = useState(resource?.description ?? '');
  const [quantity, setQuantity] = useState(String(resource?.quantity ?? 1));

  const mutation = useMutation({
    mutationFn: () => resourcesApi.updateStatus(resource!.resource_id, {
      resource_name: resourceName,
      description,
      quantity: Number(quantity),
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['resources'] });
      toast.success('Resource request updated');
      onClose();
    },
    onError: () => toast.error('Failed to update resource request'),
  });

  if (!resource) return null;

  return (
    <Modal open={!!resource} onClose={onClose} title="Edit Resource Request" size="sm">
      <div className="space-y-4">
        <div className="p-3 bg-slate-50 dark:bg-slate-800 rounded-xl">
          <p className="text-xs text-slate-500">Request for</p>
          <p className="text-sm font-semibold text-slate-800 dark:text-slate-200">{resource.system_host_name}</p>
          {resource.lab_name && <p className="text-xs text-slate-500">{resource.lab_name}</p>}
        </div>
        <div>
          <label className="label">Resource Name</label>
          <input value={resourceName} onChange={e => setResourceName(e.target.value)} className="input" />
        </div>
        <div>
          <label className="label">Quantity</label>
          <input type="number" min={1} value={quantity} onChange={e => setQuantity(e.target.value)} className="input" />
        </div>
        <div>
          <label className="label">Description</label>
          <textarea
            value={description}
            onChange={e => setDescription(e.target.value)}
            rows={3}
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
function UpdateStatusModal({
  resource, onClose,
}: {
  resource: ResourceRequest | null;
  onClose: () => void;
}) {
  const qc = useQueryClient();
  const [newStatus, setNewStatus] = useState<string>(resource?.status ?? 'Pending');
  const [summary, setSummary] = useState<string>('');
  const [quantity, setQuantity] = useState<string>(String(resource?.quantity ?? 1));
  const [cost, setCost] = useState<string>(resource?.cost != null ? String(resource.cost) : '');

  const mutation = useMutation({
    mutationFn: () => resourcesApi.updateStatus(resource!.resource_id, {
      status: newStatus,
      provision_summary: summary,
      quantity: quantity ? Number(quantity) : undefined,
      cost: cost === '' ? null : Number(cost),
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['resources'] });
      toast.success('Resource status updated');
      onClose();
    },
    onError: () => toast.error('Failed to update status'),
  });

  if (!resource) return null;

  return (
    <Modal open={!!resource} onClose={onClose} title="Update Resource Status" size="sm">
      <div className="space-y-4">
        <div className="p-3 bg-slate-50 dark:bg-slate-800 rounded-xl">
          <p className="text-xs text-slate-500">Request for</p>
          <p className="text-sm font-semibold text-slate-800 dark:text-slate-200">{resource.resource_name}</p>
          <p className="text-xs text-slate-500 mt-0.5">{resource.system_host_name}{resource.lab_name ? ` · ${resource.lab_name}` : ''}</p>
        </div>

        <div>
          <label className="label">New Status</label>
          <select value={newStatus} onChange={e => setNewStatus(e.target.value)} className="input">
            <option value="Pending">Pending</option>
            <option value="Fulfilled">Fulfilled</option>
            <option value="Denied">Denied</option>
          </select>
        </div>

        {newStatus === 'Fulfilled' && (
          <>
            <div className="flex gap-3">
              <div className="flex-1">
                <label className="label">Quantity</label>
                <input type="number" min={1} value={quantity} onChange={e => setQuantity(e.target.value)} className="input" />
              </div>
              <div className="flex-1">
                <label className="label">Unit Cost</label>
                <input type="number" min={0} step="0.01" value={cost} onChange={e => setCost(e.target.value)} className="input" placeholder="0.00" />
              </div>
            </div>
            <div>
              <label className="label">Provision Summary</label>
              <textarea
                value={summary}
                onChange={e => setSummary(e.target.value)}
                rows={3}
                className="input resize-none"
                placeholder="Describe what was provided…"
              />
            </div>
          </>
        )}

        <div className="flex gap-2 pt-1">
          <button onClick={onClose} className="btn-secondary flex-1">Cancel</button>
          <button
            onClick={() => mutation.mutate()}
            className="btn-primary flex-1"
            disabled={mutation.isPending || (newStatus === 'Fulfilled' && !summary.trim())}
          >
            {mutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Update'}
          </button>
        </div>
      </div>
    </Modal>
  );
}

// ─── Resource Row ──────────────────────────────────────────────────────────────
function ResourceRow({
  resource,
  onUpdate,
  onEdit,
  onDelete,
  canUpdateStatus,
  canEditDelete,
}: {
  resource: ResourceRequest;
  onUpdate: (r: ResourceRequest) => void;
  onEdit: (r: ResourceRequest) => void;
  onDelete: (r: ResourceRequest) => void;
  canUpdateStatus: boolean;
  canEditDelete: boolean;
}) {
  return (
    <tr className="hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors">
      <td className="px-4 py-3">
        <div>
          <p className="text-sm font-medium text-slate-800 dark:text-slate-200">{resource.system_host_name}</p>
          {resource.lab_name && <p className="text-xs text-slate-500">{resource.lab_name}</p>}
        </div>
      </td>
      <td className="px-4 py-3">
        <p className="text-sm font-semibold text-slate-800 dark:text-slate-200">{resource.resource_name}</p>
      </td>
      <td className="px-4 py-3 max-w-xs">
        <p className="text-sm text-slate-600 dark:text-slate-400 truncate">{resource.description}</p>
      </td>
      <td className="px-4 py-3">
        <p className="text-sm text-slate-700 dark:text-slate-300">×{resource.quantity}</p>
        {resource.line_total != null && (
          <p className="text-xs text-slate-400">{resource.line_total.toFixed(2)}</p>
        )}
      </td>
      <td className="px-4 py-3">
        <StatusBadge status={resource.status} />
      </td>
      <td className="px-4 py-3">
        <div className="flex items-center gap-1 text-xs text-slate-500">
          <User className="w-3 h-3" />
          {resource.requested_by_username}
        </div>
        <div className="flex items-center gap-1 text-xs text-slate-400 mt-0.5">
          <Clock className="w-3 h-3" />
          {timeAgo(resource.requested_at)}
        </div>
        {resource.provided?.provided_by_username && (
          <div className="flex items-center gap-1 text-xs text-emerald-600 mt-0.5">
            <Wrench className="w-3 h-3" />
            {resource.provided.provided_by_username}
          </div>
        )}
      </td>
      <td className="px-4 py-3">
        <div className="flex items-center gap-1.5">
          {canUpdateStatus && (
            <button onClick={() => onUpdate(resource)} className="btn-secondary text-xs py-1 px-2">
              Update
            </button>
          )}
          {canEditDelete && (
            <>
              <button
                onClick={() => onEdit(resource)}
                className="text-slate-400 hover:text-brand-600 p-1 rounded hover:bg-brand-50 dark:hover:bg-brand-900/20"
                title="Edit"
              >
                <Edit2 className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => onDelete(resource)}
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
const STATUS_OPTIONS: Array<'all' | 'Pending' | 'Fulfilled' | 'Denied'> = ['all', 'Pending', 'Fulfilled', 'Denied'];
const TIME_OPTIONS: Array<'all' | 'today' | 'week' | 'month'> = ['all', 'today', 'week', 'month'];

export default function ResourcesPage() {
  const user = useAuthStore(s => s.user);
  const isAdmin = user?.role === 'Administrator';
  const isIncharge = user?.role === 'Lab Incharge';
  const isAssistant = user?.role === 'Lab Assistant';

  const [createOpen, setCreateOpen] = useState(false);
  const [updateResource, setUpdateResource] = useState<ResourceRequest | null>(null);
  const [editResource, setEditResource] = useState<ResourceRequest | null>(null);
  const [deleteResource, setDeleteResource] = useState<ResourceRequest | null>(null);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('all');
  const [time, setTime] = useState('all');
  const [sort, setSort] = useState('newest');
  const [page, setPage] = useState(1);

  const qc = useQueryClient();

  const { data, isLoading, isError, refetch } = useQuery<PaginatedResponse<ResourceRequest>>({
    queryKey: ['resources', { search, status, time, sort, page }],
    queryFn: ({ signal }) => resourcesApi.list({ search, status, time, sort, page, page_size: 15 }, signal).then(r => r.data),
    placeholderData: prev => prev,
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => resourcesApi.delete(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['resources'] });
      toast.success('Resource request deleted');
      setDeleteResource(null);
    },
    onError: () => toast.error('Failed to delete resource request'),
  });

  const canUpdateStatus = isAdmin || isAssistant;
  const canEditDelete = isIncharge;

  return (
    <div className="space-y-5 animate-fade-in">
      <PageHeader
        title="Resource Requests"
        description="Manage hardware and software resource requests for lab systems."
        actions={
          !isAdmin ? (
            <button onClick={() => setCreateOpen(true)} className="btn-primary">
              <Plus className="w-4 h-4" /> New Request
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
            placeholder="Search systems, labs, resource name…"
            className="input pl-9"
          />
        </div>

        <select value={status} onChange={e => { setStatus(e.target.value); setPage(1); }} className="input w-36">
          {STATUS_OPTIONS.map(s => (
            <option key={s} value={s}>{s === 'all' ? 'All Statuses' : s}</option>
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
          <ErrorState message="Failed to load resource requests." onRetry={refetch} />
        ) : isLoading ? (
          <div className="p-8 text-center text-sm text-slate-500">Loading…</div>
        ) : data?.results.length === 0 ? (
          <EmptyState
            icon={<Package className="w-7 h-7" />}
            title="No resource requests found"
            description="Requests matching your filters will appear here."
          />
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-slate-50 dark:bg-slate-800/50 border-b border-slate-200 dark:border-slate-700">
                  <tr>
                    {['System', 'Resource', 'Description', 'Qty / Cost', 'Status', 'Requested / Handled By', ''].map(h => (
                      <th key={h} className="px-4 py-3 table-header">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-700/50">
                  {data?.results.map(r => (
                    <ResourceRow
                      key={r.resource_id}
                      resource={r}
                      onUpdate={setUpdateResource}
                      onEdit={setEditResource}
                      onDelete={setDeleteResource}
                      canUpdateStatus={canUpdateStatus}
                      canEditDelete={canEditDelete && r.requested_by_username === user?.username}
                    />
                  ))}
                </tbody>
              </table>
            </div>

            {data && data.total_pages > 1 && (
              <div className="px-4 py-3 border-t border-slate-100 dark:border-slate-700 flex items-center justify-between">
                <p className="text-xs text-slate-500">
                  {data.count} total · page {data.page} of {data.total_pages}
                </p>
                <div className="flex items-center gap-1">
                  <button disabled={page === 1} onClick={() => setPage(p => p - 1)} className="btn-ghost p-1.5 disabled:opacity-40">
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <button disabled={page === data.total_pages} onClick={() => setPage(p => p + 1)} className="btn-ghost p-1.5 disabled:opacity-40">
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      <CreateResourceModal open={createOpen} onClose={() => setCreateOpen(false)} />
      <UpdateStatusModal resource={updateResource} onClose={() => setUpdateResource(null)} />
      <EditResourceModal resource={editResource} onClose={() => setEditResource(null)} />

      {/* Delete Confirmation */}
      {deleteResource && (
        <Modal open onClose={() => setDeleteResource(null)} title="Delete Resource Request" size="sm">
          <div className="space-y-4">
            <p className="text-sm text-slate-600 dark:text-slate-400">
              Are you sure you want to delete this resource request for <strong>{deleteResource.resource_name}</strong>?
              This action cannot be undone.
            </p>
            <div className="flex gap-2">
              <button onClick={() => setDeleteResource(null)} className="btn-secondary flex-1">Cancel</button>
              <button
                onClick={() => deleteMutation.mutate(deleteResource.resource_id)}
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