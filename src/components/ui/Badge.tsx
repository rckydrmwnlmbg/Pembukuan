'use client';

import React from 'react';
import {
  CheckCircle,
  AlertTriangle,
  XCircle,
  Lock,
  Clock,
  HelpCircle,
} from 'lucide-react';

export type BadgeTone =
  | 'ok'
  | 'warn'
  | 'warning'
  | 'danger'
  | 'neutral'
  | 'locked'
  | 'accent'
  | 'debit'
  | 'credit'
  | 'info';

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  tone?: BadgeTone;
  showIcon?: boolean;
}

const TONE_CONFIG: Record<
  BadgeTone,
  {
    classes: string;
    DefaultIcon: React.ComponentType<{ className?: string }>;
  }
> = {
  ok: {
    classes:
      'bg-[var(--ok-subtle)] text-[var(--ok)] border border-[var(--ok)]/30',
    DefaultIcon: CheckCircle,
  },
  warn: {
    classes:
      'bg-[var(--warn-subtle)] text-[var(--warn)] border border-[var(--warn)]/40',
    DefaultIcon: AlertTriangle,
  },
  warning: {
    classes:
      'bg-[var(--warn-subtle)] text-[var(--warn)] border border-[var(--warn)]/40',
    DefaultIcon: AlertTriangle,
  },
  danger: {
    classes:
      'bg-[var(--danger-subtle)] text-[var(--danger)] border border-[var(--danger)]/30',
    DefaultIcon: XCircle,
  },
  neutral: {
    classes:
      'bg-[var(--surface-muted)] text-[var(--ink-muted)] border border-[var(--line)]',
    DefaultIcon: Clock,
  },
  locked: {
    classes:
      'bg-[var(--neutral-subtle)] text-[var(--ink)] border border-[var(--line)]',
    DefaultIcon: Lock,
  },
  accent: {
    classes:
      'bg-[var(--accent-subtle)] text-[var(--accent)] border border-[var(--accent-line)]',
    DefaultIcon: HelpCircle,
  },
  debit: {
    classes:
      'bg-[var(--ok-subtle)] text-[var(--ok)] border border-[var(--ok)]/30',
    DefaultIcon: CheckCircle,
  },
  credit: {
    classes:
      'bg-[var(--surface-muted)] text-[var(--ink-muted)] border border-[var(--line)]',
    DefaultIcon: Clock,
  },
  info: {
    classes:
      'bg-[var(--accent-subtle)] text-[var(--accent)] border border-[var(--accent-line)]',
    DefaultIcon: HelpCircle,
  },
};

/**
 * Komponen Badge Status Enterprise (DESIGN.md §5.4).
 * Tinggi 22px, radius 4px, teks 12/16 bobot 500, ikon + teks (tidak warna saja).
 */
export function Badge({
  tone = 'neutral',
  showIcon = true,
  className = '',
  children,
  ...props
}: BadgeProps) {
  const config = TONE_CONFIG[tone];
  const Icon = config.DefaultIcon;

  return (
    <span
      className={`inline-flex items-center gap-1.5 h-[22px] rounded-[4px] px-2 text-xs font-medium tabular-nums ${config.classes} ${className}`.trim()}
      {...props}
    >
      {showIcon && <Icon className="w-3 h-3 shrink-0" aria-hidden="true" />}
      <span>{children}</span>
    </span>
  );
}
