import { forwardRef, useCallback, useEffect, useImperativeHandle, useMemo, useRef, useState } from 'react';
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  addEdge,
  useNodesState,
  useEdgesState,
  useReactFlow,
  getBezierPath,
  BaseEdge,
  EdgeLabelRenderer,
  type Node,
  type Edge,
  type Connection,
  type EdgeProps,
  type NodeProps,
  type NodeTypes,
  type EdgeTypes,
  Handle,
  Position,
  Panel,
  MarkerType,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import dagre from '@dagrejs/dagre';
import {
  Building2, Layers, DoorOpen, Monitor, Server, Network,
  Wifi, Printer, Zap, HardDrive, Package, Pencil, Trash2, Moon,
} from 'lucide-react';
import type { LayoutItem } from '@/types';
import {
  BuildingVector, FloorVector, RoomVector, ComputerVector, ServerVector,
  SwitchVector, RouterVector, PrinterVector, UPSVector, RackVector,
} from './NodeVectors';
import { cn, getDeviceStatusColor, getDeviceStatusTooltip } from '@/lib/utils';
import { layoutApi } from '@/lib/api';
import { useTheme } from '@/hooks/useTheme';
import toast from 'react-hot-toast';

// ─── Type colour palette ──────────────────────────────────────────────────────
const typeColours: Record<string, { bg: string; header: string; border: string; text: string; dot: string }> = {
  building:       { bg: '#faf5ff', header: '#7c3aed', border: '#8b5cf6', text: '#5b21b6', dot: '#8b5cf6' },
  floor:          { bg: '#eff6ff', header: '#1d4ed8', border: '#3b82f6', text: '#1e40af', dot: '#3b82f6' },
  room:           { bg: '#eef2ff', header: '#3730a3', border: '#6366f1', text: '#312e81', dot: '#6366f1' },
  computer:       { bg: '#f0fdf4', header: '#047857', border: '#10b981', text: '#065f46', dot: '#10b981' },
  server:         { bg: '#fffbeb', header: '#b45309', border: '#f59e0b', text: '#92400e', dot: '#f59e0b' },
  network_switch: { bg: '#ecfeff', header: '#0e7490', border: '#06b6d4', text: '#155e75', dot: '#06b6d4' },
  router:         { bg: '#f0fdfa', header: '#0f766e', border: '#14b8a6', text: '#134e4a', dot: '#14b8a6' },
  printer:        { bg: '#fdf2f8', header: '#9d174d', border: '#ec4899', text: '#831843', dot: '#ec4899' },
  ups:            { bg: '#fefce8', header: '#854d0e', border: '#eab308', text: '#713f12', dot: '#eab308' },
  rack:           { bg: '#f8fafc', header: '#334155', border: '#64748b', text: '#1e293b', dot: '#64748b' },
};
const fallbackCol = { bg: '#f8fafc', header: '#475569', border: '#94a3b8', text: '#334155', dot: '#94a3b8' };

// ─── Dark colour palette ──────────────────────────────────────────────────────
const darkTypeColours: Record<string, { bg: string; header: string; border: string; text: string; dot: string }> = {
  building:       { bg: '#2e1065', header: '#7c3aed', border: '#7c3aed', text: '#c4b5fd', dot: '#8b5cf6' },
  floor:          { bg: '#172554', header: '#2563eb', border: '#3b82f6', text: '#93c5fd', dot: '#3b82f6' },
  room:           { bg: '#1e1b4b', header: '#4338ca', border: '#6366f1', text: '#a5b4fc', dot: '#6366f1' },
  computer:       { bg: '#052e16', header: '#059669', border: '#10b981', text: '#6ee7b7', dot: '#10b981' },
  server:         { bg: '#451a03', header: '#d97706', border: '#f59e0b', text: '#fcd34d', dot: '#f59e0b' },
  network_switch: { bg: '#083344', header: '#0891b2', border: '#06b6d4', text: '#67e8f9', dot: '#06b6d4' },
  router:         { bg: '#042f2e', header: '#0d9488', border: '#14b8a6', text: '#5eead4', dot: '#14b8a6' },
  printer:        { bg: '#500724', header: '#db2777', border: '#ec4899', text: '#f9a8d4', dot: '#ec4899' },
  ups:            { bg: '#422006', header: '#d97706', border: '#eab308', text: '#fde047', dot: '#eab308' },
  rack:           { bg: '#0f172a', header: '#475569', border: '#64748b', text: '#94a3b8', dot: '#64748b' },
};
const darkFallbackCol = { bg: '#1e293b', header: '#475569', border: '#64748b', text: '#94a3b8', dot: '#94a3b8' };

