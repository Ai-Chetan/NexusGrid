import { useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  ChevronRight, Home, Plus, Pencil, Trash2, ChevronLeft,
  Building2, Layers, DoorOpen, Monitor, Server, Network,
  Wifi, Printer, Zap, HardDrive, Package, Loader2,
  Info, ArrowRight,
} from 'lucide-react';
import { layoutApi } from '@/lib/api';
import { itemTypeLabel, statusDot, statusColors, cn, getChildTypes, isSystemType } from '@/lib/utils';
import type { LayoutItem, ItemType, BreadcrumbItem } from '@/types';
import Modal from '@/components/common/Modal';
import StatusBadge from '@/components/common/StatusBadge';
import EmptyState from '@/components/common/EmptyState';
import ErrorState from '@/components/common/ErrorState';
import toast from 'react-hot-toast';

// ─── Icon map ─────────────────────────────────────────────────────────────────
const typeIcons: Record<string, React.ElementType> = {
  building: Building2,
  floor: Layers,
  room: DoorOpen,
  computer: Monitor,
  server: Server,
  network_switch: Network,
  router: Wifi,
  printer: Printer,
  ups: Zap,
  rack: HardDrive,
};

const typeColors: Record<string, string> = {
  building: 'bg-violet-100 text-violet-700',
  floor: 'bg-blue-100 text-blue-700',
  room: 'bg-indigo-100 text-indigo-700',
  computer: 'bg-emerald-100 text-emerald-700',
  server: 'bg-amber-100 text-amber-700',
  network_switch: 'bg-cyan-100 text-cyan-700',
  router: 'bg-teal-100 text-teal-700',
  printer: 'bg-pink-100 text-pink-700',
  ups: 'bg-yellow-100 text-yellow-700',
  rack: 'bg-slate-100 text-slate-700',
};

// ─── Item Card ────────────────────────────────────────────────────────────────
interface ItemCardProps {
  item: LayoutItem;
  onEnter: (item: LayoutItem) => void;
  onEdit: (item: LayoutItem) => void;
  onDelete: (item: LayoutItem) => void;
  onStatusChange?: (item: LayoutItem) => void;
}

function ItemCard({ item, onEnter, onEdit, onDelete, onStatusChange }: ItemCardProps) {
  const Icon = typeIcons[item.item_type] ?? Package;
  const isSystem = isSystemType(item.item_type);
  const notLeaf = ['building', 'floor', 'room'].includes(item.item_type);

  return (
    <div className="card p-4 flex flex-col gap-3 hover:shadow-md transition-shadow group">
      {/* Header */}
      <div className="flex items-start justify-between gap-2">
        <div className={cn('w-9 h-9 rounded-xl flex items-center justify-center shrink-0', typeColors[item.item_type] ?? 'bg-slate-100 text-slate-600')}>
          <Icon className="w-4.5 h-4.5" />
        </div>
        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <button
            onClick={() => onEdit(item)}
            className="w-7 h-7 flex items-center justify-center rounded-lg text-slate-400
                       hover:text-brand-600 hover:bg-brand-50 transition-colors"
            title="Rename"
          >
            <Pencil className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => onDelete(item)}
            className="w-7 h-7 flex items-center justify-center rounded-lg text-slate-400
                       hover:text-red-500 hover:bg-red-50 transition-colors"
            title="Delete"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Name & type */}
      <div className="flex-1">
        <p className="text-sm font-semibold text-slate-900 truncate">{item.name}</p>
        <p className="text-xs text-slate-500 mt-0.5">{itemTypeLabel[item.item_type]}</p>
      </div>

      {/* Status */}
      {isSystem && item.status && (
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <span className={cn('w-2 h-2 rounded-full', statusDot[item.status] ?? 'bg-slate-400')} />
            <span className="text-xs text-slate-600">
              {item.status === 'active' ? 'Active' : item.status === 'inactive' ? 'Inactive' : 'Non-Functional'}
            </span>
          </div>
          {onStatusChange && (
            <button
              onClick={() => onStatusChange(item)}
              className="text-xs text-brand-600 hover:underline font-medium"
            >
              Change
            </button>
          )}
        </div>
      )}

      {/* Quick info for rooms */}
      {item.item_type === 'room' && item.quick_info && Object.keys(item.quick_info).length > 0 && (
        <div className="flex flex-wrap gap-1">
          {Object.entries(item.quick_info).slice(0, 3).map(([k, v]) => (
            <span key={k} className="text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full">
              {String(v)}
            </span>
          ))}
        </div>
      )}

      {/* Action */}
      {notLeaf && (
        <button
          onClick={() => onEnter(item)}
          className="flex items-center justify-between w-full px-3 py-2 bg-slate-50 hover:bg-brand-50
                     rounded-lg text-xs font-medium text-slate-600 hover:text-brand-700 transition-colors"
        >
          <span>View contents</span>
          <ArrowRight className="w-3.5 h-3.5" />
        </button>
      )}
    </div>
  );
}

