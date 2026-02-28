import { AlertTriangle, RefreshCw } from 'lucide-react';

interface ErrorStateProps {
  message?: string;
  onRetry?: () => void;
}

export default function ErrorState({ message = 'Something went wrong.', onRetry }: ErrorStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-20 gap-4">
        <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center">
        <AlertTriangle className="w-6 h-6 text-red-600" />
      </div>
      <p className="text-sm text-slate-600 dark:text-slate-400">{message}</p>
      {onRetry && (
        <button onClick={onRetry} className="btn-secondary text-xs">
          <RefreshCw className="w-3.5 h-3.5" />
          Retry
        </button>
      )}
    </div>
  );
}
