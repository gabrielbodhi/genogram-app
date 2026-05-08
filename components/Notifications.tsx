'use client';

import React from 'react';
import { useNotifications } from '@/lib/store/notifications';
import { X, AlertTriangle, Info, CheckCircle2, AlertCircle } from 'lucide-react';

const ICONS = {
  info: Info,
  success: CheckCircle2,
  warning: AlertTriangle,
  error: AlertCircle,
} as const;

const STYLES: Record<string, string> = {
  info: 'border-sky-200 bg-sky-50 text-sky-800',
  success: 'border-emerald-200 bg-emerald-50 text-emerald-800',
  warning: 'border-amber-200 bg-amber-50 text-amber-800',
  error: 'border-red-200 bg-red-50 text-red-800',
};

export default function Notifications() {
  const items = useNotifications((s) => s.items);
  const dismiss = useNotifications((s) => s.dismiss);

  if (items.length === 0) return null;

  return (
    <div className="pointer-events-none fixed bottom-4 right-4 z-50 flex w-full max-w-sm flex-col gap-2">
      {items.map((it) => {
        const Icon = ICONS[it.level];
        return (
          <div
            key={it.id}
            className={`pointer-events-auto flex items-start gap-2 rounded-md border px-3 py-2 shadow-md ${STYLES[it.level]}`}
            role={it.level === 'error' ? 'alert' : 'status'}
          >
            <Icon className="mt-0.5 h-4 w-4 shrink-0" />
            <div className="flex-1 text-sm leading-snug">{it.message}</div>
            <button
              onClick={() => dismiss(it.id)}
              className="rounded p-0.5 opacity-60 hover:opacity-100"
              aria-label="Dismiss"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        );
      })}
    </div>
  );
}