// ─── Add Item Modal ────────────────────────────────────────────────────────────
interface AddItemModalProps {
  open: boolean;
  onClose: () => void;
  parentType: string;
  parentId: number | null;
}

function AddItemModal({ open, onClose, parentType, parentId }: AddItemModalProps) {
  const [name, setName] = useState('');
  const [itemType, setItemType] = useState('');
  const qc = useQueryClient();

  const options = getChildTypes(parentType);

  const mutation = useMutation({
    mutationFn: (data: { name: string; item_type: string; parent?: number | null }) =>
      layoutApi.createItem(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['layout-items'] });
      toast.success('Item added successfully');
      setName('');
      setItemType('');
      onClose();
    },
    onError: () => toast.error('Failed to add item'),
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !itemType) return;
    mutation.mutate({ name: name.trim(), item_type: itemType, parent: parentId });
  };

  return (
    <Modal open={open} onClose={onClose} title="Add New Item">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="label">Item Type</label>
          <select
            value={itemType}
            onChange={(e) => setItemType(e.target.value)}
            className="input"
            required
          >
            <option value="">Select type…</option>
            {options.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="label">Name</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="input"
            placeholder="e.g. Block A, Lab 101"
            required
          />
        </div>
        <div className="flex gap-2 pt-2">
          <button type="button" onClick={onClose} className="btn-secondary flex-1">
            Cancel
          </button>
          <button
            type="submit"
            className="btn-primary flex-1"
            disabled={mutation.isPending}
          >
            {mutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Add Item'}
          </button>
        </div>
      </form>
    </Modal>
  );
}

// ─── Status Update Modal ──────────────────────────────────────────────────────
interface StatusModalProps {
  item: LayoutItem | null;
  onClose: () => void;
}

function StatusModal({ item, onClose }: StatusModalProps) {
  const qc = useQueryClient();
  const [status, setStatus] = useState<string>(item?.status ?? 'active');

  const mutation = useMutation({
    mutationFn: ({ systemId, status }: { systemId: number; status: string }) =>
      layoutApi.updateSystemStatus(systemId, status),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['layout-items'] });
      toast.success('Status updated');
      onClose();
    },
    onError: () => toast.error('Failed to update status'),
  });

  // We need the system ID from the layout item — we refetch it lazily
  const { data: sysData } = useQuery({
    queryKey: ['layout-item-system', item?.id],
    queryFn: async () => {
      const itemData = await layoutApi.getItem(item!.id).then(r => r.data);
      // The system record uses the layout_item id via the system accessor
      // For status update we need to find the system by layout item
      const systems = await layoutApi.getSystems().then(r => r.data);
      return systems.find(s => s.host_name === itemData.name) ?? null;
    },
    enabled: !!item,
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!sysData) return;
    mutation.mutate({ systemId: sysData.id, status });
  };

  if (!item) return null;

  return (
    <Modal open={!!item} onClose={onClose} title={`Update Status: ${item.name}`} size="sm">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="label">Status</label>
          <select value={status} onChange={(e) => setStatus(e.target.value)} className="input">
            <option value="active">Active (turned on)</option>
            <option value="inactive">Inactive (turned off)</option>
            <option value="non-functional">Non-Functional</option>
          </select>
        </div>
        <div className="flex gap-2 pt-1">
          <button type="button" onClick={onClose} className="btn-secondary flex-1">Cancel</button>
          <button type="submit" className="btn-primary flex-1" disabled={mutation.isPending || !sysData}>
            {mutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Update'}
          </button>
        </div>
      </form>
    </Modal>
  );
}

