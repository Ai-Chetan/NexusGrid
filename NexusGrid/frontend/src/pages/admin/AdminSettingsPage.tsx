import { useState } from 'react';
import { Settings, Activity, Shield } from 'lucide-react';
import { cn } from '@/lib/utils';
import PageHeader from '@/components/common/PageHeader';
import MonitoringConfigPanel from './MonitoringConfigPanel';
import PrivilegesConfigPanel from './PrivilegesConfigPanel';

const tabs = [
  { id: 'monitoring', label: 'Monitoring', icon: Activity },
  { id: 'privileges', label: 'Privileges', icon: Shield },
] as const;

type TabId = (typeof tabs)[number]['id'];

export default function AdminSettingsPage() {
  const [activeTab, setActiveTab] = useState<TabId>('monitoring');

  return (
    <div className="space-y-5 animate-fade-in">
      <PageHeader
        title="Admin Settings"
        description="Configure system-wide monitoring and privilege limits."
      />

      {/* Tab bar */}
      <div className="flex gap-1 p-1 bg-slate-100 dark:bg-slate-800/60 rounded-xl w-fit">
        {tabs.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            type="button"
            onClick={() => setActiveTab(id)}
            className={cn(
              'flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg transition-all',
              activeTab === id
                ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 shadow-sm'
                : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200',
            )}
          >
            <Icon className="w-4 h-4" />
            {label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div>
        {activeTab === 'monitoring' && <MonitoringConfigPanel />}
        {activeTab === 'privileges' && <PrivilegesConfigPanel />}
      </div>
    </div>
  );
}