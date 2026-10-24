import React from 'react';

export type BadgeTone =
  | 'neutral'
  | 'accent'
  | 'debit'
  | 'credit'
  | 'warning'
  | 'danger'
  | 'info';

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  tone?: BadgeTone;
}

const TONE_CLASSES: Record<BadgeTone, string> = {
  neutral: 'bg-surface-subtle text-ink-secondary border-line-subtle',
  accent: 'bg-accent-subtle text-accent-primary border-line-subtle',
  debit: 'bg-debit-subtle text-debit border-line-subtle',
  credit: 'bg-credit-subtle text-credit border-line-subtle',
  warning: 'bg-warning-subtle text-warning border-line-subtle',
  danger: 'bg-danger-subtle text-danger border-line-subtle',
  info: 'bg-info-subtle text-info border-line-subtle',
};

export function Badge({
  tone = 'neutral',
  className = '',
  children,
  ...props
}: BadgeProps) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-sm border px-2 py-0.5 text-xs font-medium ${TONE_CLASSES[tone]} ${className}`.trim()}
      {...props}
    >
      {children}
    </span>
  );
}
