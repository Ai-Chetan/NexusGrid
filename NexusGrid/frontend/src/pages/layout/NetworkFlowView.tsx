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
  type Node,
  type Edge,
  type Connection,
  type NodeProps,
  type NodeTypes,
  Handle,
  Position,
  Panel,
  MarkerType,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import dagre from '@dagrejs/dagre';
import {
  Building2, Layers, DoorOpen, Monitor, Server, Network,
  Wifi, Printer, Zap, HardDrive, Package, Pencil, Trash2,
} from 'lucide-react';
import type { LayoutItem } from '@/types';
import { cn } from '@/lib/utils';
import { layoutApi } from '@/lib/api';
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

const statusColour: Record<string, string> = {
  active: '#10b981', inactive: '#94a3b8', 'non-functional': '#ef4444',
};

const NETWORK_HUB_TYPES = new Set(['network_switch', 'router']);
const CLUSTER_TYPES    = new Set(['building', 'floor', 'room']);

// ─── Node "shape" visual bodies ───────────────────────────────────────────────
// Each returns the inner decorative area beneath the header.

function BuildingBody() {
  return (
    <div className="px-2.5 pt-1.5 pb-2 flex flex-col gap-[4px]">
      {/* Three upper floors of windows */}
      {[0, 1, 2].map((row) => (
        <div key={row} className="flex gap-[3px]">
          {[0, 1, 2, 3, 4].map((col) => (
            <div
              key={col}
              className="flex-1 h-[13px] rounded-[2px] border border-violet-300"
              style={{ background: col % 2 === 0 ? '#ddd6fe' : '#ede9fe' }}
            />
          ))}
        </div>
      ))}
      {/* Ground-floor separator */}
      <div className="h-px bg-violet-300 mx-1" />
      {/* Ground floor: windows + centred door */}
      <div className="flex gap-[3px] items-end">
        <div className="flex-1 h-[13px] rounded-[2px] border border-violet-300 bg-violet-100" />
        <div className="flex-1 h-[13px] rounded-[2px] border border-violet-300 bg-violet-100" />
        <div className="w-6 h-[19px] rounded-t-[3px] border border-violet-400 bg-white relative">
          <div className="absolute right-[3px] top-[5px] w-[3px] h-[3px] rounded-full bg-violet-500" />
        </div>
        <div className="flex-1 h-[13px] rounded-[2px] border border-violet-300 bg-violet-100" />
        <div className="flex-1 h-[13px] rounded-[2px] border border-violet-300 bg-violet-100" />
      </div>
      {/* Rooftop parapet */}
      <div className="flex items-center justify-between px-1 mt-1">
        <div className="w-5 h-[4px] bg-violet-200 rounded-sm" />
        <div className="w-2 h-[7px] bg-violet-300 rounded-sm" />
        <div className="w-2 h-[7px] bg-violet-300 rounded-sm" />
        <div className="w-5 h-[4px] bg-violet-200 rounded-sm" />
      </div>
    </div>
  );
}

function FloorBody() {
  return (
    <div className="px-2.5 pb-1.5 pt-1">
      <div className="border border-blue-300 rounded-[3px] overflow-hidden" style={{ background: '#eff6ff' }}>
        {/* Top row — 4 rooms of varying widths */}
        <div className="flex gap-px p-px pb-0">
          {[0.22, 0.28, 0.28, 0.22].map((w, i) => (
            <div key={i} className="h-[15px] border border-blue-200 bg-white rounded-[1px]" style={{ flex: w }} />
          ))}
        </div>
        {/* Corridor with dots */}
        <div className="mx-px my-[3px] h-[6px] bg-blue-100 rounded-[1px] flex items-center gap-[5px] px-2">
          {[0,1,2,3,4].map(i => <div key={i} className="w-[3px] h-[3px] rounded-full bg-blue-300" />)}
        </div>
        {/* Bottom row — 3 rooms */}
        <div className="flex gap-px p-px pt-0">
          {[0.35, 0.3, 0.35].map((w, i) => (
            <div key={i} className="h-[15px] border border-blue-200 bg-white rounded-[1px]" style={{ flex: w }} />
          ))}
        </div>
      </div>
    </div>
  );
}