// ─── Edit Modal ───────────────────────────────────────────────────────────────
interface EditItemModalProps {
  item: LayoutItem | null;
  onClose: () => void;
}

function EditItemModal({ item, onClose }: EditItemModalProps) {
  const [name, setName] = useState(item?.name ?? '');
  const qc = useQueryClient();

  const mutation = useMutation({
    mutationFn: (newName: string) => layoutApi.updateItem(item!.id, { name: newName }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['layout-items'] });
      toast.success('Renamed successfully');
      onClose();
    },
    onError: () => toast.error('Failed to rename'),
  });

  if (!item) return null;

  return (
    <Modal open={!!item} onClose={onClose} title="Rename Item" size="sm">
      <form onSubmit={(e) => { e.preventDefault(); mutation.mutate(name); }} className="space-y-4">
        <div>
          <label className="label">Name</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="input"
            autoFocus
          />
        </div>
        <div className="flex gap-2 pt-1">
          <button type="button" onClick={onClose} className="btn-secondary flex-1">Cancel</button>
          <button type="submit" className="btn-primary flex-1" disabled={mutation.isPending}>
            {mutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Save'}
          </button>
        </div>
      </form>
    </Modal>
  );
}

// ─── Delete Confirm ───────────────────────────────────────────────────────────
interface DeleteModalProps {
  item: LayoutItem | null;
  onClose: () => void;
}

