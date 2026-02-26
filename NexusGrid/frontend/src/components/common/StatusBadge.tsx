import { cn, statusColors } from '@/lib/utils';

interface StatusBadgeProps {
  status: string;
  className?: string;
}

export default function StatusBadge({ status, className }: StatusBadgeProps) {
  const color = statusColors[status] ?? 'bg-slate-100 text-slate-600 border-slate-200';
  const label = status
    .replace(/-/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());
  return (
    <span className={cn('badge', color, className)}>{label}</span>
  );
}