function RoomBody() {
  return (
    <div className="px-2.5 pb-1.5 pt-1">
      {/* Top-down room interior */}
      <div className="relative border-2 border-indigo-300 rounded-[3px] bg-indigo-50" style={{ height: 90 }}>
        {/* Door gap on bottom wall */}
        <div className="absolute bottom-0 left-[30px] w-[13px] h-[2px] bg-indigo-50 translate-y-px" />
        {/* Door arc */}
        <div
          className="absolute bottom-[2px] left-[30px] w-[12px] h-[12px] border-r border-indigo-400 rounded-br-full"
          style={{ borderColor: '#a5b4fc' }}
        />
        {/* Window on right wall */}
        <div className="absolute right-0 top-1/2 -translate-y-1/2 w-[2px] h-[16px] bg-indigo-50" />
        <div className="absolute right-[1px] top-1/2 -translate-y-1/2 w-[4px] h-[16px] border border-indigo-300 bg-sky-100 rounded-[1px]" />
        {/* Central desk */}
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="w-[58px] h-[30px] border-2 border-indigo-400 bg-white rounded-[2px] flex items-center justify-center gap-[5px]">
            {/* Tiny monitor */}
            <div className="flex flex-col items-center gap-[1px]">
              <div className="w-[13px] h-[10px] border border-indigo-300 bg-indigo-100 rounded-[1px]" />
              <div className="w-[3px] h-[2px] bg-indigo-200" />
              <div className="w-[7px] h-[1px] bg-indigo-200 rounded" />
            </div>
            {/* Keyboard */}
            <div className="w-[18px] h-[5px] bg-indigo-100 rounded-[1px] border border-indigo-200" />
          </div>
        </div>
        {/* Chair above desk */}
        <div className="absolute top-[7px] left-1/2 -translate-x-1/2 w-[15px] h-[7px] bg-indigo-200 rounded-[2px]" />
        {/* Chair below desk */}
        <div className="absolute bottom-[9px] left-1/2 -translate-x-1/2 w-[15px] h-[7px] bg-indigo-200 rounded-[2px]" />
      </div>
    </div>
  );
}

function MonitorBody({ color }: { color: string }) {
  return (
    <div className="flex flex-col items-center justify-center w-full h-full gap-1.5 py-2 px-2">
      {/* Screen bezel — border uses the card header colour */}
      <div className="w-full h-[68px] rounded-[4px] border-2 p-[5px] flex flex-col gap-[4px]" style={{ borderColor: color, background: color + '22' }}>
        <div className="flex items-center gap-[4px]">
          <div className="w-[8px] h-[4px] rounded-full opacity-90" style={{ background: color }} />
          <div className="flex-1 h-[4px] rounded-full opacity-50" style={{ background: color }} />
        </div>
        <div className="flex items-center gap-[4px] pl-[10px]">
          <div className="flex-1 h-[4px] rounded-full opacity-40" style={{ background: color }} />
        </div>
        <div className="flex items-center gap-[4px]">
          <div className="w-[8px] h-[4px] rounded-full bg-yellow-400 opacity-80" />
          <div className="w-[22px] h-[4px] rounded-full opacity-45" style={{ background: color }} />
        </div>
        <div className="flex items-center gap-[4px] pl-[5px]">
          <div className="w-[4px] h-[4px] rounded-full bg-pink-400 opacity-80" />
          <div className="flex-1 h-[4px] rounded-full opacity-35" style={{ background: color }} />
        </div>
        <div className="flex items-center gap-[4px]">
          <div className="w-[8px] h-[4px] rounded-full opacity-80" style={{ background: color }} />
          <div className="w-[28px] h-[4px] rounded-full opacity-40" style={{ background: color }} />
        </div>
        <div className="w-[3px] h-[5px] rounded-sm opacity-70" style={{ background: color }} />
      </div>
      {/* Neck + Base */}
      <div className="flex flex-col items-center gap-[2px]">
        <div className="w-[8px] h-[5px] rounded-sm opacity-70" style={{ background: color }} />
        <div className="w-[44px] h-[4px] rounded-full opacity-70" style={{ background: color }} />
      </div>
    </div>
  );
}

function ServerBody() {
  return (
    <div className="px-2.5 flex flex-col justify-center w-full h-full gap-[5px] py-2">
      {[0,1,2,3,4].map(i => (
        <div key={i} className="flex items-center gap-1.5 h-[14px] rounded-[3px] border border-amber-200 bg-amber-50 px-1.5">
          <div className="w-[6px] h-[6px] rounded-full" style={{ background: i % 4 === 1 ? '#f59e0b' : '#10b981' }} />
          <div className="flex-1 h-[4px] rounded-full bg-amber-200" />
          <div className="w-[6px] h-[6px] rounded-full" style={{ background: i === 2 ? '#f59e0b' : '#10b981' }} />
          <div className="w-[3px] h-[8px] rounded-sm bg-amber-300" />
        </div>
      ))}
    </div>
  );
}

