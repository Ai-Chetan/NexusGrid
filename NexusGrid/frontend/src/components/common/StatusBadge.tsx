import { cn, statusColors } from '@/lib/utils';
import type { SystemStatus } from '@/types';

interface StatusBadgeProps {
  status: SystemStatus | string;
  className?: string;
}

export default function StatusBadge({ status, className }: StatusBadgeProps) {
  const color = statusColors[status as SystemStatus] ?? 'bg-slate-100 text-slate-600 border-slate-200';
  const label = status
    .replace(/-/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());
  return (
    <span className={cn('badge', color, className)}>{label}</span>
  );
}