const typeIcons: Record<string, React.ElementType> = {
  building: Building2, floor: Layers, room: DoorOpen,
  computer: Monitor, server: Server, network_switch: Network,
  router: Wifi, printer: Printer, ups: Zap, rack: HardDrive,
};

const typeLabels: Record<string, string> = {
  building: 'Building', floor: 'Floor', room: 'Room / Lab',
  computer: 'Computer', server: 'Server', network_switch: 'Switch',
  router: 'Router', printer: 'Printer', ups: 'UPS', rack: 'Rack',
};

const CLUSTER_TYPES    = new Set(['building', 'floor', 'room']);
const NETWORK_HUB_TYPES = new Set(['network_switch', 'router']);

function getItemAccentColor(item: LayoutItem, fallbackHeader: string): string {
  const isDevice = !CLUSTER_TYPES.has(item.item_type);
  if (!isDevice) return fallbackHeader;

  return getDeviceStatusColor(item).hex;
}

// ─── Node "shape" visual bodies ───────────────────────────────────────────────
// Realistic flat-vector illustrations (see NodeVectors.tsx)

const typeBodyMap: Record<string, (name: string, color: string, isDark: boolean) => JSX.Element> = {
  building: (_n, _c, d) => <BuildingVector isDark={d} />,
  floor:    (_n, _c, d) => <FloorVector isDark={d} />,
  room:     (_n, _c, d) => <RoomVector isDark={d} />,
  computer: (_n, color, d) => <ComputerVector isDark={d} color={color} />,
  server:   (_n, color, d) => <ServerVector isDark={d} color={color} />,
  network_switch: (_n, color, d) => <SwitchVector isDark={d} color={color} />,
  router:   (_n, color, d) => <RouterVector isDark={d} color={color} />,
  printer:  (_n, color, d) => <PrinterVector isDark={d} color={color} />,
  ups:      (_n, color, d) => <UPSVector isDark={d} color={color} />,
  rack:     (_n, color, d) => <RackVector isDark={d} color={color} />,
};

// Body area heights (card height − header − footer)
const bodyHeights: Record<string, number> = { building: 146, floor: 80, room: 136 };

// ─── Per-type node dimensions ──────────────────────────────────────────────────────
// height = illustration body + ~22px caption
const DEVICE_SIZE = { w: 155, h: 135 };
const nodeSizes: Record<string, { w: number; h: number }> = {
  building:       { w: 155, h: 170 },   // taller than wide
  floor:          { w: 230, h: 105 },   // wider than tall
  room:           { w: 155, h: 160 },   // taller
  // devices — all identical
  computer:       DEVICE_SIZE,
  server:         DEVICE_SIZE,
  network_switch: DEVICE_SIZE,
  router:         DEVICE_SIZE,
  printer:        DEVICE_SIZE,
  ups:            DEVICE_SIZE,
  rack:           DEVICE_SIZE,
};
function nodeSize(itemType: string) { return nodeSizes[itemType] ?? DEVICE_SIZE; }

// ─── Custom node ──────────────────────────────────────────────────────────────
interface ItemNodeData extends Record<string, unknown> {
  item: LayoutItem;
  editMode: boolean;
  isDark: boolean;
  onEnter:  (item: LayoutItem) => void;
  onEdit:   (item: LayoutItem) => void;
  onDelete: (item: LayoutItem) => void;
  onMonitorClick?: (item: LayoutItem) => void;
  onFaultCreate?: (item: LayoutItem) => void;
  onResourceCreate?: (item: LayoutItem) => void;
  isHub?: boolean;
}

type ItemFlowNode = Node<ItemNodeData, 'itemNode'>;

