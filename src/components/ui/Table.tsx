'use client';

import React from 'react';

export function Table({
  className = '',
  children,
  ...props
}: React.TableHTMLAttributes<HTMLTableElement>) {
  return (
    <div className="w-full overflow-x-auto">
      <table
        className={`w-full text-left text-xs border-collapse ${className}`.trim()}
        {...props}
      >
        {children}
      </table>
    </div>
  );
}

export function TableHeader({
  className = '',
  children,
  ...props
}: React.HTMLAttributes<HTMLTableSectionElement>) {
  return (
    <thead
      className={`h-10 bg-[var(--surface-muted)] text-[var(--ink-muted)] border-b border-[var(--line)] font-medium sticky top-0 z-10 ${className}`.trim()}
      {...props}
    >
      {children}
    </thead>
  );
}

export function TableBody({
  className = '',
  children,
  ...props
}: React.HTMLAttributes<HTMLTableSectionElement>) {
  return (
    <tbody className={`divide-y divide-[var(--line)] ${className}`.trim()} {...props}>
      {children}
    </tbody>
  );
}

export interface TableRowProps extends React.HTMLAttributes<HTMLTableRowElement> {
  selected?: boolean;
}

export function TableRow({
  selected = false,
  className = '',
  children,
  ...props
}: TableRowProps) {
  return (
    <tr
      className={`h-11 transition-colors hover:bg-[var(--surface-muted)] ${
        selected
          ? 'bg-[var(--accent-subtle)] border-l-2 border-l-[var(--accent)]'
          : ''
      } ${className}`.trim()}
      {...props}
    >
      {children}
    </tr>
  );
}

export interface TableHeadProps
  extends React.ThHTMLAttributes<HTMLTableCellElement> {
  alignRight?: boolean;
  alignCenter?: boolean;
  stickyLeft?: boolean;
}

export function TableHead({
  alignRight = false,
  alignCenter = false,
  stickyLeft = false,
  className = '',
  children,
  ...props
}: TableHeadProps) {
  return (
    <th
      scope="col"
      className={`px-3 py-2 text-xs font-medium text-[var(--ink-muted)] whitespace-nowrap ${
        alignRight ? 'text-right' : alignCenter ? 'text-center' : 'text-left'
      } ${
        stickyLeft ? 'sticky left-0 bg-[var(--surface-muted)] z-20' : ''
      } ${className}`.trim()}
      {...props}
    >
      {children}
    </th>
  );
}

export interface TableCellProps
  extends React.TdHTMLAttributes<HTMLTableCellElement> {
  alignRight?: boolean;
  alignCenter?: boolean;
  tabular?: boolean;
  stickyLeft?: boolean;
}

export function TableCell({
  alignRight = false,
  alignCenter = false,
  tabular = false,
  stickyLeft = false,
  className = '',
  children,
  ...props
}: TableCellProps) {
  return (
    <td
      className={`px-3 py-2.5 text-xs text-[var(--ink)] whitespace-nowrap ${
        alignRight ? 'text-right' : alignCenter ? 'text-center' : 'text-left'
      } ${tabular ? 'tabular-nums font-mono' : ''} ${
        stickyLeft ? 'sticky left-0 bg-[var(--surface)] z-10' : ''
      } ${className}`.trim()}
      {...props}
    >
      {children}
    </td>
  );
}
