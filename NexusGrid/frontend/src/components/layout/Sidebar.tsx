import { NavLink, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard, Map, AlertTriangle, Package,
  BarChart3, Activity, Users, LogOut, Zap, ChevronRight,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuthStore } from '@/store/authStore';
import toast from 'react-hot-toast';

const navItems = [
  { to: '/dashboard',  label: 'Dashboard',      icon: LayoutDashboard },
  { to: '/layout',     label: 'System Layout',   icon: Map },
  { to: '/faults',     label: 'Fault Reports',   icon: AlertTriangle },
  { to: '/resources',  label: 'Resources',       icon: Package },
  { to: '/reports',    label: 'Reports',         icon: BarChart3 },
  { to: '/monitoring', label: 'Monitoring',      icon: Activity },
  { to: '/users',      label: 'User Privileges', icon: Users },
];

interface SidebarProps {
  onClose?: () => void;
}

export default function Sidebar({ onClose }: SidebarProps) {
  const { user, logout } = useAuthStore();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await logout();
    toast.success('Logged out successfully');
    navigate('/login');
  };

  return (
    <aside className="flex flex-col h-full bg-white border-r border-slate-200">
      {/* Logo */}
      <div className="flex items-center gap-2.5 px-5 py-5 border-b border-slate-100">
        <div className="w-8 h-8 bg-brand-600 rounded-lg flex items-center justify-center">
          <Zap className="w-4.5 h-4.5 text-white" strokeWidth={2.5} />
        </div>
        <div>
          <p className="text-sm font-bold text-slate-900 leading-tight">NexusGrid</p>
          <p className="text-xs text-slate-500">Lab Management</p>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-0.5">
        {navItems.map(({ to, label, icon: Icon }) => (
          <NavLink
            key={to}
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
        ))}
      </nav>

      {/* User Panel */}
      {user && (
        <div className="px-3 py-3 border-t border-slate-100">
          <div className="flex items-center gap-3 px-3 py-2.5 rounded-lg bg-slate-50">
            <div className="w-8 h-8 bg-brand-100 rounded-full flex items-center justify-center shrink-0">
              <span className="text-xs font-bold text-brand-700">
                {user.username.charAt(0).toUpperCase()}
              </span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold text-slate-800 truncate">{user.username}</p>
              <p className="text-xs text-slate-500 truncate">{user.role}</p>
            </div>
            <button
              onClick={handleLogout}
              title="Logout"
              className="w-7 h-7 flex items-center justify-center rounded-lg
                         text-slate-400 hover:text-red-500 hover:bg-red-50 transition-colors"
            >
              <LogOut className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}
    </aside>
  );
}
