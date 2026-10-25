'use client';

import React from 'react';

export interface SkeletonProps extends React.HTMLAttributes<HTMLDivElement> {
  className?: string;
}

/**
 * Komponen Skeleton Shimmer (DESIGN.md §3.6).
 * Menggambarkan bentuk nyata konten yang sedang dimuat, bukan spinner acak.
 */
export function Skeleton({ className = '', ...props }: SkeletonProps) {
  return (
    <div
      aria-hidden="true"
      className={`animate-pulse rounded-md bg-[var(--line)]/60 ${className}`.trim()}
      {...props}
    />
  );
}