function SwitchBody() {
  return (
    <div className="px-2.5 flex flex-col justify-center w-full h-full gap-2 py-2">
      {[0, 1].map(row => (
        <div key={row} className="w-full h-[28px] rounded border border-cyan-200 bg-cyan-50 flex items-center px-1.5 gap-[3px]">
          {Array.from({ length: 12 }).map((_, i) => (
            <div key={i} className="w-[6px] h-[16px] rounded-[2px]" style={{ background: (i + row) % 5 === 0 ? '#f59e0b' : (i + row) % 3 === 0 ? '#10b981' : '#06b6d450' }} />
          ))}
        </div>
      ))}
      <div className="flex items-center justify-between px-1">
        <div className="flex gap-1">
          <div className="w-[10px] h-[6px] rounded-sm border border-cyan-200 bg-cyan-100" />
          <div className="w-[10px] h-[6px] rounded-sm border border-cyan-200 bg-cyan-100" />
        </div>
        <div className="w-2 h-2 rounded-full bg-green-400" />
        <div className="flex gap-1">
          <div className="w-[10px] h-[6px] rounded-sm border border-cyan-200 bg-cyan-100" />
          <div className="w-[10px] h-[6px] rounded-sm border border-cyan-200 bg-cyan-100" />
        </div>
      </div>
    </div>
  );
}

function RouterBody() {
  return (
    <div className="flex flex-col items-center justify-center w-full h-full gap-1.5 py-2">
      {/* Antennas */}
      <div className="flex gap-6 items-end">
        <div className="w-[3px] h-[14px] bg-teal-400 rounded-full" style={{ transform: 'rotate(-15deg)', transformOrigin: 'bottom' }} />
        <div className="w-[3px] h-[18px] bg-teal-400 rounded-full" />
        <div className="w-[3px] h-[14px] bg-teal-400 rounded-full" style={{ transform: 'rotate(15deg)', transformOrigin: 'bottom' }} />
      </div>
      {/* Main chassis */}
      <div className="w-[120px] h-[38px] rounded-lg border border-teal-300 bg-teal-50 flex items-center justify-between px-3">
        <Wifi className="w-5 h-5 text-teal-500" />
        <div className="flex flex-col gap-1">
          <div className="w-2 h-2 rounded-full bg-green-400" />
          <div className="w-2 h-2 rounded-full bg-teal-300" />
        </div>
      </div>
      {/* Ethernet ports */}
      <div className="flex gap-1.5">
        {[0,1,2,3].map(i => (
          <div key={i} className="w-[14px] h-[9px] rounded-[2px] border border-teal-300 bg-teal-100" />
        ))}
      </div>
    </div>
  );
}

function PrinterBody() {
  return (
    <div className="flex flex-col items-center justify-center w-full h-full gap-1 py-2">
      {/* Output tray / paper */}
      <div className="w-[110px] h-[10px] rounded-sm border border-pink-200 bg-white flex items-center px-2">
        <div className="w-1/2 h-[2px] rounded bg-pink-100" />
      </div>
      {/* Main body */}
      <div className="w-[110px] h-[52px] rounded border border-pink-200 bg-pink-50 flex items-center gap-2 px-2">
        <div className="flex flex-col gap-1">
          <div className="w-4 h-4 rounded border border-pink-200 bg-white flex items-center justify-center">
            <div className="w-2 h-2 rounded-full bg-green-400" />
          </div>
          <div className="w-4 h-2 rounded bg-pink-300" />
        </div>
        {/* Paper slot area */}
        <div className="flex-1 h-[36px] rounded-sm border border-pink-200 bg-pink-100 flex flex-col justify-center px-1.5 gap-1">
          <div className="h-[4px] rounded bg-pink-300" />
          <div className="h-[4px] rounded bg-pink-200 w-3/4" />
          <div className="h-[4px] rounded bg-pink-200 w-1/2" />
        </div>
      </div>
      {/* Input tray */}
      <div className="w-[100px] h-[10px] rounded-sm border border-pink-200 bg-pink-100" />
    </div>
  );
}