function DeleteModal({ item, onClose }: DeleteModalProps) {
  const qc = useQueryClient();

  const mutation = useMutation({
    mutationFn: () => layoutApi.deleteItem(item!.id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['layout-items'] });
      toast.success('Item deleted');
      onClose();
    },
    onError: () => toast.error('Failed to delete item'),
  });

  if (!item) return null;

  return (
    <Modal open={!!item} onClose={onClose} title="Confirm Delete" size="sm">
      <div className="space-y-4">
        <p className="text-sm text-slate-600">
          Are you sure you want to delete <strong>{item.name}</strong>? This will also remove
          all child items and related records.
        </p>
        <div className="flex gap-2 pt-1">
          <button onClick={onClose} className="btn-secondary flex-1">Cancel</button>
          <button
            onClick={() => mutation.mutate()}
            className="btn-danger flex-1"
            disabled={mutation.isPending}
          >
            {mutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Delete'}
          </button>
        </div>
      </div>
    </Modal>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function LayoutPage() {
  const { id } = useParams<{ id?: string }>();
  const navigate = useNavigate();
  const parentId = id ? parseInt(id) : null;

  const [addOpen, setAddOpen] = useState(false);
  const [editItem, setEditItem] = useState<LayoutItem | null>(null);
  const [deleteItem, setDeleteItem] = useState<LayoutItem | null>(null);
  const [statusItem, setStatusItem] = useState<LayoutItem | null>(null);

  // Fetch items at current level
  const { data: items = [], isLoading, isError, refetch } = useQuery({
    queryKey: ['layout-items', parentId],
    queryFn: () => layoutApi.getItems({ parent_id: parentId }).then((r) => r.data),
  });

  // Fetch breadcrumb
  const { data: breadcrumb = [] } = useQuery({
    queryKey: ['layout-breadcrumb', parentId],
    queryFn: () => parentId ? layoutApi.getBreadcrumb(parentId).then((r) => r.data) : Promise.resolve<BreadcrumbItem[]>([]),
    enabled: !!parentId,
  });

  // Determine current context
  const currentItem = breadcrumb[breadcrumb.length - 1];
  const parentType = currentItem?.item_type ?? 'root';
  const canAddChildren = getChildTypes(parentType).length > 0;

  const handleEnter = useCallback((item: LayoutItem) => {
    navigate(`/layout/${item.id}`);
  }, [navigate]);

  const handleBack = useCallback(() => {
    if (breadcrumb.length > 1) {
      navigate(`/layout/${breadcrumb[breadcrumb.length - 2].id}`);
    } else {
      navigate('/layout');
    }
  }, [breadcrumb, navigate]);

  if (isError) return <ErrorState message="Failed to load layout items." onRetry={refetch} />;

  return (
    <div className="space-y-5 animate-fade-in">
      {/* Breadcrumb + Actions */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        {/* Breadcrumb */}
        <div className="flex items-center gap-1 flex-wrap">
          <button
            onClick={() => navigate('/layout')}
            className="flex items-center gap-1 text-sm text-slate-500 hover:text-brand-600 transition-colors"
          >
            <Home className="w-3.5 h-3.5" />
            <span>Root</span>
          </button>
          {breadcrumb.map((crumb, i) => (
            <span key={crumb.id} className="flex items-center gap-1">
              <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
              {i < breadcrumb.length - 1 ? (
                <button
                  onClick={() => navigate(`/layout/${crumb.id}`)}
                  className="text-sm text-slate-500 hover:text-brand-600 transition-colors"
                >
                  {crumb.name}
                </button>
              ) : (
                <span className="text-sm font-semibold text-slate-900">{crumb.name}</span>
              )}
            </span>
          ))}
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2">
          {parentId && (
            <button onClick={handleBack} className="btn-secondary">
              <ChevronLeft className="w-4 h-4" />
              Back
            </button>
          )}
          {canAddChildren && (
            <button onClick={() => setAddOpen(true)} className="btn-primary">
              <Plus className="w-4 h-4" />
              Add Item
            </button>
          )}
        </div>
      </div>

      {/* Level indicator */}
      {currentItem && (
        <div className="flex items-center gap-2">
          <span className={cn('px-3 py-1 rounded-full text-xs font-medium',
            typeColors[currentItem.item_type] ?? 'bg-slate-100 text-slate-600')}>
            {itemTypeLabel[currentItem.item_type]}
          </span>
          <span className="text-sm text-slate-500">
            {items.length} item{items.length !== 1 ? 's' : ''} inside
          </span>
        </div>
      )}

      {/* Grid */}
      {isLoading ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="h-36 bg-white rounded-xl border border-slate-200 animate-pulse" />
          ))}
        </div>
      ) : items.length === 0 ? (
        <EmptyState
          icon={<Package className="w-7 h-7" />}
          title="No items here"
          description={canAddChildren ? "Click 'Add Item' to start building your layout." : "This item has no configurable children."}
          action={
            canAddChildren ? (
              <button onClick={() => setAddOpen(true)} className="btn-primary">
                <Plus className="w-4 h-4" /> Add Item
              </button>
            ) : undefined
          }
        />
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
          {items.map((item) => (
            <ItemCard
              key={item.id}
              item={item}
              onEnter={handleEnter}
              onEdit={setEditItem}
              onDelete={setDeleteItem}
              onStatusChange={isSystemType(item.item_type) ? setStatusItem : undefined}
            />
          ))}
        </div>
      )}

      {/* Modals */}
      <AddItemModal
        open={addOpen}
        onClose={() => setAddOpen(false)}
        parentType={parentType}
        parentId={parentId}
      />
      <EditItemModal item={editItem} onClose={() => setEditItem(null)} />
      <DeleteModal item={deleteItem} onClose={() => setDeleteItem(null)} />
      <StatusModal item={statusItem} onClose={() => setStatusItem(null)} />
    </div>
  );
}
