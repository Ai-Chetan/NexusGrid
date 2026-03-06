import { useState, useCallback } from 'react';
import {
  Building2, Layers, DoorOpen, Monitor, Server, Network,
  Wifi, Printer, Zap, HardDrive, Package, Loader2,
  ChevronRight, ChevronDown, Plus, X, Hash,
} from 'lucide-react';
import { layoutApi } from '@/lib/api';
import { cn } from '@/lib/utils';
import type { ItemType } from '@/types';
import Modal from '@/components/common/Modal';
import toast from 'react-hot-toast';

// ─── Types ────────────────────────────────────────────────────────────────────
let _uid = 0;
function nextId() { return `qn-${++_uid}`; }

interface QuickNode {
  id: string;
  name: string;
  item_type: string;
  children: QuickNode[];
  collapsed: boolean;
}

// ─── Constants ────────────────────────────────────────────────────────────────
const SINGLE_CHILD_TYPE: Record<string, string | null> = {
  root: 'building',
  building: 'floor',
  floor: 'room',
  room: null, // devices — selectable
};

const DEVICE_TYPES = [
  { value: 'computer',       label: 'Computer' },
  { value: 'server',         label: 'Server' },
  { value: 'network_switch', label: 'Switch' },
  { value: 'router',         label: 'Router' },
  { value: 'printer',        label: 'Printer' },
  { value: 'ups',            label: 'UPS' },
  { value: 'rack',           label: 'Rack' },
];

const typeIcons: Record<string, React.ElementType> = {
  building: Building2, floor: Layers, room: DoorOpen,
  computer: Monitor, server: Server, network_switch: Network,
  router: Wifi, printer: Printer, ups: Zap, rack: HardDrive,
};

const typeColors: Record<string, { border: string; bg: string }> = {
  building:       { border: '#7c3aed', bg: '#faf5ff' },
  floor:          { border: '#1d4ed8', bg: '#eff6ff' },
  room:           { border: '#3730a3', bg: '#eef2ff' },
  computer:       { border: '#047857', bg: '#f0fdf4' },
  server:         { border: '#b45309', bg: '#fffbeb' },
  network_switch: { border: '#0e7490', bg: '#ecfeff' },
  router:         { border: '#0f766e', bg: '#f0fdfa' },
  printer:        { border: '#9d174d', bg: '#fdf2f8' },
  ups:            { border: '#854d0e', bg: '#fefce8' },
  rack:           { border: '#334155', bg: '#f8fafc' },
};

const typeLabels: Record<string, string> = {
  building: 'Building', floor: 'Floor', room: 'Room',
  computer: 'Computer', server: 'Server', network_switch: 'Switch',
  router: 'Router', printer: 'Printer', ups: 'UPS', rack: 'Rack',
};

function makeNode(item_type: string): QuickNode {
  return { id: nextId(), name: '', item_type, children: [], collapsed: false };
}

function countNodes(nodes: QuickNode[]): number {
  return nodes.reduce((acc, n) => acc + 1 + countNodes(n.children), 0);
}

function allNamed(nodes: QuickNode[]): boolean {
  return nodes.every(n => n.name.trim() && allNamed(n.children));
}

// ─── Tree helpers (pure, produce new arrays) ──────────────────────────────────
function updateIn(nodes: QuickNode[], id: string, patch: Partial<QuickNode>): QuickNode[] {
  return nodes.map(n =>
    n.id === id ? { ...n, ...patch } : { ...n, children: updateIn(n.children, id, patch) },
  );
}

function addChildTo(nodes: QuickNode[], parentId: string, type: string): QuickNode[] {
  return nodes.map(n =>
    n.id === parentId
      ? { ...n, collapsed: false, children: [...n.children, makeNode(type)] }
      : { ...n, children: addChildTo(n.children, parentId, type) },
  );
}

