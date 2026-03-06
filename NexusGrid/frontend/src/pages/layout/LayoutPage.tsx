import { useState, useCallback, useEffect, useMemo, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  ChevronRight, Home, Plus, ChevronLeft,
  Building2, Layers, DoorOpen, Monitor, Server, Network,
  Wifi, Printer, Zap, HardDrive, Package, Loader2,
  Copy, ClipboardPaste, Undo2, Redo2, AlertTriangle, PackageSearch,
} from 'lucide-react';
import { layoutApi, faultsApi, resourcesApi, privilegesApi } from '@/lib/api';
import { itemTypeLabel, cn, getChildTypes } from '@/lib/utils';
import { useAuthStore } from '@/store/authStore';
import type { LayoutItem, BreadcrumbItem, SimpleSystem } from '@/types';
import Modal from '@/components/common/Modal';
import EmptyState from '@/components/common/EmptyState';
import ErrorState from '@/components/common/ErrorState';
import toast from 'react-hot-toast';
import NetworkFlowView from './NetworkFlowView';
import type { NetworkFlowViewRef } from './NetworkFlowView';
import QuickCreateModal from './QuickCreateModal';
import ComputerMonitorModal from './ComputerMonitorModal';

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
// ─── Quick Fault Modal ──────────────────────────────────────────────────────
interface QuickFaultModalProps { item: LayoutItem; onClose: () => void; }
function QuickFaultModal({ item, onClose }: QuickFaultModalProps) {
  const qc = useQueryClient();
  const [faultType, setFaultType] = useState('Hardware');
  const [description, setDescription] = useState('');

  const { data: systems = [], isLoading: systemsLoading } = useQuery({
    queryKey: ['systems-list'],
    queryFn: () => layoutApi.getSystems().then(r => r.data),
    staleTime: 60_000,
  });
  const system = systems.find((s: SimpleSystem) => s.host_name.toLowerCase() === item.name.toLowerCase());

  const mutation = useMutation({
    mutationFn: (d: { system_id: number; fault_type: string; description: string }) =>
      faultsApi.create(d),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['faults'] });
      qc.invalidateQueries({ queryKey: ['layout-items'] });
      toast.success('Fault reported!');
      onClose();
    },
    onError: () => toast.error('Failed to report fault'),
  });

  return (
    <Modal open onClose={onClose} title={`Report Fault for ${item.name}`} size="sm">
      <div className="space-y-4">
        {systemsLoading && <p className="text-xs text-slate-400 text-center">Loading…</p>}
        {!systemsLoading && !system && (
          <p className="text-xs text-amber-600 text-center">
            No system record found for <strong>{item.name}</strong>. Fault cannot be created.
          </p>
        )}
        {system && (
          <>
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
                className="input min-h-[80px] resize-none"
                placeholder="Describe the fault…"
                rows={3}
              />
            </div>
          </>
        )}
        <div className="flex gap-2 pt-1">
          <button onClick={onClose} className="btn-secondary flex-1">Cancel</button>
          <button
            onClick={() => system && mutation.mutate({ system_id: system.id, fault_type: faultType, description })}
            disabled={!system || !description.trim() || mutation.isPending}
            className="btn-danger flex-1 flex items-center justify-center gap-1.5"
          >
            {mutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <AlertTriangle className="w-4 h-4" />}
            Report Fault
          </button>
        </div>
      </div>
    </Modal>
  );
}

