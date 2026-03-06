import { useState, useCallback, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  ChevronRight, Home, Plus, ChevronLeft,
  Building2, Layers, DoorOpen, Monitor, Server, Network,
  Wifi, Printer, Zap, HardDrive, Package, Loader2,
} from 'lucide-react';
import { layoutApi } from '@/lib/api';
import { itemTypeLabel, cn, getChildTypes } from '@/lib/utils';
import type { LayoutItem, BreadcrumbItem, ItemType, SystemStatus } from '@/types';
import Modal from '@/components/common/Modal';
import EmptyState from '@/components/common/EmptyState';
import ErrorState from '@/components/common/ErrorState';
import toast from 'react-hot-toast';
import NetworkFlowView from './NetworkFlowView';
import type { NetworkFlowViewRef } from './NetworkFlowView';
import QuickCreateModal from './QuickCreateModal';

// ─── Icon / colour maps ────────────────────────────────────────────────────────
const typeIcons: Record<string, React.ElementType> = {
  building: Building2, floor: Layers, room: DoorOpen,
  computer: Monitor, server: Server, network_switch: Network,
  router: Wifi, printer: Printer, ups: Zap, rack: HardDrive,
};
const typeColors: Record<string, string> = {
  building:       'bg-violet-100 dark:bg-violet-900/30 text-violet-700 dark:text-violet-300',
  floor:          'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300',
  room:           'bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300',
  computer:       'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300',
  server:         'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300',
  network_switch: 'bg-cyan-100 dark:bg-cyan-900/30 text-cyan-700 dark:text-cyan-300',
  router:         'bg-teal-100 dark:bg-teal-900/30 text-teal-700 dark:text-teal-300',
  printer:        'bg-pink-100 dark:bg-pink-900/30 text-pink-700 dark:text-pink-300',
  ups:            'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-300',
  rack:           'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300',
};

// ─── Add Item Modal ────────────────────────────────────────────────────────────
interface AddItemModalProps {
  open: boolean;
  onClose: () => void;
  parentType: ItemType | null;
  parentId: number | null;
}