function UPSBody() {
  return (
    <div className="px-2.5 flex flex-col justify-center w-full h-full gap-2 py-2">
      {/* Main chassis */}
      <div className="w-full h-[52px] rounded border border-yellow-300 bg-yellow-50 flex flex-col justify-center px-2 gap-1.5">
        {/* Battery bar */}
        <div className="flex items-center gap-1.5">
          <Zap className="w-3.5 h-3.5 text-yellow-500 shrink-0" />
          <div className="flex-1 h-[10px] rounded-full bg-yellow-100 overflow-hidden border border-yellow-200">
            <div className="h-full bg-gradient-to-r from-yellow-400 to-green-400 rounded-full" style={{ width: '72%' }} />
          </div>
          <span className="text-[9px] text-yellow-700 font-bold">72%</span>
        </div>
        {/* Status LEDs */}
        <div className="flex gap-1.5 pl-0.5">
          <div className="w-2 h-2 rounded-full bg-green-400" />
          <div className="w-2 h-2 rounded-full bg-yellow-400" />
          <div className="w-2 h-2 rounded-full bg-slate-200" />
        </div>
      </div>
      {/* Outlet strip */}
      <div className="flex justify-center gap-2">
        {[0,1,2].map(i => (
          <div key={i} className="w-[22px] h-[16px] rounded-sm border border-yellow-300 bg-white flex items-center justify-center gap-[4px]">
            <div className="w-[2px] h-[7px] rounded-full bg-slate-400" />
            <div className="w-[2px] h-[7px] rounded-full bg-slate-400" />
          </div>
        ))}
      </div>
    </div>
  );
}

function RackBody() {
  return (
    <div className="px-2.5 flex flex-col justify-center w-full h-full gap-[4px] py-2">
      {[0,1,2,3,4,5].map(i => (
        <div key={i} className="flex items-center h-[13px] rounded-[2px] border border-slate-200 bg-slate-50 px-1.5 gap-1.5">
          <div className="w-[5px] h-[5px] rounded-full" style={{ background: i === 1 ? '#10b981' : i === 3 ? '#f59e0b' : '#94a3b8' }} />
          <div className="flex-1 h-[3px] rounded-full bg-slate-200" />
          <div className="w-[3px] h-[8px] rounded-sm bg-slate-300" />
          <div className="w-[3px] h-[8px] rounded-sm bg-slate-300" />
        </div>
      ))}
    </div>
  );
}

const typeBodyMap: Record<string, (name: string, color: string) => JSX.Element> = {
  building: () => <BuildingBody />,
  floor:    () => <FloorBody />,
  room:     () => <RoomBody />,
  computer: (_n, color) => <MonitorBody color={color} />,
  server:   () => <ServerBody />,
  network_switch: () => <SwitchBody />,
  router:   () => <RouterBody />,
  printer:  () => <PrinterBody />,
  ups:      () => <UPSBody />,
  rack:     () => <RackBody />,
};

// ─── Per-type node dimensions ──────────────────────────────────────────────────────
const DEVICE_SIZE = { w: 155, h: 150 };
const nodeSizes: Record<string, { w: number; h: number }> = {
  building:       { w: 155, h: 210 },   // taller than wide
  floor:          { w: 230, h: 145 },   // wider than tall
  room:           { w: 155, h: 200 },   // taller
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
  onEnter:  (item: LayoutItem) => void;
  onEdit:   (item: LayoutItem) => void;
  onDelete: (item: LayoutItem) => void;
  isHub?: boolean;
}

type ItemFlowNode = Node<ItemNodeData, 'itemNode'>;

