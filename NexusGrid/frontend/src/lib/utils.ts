import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { formatDistanceToNow, format } from 'date-fns';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function timeAgo(dateStr: string): string {
  try {
    return formatDistanceToNow(new Date(dateStr), { addSuffix: true });
  } catch {
    return dateStr;
  }
}

export function formatDateTime(dateStr: string): string {
  try {
    return format(new Date(dateStr), 'MMM d, yyyy HH:mm');
  } catch {
    return dateStr;
  }
}

export function formatDate(dateStr: string): string {
  try {
    return format(new Date(dateStr), 'MMM d, yyyy');
  } catch {
    return dateStr;
  }
}

export const statusColors: Record<string, string> = {
  // Fault statuses
  unaddressed:      'text-red-600 bg-red-50',
  'in-progress':    'text-amber-600 bg-amber-50',
  scheduled:        'text-blue-600 bg-blue-50',
  resolved:         'text-emerald-600 bg-emerald-50',
  ignored:          'text-slate-500 bg-slate-100',
  // Resource statuses
  Pending:          'text-amber-600 bg-amber-50',
  Fulfilled:        'text-emerald-600 bg-emerald-50',
  Denied:           'text-red-600 bg-red-50',
  // System statuses
  active:           'text-emerald-600 bg-emerald-50',
  inactive:         'text-slate-500 bg-slate-100',
  'non-functional': 'text-red-600 bg-red-50',
};

// ─── Device online/offline status dot ────────────────────────────────────────
// Single source of truth for the small status indicator dot shown next to a
// device in both the System Layout view and the Live Monitoring view.
// NOTE: These are intentionally separate from statusColors above — those are
// for fault/resource/admin badge colours, not heartbeat-derived online status.

export type DeviceHealthState = 'online' | 'offline' | 'unknown';

export const DEVICE_STATUS_DOT_COLOR: Record<DeviceHealthState, string> = {
  online:  '#10b981',  // emerald-500 — green  (heartbeat fresh)
  offline: '#94a3b8',  // slate-400   — grey   (heartbeat stale)
  unknown: '#94a3b8',  // slate-400   — grey   (no monitoring data)
};

export const DEVICE_STATUS_DOT_CLASS: Record<DeviceHealthState, string> = {
  online:  'bg-emerald-500',
  offline: 'bg-slate-400',
  unknown: 'bg-slate-400',
};

export function getHealthState(raw: string | null | undefined): DeviceHealthState {
  if (raw === 'online')  return 'online';
  if (raw === 'offline') return 'offline';
  return 'unknown';
}

export interface DeviceStatusData {
  status?: string | null;
  alert_status?: string | null;
  health_state?: string | null;
  monitoring_status?: string | null;
}

export function getDeviceStatusColor(data: DeviceStatusData): {
  hex: string;
  bgClass: string;
  isOnline: boolean;
  statusType: 'online' | 'offline' | 'sleep' | 'fault';
} {
  const isOnline = data.health_state === 'online' || data.monitoring_status === 'online' || data.status === 'active';

  // 1. Alert states take highest priority (red for active fault, blue for pending resource)
  if (data.alert_status === 'fault_active') {
    return { hex: '#ef4444', bgClass: 'bg-red-500', isOnline: false, statusType: 'fault' };
  }
  if (data.alert_status === 'resource_pending') {
    return { hex: '#3b82f6', bgClass: 'bg-blue-500', isOnline: false, statusType: 'fault' };
  }

  // 2. Explicit System status & Sleep handling
  if (data.status === 'non-functional') {
    return { hex: '#ef4444', bgClass: 'bg-red-500', isOnline: false, statusType: 'fault' };
  }
  if (data.status === 'sleep' || data.health_state === 'sleep') {
    return { hex: '#64748b', bgClass: 'bg-slate-500', isOnline: false, statusType: 'sleep' };
  }
  if (data.status === 'active') {
    return { hex: '#10b981', bgClass: 'bg-emerald-500', isOnline: true, statusType: 'online' };
  }
  if (data.status === 'inactive') {
    return { hex: '#94a3b8', bgClass: 'bg-slate-400', isOnline: false, statusType: 'offline' };
  }

  // 3. Heartbeat / Monitoring status fallback
  if (data.health_state === 'online' || data.monitoring_status === 'online') {
    return { hex: '#10b981', bgClass: 'bg-emerald-500', isOnline: true, statusType: 'online' };
  }
  if (data.health_state === 'sleep') {
    return { hex: '#64748b', bgClass: 'bg-slate-500', isOnline: false, statusType: 'sleep' };
  }

  // 4. Default / unknown / offline
  return { hex: '#94a3b8', bgClass: 'bg-slate-400', isOnline: false, statusType: 'offline' };
}

/**
 * Returns a human-readable "why" tooltip explaining the device's status and telemetry freshness.
 * e.g. "Online — last heartbeat 12s ago", "Offline — last seen 4h 12m ago", "Sleep — last seen 5m ago"
 */
export function getDeviceStatusTooltip(data: DeviceStatusData & { last_seen_at?: string | null }): string {
  const { statusType } = getDeviceStatusColor(data);
  const timeStr = data.last_seen_at ? timeAgo(data.last_seen_at) : null;

  if (data.alert_status === 'fault_active') {
    return `Fault — Active fault reported${timeStr ? ` (last seen ${timeStr})` : ''}`;
  }
  if (data.alert_status === 'resource_pending') {
    return `Resource Pending — Request pending${timeStr ? ` (last seen ${timeStr})` : ''}`;
  }

  switch (statusType) {
    case 'online':
      return `Online — last heartbeat ${timeStr ?? 'just now'}`;
    case 'sleep':
      return `Sleep — last seen ${timeStr ?? 'recently'}`;
    case 'fault':
      return `Fault — Non-functional${timeStr ? ` (last seen ${timeStr})` : ''}`;
    case 'offline':
      return `Offline — last seen ${timeStr ?? 'never'}`;
    default:
      return timeStr ? `Unknown — last seen ${timeStr}` : 'Unknown — no monitoring telemetry';
  }
}

export const itemTypeLabel: Record<string, string> = {
  building:       'Building',
  floor:          'Floor',
  room:           'Room',
  computer:       'Computer',
  server:         'Server',
  network_switch: 'Switch',
  router:         'Router',
  printer:        'Printer',
  ups:            'UPS',
  rack:           'Rack',
};

const CHILD_TYPES: Record<string, { value: string; label: string }[]> = {
  root: [
    { value: 'building', label: 'Building' },
  ],
  building: [
    { value: 'floor', label: 'Floor' },
  ],
  floor: [
    { value: 'room', label: 'Room' },
  ],
  room: [
    { value: 'computer',       label: 'Computer' },
    { value: 'server',         label: 'Server' },
    { value: 'network_switch', label: 'Switch' },
    { value: 'router',         label: 'Router' },
    { value: 'printer',        label: 'Printer' },
    { value: 'ups',            label: 'UPS' },
    { value: 'rack',           label: 'Rack' },
  ],
};

export function getChildTypes(parentType: string): { value: string; label: string }[] {
  return CHILD_TYPES[parentType] ?? [];
}

