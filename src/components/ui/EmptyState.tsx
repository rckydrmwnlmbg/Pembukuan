'use client';

import React from 'react';
import { Button } from './Button';

export interface EmptyStateProps {
  title: string;
  description: string;
  actionLabel?: string;
  onAction?: () => void;
  className?: string;
}

/**
 * Komponen Kondisi Kosong Enterprise (DESIGN.md §5.6).
 * Ajakan bertindak konkret, tanpa ilustrasi kartun, tanpa koin 3D.
 */
export function EmptyState({
  title,
  description,
  actionLabel,
  onAction,
  className = '',
}: EmptyStateProps) {
  return (
    <div
      className={`rounded-lg border border-[var(--line)] bg-[var(--surface)] p-8 text-center space-y-3 ${className}`.trim()}
    >
      <div className="max-w-md mx-auto space-y-1">
        <h3 className="text-sm font-semibold text-[var(--ink)]">{title}</h3>
        <p className="text-xs text-[var(--ink-muted)] leading-relaxed">
          {description}
        </p>
      </div>

      {actionLabel && onAction && (
        <div className="pt-2">
          <Button variant="primary" size="sm" onClick={onAction}>
            {actionLabel}
          </Button>
        </div>
      )}
    </div>
  );
}
