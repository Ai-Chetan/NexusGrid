import { useState } from 'react';
import { useLocation } from 'react-router-dom';
import { Menu, Bell, Search } from 'lucide-react';

const pageTitles: Record<string, string> = {
  '/dashboard':  'Dashboard',
  '/layout':     'System Layout',
  '/faults':     'Fault Reports',
  '/resources':  'Resources',
  '/reports':    'Reports',
  '/monitoring': 'Monitoring',
  '/users':      'User Privileges',
};

interface HeaderProps {
  onSidebarToggle: () => void;
}

export default function Header({ onSidebarToggle }: HeaderProps) {
  const { pathname } = useLocation();
  const title = pageTitles[pathname.replace(/\/\d+$/, '')] ?? 'NexusGrid';

  return (
    <header className="h-14 px-4 lg:px-6 flex items-center justify-between
                       bg-white border-b border-slate-200 shrink-0">
      {/* Left */}
      <div className="flex items-center gap-3">
        <button
          onClick={onSidebarToggle}
          className="lg:hidden w-9 h-9 flex items-center justify-center rounded-lg
                     text-slate-500 hover:bg-slate-100 transition-colors"
        >
          <Menu className="w-5 h-5" />
        </button>
        <h2 className="text-base font-semibold text-slate-900">{title}</h2>
      </div>

      {/* Right */}
      <div className="flex items-center gap-2">
        <span className="text-xs text-slate-400 hidden sm:block">
          {new Date().toLocaleDateString('en-US', {
            weekday: 'long', month: 'short', day: 'numeric',
          })}
        </span>
      </div>
    </header>
  );
}
