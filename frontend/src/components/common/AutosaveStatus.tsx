import { Check, AlertCircle, Loader2 } from 'lucide-react';

interface AutosaveStatusProps {
  isSaving: boolean;
  lastSaved: Date | null;
  error: string | null;
  onRetry?: () => void;
}

export function AutosaveStatus({
  isSaving,
  lastSaved,
  error,
  onRetry,
}: AutosaveStatusProps) {
  if (error) {
    return (
      <div className="flex items-center gap-2 px-2.5 py-1.5 bg-red-50 border border-red-200 rounded-lg text-xs">
        <AlertCircle size={13} className="text-red-600 flex-shrink-0" />
        <span className="text-red-700">{error}</span>
        {onRetry && (
          <button
            onClick={onRetry}
            className="text-red-600 font-medium hover:text-red-700 ml-auto"
          >
            Retry
          </button>
        )}
      </div>
    );
  }

  if (isSaving) {
    return (
      <div className="flex items-center gap-2 px-2.5 py-1.5 bg-blue-50 border border-blue-200 rounded-lg text-xs">
        <Loader2 size={13} className="text-blue-600 animate-spin flex-shrink-0" />
        <span className="text-blue-700">Saving...</span>
      </div>
    );
  }

  if (lastSaved) {
    const now = new Date();
    const diff = Math.floor((now.getTime() - lastSaved.getTime()) / 1000);
    let timeText = 'just now';
    if (diff >= 60) timeText = `${Math.floor(diff / 60)}m ago`;
    else if (diff > 0) timeText = `${diff}s ago`;

    return (
      <div className="flex items-center gap-2 px-2.5 py-1.5 bg-emerald-50 border border-emerald-200 rounded-lg text-xs">
        <Check size={13} className="text-emerald-600 flex-shrink-0" />
        <span className="text-emerald-700">Saved {timeText}</span>
      </div>
    );
  }

  return null;
}