function removeNode(nodes: QuickNode[], id: string): QuickNode[] {
  return nodes
    .filter(n => n.id !== id)
    .map(n => ({ ...n, children: removeNode(n.children, id) }));
}

function addBulkChildrenTo(nodes: QuickNode[], parentId: string, newItems: QuickNode[]): QuickNode[] {
  return nodes.map(n =>
    n.id === parentId
      ? { ...n, collapsed: false, children: [...n.children, ...newItems] }
      : { ...n, children: addBulkChildrenTo(n.children, parentId, newItems) },
  );
}

// returns count of direct children of a given type; -1 if node not found
function countChildrenOfType(nodes: QuickNode[], parentId: string, type: string): number {
  for (const n of nodes) {
    if (n.id === parentId) return n.children.filter(c => c.item_type === type).length;
    const found = countChildrenOfType(n.children, parentId, type);
    if (found !== -1) return found;
  }
  return -1;
}

function safeCountChildrenOfType(nodes: QuickNode[], parentId: string, type: string): number {
  const r = countChildrenOfType(nodes, parentId, type);
  return r === -1 ? 0 : r;
}

function generateBulkNamesFromFirst(firstName: string, count: number): string[] {
  const trimmed = firstName.trim();
  const match = trimmed.match(/^(.*?)(\d+)$/);
  if (match) {
    const prefix = match[1];
    const startNum = parseInt(match[2], 10);
    const pad = match[2].length; // preserve original zero-padding width
    return Array.from({ length: count }, (_, i) =>
      `${prefix}${String(startNum + i).padStart(pad, '0')}`,
    );
  }
  // No trailing number — append -001, -002…
  const pad = Math.max(2, String(count).length);
  const safeName = trimmed || 'Device';
  return Array.from({ length: count }, (_, i) =>
    `${safeName}-${String(i + 1).padStart(pad, '0')}`,
  );
}

// ─── Position layout helpers ─────────────────────────────────────────────────
const ORIGIN = { x: 80, y: 80 };
const CARD_GAP = 20; // uniform gap (px) between every card edge

// Card sizes mirror NetworkFlowView nodeSizes
const CARD_SIZES: Record<string, { w: number; h: number }> = {
  building: { w: 155, h: 210 },
  floor:    { w: 230, h: 145 },
  room:     { w: 155, h: 200 },
  device:   { w: 155, h: 150 }, // all device types
};

const GAPS: Record<string, { x: number; y: number }> = {
  root:     { x: CARD_SIZES.building.w + CARD_GAP, y: 0 }, // buildings → side by side
  building: { x: 0, y: CARD_SIZES.floor.h + CARD_GAP },   // floors    → stacked
  floor:    { x: CARD_SIZES.room.w + CARD_GAP, y: 0 },     // rooms     → side by side
};
// equal horizontal + vertical gap for devices
const DEVICE_GAP = {
  x: CARD_SIZES.device.w + CARD_GAP,
  y: CARD_SIZES.device.h + CARD_GAP,
};

function calcChildPositions(
  parentType: string,
  count: number,
  devicesPerRow: number,
): { x: number; y: number }[] {
  return Array.from({ length: count }, (_, i) => {
    if (parentType === 'room') {
      return {
        x: ORIGIN.x + (i % devicesPerRow) * DEVICE_GAP.x,
        y: ORIGIN.y + Math.floor(i / devicesPerRow) * DEVICE_GAP.y,
      };
    }
    const gap = GAPS[parentType] ?? { x: 250, y: 0 };
    // Floors stack bottom-up: floor 1 is lowest, floor N is highest
    const idx = parentType === 'building' ? (count - 1 - i) : i;
    return { x: ORIGIN.x + idx * gap.x, y: ORIGIN.y + idx * gap.y };
  });
}