// ─── Quick Resource Modal ──────────────────────────────────────────────────
interface QuickResourceModalProps { item: LayoutItem; onClose: () => void; }
function QuickResourceModal({ item, onClose }: QuickResourceModalProps) {
  const qc = useQueryClient();
  const [resourceName, setResourceName] = useState('');
  const [description, setDescription] = useState('');

  const { data: systems = [], isLoading: systemsLoading } = useQuery({
    queryKey: ['systems-list'],
    queryFn: () => layoutApi.getSystems().then(r => r.data),
    staleTime: 60_000,
  });
  const system = systems.find((s: SimpleSystem) => s.host_name.toLowerCase() === item.name.toLowerCase());

  const mutation = useMutation({
    mutationFn: (d: { system_id: number; resource_name: string; description: string }) =>
      resourcesApi.create(d),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['resources'] });
      qc.invalidateQueries({ queryKey: ['layout-items'] });
      toast.success('Resource requested!');
      onClose();
    },
    onError: () => toast.error('Failed to request resource'),
  });

  return (
    <Modal open onClose={onClose} title={`Request Resource for ${item.name}`} size="sm">
      <div className="space-y-4">
        {systemsLoading && <p className="text-xs text-slate-400 text-center">Loading…</p>}
        {!systemsLoading && !system && (
          <p className="text-xs text-amber-600 text-center">
            No system record found for <strong>{item.name}</strong>. Request cannot be created.
          </p>
        )}
        {system && (
          <>
            <div>
              <label className="label">Resource Name</label>
              <input
                type="text"
                value={resourceName}
                onChange={e => setResourceName(e.target.value)}
                className="input"
                placeholder="e.g. Keyboard, RAM 8GB, Monitor…"
              />
            </div>
            <div>
              <label className="label">Description</label>
              <textarea
                value={description}
                onChange={e => setDescription(e.target.value)}
                className="input min-h-[80px] resize-none"
                placeholder="Describe the resource needed…"
                rows={3}
              />
            </div>
          </>
        )}
        <div className="flex gap-2 pt-1">
          <button onClick={onClose} className="btn-secondary flex-1">Cancel</button>
          <button
            onClick={() => system && mutation.mutate({ system_id: system.id, resource_name: resourceName, description })}
            disabled={!system || !resourceName.trim() || !description.trim() || mutation.isPending}
            className="btn-primary flex-1 flex items-center justify-center gap-1.5"
          >
            {mutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <PackageSearch className="w-4 h-4" />}
            Request Resource
          </button>
        </div>
      </div>
    </Modal>
  );
}
// ─── Add Item Modal ────────────────────────────────────────────────────────────
interface AddItemModalProps {
  open: boolean;
  onClose: () => void;
  parentType: string;
  parentId: number | null;
  existingItems: LayoutItem[];
}

