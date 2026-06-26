'use client';

import { useEffect } from 'react';

type InlineToastProps = {
  message: string;
  tone?: 'success' | 'error' | 'info';
  onDismiss?: () => void;
  autoHideMs?: number;
};

const toneClasses = {
  success: 'border-emerald-200 bg-emerald-50 text-emerald-900',
  error: 'border-red-200 bg-red-50 text-red-900',
  info: 'border-blue-200 bg-blue-50 text-blue-900',
};

export default function InlineToast({
  message,
  tone = 'success',
  onDismiss,
  autoHideMs = 4500,
}: InlineToastProps) {
  useEffect(() => {
    if (!onDismiss || autoHideMs <= 0) return;
    const timer = window.setTimeout(onDismiss, autoHideMs);
    return () => window.clearTimeout(timer);
  }, [message, onDismiss, autoHideMs]);

  return (
    <div
      role="status"
      aria-live="polite"
      className={`fixed bottom-5 left-1/2 z-[100] w-[min(92vw,24rem)] -translate-x-1/2 rounded-2xl border px-4 py-3 text-sm font-medium shadow-lg ${toneClasses[tone]}`}
    >
      <div className="flex items-start justify-between gap-3">
        <span>{message}</span>
        {onDismiss && (
          <button
            type="button"
            onClick={onDismiss}
            className="shrink-0 rounded-md px-1 text-xs opacity-70 hover:opacity-100"
            aria-label="Dismiss notification"
          >
            ✕
          </button>
        )}
      </div>
    </div>
  );
}