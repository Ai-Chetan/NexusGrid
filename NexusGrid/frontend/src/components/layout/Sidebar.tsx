import { useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  LayoutDashboard, Map, AlertTriangle, Package,
  BarChart3, Activity, Users, LogOut, ChevronRight, ScanLine,
} from 'lucide-react';
import { layoutApi } from '@/lib/api';
import { cn } from '@/lib/utils';
import { useAuthStore } from '@/store/authStore';
import type { SimpleSystem, User } from '@/types';
import QrScannerModal from '@/components/common/QrScannerModal';
import toast from 'react-hot-toast';

type Role = User['role'];

const navItems: { to: string; label: string; icon: React.ElementType; allowedRoles?: Role[] }[] = [
  { to: '/app/dashboard',  label: 'Dashboard',      icon: LayoutDashboard },
  { to: '/app/layout',     label: 'System Layout',   icon: Map },
  { to: '/app/faults',     label: 'Fault Reports',   icon: AlertTriangle },
  { to: '/app/resources',  label: 'Resources',       icon: Package },
  { to: '/app/reports',    label: 'Reports',         icon: BarChart3 },
  { to: '/app/monitoring', label: 'Monitoring',      icon: Activity,    allowedRoles: ['Administrator', 'Lab Assistant'] },
  { to: '/app/users',      label: 'User Privileges', icon: Users,        allowedRoles: ['Administrator'] },
];

interface SidebarProps {
  onClose?: () => void;
}

export default function Sidebar({ onClose }: SidebarProps) {
  const { user, logout } = useAuthStore();
  const navigate = useNavigate();
  const [scannerOpen, setScannerOpen] = useState(false);
  const isNoRole = user?.role === 'No Roles';

  const { data: systems = [] } = useQuery<SimpleSystem[]>({
    queryKey: ['systems-list'],
    queryFn: () => layoutApi.getSystems().then((r) => r.data as SimpleSystem[]),
    staleTime: 60_000,
    enabled: !isNoRole,
  });

  const visibleNavItems = navItems.filter(({ allowedRoles }) =>
    !allowedRoles || (user?.role && allowedRoles.includes(user.role))
  );

  const handleLogout = async () => {
    await logout();
    toast.success('Logged out successfully');
    navigate('/login');
  };

  const handleCodeDetected = (code: string) => {
    const system = systems.find((s) => s.unique_code.toUpperCase() === code.toUpperCase());
    if (!system || system.layout_item_id == null) {
      toast.error('System not found for scanned QR code.');
      return;
    }
    navigate(`/app/system/${system.layout_item_id}?scan=${encodeURIComponent(system.unique_code)}`);
    setScannerOpen(false);
    onClose?.();
    toast.success(`Opened ${system.host_name}`);
  };

  return (
    <aside className="flex flex-col h-full bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-700/60">
      {/* Logo */}
      <div className="flex items-center gap-2.5 px-5 py-5 border-b border-slate-100 dark:border-slate-700/60">
        <img src="/favicon.svg" alt="NexusGrid logo" className="w-8 h-8 rounded-lg" />
        <div>
          <p className="text-sm font-bold text-slate-900 dark:text-slate-100 leading-tight">NexusGrid</p>
          <p className="text-xs text-slate-500 dark:text-slate-400">Lab Management</p>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-0.5">
        {visibleNavItems.map(({ to, label, icon: Icon }) => (
          <div key={to}>
            <NavLink
              to={to}
              onClick={onClose}
              className={({ isActive }) =>
                cn('sidebar-link', isActive && 'active')
              }
            >
              <Icon className="w-4.5 h-4.5 shrink-0" />
              <span className="flex-1">{label}</span>
              <ChevronRight className="w-3.5 h-3.5 opacity-0 group-hover:opacity-40 transition-opacity" />
            </NavLink>

            {!isNoRole && to === '/app/dashboard' && (
              <button
                type="button"
                onClick={() => setScannerOpen(true)}
                className="sidebar-link w-full"
                title="Scan a system QR code"
              >
                <ScanLine className="w-4.5 h-4.5 shrink-0" />
                <span className="flex-1 text-left">Scan QR</span>
                <ChevronRight className="w-3.5 h-3.5 opacity-0 group-hover:opacity-40 transition-opacity" />
              </button>
            )}
          </div>
        ))}
      </nav>

      {/* User Panel */}
      {user && (
        <div className="px-3 py-3 border-t border-slate-100 dark:border-slate-700/60">
          <div className="flex items-center gap-3 px-3 py-2.5 rounded-lg bg-slate-50 dark:bg-slate-800">
            <button
              onClick={() => { navigate('/app/profile'); onClose?.(); }}
              title="View profile"
              className="w-8 h-8 bg-brand-100 rounded-full flex items-center justify-center shrink-0
                         hover:bg-brand-200 dark:hover:bg-brand-800/60 transition-colors"
            >
              <span className="text-xs font-bold text-brand-700">
                {user.username.charAt(0).toUpperCase()}
              </span>
            </button>
            <button
              onClick={() => { navigate('/app/profile'); onClose?.(); }}
              className="flex-1 min-w-0 text-left hover:opacity-80 transition-opacity"
            >
              <p className="text-xs font-semibold text-slate-800 dark:text-slate-200 truncate">{user.username}</p>
              <p className="text-xs text-slate-500 dark:text-slate-400 truncate">{user.role}</p>
            </button>
            <button
              onClick={handleLogout}
              title="Logout"
              className="w-7 h-7 flex items-center justify-center rounded-lg
                         text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/40 transition-colors"
            >
              <LogOut className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}

      <QrScannerModal
        open={scannerOpen}
        onClose={() => setScannerOpen(false)}
        onCodeDetected={handleCodeDetected}
      />
    </aside>
  );
}