function ItemNode({ data }: NodeProps<ItemFlowNode>) {
  const { item, editMode, onEnter, onEdit, onDelete, isHub } = data;
  const [hovered, setHovered] = useState(false);
  const col = typeColours[item.item_type] ?? fallbackCol;
  const isNavigable = CLUSTER_TYPES.has(item.item_type);
  const BodyEl = typeBodyMap[item.item_type];

  // Manual double-click: React Flow intercepts pointer events so browser dblclick is unreliable
  const clickCount = useRef(0);
  const clickTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Clear pending timer on unmount to avoid state updates on an unmounted component
  useEffect(() => {
    return () => {
      if (clickTimer.current) clearTimeout(clickTimer.current);
    };
  }, []);

  const handleClick = useCallback(() => {
    if (editMode || !isNavigable) return;
    clickCount.current += 1;
    if (clickCount.current === 2) {
      clickCount.current = 0;
      if (clickTimer.current) clearTimeout(clickTimer.current);
      onEnter(item);
    } else {
      clickTimer.current = setTimeout(() => { clickCount.current = 0; }, 300);
    }
  }, [editMode, isNavigable, onEnter, item]);

  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onClick={handleClick}
      style={{ borderColor: col.header, width: nodeSize(item.item_type).w }}
      className={cn(
        'rounded-xl border-2 overflow-hidden select-none transition-shadow bg-white',
        hovered && 'shadow-lg',
        !editMode && isNavigable && 'cursor-pointer',
        editMode && 'cursor-grab',
      )}
    >
      <Handle type="target" position={Position.Top} style={{ opacity: 0 }} />

      {/* ── Coloured header ── */}
      <div
        className="relative flex items-center gap-2 px-2.5 py-2"
        style={{ background: col.header }}
      >
        <div className="w-6 h-6 rounded-md bg-white/20 flex items-center justify-center shrink-0">
          {(() => { const Icon = typeIcons[item.item_type] ?? Package; return <Icon className="w-3.5 h-3.5 text-white" />; })()}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-white text-[11px] font-semibold leading-tight truncate">{item.name}</p>
          <p className="text-white/70 text-[9px] leading-none mt-0.5">{typeLabels[item.item_type] ?? item.item_type}</p>
        </div>
        {/* Edit/delete overlay — all card types */}
        {editMode && (
          <div className={cn('absolute right-1.5 top-1/2 -translate-y-1/2 flex items-center gap-0.5 transition-opacity', hovered ? 'opacity-100' : 'opacity-0')}>
            <button
              onPointerDown={(e) => e.stopPropagation()}
              onClick={(e) => { e.stopPropagation(); onEdit(item); }}
              className="w-5 h-5 rounded flex items-center justify-center bg-white/20 hover:bg-white/40 text-white transition-colors"
              title="Rename"
            >
              <Pencil className="w-3 h-3" />
            </button>
            <button
              onPointerDown={(e) => e.stopPropagation()}
              onClick={(e) => { e.stopPropagation(); onDelete(item); }}
              className="w-5 h-5 rounded flex items-center justify-center bg-white/20 hover:bg-red-400/60 text-white transition-colors"
              title="Delete"
            >
              <Trash2 className="w-3 h-3" />
            </button>
          </div>
        )}
      </div>

      {/* ── Body decoration ── */}
      <div
        style={{ background: col.bg, ...(isNavigable ? {} : { height: 110, overflow: 'hidden', display: 'flex', alignItems: 'stretch' }) }}
      >
        {BodyEl ? BodyEl(item.name, col.header) : <div className="h-12" />}
      </div>

      {/* ── Footer: status only, cluster types ── */}
      {isNavigable && item.status && (
        <div
          className="flex items-center px-2.5 py-1.5 border-t"
          style={{ borderColor: col.border + '40', background: col.bg }}
        >
          <span className="w-1.5 h-1.5 rounded-full" style={{ background: statusColour[item.status] ?? '#94a3b8' }} />
          <span className="text-[9px] text-slate-500 capitalize ml-1">{item.status}</span>
        </div>
      )}

      <Handle type="source" position={Position.Bottom} style={{ opacity: 0 }} />
    </div>
  );
}

// ─── Dagre auto-layout ────────────────────────────────────────────────────────
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
      return { ...n, position: { x: pos.x - sz.w / 2, y: pos.y - sz.h / 2 } };
    }) as N[],
    edges,
  };
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
  pendingRenames: Record<number, string>;
  pendingDeletes: number[];
  onSaveAll: () => Promise<void>;
  onDiscardAll: () => void;
  /** Notifies the parent when the async save starts / finishes */
  onIsSavingChange?: (v: boolean) => void;
}

