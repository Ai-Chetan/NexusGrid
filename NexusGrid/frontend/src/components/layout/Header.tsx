import { useLocation } from 'react-router-dom';
import { Menu, Moon, Sun } from 'lucide-react';
import { useTheme } from '@/hooks/useTheme';

const pageTitles: Record<string, string> = {
  '/app/dashboard':  'Dashboard',
  '/app/layout':     'System Layout',
  '/app/faults':     'Fault Reports',
  '/app/resources':  'Resources',
  '/app/reports':    'Reports',
  '/app/monitoring': 'Monitoring',
  '/app/users':      'User Privileges',
};

interface HeaderProps {
  onSidebarToggle: () => void;
}

export default function Header({ onSidebarToggle }: HeaderProps) {
  const { pathname } = useLocation();
  const { theme, toggle } = useTheme();
  const title = pageTitles[pathname.replace(/\/\d+$/, '')] ?? 'NexusGrid';

  return (
    <header className="h-14 px-4 lg:px-6 flex items-center justify-between
                       bg-white dark:bg-slate-900 border-b border-slate-200
                       dark:border-slate-700 shrink-0">
      {/* Left */}
      <div className="flex items-center gap-3">
        <button
          onClick={onSidebarToggle}
          className="lg:hidden w-9 h-9 flex items-center justify-center rounded-lg
                     text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800
                     transition-colors"
        >
          <Menu className="w-5 h-5" />
        </button>
        <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">{title}</h2>
      </div>

      {/* Right */}
      <div className="flex items-center gap-2">
        <span className="text-xs text-slate-400 hidden sm:block">
          {new Date().toLocaleDateString('en-US', {
            weekday: 'long', month: 'short', day: 'numeric',
          })}
        </span>

        {/* Theme toggle */}
        <button
          onClick={toggle}
          aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
          className="w-9 h-9 flex items-center justify-center rounded-lg
                     text-slate-500 dark:text-slate-400
                     hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
        >
          {theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
        </button>
      </div>
    </header>
  );
}
