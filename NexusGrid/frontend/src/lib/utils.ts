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