// ─── NodeRow ──────────────────────────────────────────────────────────────────
interface NodeRowProps {
  node: QuickNode;
  depth: number;
  onUpdate: (id: string, patch: Partial<QuickNode>) => void;
  onDelete: (id: string) => void;
  onAddChild: (parentId: string, type: string) => void;
  onAddBulkChildren: (parentId: string, type: string, names: string[]) => void;
  allNodes: QuickNode[];
  disabled: boolean;
}

function NodeRow({ node, depth, onUpdate, onDelete, onAddChild, onAddBulkChildren, allNodes, disabled }: NodeRowProps) {
  const [deviceType, setDeviceType] = useState('computer');
  const [showBulk, setShowBulk] = useState(false);
  const [bulkType, setBulkType] = useState('computer');
  const [bulkCount, setBulkCount] = useState(5);
  const [bulkFirstName, setBulkFirstName] = useState('');
  const Icon = typeIcons[node.item_type] ?? Package;
  const col = typeColors[node.item_type] ?? typeColors.rack;
  const hasChildren = node.children.length > 0;
  const singleChildType = SINGLE_CHILD_TYPE[node.item_type]; // undefined = device (no children)
  const isRoom = node.item_type === 'room';
  const canExpand = hasChildren;

  return (
    <>
      <div
        className="flex items-center gap-1.5 py-[3px] pr-2 group rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors"
        style={{ paddingLeft: depth * 18 + 6 }}
      >
        {/* Expand toggle */}
        <button
          onClick={() => onUpdate(node.id, { collapsed: !node.collapsed })}
          className={cn('w-4 h-4 flex items-center justify-center shrink-0 text-slate-400',
            canExpand ? 'opacity-60 hover:opacity-100' : 'opacity-0 pointer-events-none')}
        >
          {node.collapsed ? <ChevronRight className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
        </button>

        {/* Type icon badge */}
        <div
          className="w-5 h-5 rounded-[4px] flex items-center justify-center shrink-0 shadow-sm"
          style={{ background: col.border }}
        >
          <Icon style={{ width: 11, height: 11, color: '#fff' }} />
        </div>

        {/* Name input */}
        <input
          value={node.name}
          onChange={e => onUpdate(node.id, { name: e.target.value })}
          placeholder={`${typeLabels[node.item_type] ?? node.item_type} name…`}
          disabled={disabled}
          className={cn(
            'flex-1 text-sm bg-transparent outline-none border-b py-px min-w-0 transition-colors',
            node.name.trim()
              ? 'border-transparent focus:border-slate-300 dark:focus:border-slate-600'
              : 'border-red-300/70 dark:border-red-700/50',
            'text-slate-800 dark:text-slate-200 placeholder:text-slate-300 dark:placeholder:text-slate-600 disabled:opacity-50',
          )}
        />

        {/* Add child controls (visible on hover) */}
        {singleChildType !== undefined && !disabled && (
          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
            {isRoom ? (
              <>
                <select
                  value={deviceType}
                  onChange={e => setDeviceType(e.target.value)}
                  className="text-[10px] border border-slate-200 dark:border-slate-700 rounded px-1 py-0.5 bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 cursor-pointer"
                >
                  {DEVICE_TYPES.map(t => (
                    <option key={t.value} value={t.value}>{t.label}</option>
                  ))}
                </select>
                <button
                  onClick={() => onAddChild(node.id, deviceType)}
                  className="flex items-center gap-0.5 text-[10px] px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300"
                >
                  <Plus style={{ width: 9, height: 9 }} />Add
                </button>
                <button
                  onClick={() => setShowBulk(v => !v)}
                  title="Bulk add devices"
                  className={cn(
                    'flex items-center gap-0.5 text-[10px] px-1.5 py-0.5 rounded transition-colors',
                    showBulk
                      ? 'bg-brand-100 dark:bg-brand-900/30 text-brand-600 dark:text-brand-400'
                      : 'bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-500 dark:text-slate-400',
                  )}
                >
                  <Hash style={{ width: 9, height: 9 }} />Bulk
                </button>
              </>
            ) : (
              <>
                <button
                  onClick={() => onAddChild(node.id, singleChildType!)}
                  className="flex items-center gap-0.5 text-[10px] px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-500 dark:text-slate-400 whitespace-nowrap"
                >
                  <Plus style={{ width: 9, height: 9 }} />
                  {typeLabels[singleChildType!]}
                </button>
                <button
                  onClick={() => setShowBulk(v => !v)}
                  title={`Bulk add ${typeLabels[singleChildType!]}s`}
                  className={cn(
                    'flex items-center gap-0.5 text-[10px] px-1.5 py-0.5 rounded transition-colors',
                    showBulk
                      ? 'bg-brand-100 dark:bg-brand-900/30 text-brand-600 dark:text-brand-400'
                      : 'bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-500 dark:text-slate-400',
                  )}
                >
                  <Hash style={{ width: 9, height: 9 }} />Bulk
                </button>
              </>
            )}
          </div>
        )}

        {/* Child count badge */}
        {hasChildren && (
          <span
            className="text-[10px] font-semibold px-1.5 py-px rounded-full tabular-nums shrink-0"
            style={{ background: col.border + '22', color: col.border }}
          >
            {node.children.length}
          </span>
        )}

        {/* Delete */}
        {!disabled && (
          <button
            onClick={() => onDelete(node.id)}
            className="w-5 h-5 flex items-center justify-center rounded text-slate-300 dark:text-slate-600 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors opacity-0 group-hover:opacity-100 shrink-0"
          >
            <X style={{ width: 11, height: 11 }} />
          </button>
        )}
      </div>

      {/* ── Bulk panel ── */}
      {singleChildType !== undefined && showBulk && !disabled && (() => {
        const effectiveType = isRoom ? bulkType : singleChildType!;
        const existingOfType = safeCountChildrenOfType(allNodes, node.id, effectiveType);
        const childLabel = typeLabels[effectiveType] ?? effectiveType;
        const defaultFirst = node.name
          ? `${node.name.replace(/\s+/g, '-')}-${String(existingOfType + 1).padStart(2, '0')}`
          : `${childLabel}-${String(existingOfType + 1).padStart(2, '0')}`;
        const resolvedFirst = bulkFirstName.trim() || defaultFirst;
        const previewNames = bulkCount > 0
          ? generateBulkNamesFromFirst(resolvedFirst, Math.min(bulkCount, 3))
          : [];
        const lastPreview = bulkCount > 3
          ? generateBulkNamesFromFirst(resolvedFirst, bulkCount).slice(-1)[0]
          : null;
        const previewStr = previewNames.length > 0
          ? (lastPreview
              ? `${previewNames[0]}, ${previewNames[1]}, … ${lastPreview}`
              : previewNames.join(', ')
            )
          : '';
        return (
          <div
            className="mt-0.5 mb-1 mx-2 rounded-lg border border-brand-200 dark:border-brand-800/50 bg-brand-50/60 dark:bg-brand-950/20 p-2.5 flex flex-col gap-2"
            style={{ marginLeft: depth * 18 + 22 }}
          >
            <div className="flex items-center gap-2 flex-wrap">
              {/* Device type — only for rooms */}
              {isRoom && (
              <div className="flex items-center gap-1">
                <span className="text-[10px] font-medium text-slate-500 dark:text-slate-400">Type</span>
                <select
                  value={bulkType}
                  onChange={e => setBulkType(e.target.value)}
                  className="text-[11px] border border-slate-200 dark:border-slate-700 rounded px-1.5 py-0.5 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300"
                >
                  {DEVICE_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                </select>
              </div>
              )}
              {/* Count */}
              <div className="flex items-center gap-1">
                <span className="text-[10px] font-medium text-slate-500 dark:text-slate-400">Count</span>
                <input
                  type="number" min={1} max={999}
                  value={bulkCount}
                  onChange={e => setBulkCount(Math.max(1, Math.min(999, Number(e.target.value) || 1)))}
                  className="w-14 text-[11px] border border-slate-200 dark:border-slate-700 rounded px-1.5 py-0.5 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 text-center"
                />
              </div>
              {/* First name */}
              <div className="flex items-center gap-1 flex-1 min-w-0">
                <span className="text-[10px] font-medium text-slate-500 dark:text-slate-400 shrink-0">First name</span>
                <input
                  type="text"
                  value={bulkFirstName}
                  onChange={e => setBulkFirstName(e.target.value)}
                  placeholder={resolvedFirst}
                  className="flex-1 min-w-0 text-[11px] border border-slate-200 dark:border-slate-700 rounded px-1.5 py-0.5 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 placeholder:text-slate-300 dark:placeholder:text-slate-600"
                />
              </div>
              {/* Add button */}
              <button
                onClick={() => {
                  const names = generateBulkNamesFromFirst(resolvedFirst, bulkCount);
                  onAddBulkChildren(node.id, effectiveType, names);
                  setShowBulk(false);
                  setBulkFirstName('');
                }}
                disabled={bulkCount < 1}
                className="flex items-center gap-1 text-[11px] px-2.5 py-1 rounded-md bg-brand-600 hover:bg-brand-700 text-white font-medium disabled:opacity-50 whitespace-nowrap transition-colors"
              >
                <Plus style={{ width: 10, height: 10 }} />
                Add {bulkCount} {childLabel}{bulkCount !== 1 ? 's' : ''}
              </button>
              <button onClick={() => setShowBulk(false)} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300">
                <X style={{ width: 13, height: 13 }} />
              </button>
            </div>
            {/* Preview */}
            {previewStr && (
              <p className="text-[10px] text-brand-600 dark:text-brand-400 font-mono truncate">
                {previewStr}
              </p>
            )}
            <p className="text-[10px] text-slate-400 dark:text-slate-500 italic">
              {bulkFirstName.trim()
                ? 'Names increment from the number at the end of the first name'
                : 'Leave blank to auto-generate — or type e.g. B1-F1-001'
              }
            </p>
          </div>
        );
      })()}

      {/* Children — with left guide line */}
      {!node.collapsed && hasChildren && (
        <div className="relative" style={{ marginLeft: depth * 18 + 16 }}>
          <div className="absolute top-0 bottom-0 left-0 w-px bg-slate-200 dark:bg-slate-700" />
          <div style={{ marginLeft: 10 }}>
            {node.children.map(child => (
              <NodeRow
                key={child.id}
                node={child}
                depth={depth + 1}
                onUpdate={onUpdate}
                onDelete={onDelete}
                onAddChild={onAddChild}
                onAddBulkChildren={onAddBulkChildren}
                allNodes={allNodes}
                disabled={disabled}
              />
            ))}
          </div>
        </div>
      )}
    </>
  );
}

// ─── Main modal ───────────────────────────────────────────────────────────────
interface Props {
  open: boolean;
  onClose: () => void;
  parentType: string;
  parentId: number | null;
  onSuccess: () => void;
}

export default function QuickCreateModal({ open, onClose, parentType, parentId, onSuccess }: Props) {
  const [nodes, setNodes] = useState<QuickNode[]>([]);
  const [creating, setCreating] = useState(false);
  const [progress, setProgress] = useState({ done: 0, total: 0 });
  const [devicesPerRow, setDevicesPerRow] = useState(4);

  const rootType = SINGLE_CHILD_TYPE[parentType] ?? 'computer';

  const addRoot = () => setNodes(prev => [...prev, makeNode(rootType)]);

  const handleUpdate = useCallback((id: string, patch: Partial<QuickNode>) => {
    setNodes(prev => updateIn(prev, id, patch));
  }, []);

  const handleAddChild = useCallback((parentId: string, type: string) => {
    setNodes(prev => addChildTo(prev, parentId, type));
  }, []);

  const handleAddBulkChildren = useCallback((parentId: string, type: string, names: string[]) => {
    const newItems = names.map(name => ({ ...makeNode(type), name }));
    setNodes(prev => addBulkChildrenTo(prev, parentId, newItems));
  }, []);

  const handleDelete = useCallback((id: string) => {
    setNodes(prev => removeNode(prev, id));
  }, []);

  // Count totals for the summary
  const typeCounts: Record<string, number> = {};
  (function walk(ns: QuickNode[]) {
    ns.forEach(n => {
      typeCounts[n.item_type] = (typeCounts[n.item_type] ?? 0) + 1;
      walk(n.children);
    });
  })(nodes);

  const total = countNodes(nodes);
  const canCreate = total > 0 && allNamed(nodes) && !creating;

  // Sequential tree creation
  async function createSubtree(
    node: QuickNode,
    pid: number | null,
    pos: { x: number; y: number },
  ) {
    const res = await layoutApi.createItem({
      name: node.name.trim(),
      item_type: node.item_type as ItemType,
      parent: pid,
      position_x: pos.x,
      position_y: pos.y,
    });
    const newId = res.data.id;
    setProgress(p => ({ ...p, done: p.done + 1 }));
    const childPositions = calcChildPositions(node.item_type, node.children.length, devicesPerRow);
    for (let i = 0; i < node.children.length; i++) {
      await createSubtree(node.children[i], newId, childPositions[i]);
    }
  }

  const handleCreate = async () => {
    if (!canCreate) return;
    setCreating(true);
    setProgress({ done: 0, total });
    try {
      const rootPositions = calcChildPositions(parentType, nodes.length, devicesPerRow);
      for (let i = 0; i < nodes.length; i++) {
        await createSubtree(nodes[i], parentId, rootPositions[i]);
      }
      toast.success(`Created ${total} item${total !== 1 ? 's' : ''}`);
      setNodes([]);
      onSuccess();
      onClose();
    } catch {
      toast.error('Failed to create some items');
    } finally {
      setCreating(false);
    }
  };

  const handleClose = () => { if (!creating) { onClose(); } };

  const pct = progress.total > 0 ? (progress.done / progress.total) * 100 : 0;

  return (
    <Modal open={open} onClose={handleClose} title="Quick Build" size="lg">
      <div className="flex flex-col gap-3">

        {/* ── Tree ── */}
        <div className={cn(
          'rounded-xl border overflow-y-auto',
          'border-slate-200 dark:border-slate-700',
          nodes.length === 0 ? 'flex items-center justify-center' : '',
        )} style={{ minHeight: 200, maxHeight: 440 }}>
          {nodes.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-2 py-12 text-slate-400 dark:text-slate-600">
              <Package className="w-8 h-8" />
              <p className="text-sm">Click below to add your first {typeLabels[rootType]}</p>
            </div>
          ) : (
            <div className="py-2 px-1">
              {nodes.map(node => (
                <NodeRow
                  key={node.id}
                  node={node}
                  depth={0}
                  onUpdate={handleUpdate}
                  onDelete={handleDelete}
                  onAddChild={handleAddChild}
                  onAddBulkChildren={handleAddBulkChildren}
                  allNodes={nodes}
                  disabled={creating}
                />
              ))}
            </div>
          )}
        </div>

        {/* ── Add root button ── */}
        <button
          onClick={addRoot}
          disabled={creating}
          className={cn(
            'flex items-center justify-center gap-2 px-3 py-2 text-sm rounded-xl border-2 border-dashed w-full',
            'border-slate-300 dark:border-slate-700 text-slate-400 dark:text-slate-500',
            'hover:border-brand-400 dark:hover:border-brand-600 hover:text-brand-600 dark:hover:text-brand-400',
            'transition-colors disabled:opacity-40 disabled:cursor-not-allowed',
          )}
        >
          <Plus className="w-4 h-4" />
          Add {typeLabels[rootType]}
        </button>

        {/* ── Type count summary ── */}
        {total > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {Object.entries(typeCounts).map(([type, count]) => {
              const Icon = typeIcons[type] ?? Package;
              const col = typeColors[type] ?? typeColors.rack;
              return (
                <span
                  key={type}
                  className="flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium"
                  style={{ background: col.border + '18', color: col.border }}
                >
                  <Icon style={{ width: 11, height: 11 }} />
                  {count} {typeLabels[type]}{count !== 1 ? 's' : ''}
                </span>
              );
            })}
          </div>
        )}

        {/* ── Layout options ── */}
        {total > 0 && (() => {
          const hasDevices = DEVICE_TYPES.some(t => (typeCounts[t.value] ?? 0) > 0);
          return (
            <div className="flex flex-wrap items-center gap-3 px-0.5">
              {/* Fixed rules */}
              <div className="flex items-center gap-1.5 text-[11px] text-slate-400 dark:text-slate-500">
                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800">
                  <Building2 style={{ width: 9, height: 9 }} />Buildings → ↔ row
                </span>
                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800">
                  <Layers style={{ width: 9, height: 9 }} />Floors → ↕ column
                </span>
                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800">
                  <DoorOpen style={{ width: 9, height: 9 }} />Rooms → ↔ row
                </span>
              </div>
              {/* Devices per row picker */}
              {hasDevices && (
                <div className="flex items-center gap-1.5 ml-auto">
                  <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400">Devices per row</span>
                  <div className="flex rounded-lg overflow-hidden border border-slate-200 dark:border-slate-700">
                    {[2, 3, 4, 5, 6, 8].map(n => (
                      <button
                        key={n}
                        onClick={() => setDevicesPerRow(n)}
                        className={cn(
                          'px-2.5 py-1 text-[11px] font-medium transition-colors',
                          devicesPerRow === n
                            ? 'bg-brand-600 text-white'
                            : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800',
                          n !== 2 ? 'border-l border-slate-200 dark:border-slate-700' : '',
                        )}
                      >
                        {n}
                      </button>
                    ))}
                  </div>
                  {/* Mini grid preview */}
                  <div
                    className="grid gap-px p-1 rounded border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900"
                    style={{ gridTemplateColumns: `repeat(${devicesPerRow}, 10px)` }}
                  >
                    {Array.from({ length: Math.min(devicesPerRow * 2, 16) }, (_, i) => (
                      <div key={i} className="w-2.5 h-2 rounded-[2px] bg-emerald-400 dark:bg-emerald-600 opacity-70" />
                    ))}
                  </div>
                </div>
              )}
            </div>
          );
        })()}

        {/* ── Progress bar ── */}
        {creating && (
          <div className="space-y-1">
            <div className="h-1.5 rounded-full bg-slate-200 dark:bg-slate-700 overflow-hidden">
              <div
                className="h-full bg-brand-500 rounded-full transition-all duration-300"
                style={{ width: `${pct}%` }}
              />
            </div>
            <p className="text-[11px] text-center text-slate-500 dark:text-slate-400">
              Creating… {progress.done} / {progress.total}
            </p>
          </div>
        )}

        {/* ── Actions ── */}
        <div className="flex gap-2 pt-1">
          <button onClick={handleClose} disabled={creating} className="btn-secondary flex-1">
            Cancel
          </button>
          <button
            onClick={handleCreate}
            disabled={!canCreate}
            className="btn-primary flex-1 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {creating
              ? <><Loader2 className="w-4 h-4 animate-spin" />Creating…</>
              : <><Zap className="w-4 h-4" />Create {total > 0 ? `${total} Item${total !== 1 ? 's' : ''}` : 'All'}</>
            }
          </button>
        </div>

      </div>
    </Modal>
  );
}
