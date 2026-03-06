import { useState, useEffect } from 'react';
import { Download, X } from 'lucide-react';
import { isPWA } from '@/lib/pwa';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

export default function PWAInstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [showPrompt, setShowPrompt] = useState(false);

  useEffect(() => {
    // Don't show if already installed
    if (isPWA()) {
      return;
    }

    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      
      // Show prompt after a delay (better UX)
      setTimeout(() => {
        setShowPrompt(true);
      }, 3000);
    };

    window.addEventListener('beforeinstallprompt', handler);

    return () => {
      window.removeEventListener('beforeinstallprompt', handler);
    };
  }, []);

  const handleInstallClick = async () => {
    if (!deferredPrompt) return;

    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    
    console.log(`User ${outcome} the install prompt`);
    
    setDeferredPrompt(null);
    setShowPrompt(false);
  };

  const handleDismiss = () => {
    setShowPrompt(false);
    // Don't show again for this session
    sessionStorage.setItem('pwa-prompt-dismissed', 'true');
  };

  // Don't show if dismissed in this session
  if (sessionStorage.getItem('pwa-prompt-dismissed')) {
    return null;
  }

  if (!showPrompt || !deferredPrompt) {
    return null;
  }

  return (
    <div className="fixed bottom-4 right-4 z-50 animate-slide-in">
      <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-700 p-4 max-w-sm">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 bg-brand-100 dark:bg-brand-900/30 rounded-xl flex items-center justify-center shrink-0">
            <Download className="w-5 h-5 text-brand-600 dark:text-brand-400" />
          </div>
          
          <div className="flex-1">
            <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100 mb-1">
              Install NexusGrid
            </h3>
            <p className="text-xs text-slate-600 dark:text-slate-400 mb-3">
              Install our app for faster access and offline support
            </p>
            
            <div className="flex gap-2">
              <button
                onClick={handleInstallClick}
                className="flex-1 bg-brand-600 hover:bg-brand-700 text-white text-xs font-medium px-3 py-2 rounded-lg transition-colors"
              >
                Install
              </button>
              <button
                onClick={handleDismiss}
                className="px-3 py-2 text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
