import { useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Bell, Menu, Moon, Sun } from 'lucide-react';
import { useTheme } from '@/hooks/useTheme';
import { notificationsApi } from '@/lib/api';
import { timeAgo } from '@/lib/utils';
import type { NotificationItem, PaginatedResponse } from '@/types';

const pageTitles: Record<string, string> = {
  '/app/dashboard':  'Dashboard',
  '/app/layout':     'System Layout',
  '/app/faults':     'Fault Reports',
  '/app/resources':  'Resources',
  '/app/reports':    'Reports',
  '/app/monitoring': 'Monitoring',
  '/app/users':      'User Privileges',
  '/app/admin-controls': 'Admin Controls',
};

interface HeaderProps {
  onSidebarToggle: () => void;
}

export default function Header({ onSidebarToggle }: HeaderProps) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { pathname } = useLocation();
  const { theme, toggle } = useTheme();
  const [openNotifs, setOpenNotifs] = useState(false);
  const notifPanelRef = useRef<HTMLDivElement | null>(null);
  const prevUnreadRef = useRef<number>(-1);
  const userInteractedRef = useRef<boolean>(false);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const title = pageTitles[pathname.replace(/\/\d+$/, '')] ?? 'NexusGrid';

  const { data: unreadPage } = useQuery<PaginatedResponse<NotificationItem>>({
    queryKey: ['notifications-unread-count'],
    queryFn: () => notificationsApi.list({ unread: true, page: 1, page_size: 1 }).then((r) => r.data),
    refetchInterval: 30_000,
  });

  const { data: notifPage } = useQuery<PaginatedResponse<NotificationItem>>({
    queryKey: ['notifications-header-list'],
    queryFn: () => notificationsApi.list({ page: 1, page_size: 20 }).then((r) => r.data),
    refetchInterval: 30_000,
  });

  const clearRead = useMutation({
    mutationFn: () => notificationsApi.clear('read'),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications-unread-count'] });
      queryClient.invalidateQueries({ queryKey: ['notifications-header-list'] });
      queryClient.invalidateQueries({ queryKey: ['notifications-dashboard'] });
    },
  });

  const clearAll = useMutation({
    mutationFn: () => notificationsApi.clear('all'),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications-unread-count'] });
      queryClient.invalidateQueries({ queryKey: ['notifications-header-list'] });
      queryClient.invalidateQueries({ queryKey: ['notifications-dashboard'] });
    },
  });

  const markRead = useMutation({
    mutationFn: (id: number) => notificationsApi.update(id, { is_read: true }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications-unread-count'] });
      queryClient.invalidateQueries({ queryKey: ['notifications-header-list'] });
      queryClient.invalidateQueries({ queryKey: ['notifications-dashboard'] });
    },
  });

  const notifications = notifPage?.results ?? [];
  const unreadCount = unreadPage?.count ?? 0;
  const readCount = Math.max(notifications.length - unreadCount, 0);

  const getAudioContext = () => {
    if (audioCtxRef.current) {
      return audioCtxRef.current;
    }
    const AudioCtor = window.AudioContext || (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtor) {
      return null;
    }
    audioCtxRef.current = new AudioCtor();
    return audioCtxRef.current;
  };

  const playNotificationChime = async () => {
    const ctx = getAudioContext();
    if (!ctx) return;

    if (ctx.state === 'suspended') {
      await ctx.resume();
    }

    const now = ctx.currentTime;
    const gain = ctx.createGain();
    gain.connect(ctx.destination);

    const osc1 = ctx.createOscillator();
    osc1.type = 'triangle';
    osc1.frequency.setValueAtTime(880, now);
    osc1.connect(gain);

    const osc2 = ctx.createOscillator();
    osc2.type = 'triangle';
    osc2.frequency.setValueAtTime(1174.66, now + 0.12);
    osc2.connect(gain);

    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(0.14, now + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.08, now + 0.12);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.32);

    osc1.start(now);
    osc1.stop(now + 0.14);
    osc2.start(now + 0.12);
    osc2.stop(now + 0.32);
  };

  useEffect(() => {
    const markInteracted = () => {
      userInteractedRef.current = true;
      const ctx = getAudioContext();
      if (ctx && ctx.state === 'suspended') {
        void ctx.resume();
      }
    };
    window.addEventListener('pointerdown', markInteracted, { once: true });
    window.addEventListener('keydown', markInteracted, { once: true });
    return () => {
      window.removeEventListener('pointerdown', markInteracted);
      window.removeEventListener('keydown', markInteracted);
    };
  }, []);

  useEffect(() => {
    if (!openNotifs) return;

    const handleOutsideClick = (event: MouseEvent) => {
      const target = event.target as Node;
      if (notifPanelRef.current && !notifPanelRef.current.contains(target)) {
        setOpenNotifs(false);
      }
    };

    window.addEventListener('mousedown', handleOutsideClick);
    return () => {
      window.removeEventListener('mousedown', handleOutsideClick);
    };
  }, [openNotifs]);

  useEffect(() => {
    const prev = prevUnreadRef.current;
    if (prev === -1) {
      prevUnreadRef.current = unreadCount;
      return;
    }

    const increased = unreadCount > prev;
    prevUnreadRef.current = unreadCount;

    if (!increased || !userInteractedRef.current || document.visibilityState !== 'visible') {
      return;
    }

    try {
      void playNotificationChime();
    } catch {
      // Ignore if audio playback is blocked by the browser.
    }
  }, [unreadCount]);

  const relationLabel: Record<NotificationItem['related_to'], string> = {
    fault_report: 'Fault Report',
    fault_status_update: 'Fault Status',
    resource_request: 'Resource Request',
    resource_status_update: 'Resource Status',
    admin_message: 'Admin Message',
    system_alert: 'System Alert',
  };

  const openNotification = async (notification: NotificationItem) => {
    if (!notification.is_read) {
      await markRead.mutateAsync(notification.id);
    }
    setOpenNotifs(false);
    navigate(notification.target_url || '/app/dashboard');
  };

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
      <div className="flex items-center gap-2 relative">
        <span className="text-xs text-slate-400 hidden sm:block">
          {new Date().toLocaleDateString('en-US', {
            weekday: 'long', month: 'short', day: 'numeric',
          })}
        </span>

        <div className="relative" ref={notifPanelRef}>
          <button
            onClick={() => setOpenNotifs((prev) => !prev)}
            aria-label="Notifications"
            className="w-9 h-9 flex items-center justify-center rounded-lg
                     text-slate-500 dark:text-slate-400
                     hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            <Bell className="w-4 h-4" />
            {unreadCount > 0 && (
              <span className="absolute -top-1 -right-1 min-w-4 h-4 px-1 rounded-full
                               bg-red-500 text-white text-[10px] leading-4 text-center">
                {unreadCount > 99 ? '99+' : unreadCount}
              </span>
            )}
          </button>

          {openNotifs && (
            <div className="absolute right-0 mt-2 w-[26rem] max-w-[90vw] card p-3 z-50 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700">
              <div className="flex items-center justify-between mb-2">
                <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">Notifications</p>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    disabled={clearRead.isPending || readCount === 0}
                    onClick={() => clearRead.mutate()}
                    className="text-xs text-brand-600 disabled:text-slate-400"
                  >
                    Clear read
                  </button>
                  <button
                    type="button"
                    disabled={clearAll.isPending || notifications.length === 0}
                    onClick={() => clearAll.mutate()}
                    className="text-xs text-red-600 disabled:text-slate-400"
                  >
                    Clear all
                  </button>
                </div>
              </div>

              {notifications.length === 0 ? (
                <p className="text-xs text-slate-500 py-2">No notifications</p>
              ) : (
                <div className="space-y-2 max-h-96 overflow-y-auto">
                  {notifications.map((n) => (
                    <button
                      key={n.id}
                      type="button"
                      onClick={() => openNotification(n)}
                      className={`w-full text-left p-3 rounded-lg border transition-colors ${
                        n.is_read
                          ? 'border-slate-200 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800'
                          : 'border-brand-200 bg-brand-50 dark:bg-brand-900 hover:bg-brand-100 dark:hover:bg-brand-800'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <span className="text-[11px] font-medium px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                          {relationLabel[n.related_to]}
                        </span>
                        <span className="text-[11px] text-slate-500 shrink-0">{timeAgo(n.created_at)}</span>
                      </div>
                      <p className="text-sm text-slate-800 dark:text-slate-100 mt-2 whitespace-normal break-words">{n.message}</p>
                      <p className="text-xs text-slate-500 mt-1">
                        {n.created_by_username ? `By ${n.created_by_username}` : 'By System'}
                        {n.related_id ? ` · Ref #${n.related_id}` : ''}
                      </p>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

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