function ItemNode({ data }: NodeProps<ItemFlowNode>) {
  const { item, editMode, isDark, onEnter, onEdit, onDelete, onMonitorClick, onFaultCreate, onResourceCreate } = data;
  const [hovered, setHovered] = useState(false);
  const col = (isDark ? darkTypeColours : typeColours)[item.item_type] ?? (isDark ? darkFallbackCol : fallbackCol);
  const isNavigable = CLUSTER_TYPES.has(item.item_type);
  const isDevice = !isNavigable;
  const BodyEl = typeBodyMap[item.item_type];

  // State colour drives the vector tint: green (online), red (fault),
  // blue (resource pending), grey (offline/no data)
  const accentColor = getItemAccentColor(item, col.header);
  const cardHeaderColor = isDevice ? accentColor : col.header;

  const handleClick = useCallback(() => {
    if (editMode) return;
    if (isNavigable) {
      // Single-click to navigate into the cluster
      onEnter(item);
    } else if (onMonitorClick) {
      // Single-click on any device opens full system detail page
      onMonitorClick(item);
    }
  }, [editMode, isNavigable, onEnter, onMonitorClick, item]);

  const statusTooltip = isDevice ? getDeviceStatusTooltip(item) : null;

  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onClick={handleClick}
      style={{ width: nodeSize(item.item_type).w }}
      title={statusTooltip ?? undefined}
      className={cn(
        'relative select-none',
        !editMode && 'cursor-pointer',
        editMode && 'cursor-grab',
      )}
    >
      {/* Sleek hover status reasoning tooltip pill */}
      {hovered && isDevice && statusTooltip && (
        <div
          className={cn(
            'absolute -top-8 left-1/2 -translate-x-1/2 z-30 px-2.5 py-1 rounded-md text-[10px] font-medium shadow-md whitespace-nowrap border pointer-events-none transition-all duration-150',
            isDark ? 'bg-slate-900/95 border-slate-700 text-slate-200 shadow-slate-950/60' : 'bg-slate-900/90 border-slate-800 text-white shadow-slate-900/20'
          )}
        >
          {statusTooltip}
        </div>
      )}
      <Handle type="target" position={Position.Top}
        style={editMode ? { background: col.header, borderColor: col.header, width: 8, height: 8 } : { opacity: 0 }}
      />
      <Handle type="source" position={Position.Bottom}
        style={editMode ? { background: col.header, borderColor: col.header, width: 8, height: 8 } : { opacity: 0 }}
      />

      {/* ── Vector illustration (state colour tints the artwork itself) ── */}
      <div
        className="rounded-lg overflow-hidden"
        style={{
          height: bodyHeights[item.item_type] ?? 110,
          padding: 4,
          border: `1.5px ${editMode ? 'dashed' : 'solid'} ${hovered || editMode ? accentColor : 'transparent'}`,
        }}
      >
        {BodyEl ? BodyEl(item.name, cardHeaderColor, isDark) : <div className="h-12" />}
      </div>

      {/* Edit/delete overlay */}
      {editMode && (
        <div className={cn('absolute right-1 top-1 z-10 flex items-center gap-0.5 transition-opacity', hovered ? 'opacity-100' : 'opacity-0')}>
          <button
            onPointerDown={(e) => e.stopPropagation()}
            onClick={(e) => { e.stopPropagation(); onEdit(item); }}
            className="w-5 h-5 rounded flex items-center justify-center text-white shadow transition-colors hover:opacity-80"
            style={{ background: col.header }}
            title="Rename"
          >
            <Pencil className="w-3 h-3" />
          </button>
          <button
            onPointerDown={(e) => e.stopPropagation()}
            onClick={(e) => { e.stopPropagation(); onDelete(item); }}
            className="w-5 h-5 rounded flex items-center justify-center text-white shadow bg-red-500 hover:bg-red-600 transition-colors"
            title="Delete"
          >
            <Trash2 className="w-3 h-3" />
          </button>
        </div>
      )}

      {/* ── Minimal caption: icon + name + status dot ── */}
      <div className="flex items-center justify-center gap-1 mt-0.5 px-1">
        {(() => { const Icon = typeIcons[item.item_type] ?? Package; return <Icon className="w-3 h-3 shrink-0" style={{ color: cardHeaderColor }} />; })()}
        <span className={cn('text-[10px] font-semibold truncate', isDark ? 'text-slate-200' : 'text-slate-700')}>{item.name}</span>
        {item.status && (() => {
          const statusInfo = getDeviceStatusColor(item);
          if (statusInfo.statusType === 'sleep') {
            return (
              <span title="Sleep / Standby" className="shrink-0 flex items-center justify-center">
                <Moon className="w-2.5 h-2.5 text-slate-400 fill-slate-400/40" />
              </span>
            );
          }
          return (
            <span
              className="w-1.5 h-1.5 rounded-full shrink-0"
              style={{
                background: statusInfo.hex,
              }}
            />
          );
        })()}
      </div>

      <Handle type="source" position={Position.Bottom} style={{ opacity: 0 }} />
    </div>
  );
}