function AddItemModal({ open, onClose, parentType, parentId, existingItems }: AddItemModalProps) {
  const [name, setName] = useState('');
  const [itemType, setItemType] = useState('');
  const qc = useQueryClient();

  const options = getChildTypes(parentType);

  const mutation = useMutation({
    mutationFn: (data: { name: string; item_type: string; parent?: number | null; position_x?: number; position_y?: number }) =>
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
    mutation.mutate({
      name: name.trim(),
      item_type: itemType,
      parent: parentId,
      position_x: suggestedSpawn.x,
      position_y: suggestedSpawn.y,
    });
  };

  const suggestedSpawn = useMemo(() => {
    const SNAP = 24;
    const STEP_X = 192;
    const STEP_Y = 168;
    const snap = (v: number) => Math.round(v / SNAP) * SNAP;

    if (existingItems.length === 0) {
      return { x: 0, y: 0 };
    }

    const positions = existingItems.map((i) => ({ x: snap(i.position_x), y: snap(i.position_y) }));
    const minX = Math.min(...positions.map((p) => p.x));
    const maxX = Math.max(...positions.map((p) => p.x));
    const minY = Math.min(...positions.map((p) => p.y));
    const maxY = Math.max(...positions.map((p) => p.y));

    const anchor = { x: maxX + STEP_X, y: minY };
    const occupied = (x: number, y: number) =>
      positions.some((p) => Math.abs(p.x - x) < STEP_X * 0.7 && Math.abs(p.y - y) < STEP_Y * 0.7);

    if (!occupied(anchor.x, anchor.y)) return anchor;

    // Spiral search around anchor to keep new nodes near existing ones.
    for (let ring = 1; ring <= 6; ring++) {
      for (let dx = -ring; dx <= ring; dx++) {
        for (let dy = -ring; dy <= ring; dy++) {
          if (Math.max(Math.abs(dx), Math.abs(dy)) !== ring) continue;
          const x = snap(anchor.x + dx * STEP_X);
          const y = snap(anchor.y + dy * STEP_Y);
          if (!occupied(x, y)) return { x, y };
        }
      }
    }

    return { x: snap(maxX + STEP_X), y: snap(maxY + STEP_Y) };
  }, [existingItems]);

  return (
    <Modal open={open} onClose={onClose} title="Add New Item">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="label">Item Type</label>
          <select value={itemType} onChange={(e) => setItemType(e.target.value)} className="input" required>
            <option value="">Select type…</option>
            {options.map((opt) => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
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

  const { data: sysData, isLoading: sysLoading } = useQuery({
    queryKey: ['layout-item-system', item?.id],
    queryFn: async () => {
      const itemData = await layoutApi.getItem(item!.id).then(r => r.data);
      const systems = await layoutApi.getSystems().then(r => r.data);
      return systems.find((s: SimpleSystem) => s.host_name === itemData.name) ?? null;
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

// ─── Clipboard types ─────────────────────────────────────────────────────────
interface ClipboardEntry {
  name: string;
  item_type: string;
  position_x: number;
  position_y: number;
}
interface LayoutClipboard {
  items: ClipboardEntry[];
  sourceParentType: string;
}
// ─── Undo / Redo snapshot ─────────────────────────────────────────────────────
interface EditSnapshot {
  renames: Record<number, string>;
  deletes: number[];
  positions: Record<string, { x: number; y: number }>;
}
// ─── Paste Layout Modal ───────────────────────────────────────────────────────
interface PasteModalProps {
  open: boolean;
  onClose: () => void;
  clipboard: LayoutClipboard | null;
  parentId: number | null;
  parentType: string;
}

function PasteModal({ open, onClose, clipboard, parentId, parentType }: PasteModalProps) {
  const [prefix, setPrefix] = useState('');
  const [isPasting, setIsPasting] = useState(false);
  const qc = useQueryClient();

  useEffect(() => { if (!open) setPrefix(''); }, [open]);

  if (!clipboard) return null;

  const handlePaste = async () => {
    setIsPasting(true);
    try {
      await Promise.all(
        clipboard.items.map((entry) =>
          layoutApi.createItem({
            name: prefix.trim() ? `${prefix.trim()} ${entry.name}` : entry.name,
            item_type: entry.item_type,
            parent: parentId,
            position_x: entry.position_x,
            position_y: entry.position_y,
          }),
        ),
      );
      qc.invalidateQueries({ queryKey: ['layout-items'] });
      toast.success(`${clipboard.items.length} item${clipboard.items.length !== 1 ? 's' : ''} pasted`);
      onClose();
    } catch {
      toast.error('Failed to paste items');
    } finally {
      setIsPasting(false);
    }
  };

  const levelLabel = parentType === 'root' ? 'root' : parentType;

  return (
    <Modal open={open} onClose={onClose} title="Paste Layout">
      <div className="space-y-4">
        <p className="text-sm text-slate-600 dark:text-slate-400">
          Paste <strong>{clipboard.items.length}</strong> item{clipboard.items.length !== 1 ? 's' : ''} into this <strong>{levelLabel}</strong>.
        </p>

        <div className="max-h-48 overflow-y-auto space-y-0.5 border border-slate-200 dark:border-slate-700 rounded-lg p-2">
          {clipboard.items.map((entry, i) => {
            const Icon = typeIcons[entry.item_type] ?? Package;
            const displayName = prefix.trim() ? `${prefix.trim()} ${entry.name}` : entry.name;
            return (
              <div key={i} className="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-300 px-1 py-0.5 rounded hover:bg-slate-50 dark:hover:bg-slate-800/40">
                <Icon className="w-3.5 h-3.5 shrink-0 text-slate-400" />
                <span className="truncate flex-1">{displayName}</span>
                <span className="text-xs text-slate-400 shrink-0">{itemTypeLabel[entry.item_type] ?? entry.item_type}</span>
              </div>
            );
          })}
        </div>

        <div>
          <label className="label">Name prefix <span className="text-slate-400 font-normal">(optional)</span></label>
          <input
            type="text"
            value={prefix}
            onChange={(e) => setPrefix(e.target.value)}
            className="input"
            placeholder="e.g. Copy of"
          />
        </div>

        <div className="flex gap-2 pt-1">
          <button type="button" onClick={onClose} className="btn-secondary flex-1">Cancel</button>
          <button
            type="button"
            onClick={handlePaste}
            disabled={isPasting}
            className="btn-primary flex-1"
          >
            {isPasting
              ? <><Loader2 className="w-4 h-4 animate-spin" /> Pasting…</>
              : `Paste ${clipboard.items.length} Item${clipboard.items.length !== 1 ? 's' : ''}`
            }
          </button>
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
            {count} {itemTypeLabel[type] ?? type}
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
  const user = useAuthStore(s => s.user);
  const isNoRole     = user?.role === 'No Roles';
  const isRestricted = user?.role === 'Lab Incharge' || user?.role === 'Lab Assistant';

  // ─── Persist & restore layout position across page navigations ───────────────────
  const didRestoreRef = useRef(false);
  useEffect(() => {
    if (parentId !== null) {
      sessionStorage.setItem('lastLayoutId', String(parentId));
    }
  }, [parentId]);
  useEffect(() => {
    if (!didRestoreRef.current && parentId === null) {
      didRestoreRef.current = true;
      const lastId = sessionStorage.getItem('lastLayoutId');
      if (lastId) {
        navigate(`/app/layout/${lastId}`, { replace: true });
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const [addOpen, setAddOpen] = useState(false);
  const [quickCreateOpen, setQuickCreateOpen] = useState(false);
  const [pasteOpen, setPasteOpen] = useState(false);
  const [copiedLayout, setCopiedLayout] = useState<LayoutClipboard | null>(null);
  const [editMode, setEditMode] = useState(false);
  const [editItem, setEditItem] = useState<LayoutItem | null>(null);
  const [deleteItem, setDeleteItem] = useState<LayoutItem | null>(null);
  const [pendingRenames, setPendingRenames] = useState<Record<number, string>>({});
  const [pendingDeletes, setPendingDeletes] = useState<number[]>([]);
  const [undoStack, setUndoStack] = useState<EditSnapshot[]>([]);
  const [redoStack, setRedoStack] = useState<EditSnapshot[]>([]);
  const [isSavingLayout, setIsSavingLayout] = useState(false);
  const [isSavingFlow, setIsSavingFlow] = useState(false);
  const [monitorItem, setMonitorItem] = useState<LayoutItem | null>(null);
  const [faultItem, setFaultItem] = useState<LayoutItem | null>(null);
  const [resourceItem, setResourceItem] = useState<LayoutItem | null>(null);
  const isSaving = isSavingLayout || isSavingFlow;
  const canUndo = undoStack.length > 0;
  const canRedo = redoStack.length > 0;
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
    setUndoStack([]);
    setRedoStack([]);
  }, []);

  // Push current edit state onto the undo stack and clear redo
  const pushUndo = useCallback((renames: Record<number, string>, deletes: number[]) => {
    const positions = flowRef.current?.getPositions() ?? {};
    setUndoStack((s) => [...s, { renames, deletes, positions }]);
    setRedoStack([]);
  }, []);

  const handleUndo = useCallback(() => {
    setUndoStack((stack) => {
      if (stack.length === 0) return stack;
      const prev = stack[stack.length - 1];
      const currentPositions = flowRef.current?.getPositions() ?? {};
      setRedoStack((rs) => [
        ...rs,
        { renames: pendingRenames, deletes: pendingDeletes, positions: currentPositions },
      ]);
      setPendingRenames(prev.renames);
      setPendingDeletes(prev.deletes);
      flowRef.current?.applyPositions(prev.positions);
      return stack.slice(0, -1);
    });
  }, [pendingRenames, pendingDeletes]);

  const handleRedo = useCallback(() => {
    setRedoStack((stack) => {
      if (stack.length === 0) return stack;
      const next = stack[stack.length - 1];
      const currentPositions = flowRef.current?.getPositions() ?? {};
      setUndoStack((us) => [
        ...us,
        { renames: pendingRenames, deletes: pendingDeletes, positions: currentPositions },
      ]);
      setPendingRenames(next.renames);
      setPendingDeletes(next.deletes);
      flowRef.current?.applyPositions(next.positions);
      return stack.slice(0, -1);
    });
  }, [pendingRenames, pendingDeletes]);

  // Keyboard shortcuts: Ctrl+Z = undo, Ctrl+Y / Ctrl+Shift+Z = redo
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (!editMode) return;
      const target = e.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) return;
      if (e.ctrlKey && !e.shiftKey && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        handleUndo();
      }
      if (e.ctrlKey && (e.key.toLowerCase() === 'y' || (e.shiftKey && e.key.toLowerCase() === 'z'))) {
        e.preventDefault();
        handleRedo();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [editMode, handleUndo, handleRedo]);

  // Called by NetworkFlowView just before committing a drag
  const handleBeforePositionChange = useCallback((currentPositions: Record<string, { x: number; y: number }>) => {
    setUndoStack((s) => [...s, { renames: pendingRenames, deletes: pendingDeletes, positions: currentPositions }]);
    setRedoStack([]);
  }, [pendingRenames, pendingDeletes]);

  // Reset all edit state whenever the user navigates to a different level
  useEffect(() => {
    setEditMode(false);
    setPendingRenames({});
    setPendingDeletes([]);
    setUndoStack([]);
    setRedoStack([]);
  }, [parentId]);

  const { data: rawItems = [], isLoading, isError, refetch } = useQuery({
    queryKey: ['layout-items', parentId],
    queryFn: () => layoutApi.getItems({ parent_id: parentId }).then((r) => r.data),
  });

  // Fetch this user's lab assignments — used to gate content for restricted roles
  const { data: myAssignments = [] } = useQuery({
    queryKey: ['my-assignments'],
    queryFn: () => privilegesApi.getAssignments().then(r => r.data as { id: number }[]),
    enabled: isRestricted,
    staleTime: 5 * 60 * 1000,
  });

  // No Roles → always empty; Restricted with no assignments → also empty
  const hasNoAccess = isNoRole || (isRestricted && myAssignments.length === 0);
  const items = hasNoAccess ? [] : rawItems;

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
  const canPaste = copiedLayout !== null && copiedLayout.sourceParentType === parentType;

  const handleCopy = useCallback(() => {
    if (items.length === 0) return;
    setCopiedLayout({
      items: items.map((item: LayoutItem) => ({
        name: item.name,
        item_type: item.item_type,
        position_x: item.position_x,
        position_y: item.position_y,
      })),
      sourceParentType: parentType,
    });
    toast.success(`${items.length} item${items.length !== 1 ? 's' : ''} copied to clipboard`);
  }, [items, parentType]);

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
            onClick={() => {
              sessionStorage.removeItem('lastLayoutId');
              navigate('/app/layout');
            }}
            className="flex items-center gap-1 text-sm text-slate-500 dark:text-slate-400 hover:text-brand-600 dark:hover:text-brand-400 transition-colors"
          >
            <Home className="w-3.5 h-3.5" />
            <span>Root</span>
          </button>
          {breadcrumb.map((crumb: BreadcrumbItem, i: number) => (
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
          {!isNoRole && !isRestricted && !editMode && items.length > 0 && canAddChildren && (
            <button onClick={() => setEditMode(true)} className="btn-secondary">
              Edit Layout
            </button>
          )}
          {!isNoRole && !isRestricted && !editMode && canAddChildren && (
            <button onClick={() => setQuickCreateOpen(true)} className="btn-secondary flex items-center gap-1.5">
              <Zap className="w-4 h-4" /> Quick Build
            </button>
          )}
          {/* ── Paste — always visible when clipboard is compatible, regardless of edit mode ── */}
          {!isNoRole && !isRestricted && canPaste && (
            <button
              onClick={() => setPasteOpen(true)}
              title="Paste copied layout here"
              className="btn-secondary flex items-center gap-1.5 text-violet-700 dark:text-violet-300 border-violet-200 dark:border-violet-700 hover:bg-violet-50 dark:hover:bg-violet-900/20"
            >
              <ClipboardPaste className="w-4 h-4" /> Paste Layout
            </button>
          )}

          {/* ── Edit mode: Discard | Undo | Redo | Copy | + Add | Save ── */}
          {!isNoRole && !isRestricted && editMode && (
            <div className="flex items-stretch rounded-lg overflow-hidden border border-slate-200 dark:border-slate-700 shadow-sm">
              <button
                onClick={() => flowRef.current?.discard()}
                disabled={isSaving}
                className="px-3 py-1.5 text-sm font-medium text-slate-700 dark:text-slate-300 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors border-r border-slate-200 dark:border-slate-700"
              >
                Discard
              </button>
              <button
                onClick={handleUndo}
                disabled={isSaving || !canUndo}
                title="Undo (Ctrl+Z)"
                className="flex items-center gap-1 px-3 py-1.5 text-sm font-medium text-slate-700 dark:text-slate-300 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors border-r border-slate-200 dark:border-slate-700"
              >
                <Undo2 className="w-4 h-4" />
              </button>
              <button
                onClick={handleRedo}
                disabled={isSaving || !canRedo}
                title="Redo (Ctrl+Y)"
                className="flex items-center gap-1 px-3 py-1.5 text-sm font-medium text-slate-700 dark:text-slate-300 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors border-r border-slate-200 dark:border-slate-700"
              >
                <Redo2 className="w-4 h-4" />
              </button>
              {items.length > 0 && (
                <button
                  onClick={handleCopy}
                  disabled={isSaving}
                  title="Copy all items in this layer"
                  className="flex items-center gap-1 px-3 py-1.5 text-sm font-medium text-slate-700 dark:text-slate-300 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors border-r border-slate-200 dark:border-slate-700"
                >
                  <Copy className="w-4 h-4" /> Copy
                </button>
              )}
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
          title={hasNoAccess ? 'No access' : 'No items here'}
          description={
            hasNoAccess
              ? isNoRole
                ? 'Your account has no role. Contact an administrator to get access.'
                : 'You have no labs assigned. Contact an administrator.'
              : !isRestricted && canAddChildren
              ? "Click 'Add Item' to start building your layout."
              : 'This item has no configurable children.'
          }
          action={
            !hasNoAccess && !isRestricted && canAddChildren ? (
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
          onBeforePositionChange={handleBeforePositionChange}
          onMonitorClick={(item) => setMonitorItem(item)}
          onFaultCreate={(item) => setFaultItem(item)}
          onResourceCreate={(item) => setResourceItem(item)}
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
        existingItems={items}
      />
      <EditItemModal
        item={editItem}
        onClose={() => setEditItem(null)}
        onConfirm={(newName) => {
          pushUndo(pendingRenames, pendingDeletes);
          setPendingRenames((prev) => ({ ...prev, [editItem!.id]: newName }));
          setEditItem(null);
        }}
      />
      <DeleteModal
        item={deleteItem}
        onClose={() => setDeleteItem(null)}
        onConfirm={() => {
          pushUndo(pendingRenames, pendingDeletes);
          setPendingDeletes((prev) => [...prev, deleteItem!.id]);
          setDeleteItem(null);
        }}
      />
      <PasteModal
        open={pasteOpen}
        onClose={() => setPasteOpen(false)}
        clipboard={copiedLayout}
        parentId={parentId}
        parentType={parentType}
      />
      {monitorItem && (
        <ComputerMonitorModal
          itemId={monitorItem.id}
          itemName={monitorItem.name}
          item={monitorItem}
          onClose={() => setMonitorItem(null)}
          onFaultCreate={(item) => { setMonitorItem(null); setFaultItem(item); }}
          onResourceCreate={(item) => { setMonitorItem(null); setResourceItem(item); }}
        />
      )}
      {faultItem && (
        <QuickFaultModal
          item={faultItem}
          onClose={() => setFaultItem(null)}
        />
      )}
      {resourceItem && (
        <QuickResourceModal
          item={resourceItem}
          onClose={() => setResourceItem(null)}
        />
      )}
    </div>
  );
}
