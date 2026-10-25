'use client';

import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { CheckCircle2, AlertTriangle, XCircle, Info, X } from 'lucide-react';

export type ToastTone = 'success' | 'warn' | 'error' | 'info';

export interface ToastMessage {
  id: string;
  tone: ToastTone;
  title: string;
  description?: string;
}

interface ToastContextType {
  toast: (options: { tone?: ToastTone; title: string; description?: string }) => void;
}

const ToastContext = createContext<ToastContextType | null>(null);

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [activeToast, setActiveToast] = useState<ToastMessage | null>(null);

  const toast = useCallback(
    ({
      tone = 'info',
      title,
      description,
    }: {
      tone?: ToastTone;
      title: string;
      description?: string;
    }) => {
      const id = crypto.randomUUID();
      setActiveToast({ id, tone, title, description });
    },
    [],
  );

  useEffect(() => {
    if (!activeToast) return;
    const timer = setTimeout(() => {
      setActiveToast(null);
    }, 4000);
    return () => clearTimeout(timer);
  }, [activeToast]);

  const IconComponent =
    activeToast?.tone === 'success'
      ? CheckCircle2
      : activeToast?.tone === 'warn'
        ? AlertTriangle
        : activeToast?.tone === 'error'
          ? XCircle
          : Info;

  const toneBorderColor =
    activeToast?.tone === 'success'
      ? 'border-[var(--ok)]'
      : activeToast?.tone === 'warn'
        ? 'border-[var(--warn)]'
        : activeToast?.tone === 'error'
          ? 'border-[var(--danger)]'
          : 'border-[var(--line-strong)]';

  return (
    <ToastContext.Provider value={{ toast }}>
      {children}
      {activeToast && (
        <div
          role="status"
          aria-live="polite"
          className="fixed bottom-5 right-5 z-50 flex items-start gap-3 w-80 max-w-[calc(100vw-40px)] rounded-lg border bg-[var(--surface)] p-3.5 shadow-[0_8px_24px_rgba(27,36,48,0.12),0_0_0_1px_var(--line)] transition-all duration-150 animate-in fade-in slide-in-from-bottom-2"
        >
          <div
            className={`mt-0.5 rounded-full p-0.5 shrink-0 ${toneBorderColor}`}
          >
            <IconComponent
              className={`w-4 h-4 ${
                activeToast.tone === 'success'
                  ? 'text-[var(--ok)]'
                  : activeToast.tone === 'warn'
                    ? 'text-[var(--warn)]'
                    : activeToast.tone === 'error'
                      ? 'text-[var(--danger)]'
                      : 'text-[var(--accent)]'
              }`}
            />
          </div>
          <div className="flex-1 space-y-0.5 text-left">
            <p className="text-xs font-semibold text-[var(--ink)]">
              {activeToast.title}
            </p>
            {activeToast.description && (
              <p className="text-xs text-[var(--ink-muted)]">
                {activeToast.description}
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={() => setActiveToast(null)}
            className="text-[var(--ink-muted)] hover:text-[var(--ink)] transition-colors p-0.5 rounded"
            aria-label="Tutup notifikasi"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast harus dipakai di dalam ToastProvider.');
  }
  return context;
}