// ─── Dagre auto-layout ────────────────────────────────────────────────────────
const SNAP = 24; // must match snapGrid prop on <ReactFlow>
const snapTo = (v: number) => Math.round(v / SNAP) * SNAP;

function getLayoutedElements<N extends Node>(nodes: N[], edges: Edge[], direction = 'TB') {
  const g = new dagre.graphlib.Graph();
  g.setDefaultEdgeLabel(() => ({}));
  g.setGraph({ rankdir: direction, nodesep: 60, ranksep: 100, marginx: 60, marginy: 60 });

  nodes.forEach((n) => {
    const sz = nodeSize((n.data as ItemNodeData).item.item_type);
    g.setNode(n.id, { width: sz.w, height: sz.h });
  });
  edges.forEach((e) => g.setEdge(e.source, e.target));
  dagre.layout(g);

  return {
    nodes: nodes.map((n) => {
      const pos = g.node(n.id);
      const sz = nodeSize((n.data as ItemNodeData).item.item_type);
      // Snap dagre output to the same grid used during dragging
      return { ...n, position: { x: snapTo(pos.x - sz.w / 2), y: snapTo(pos.y - sz.h / 2) } };
    }) as N[],
    edges,
  };
}

// ─── Editable edge ─────────────────────────────────────────────────────────────
// Module-level ref so EditableEdge can call back into the component
const edgeDeleteRef = { current: (_id: string) => {} };

function EditableEdge({ id, sourceX, sourceY, targetX, targetY, style, markerEnd, selected }: EdgeProps) {
  const [edgePath, labelX, labelY] = getBezierPath({ sourceX, sourceY, targetX, targetY });
  return (
    <>
      <BaseEdge id={id} path={edgePath} style={style} markerEnd={markerEnd} />
      {selected && (
        <EdgeLabelRenderer>
          <div
            style={{ transform: `translate(-50%,-50%) translate(${labelX}px,${labelY}px)`, position: 'absolute' }}
            className="pointer-events-auto nodrag nopan"
          >
            <button
              onClick={() => edgeDeleteRef.current(id)}
              className="w-5 h-5 rounded-full bg-red-500 text-white text-sm font-bold leading-none flex items-center justify-center hover:bg-red-600 shadow border border-white"
            >
              ×
            </button>
          </div>
        </EdgeLabelRenderer>
      )}
    </>
  );
}

// ─── Edges ────────────────────────────────────────────────────────────────────
function buildNetworkEdges(items: LayoutItem[]): Edge[] {
  const hub = items.find((i) => NETWORK_HUB_TYPES.has(i.item_type));
  if (!hub) return [];
  const col = typeColours[hub.item_type] ?? fallbackCol;
  return items
    .filter((i) => !NETWORK_HUB_TYPES.has(i.item_type) && i.item_type !== 'ups' && i.item_type !== 'rack')
    .map((i) => ({
      id: `${hub.id}-${i.id}`,
      type: 'editableEdge',
      source: String(hub.id),
      target: String(i.id),
      animated: true,
      style: { stroke: col.border, strokeWidth: 2 },
      markerEnd: { type: MarkerType.ArrowClosed, color: col.border },
    }));
}

