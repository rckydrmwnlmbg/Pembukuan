'use client';

import React from 'react';
import { Loader2 } from 'lucide-react';

export type ButtonVariant =
  | 'primary'
  | 'secondary'
  | 'ghost'
  | 'tertiary'
  | 'danger';
export type ButtonSize = 'sm' | 'md' | 'login';

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
}

const VARIANT_CLASSES: Record<ButtonVariant, string> = {
  primary:
    'bg-[var(--accent)] text-[var(--ink-on-accent,#fff)] border border-transparent hover:bg-[var(--accent-hover)] active:bg-[var(--accent-press)] shadow-none',
  secondary:
    'bg-[var(--surface)] text-[var(--ink)] border border-[var(--line-strong)] hover:bg-[var(--surface-muted)] active:bg-[var(--neutral-subtle)] shadow-none',
  ghost:
    'bg-transparent text-[var(--ink-muted)] border border-transparent hover:bg-[var(--surface-muted)] hover:text-[var(--ink)] active:bg-[var(--neutral-subtle)] shadow-none',
  tertiary:
    'bg-transparent text-[var(--ink-muted)] border border-transparent hover:bg-[var(--surface-muted)] hover:text-[var(--ink)] active:bg-[var(--neutral-subtle)] shadow-none',
  danger:
    'bg-[var(--surface)] text-[var(--danger)] border border-[var(--danger)] hover:bg-[var(--danger-subtle)] active:opacity-90 shadow-none',
};

const SIZE_CLASSES: Record<ButtonSize, string> = {
  sm: 'h-8 px-2.5 text-xs',
  md: 'h-9 px-3.5 text-sm',
  login: 'h-10 px-4 text-sm w-full',
};

/**
 * Komponen Tombol Enterprise Kasdapur (DESIGN.md §5.1).
 * Label berupa kata kerja spesifik, tanpa panah '→', radius 6px.
 */
export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  function Button(
    {
      variant = 'secondary',
      size = 'md',
      loading = false,
      disabled,
      className = '',
      type = 'button',
      children,
      ...props
    },
    ref,
  ) {
    const isDisabled = disabled || loading;

    return (
      <button
        ref={ref}
        type={type}
        disabled={isDisabled}
        className={`inline-flex items-center justify-center gap-2 rounded-md font-medium transition-colors duration-150 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--focus-ring)] disabled:cursor-not-allowed disabled:opacity-50 select-none ${VARIANT_CLASSES[variant]} ${SIZE_CLASSES[size]} ${className}`.trim()}
        {...props}
      >
        {loading ? (
          <Loader2 className="w-3.5 h-3.5 animate-spin shrink-0 text-current" />
        ) : null}
        {children}
      </button>
    );
  },
);