const nodeTypes: NodeTypes = { itemNode: ItemNode as NodeTypes[string] };

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
  { items, parentType, editMode, onEditModeChange, onEnter, onEdit, onDelete, pendingRenames, pendingDeletes, onSaveAll, onDiscardAll, onIsSavingChange },
  ref,
) {
  const isRoomLevel = parentType === 'room';
  const hasHubs = items.some((i) => NETWORK_HUB_TYPES.has(i.item_type));

  const [pendingPositions, setPendingPositions] = useState<Record<string, { x: number; y: number }>>({});
  const [isSaving, setIsSaving] = useState(false);

  const onNodeDragStop = useCallback(
    (_event: React.MouseEvent, node: ItemFlowNode) => {
      setPendingPositions((prev) => ({ ...prev, [node.id]: node.position }));
    },
    [],
  );

  const initialElements = useMemo(() => {
    const rawEdges: Edge[] = isRoomLevel && hasHubs ? buildNetworkEdges(items) : buildHierarchyEdges(items);

    const makeNode = (item: LayoutItem, position: { x: number; y: number }): ItemFlowNode => ({
      id: String(item.id),
      type: 'itemNode',
      position,
      data: { item, editMode: false, onEnter, onEdit, onDelete, isHub: NETWORK_HUB_TYPES.has(item.item_type) },
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
        ? { x: item.position_x, y: item.position_y }
        : (dagrePosById[String(item.id)] ?? { x: 0, y: 0 });
      return makeNode(item, position);
    });

    return { nodes, edges: rawEdges };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items.map((i) => `${i.id}:${i.position_x},${i.position_y}:${i.name}:${i.status ?? ''}`).join('|'), parentType]);

  const [nodes, setNodes, onNodesChange] = useNodesState<ItemFlowNode>(initialElements.nodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>(initialElements.edges);

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
    setNodes((nds) => nds.map((n) => ({ ...n, data: { ...n.data, editMode } })));
  }, [editMode, setNodes]);

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
    (params: Connection) => setEdges((eds) => addEdge(params, eds)),
    [setEdges],
  );

  const handleSave = useCallback(async () => {
    if (isSaving) return;
    setIsSaving(true);
    onIsSavingChange?.(true);
    const posEntries = Object.entries(pendingPositions);
    try {
      await Promise.all(
        posEntries.map(([id, pos]) =>
          layoutApi.updateItem(parseInt(id, 10), { position_x: Math.round(pos.x), position_y: Math.round(pos.y) }),
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
  }, [isSaving, pendingPositions, onSaveAll, onEditModeChange, onIsSavingChange]);

  const handleDiscard = useCallback(() => {
    setNodes(initialElements.nodes.map((n) => ({ ...n, data: { ...n.data, editMode: false } })));
    setEdges(initialElements.edges);
    setPendingPositions({});
    onDiscardAll();
    onEditModeChange(false);
  }, [initialElements, setNodes, setEdges, onDiscardAll, onEditModeChange]);

  useImperativeHandle(ref, () => ({ save: handleSave, discard: handleDiscard }), [handleSave, handleDiscard]);

  // Stable trigger string: changes on every navigation or item-list change
  const fitTrigger = items.map((i) => i.id).sort().join(',') + '|' + parentType;

  return (
    <div className="w-full rounded-xl border border-slate-200 bg-white overflow-hidden" style={{ height: 'calc(100vh - 210px)', minHeight: 520 }}>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        nodeTypes={nodeTypes}
        nodesDraggable={editMode}
        snapToGrid={editMode}
        snapGrid={[24, 24]}
        onNodeDragStop={editMode ? onNodeDragStop : undefined}
        fitView
        fitViewOptions={{ padding: 0.25 }}
        minZoom={0.25}
        maxZoom={2}
        proOptions={{ hideAttribution: true }}
      >
        <FitOnChange trigger={fitTrigger} />
        <Background gap={24} color="#e2e8f0" />
        <Controls showInteractive={false} />
        <MiniMap
          nodeColor={(n) => typeColours[(n.data as ItemNodeData).item.item_type]?.dot ?? '#94a3b8'}
          style={{ background: '#f8fafc', border: '1px solid #e2e8f0' }}
          maskColor="rgba(241,245,249,0.7)"
        />
        <Panel position="top-right">
          <div className="bg-white border border-slate-200 rounded-xl p-3 shadow-sm text-[11px] space-y-1.5 max-h-72 overflow-y-auto">
            <p className="font-semibold text-slate-700 text-xs mb-2">Legend</p>
            {Object.entries(typeColours).map(([type, col]) => {
              const Icon = typeIcons[type] ?? Package;
              return (
                <div key={type} className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: col.dot }} />
                  <Icon className="w-3 h-3 shrink-0" style={{ color: col.header }} />
                  <span className="text-slate-600">{typeLabels[type] ?? type}</span>
                </div>
              );
            })}
          </div>
        </Panel>
        {isRoomLevel && !hasHubs && (
          <Panel position="top-left">
            <div className="bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 text-xs text-amber-700">
              Add a Network Switch or Router to show topology connections.
            </div>
          </Panel>
        )}
      </ReactFlow>
    </div>
  );
});

export default NetworkFlowView;