function buildHierarchyEdges(items: LayoutItem[]): Edge[] {
  const idSet = new Set(items.map((i) => i.id));
  return items
    .filter((i) => i.parent !== null && idSet.has(i.parent!))
    .map((i) => ({
      id: `edge-${i.parent}-${i.id}`,
      type: 'editableEdge',
      source: String(i.parent),
      target: String(i.id),
      style: { stroke: '#94a3b8', strokeWidth: 1.5 },
      markerEnd: { type: MarkerType.ArrowClosed, color: '#94a3b8' },
    }));
}

// ─── Public ref handle ───────────────────────────────────────────────────────
export interface NetworkFlowViewRef {
  save: () => Promise<void>;
  discard: () => void;
  getPositions: () => Record<string, { x: number; y: number }>;
  applyPositions: (positions: Record<string, { x: number; y: number }>) => void;
}

// ─── Props ────────────────────────────────────────────────────────────────────
interface Props {
  items: LayoutItem[];
  parentType: string;
  editMode: boolean;
  onEditModeChange: (v: boolean) => void;
  onEnter: (item: LayoutItem) => void;
  onEdit: (item: LayoutItem) => void;
  onDelete: (item: LayoutItem) => void;
  onMonitorClick?: (item: LayoutItem) => void;
  onFaultCreate?: (item: LayoutItem) => void;
  onResourceCreate?: (item: LayoutItem) => void;
  pendingRenames: Record<number, string>;
  pendingDeletes: number[];
  onSaveAll: () => Promise<void>;
  onDiscardAll: () => void;
  /** Notifies the parent when the async save starts / finishes */
  onIsSavingChange?: (v: boolean) => void;
  /** Called with the snapshot of positions BEFORE a drag is committed, for undo tracking */
  onBeforePositionChange?: (currentPositions: Record<string, { x: number; y: number }>) => void;
}

const nodeTypes: NodeTypes = { itemNode: ItemNode as NodeTypes[string] };
const edgeTypes: EdgeTypes = { editableEdge: EditableEdge as EdgeTypes[string] };

// ─── Auto-fit whenever the displayed item set changes ─────────────────────────
// Must live inside the ReactFlow context to access useReactFlow().
function FitOnChange({ trigger }: { trigger: string }) {
  const { fitView } = useReactFlow();
  const isFirst = useRef(true);
  useEffect(() => {
    // Skip the very first render — ReactFlow's own fitView handles it.
    if (isFirst.current) { isFirst.current = false; return; }
    const t = setTimeout(() => fitView({ padding: 0.25, duration: 350 }), 50);
    return () => clearTimeout(t);
  }, [trigger, fitView]);
  return null;
}