function AddItemModal({ open, onClose, parentType, parentId }: AddItemModalProps) {
  const [name, setName] = useState('');
  const [itemType, setItemType] = useState<ItemType | ''>('');
  const qc = useQueryClient();

  const options = getChildTypes(parentType);

  const mutation = useMutation({
    mutationFn: (data: { name: string; item_type: ItemType; parent?: number | null }) =>
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
    mutation.mutate({ name: name.trim(), item_type: itemType as ItemType, parent: parentId });
  };

  return (
    <Modal open={open} onClose={onClose} title="Add New Item">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="label">Item Type</label>
          <select value={itemType} onChange={(e) => setItemType(e.target.value as ItemType)} className="input" required>
            <option value="">Select type…</option>
            {options.map((o) => (
              <option key={o} value={o}>{itemTypeLabel[o]}</option>
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
          <button type="button" onClick={onClose} className="btn-secondary flex-1">Cancel</button>
          <button type="submit" className="btn-primary flex-1" disabled={mutation.isPending}>
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
  const [status, setStatus] = useState<SystemStatus>(item?.status ?? 'active');

  const mutation = useMutation({
    mutationFn: ({ systemId, status }: { systemId: number; status: SystemStatus }) =>
      layoutApi.updateSystemStatus(systemId, status),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['layout-items'] });
      toast.success('Status updated');
      onClose();
    },
    onError: () => toast.error('Failed to update status'),
  });

  const { data: sysData, isLoading: sysLoading } = useQuery({
    queryKey: ['layout-item-system', item?.id],
    queryFn: async () => {
      const itemData = await layoutApi.getItem(item!.id).then(r => r.data);
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
          <select value={status} onChange={(e) => setStatus(e.target.value as SystemStatus)} className="input">
            <option value="active">Active (turned on)</option>
            <option value="inactive">Inactive (turned off)</option>
            <option value="non-functional">Non-Functional</option>
          </select>
        </div>
        <div className="flex gap-2 pt-1">
          <button type="button" onClick={onClose} className="btn-secondary flex-1">Cancel</button>
          <button type="submit" className="btn-primary flex-1" disabled={mutation.isPending || sysLoading || !sysData}>
            {mutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Update'}
          </button>
        </div>
        {!sysLoading && sysData === null && (
          <p className="text-xs text-amber-600 text-center">
            No monitored system found matching this item’s name.
          </p>
        )}
      </form>
    </Modal>
  );
}

// ─── Edit Modal ───────────────────────────────────────────────────────────────
interface EditItemModalProps {
  item: LayoutItem | null;
  onClose: () => void;
  onConfirm: (newName: string) => void;
}

function EditItemModal({ item, onClose, onConfirm }: EditItemModalProps) {
  const [name, setName] = useState(item?.name ?? '');

  useEffect(() => { setName(item?.name ?? ''); }, [item]);

  if (!item) return null;

  return (
    <Modal open={!!item} onClose={onClose} title="Rename Item" size="sm">
      <form onSubmit={(e) => { e.preventDefault(); if (name.trim()) { onConfirm(name.trim()); } }} className="space-y-4">
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
          <button type="submit" className="btn-primary flex-1">Stage Rename</button>
        </div>
      </form>
    </Modal>
  );
}

// ─── Delete Confirm ───────────────────────────────────────────────────────────
interface DeleteModalProps {
  item: LayoutItem | null;
  onClose: () => void;
  onConfirm: () => void;
}

function DeleteModal({ item, onClose, onConfirm }: DeleteModalProps) {
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
          <button onClick={onConfirm} className="btn-danger flex-1">Stage Delete</button>
        </div>
      </div>
    </Modal>
  );
}

// ─── Stats row ────────────────────────────────────────────────────────────────
function StatsRow({ items }: { items: LayoutItem[] }) {
  const counts: Record<string, number> = {};
  items.forEach((i) => { counts[i.item_type] = (counts[i.item_type] ?? 0) + 1; });

  return (
    <div className="flex flex-wrap gap-2">
      {Object.entries(counts).map(([type, count]) => {
        const Icon = typeIcons[type] ?? Package;
        return (
          <span key={type}
            className={cn('flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium',
              typeColors[type] ?? 'bg-slate-100 text-slate-600')}
          >
            <Icon className="w-3 h-3" />
            {count} {itemTypeLabel[type as ItemType] ?? type}
          </span>
        );
      })}
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function LayoutPage() {
  const { id } = useParams<{ id?: string }>();
  const navigate = useNavigate();
  const parentId = id ? parseInt(id) : null;
  const qc = useQueryClient();

  const [addOpen, setAddOpen] = useState(false);
  const [quickCreateOpen, setQuickCreateOpen] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [editItem, setEditItem] = useState<LayoutItem | null>(null);
  const [deleteItem, setDeleteItem] = useState<LayoutItem | null>(null);
  const [pendingRenames, setPendingRenames] = useState<Record<number, string>>({});
  const [pendingDeletes, setPendingDeletes] = useState<number[]>([]);
  const [isSavingLayout, setIsSavingLayout] = useState(false);
  const [isSavingFlow, setIsSavingFlow] = useState(false);
  const isSaving = isSavingLayout || isSavingFlow;
  const flowRef = useRef<NetworkFlowViewRef>(null);

  const handleLayoutSave = useCallback(async () => {
    if (isSavingLayout) return;
    setIsSavingLayout(true);
    try {
      await Promise.all([
        ...Object.entries(pendingRenames).map(([id, name]) =>
          layoutApi.updateItem(parseInt(id, 10), { name }),
        ),
        ...pendingDeletes.map((id) => layoutApi.deleteItem(id)),
      ]);
      qc.invalidateQueries({ queryKey: ['layout-items'] });
      setPendingRenames({});
      setPendingDeletes([]);
    } catch {
      toast.error('Failed to apply layout changes');
      throw new Error('Layout save failed');
    } finally {
      setIsSavingLayout(false);
    }
  }, [isSavingLayout, pendingRenames, pendingDeletes, qc]);

  const handleLayoutDiscard = useCallback(() => {
    setPendingRenames({});
    setPendingDeletes([]);
  }, []);

  // Reset all edit state whenever the user navigates to a different level
  useEffect(() => {
    setEditMode(false);
    setPendingRenames({});
    setPendingDeletes([]);
  }, [parentId]);

  const { data: items = [], isLoading, isError, refetch } = useQuery({
    queryKey: ['layout-items', parentId],
    queryFn: () => layoutApi.getItems({ parent_id: parentId }).then((r) => r.data),
  });

  const { data: breadcrumb = [] } = useQuery({
    queryKey: ['layout-breadcrumb', parentId],
    queryFn: () =>
      parentId
        ? layoutApi.getBreadcrumb(parentId).then((r) => r.data)
        : Promise.resolve<BreadcrumbItem[]>([]),
    enabled: !!parentId,
  });

  const currentItem = breadcrumb[breadcrumb.length - 1];
  const parentType = currentItem?.item_type ?? 'root';
  const canAddChildren = getChildTypes(parentType).length > 0;

  const handleEnter = useCallback((item: LayoutItem) => {
    navigate(`/app/layout/${item.id}`);
  }, [navigate]);

  const handleBack = useCallback(() => {
    if (breadcrumb.length > 1) {
      navigate(`/app/layout/${breadcrumb[breadcrumb.length - 2].id}`);
    } else {
      navigate('/app/layout');
    }
  }, [breadcrumb, navigate]);

  if (isError) return <ErrorState message="Failed to load layout items." onRetry={refetch} />;

  const sharedProps = {
    items,
    parentType,
    editMode,
    onEditModeChange: setEditMode,
    onEnter: handleEnter,
    onEdit: setEditItem,
    onDelete: setDeleteItem,
    pendingRenames,
    pendingDeletes,
    onSaveAll: handleLayoutSave,
    onDiscardAll: handleLayoutDiscard,
  };

  return (
    <div className="space-y-5 animate-fade-in">

      {/* ── Breadcrumb + Actions ── */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-1 flex-wrap">
          <button
            onClick={() => navigate('/app/layout')}
            className="flex items-center gap-1 text-sm text-slate-500 dark:text-slate-400 hover:text-brand-600 dark:hover:text-brand-400 transition-colors"
          >
            <Home className="w-3.5 h-3.5" />
            <span>Root</span>
          </button>
          {breadcrumb.map((crumb, i) => (
            <span key={crumb.id} className="flex items-center gap-1">
              <ChevronRight className="w-3.5 h-3.5 text-slate-400 dark:text-slate-600" />
              {i < breadcrumb.length - 1 ? (
                <button
                  onClick={() => navigate(`/app/layout/${crumb.id}`)}
                  className="text-sm text-slate-500 dark:text-slate-400 hover:text-brand-600 dark:hover:text-brand-400 transition-colors"
                >
                  {crumb.name}
                </button>
              ) : (
                <span className="text-sm font-semibold text-slate-900 dark:text-slate-100">{crumb.name}</span>
              )}
            </span>
          ))}
        </div>

        <div className="flex items-center gap-2">
          {parentId && (
            <button onClick={handleBack} disabled={editMode} className="btn-secondary disabled:opacity-40 disabled:cursor-not-allowed">
              <ChevronLeft className="w-4 h-4" /> Back
            </button>
          )}

          {/* ── View mode: Edit + Quick Build buttons ── */}
          {!editMode && items.length > 0 && canAddChildren && (
            <button onClick={() => setEditMode(true)} className="btn-secondary">
              Edit Layout
            </button>
          )}
          {!editMode && canAddChildren && (
            <button onClick={() => setQuickCreateOpen(true)} className="btn-secondary flex items-center gap-1.5">
              <Zap className="w-4 h-4" /> Quick Build
            </button>
          )}

          {/* ── Edit mode: Discard | + Add | Save ── */}
          {editMode && (
            <div className="flex items-stretch rounded-lg overflow-hidden border border-slate-200 dark:border-slate-700 shadow-sm">
              <button
                onClick={() => flowRef.current?.discard()}
                disabled={isSaving}
                className="px-3 py-1.5 text-sm font-medium text-slate-700 dark:text-slate-300 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors border-r border-slate-200 dark:border-slate-700"
              >
                Discard
              </button>
              {canAddChildren && (
                <button
                  onClick={() => setAddOpen(true)}
                  disabled={isSaving}
                  className="flex items-center gap-1 px-3 py-1.5 text-sm font-medium text-slate-700 dark:text-slate-300 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors border-r border-slate-200 dark:border-slate-700"
                >
                  <Plus className="w-4 h-4" /> Add
                </button>
              )}
              <button
                onClick={() => flowRef.current?.save()}
                disabled={isSaving}
                className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-white bg-brand-600 hover:bg-brand-700 disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
              >
                {isSaving
                  ? <><Loader2 className="w-4 h-4 animate-spin" /> Saving…</>
                  : 'Save Changes'
                }
              </button>
            </div>
          )}
        </div>
      </div>

      {/* ── Context bar ── */}
      <div className="flex flex-wrap items-center gap-3">
        {currentItem && (
          <span className={cn('px-3 py-1 rounded-full text-xs font-medium',
            typeColors[currentItem.item_type] ?? 'bg-slate-100 text-slate-600')}>
            {itemTypeLabel[currentItem.item_type]}
          </span>
        )}
        {!isLoading && items.length > 0 && <StatsRow items={items} />}
      </div>

      {/* ── Content ── */}
      {isLoading ? (
        <div className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 flex items-center justify-center" style={{ height: 'calc(100vh - 210px)', minHeight: 520 }}>
          <div className="flex flex-col items-center gap-3">
            <Loader2 className="w-8 h-8 animate-spin text-brand-500" />
            <p className="text-sm text-slate-500 dark:text-slate-400">Loading layout…</p>
          </div>
        </div>
      ) : items.length === 0 ? (
        <EmptyState

          icon={<Package className="w-7 h-7" />}
          title="No items here"
          description={
            canAddChildren
              ? "Click 'Add Item' to start building your layout."
              : 'This item has no configurable children.'
          }
          action={
            canAddChildren ? (
              <button onClick={() => setAddOpen(true)} className="btn-primary">
                <Plus className="w-4 h-4" /> Add Item
              </button>
            ) : undefined
          }
        />
      ) : (
        <NetworkFlowView
          ref={flowRef}
          onIsSavingChange={setIsSavingFlow}
          {...sharedProps}
        />
      )}

      {/* ── Modals ── */}
      <QuickCreateModal
        open={quickCreateOpen}
        onClose={() => setQuickCreateOpen(false)}
        parentType={parentType}
        parentId={parentId}
        onSuccess={() => qc.invalidateQueries({ queryKey: ['layout-items'] })}
      />
      <AddItemModal
        open={addOpen}
        onClose={() => setAddOpen(false)}
        parentType={parentType}
        parentId={parentId}
      />
      <EditItemModal
        item={editItem}
        onClose={() => setEditItem(null)}
        onConfirm={(newName) => {
          setPendingRenames((prev) => ({ ...prev, [editItem!.id]: newName }));
          setEditItem(null);
        }}
      />
      <DeleteModal
        item={deleteItem}
        onClose={() => setDeleteItem(null)}
        onConfirm={() => {
          setPendingDeletes((prev) => [...prev, deleteItem!.id]);
          setDeleteItem(null);
        }}
      />
    </div>
  );
}