const NetworkFlowView = forwardRef<NetworkFlowViewRef, Props>(function NetworkFlowView(
  { items, parentType, editMode, onEditModeChange, onEnter, onEdit, onDelete, onMonitorClick, onFaultCreate, onResourceCreate, pendingRenames, pendingDeletes, onSaveAll, onDiscardAll, onIsSavingChange, onBeforePositionChange },
  ref,
) {
  const isRoomLevel = parentType === 'room';
  const hasHubs = items.some((i) => NETWORK_HUB_TYPES.has(i.item_type));
  const { theme } = useTheme();
  const isDark = theme === 'dark';

  const [pendingPositions, setPendingPositions] = useState<Record<string, { x: number; y: number }>>({});
  const [isSaving, setIsSaving] = useState(false);
  const [pinnedLegend, setPinnedLegend] = useState(false);

  // Stable refs so imperative handles never go stale
  const pendingPositionsRef = useRef(pendingPositions);
  useEffect(() => { pendingPositionsRef.current = pendingPositions; }, [pendingPositions]);

  const onNodeDragStop = useCallback(
    (_event: React.MouseEvent, _node: ItemFlowNode, draggedNodes: ItemFlowNode[]) => {
      onBeforePositionChange?.(pendingPositionsRef.current);
      // React Flow passes ALL dragged nodes as the third arg — a multi-select
      // drag moves several nodes, not just the one under the pointer.
      setPendingPositions((prev) => {
        const next = { ...prev };
        for (const n of draggedNodes) next[n.id] = n.position;
        return next;
      });
    },
    [onBeforePositionChange],
  );

  const initialElements = useMemo(() => {
    const rawEdges: Edge[] = isRoomLevel && hasHubs ? buildNetworkEdges(items) : buildHierarchyEdges(items);

    const makeNode = (item: LayoutItem, position: { x: number; y: number }): ItemFlowNode => ({
      id: String(item.id),
      type: 'itemNode',
      position,
      data: { item, editMode: false, isDark, onEnter, onEdit, onDelete, onMonitorClick, onFaultCreate, onResourceCreate, isHub: NETWORK_HUB_TYPES.has(item.item_type) },
    });

    // Always run dagre to get a valid default layout for every node.
    // Then override per-item with its saved position if it was explicitly moved (non-zero).
    const dagreResult = getLayoutedElements(
      items.map((i) => makeNode(i, { x: 0, y: 0 })),
      rawEdges,
      isRoomLevel ? 'LR' : 'TB',
    );

    const dagrePosById = Object.fromEntries(dagreResult.nodes.map((n) => [n.id, n.position]));

    const nodes: ItemFlowNode[] = items.map((item) => {
      const hasSaved = item.position_x !== 0 || item.position_y !== 0;
      const position = hasSaved
        ? { x: snapTo(item.position_x), y: snapTo(item.position_y) }
        : (dagrePosById[String(item.id)] ?? { x: 0, y: 0 });
      return makeNode(item, position);
    });

    return { nodes, edges: rawEdges };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items.map((i) => `${i.id}:${i.position_x},${i.position_y}:${i.name}:${i.status ?? ''}:${i.monitoring_status ?? ''}:${i.alert_status ?? ''}`).join('|'), parentType]);

  const [nodes, setNodes, onNodesChange] = useNodesState<ItemFlowNode>(initialElements.nodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>(initialElements.edges);

  // Stable ref to initialElements so applyPositions never closes over a stale value
  const initialElementsRef = useRef(initialElements);
  useEffect(() => { initialElementsRef.current = initialElements; }, [initialElements]);

  const applyPositions = useCallback((positions: Record<string, { x: number; y: number }>) => {
    setPendingPositions(positions);
    setNodes((nds) => nds.map((n) => {
      const pos = positions[n.id];
      if (pos) return { ...n, position: pos };
      // Node not in snapshot — restore to its initial/saved position
      const initial = initialElementsRef.current.nodes.find((i) => i.id === n.id);
      return initial ? { ...n, position: initial.position } : n;
    }));
  }, [setNodes]);

  // Keep a ref so the reset effect below can stamp the *current* editMode onto
  // newly-arrived nodes (e.g. after adding an item while already in edit mode)
  // without adding editMode to the dep array (which would re-run dagre).
  const editModeRef = useRef(editMode);
  useEffect(() => { editModeRef.current = editMode; });

  useEffect(() => {
    setNodes(initialElements.nodes.map((n) => ({ ...n, data: { ...n.data, editMode: editModeRef.current } })));
    setEdges(initialElements.edges);
  }, [initialElements, setNodes, setEdges]);

  // Propagate editMode changes into existing node data without resetting positions
  useEffect(() => {
    setNodes((nds) => nds.map((n) => ({ ...n, data: { ...n.data, editMode, onMonitorClick, onFaultCreate, onResourceCreate } })));
  }, [editMode, onMonitorClick, onFaultCreate, onResourceCreate, setNodes]);

  // Propagate isDark theme changes without resetting positions
  useEffect(() => {
    setNodes((nds) => nds.map((n) => ({ ...n, data: { ...n.data, isDark } })));
  }, [isDark, setNodes]);

  // Reflect pending renames and hide pending deletes without re-running dagre
  useEffect(() => {
    setNodes((nds) =>
      nds
        .filter((n) => !pendingDeletes.includes(parseInt(n.id, 10)))
        .map((n) => {
          const newName = pendingRenames[parseInt(n.id, 10)];
          if (!newName) return n;
          return { ...n, data: { ...n.data, item: { ...(n.data.item as LayoutItem), name: newName } } };
        }),
    );
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingRenames, pendingDeletes, setNodes]);

  const onConnect = useCallback(
    (params: Connection) => {
      const srcNode = nodes.find((n) => n.id === params.source);
      const srcType = (srcNode?.data as ItemNodeData | undefined)?.item.item_type ?? '';
      const palette = isDark ? darkTypeColours : typeColours;
      const col = palette[srcType] ?? (isDark ? darkFallbackCol : fallbackCol);
      setEdges((eds) => addEdge({
        ...params,
        type: 'editableEdge',
        style: { stroke: col.border, strokeWidth: 2 },
        markerEnd: { type: MarkerType.ArrowClosed, color: col.border },
      }, eds));
    },
    [setEdges, nodes, isDark],
  );

  // Wire the module-level delete ref to the live setEdges
  useEffect(() => {
    edgeDeleteRef.current = (id: string) => setEdges((eds) => eds.filter((e) => e.id !== id));
  }, [setEdges]);

  const handleSave = useCallback(async () => {
    if (isSaving) return;
    setIsSaving(true);
    onIsSavingChange?.(true);
    // Persist the on-screen position of every node, not just the dragged ones:
    // dagre-auto-laid positions were never written back, so they reshuffled on
    // the next reload whenever the item set changed and the layout re-ran.
    const deleted = new Set(pendingDeletes.map(String));
    const updates = nodes
      .filter((n) => !deleted.has(n.id))
      .map((n) => {
        const pos = pendingPositions[n.id] ?? n.position;
        const item = n.data.item as LayoutItem;
        return { id: n.id, x: snapTo(pos.x), y: snapTo(pos.y), item };
      })
      .filter(({ x, y, item }) => x !== item.position_x || y !== item.position_y);
    try {
      await Promise.all(
        updates.map(({ id, x, y }) =>
          layoutApi.updateItem(parseInt(id, 10), { position_x: x, position_y: y }),
        ),
      );
      await onSaveAll();
      toast.success('Changes saved');
      // Only clear state after a confirmed successful save
      setPendingPositions({});
      onEditModeChange(false);
    } catch {
      toast.error('Failed to save changes');
    } finally {
      setIsSaving(false);
      onIsSavingChange?.(false);
    }
  }, [isSaving, pendingPositions, nodes, pendingDeletes, onSaveAll, onEditModeChange, onIsSavingChange]);

  const handleDiscard = useCallback(() => {
    setNodes(initialElements.nodes.map((n) => ({ ...n, data: { ...n.data, editMode: false } })));
    setEdges(initialElements.edges);
    setPendingPositions({});
    onDiscardAll();
    onEditModeChange(false);
  }, [initialElements, setNodes, setEdges, onDiscardAll, onEditModeChange]);

  useImperativeHandle(ref, () => ({
    save: handleSave,
    discard: handleDiscard,
    getPositions: () => pendingPositionsRef.current,
    applyPositions,
  }), [handleSave, handleDiscard, applyPositions]);

  // Stable trigger string: changes on every navigation or item-list change
  const fitTrigger = items.map((i) => i.id).sort().join(',') + '|' + parentType;

  return (
    <div
      className={cn('w-full rounded-xl border overflow-hidden', isDark ? 'border-slate-700 bg-slate-950' : 'border-slate-200 bg-white')}
      style={{ height: 'calc(100vh - 210px)', minHeight: 520 }}
    >
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        colorMode={isDark ? 'dark' : 'light'}
        nodesDraggable={editMode}
        snapToGrid={editMode}
        snapGrid={[SNAP, SNAP]}
        connectionLineStyle={{ stroke: '#94a3b8', strokeWidth: 2, strokeDasharray: '6 3' }}
        onNodeDragStop={editMode ? onNodeDragStop : undefined}
        fitView
        fitViewOptions={{ padding: 0.25 }}
        minZoom={0.25}
        maxZoom={2}
        proOptions={{ hideAttribution: true }}
      >
        <FitOnChange trigger={fitTrigger} />
        <Background gap={24} color={isDark ? '#1e293b' : '#e2e8f0'} />
        <Controls showInteractive={false} />
        <MiniMap
          nodeColor={(n) => {
            const item = (n.data as ItemNodeData).item;
            const palette = (isDark ? darkTypeColours : typeColours)[item.item_type] ?? (isDark ? darkFallbackCol : fallbackCol);
            return getItemAccentColor(item, palette.dot);
          }}
        />
        <Panel position="top-right">
          <div className="group relative flex items-start justify-end">
            {/* Circular trigger button */}
            <button
              type="button"
              onClick={() => setPinnedLegend((prev) => !prev)}
              className={cn(
                'w-8 h-8 rounded-full flex items-center justify-center shadow-md border transition-all z-10 select-none cursor-pointer',
                pinnedLegend
                  ? (isDark ? 'bg-brand-900/80 border-brand-500 text-brand-300 ring-2 ring-brand-500/50' : 'bg-brand-50 border-brand-400 text-brand-600 ring-2 ring-brand-400/50')
                  : (isDark
                      ? 'bg-slate-800 border-slate-600 text-slate-400 hover:text-slate-200 hover:border-slate-400'
                      : 'bg-white border-slate-200 text-slate-400 hover:text-slate-700 hover:border-slate-400'),
              )}
              title={pinnedLegend ? 'Click to unpin legend' : 'Click to pin legend'}
              aria-label="Toggle legend"
            >
              <span style={{ fontFamily: 'serif', fontStyle: 'italic', fontWeight: 700, fontSize: 15, lineHeight: 1, display: 'block' }}>i</span>
            </button>

            {/* Legend popover — stays visible when pinnedLegend is true, or on hover when not pinned */}
            <div
              className={cn(
                'absolute top-10 right-0 rounded-xl p-3 shadow-lg text-[11px] space-y-1.5 border w-40 z-20 transition-all duration-200 ease-out',
                pinnedLegend
                  ? 'opacity-100 scale-100 translate-y-0 pointer-events-auto'
                  : 'opacity-0 scale-95 translate-y-[-4px] pointer-events-none group-hover:opacity-100 group-hover:scale-100 group-hover:translate-y-0 group-hover:pointer-events-auto',
                isDark ? 'bg-slate-900 border-slate-700' : 'bg-white border-slate-200',
              )}
            >
              <p className={cn('font-semibold text-xs mb-2', isDark ? 'text-slate-300' : 'text-slate-700')}>Legend</p>
              <div className="space-y-1.5 pb-2 mb-2 border-b border-slate-200 dark:border-slate-700">
                <p className={cn('text-[10px] font-semibold uppercase tracking-wide', isDark ? 'text-slate-500' : 'text-slate-400')}>Status</p>
                {[
                  { color: '#10b981', label: 'Active (On)' },
                  { color: '#94a3b8', label: 'Inactive (Off)' },
                  { color: '#64748b', label: 'Sleep (Standby)', isMoon: true },
                  { color: '#ef4444', label: 'Non-Functional / Fault' },
                  { color: '#3b82f6', label: 'Resource Requested' },
                ].map((s) => (
                  <div key={s.label} className="flex items-center gap-2">
                    {s.isMoon ? (
                      <Moon className="w-2.5 h-2.5 shrink-0 text-slate-400 fill-slate-400/40" />
                    ) : (
                      <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: s.color }} />
                    )}
                    <span className={isDark ? 'text-slate-300' : 'text-slate-600'}>{s.label}</span>
                  </div>
                ))}
              </div>
              <p className={cn('text-[10px] font-semibold uppercase tracking-wide mb-1', isDark ? 'text-slate-500' : 'text-slate-400')}>Types</p>
              {Object.entries(isDark ? darkTypeColours : typeColours).map(([type, col]) => {
                const Icon = typeIcons[type] ?? Package;
                return (
                  <div key={type} className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: col.dot }} />
                    <Icon className="w-3 h-3 shrink-0" style={{ color: col.header }} />
                    <span className={isDark ? 'text-slate-400' : 'text-slate-600'}>{typeLabels[type] ?? type}</span>
                  </div>
                );
              })}
            </div>
          </div>
        </Panel>
        {isRoomLevel && !hasHubs && (
          <Panel position="top-left">
            <div className={cn('rounded-lg px-3 py-2 text-xs border', isDark ? 'bg-amber-950/60 border-amber-700/50 text-amber-400' : 'bg-amber-50 border-amber-200 text-amber-700')}>
              Add a Network Switch or Router to show topology connections.
            </div>
          </Panel>
        )}
      </ReactFlow>
    </div>
  );
});

export default NetworkFlowView;
