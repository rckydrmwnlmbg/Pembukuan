'use client';

import React from 'react';
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from '@/components/ui/Table';
import { Badge } from '@/components/ui/Badge';
import { formatLedgerCellAmount, formatTxDate, formatRupiah } from '@/lib/format';
import type { SerializedLedgerRow } from '@/components/domain/LedgerWorkspace';

export interface LedgerTableProps {
  rows: readonly SerializedLedgerRow[];
  openingBalance: bigint;
  closingBalance: bigint;
  year: number;
  month: number;
  isTransitioned?: boolean;
  onRowClick?: (row: SerializedLedgerRow) => void;
  selectedRowId?: string | null;
  className?: string;
}

function getOpeningRowDescription(
  year: number,
  month: number,
  isTransitioned: boolean = false,
): string {
  const months = [
    'JANUARI',
    'FEBRUARI',
    'MARET',
    'APRIL',
    'MEI',
    'JUNI',
    'JULI',
    'AGUSTUS',
    'SEPTEMBER',
    'OKTOBER',
    'NOVEMBER',
    'DESEMBER',
  ];
  if (isTransitioned) {
    const prevMonthIdx = month === 1 ? 11 : month - 2;
    const prevYear = month === 1 ? year - 1 : year;
    return `PERPINDAHAN SALDO ${months[prevMonthIdx]} ${prevYear}`;
  }
  const currentMonthIdx = Math.max(0, Math.min(11, month - 1));
  return `SALDO AWAL PEMBUKUAN ${months[currentMonthIdx]} ${year}`;
}

/**
 * Komponen Tabel Buku Kas Enterprise (DESIGN.md §5.3 & Excel Template).
 * - Header 40px, latar --surface-muted, teks 12/16 bobot 500
 * - Baris 44px, tanpa zebra, hover latar --surface-muted
 * - Kolom angka rata kanan, tabular, nilai nol dikosongkan ("")
 * - Baris pertama: PERPINDAHAN SALDO (NO = 1)
 * - Baris penutup: SISA UANG dengan saldo akhir
 */
export function LedgerTable({
  rows,
  openingBalance,
  closingBalance,
  year,
  month,
  isTransitioned = false,
  onRowClick,
  selectedRowId,
  className = '',
}: LedgerTableProps) {
  const openingDesc = getOpeningRowDescription(year, month, isTransitioned);
  const openingDateIso = `${year}-${String(month).padStart(2, '0')}-01`;

  return (
    <div
      className={`rounded-lg border border-[var(--line)] bg-[var(--surface)] overflow-hidden ${className}`.trim()}
    >
      <Table>
        <TableHeader>
          <tr>
            <TableHead stickyLeft className="w-12 text-center">
              NO
            </TableHead>
            <TableHead className="w-28">TANGGAL</TableHead>
            <TableHead className="w-36">NO. REFERENCE</TableHead>
            <TableHead>DESKRIPSI</TableHead>
            <TableHead alignRight className="w-32">
              DEBIT
            </TableHead>
            <TableHead alignRight className="w-32">
              KREDIT
            </TableHead>
            <TableHead alignRight className="w-36">
              TOTAL
            </TableHead>
          </tr>
        </TableHeader>
        <TableBody>
          {/* Baris 1: SALDO AWAL PEMBUKUAN (NO = 1) */}
          <TableRow className="bg-[var(--surface-muted)]/50 font-medium">
            <TableCell stickyLeft alignCenter tabular className="text-[var(--ink-muted)]">
              1
            </TableCell>
            <TableCell tabular>{formatTxDate(openingDateIso)}</TableCell>
            <TableCell className="text-[var(--ink-subtle)]">—</TableCell>
            <TableCell className="font-semibold text-[var(--ink)]">
              {openingDesc}
            </TableCell>
            <TableCell alignRight tabular>
              {formatLedgerCellAmount(openingBalance)}
            </TableCell>
            <TableCell alignRight tabular>
              —
            </TableCell>
            <TableCell alignRight tabular className="font-semibold text-[var(--ink)]">
              {formatRupiah(openingBalance)}
            </TableCell>
          </TableRow>

          {/* Baris Transaksi Aktual (NO = 2..N) */}
          {rows.map((row, idx) => {
            const rowNo = idx + 2;
            const isVoid = row.status === 'void';
            const isSelected = row.id === selectedRowId;
            const debitBig = BigInt(row.debit);
            const creditBig = BigInt(row.credit);
            const runningBig = BigInt(row.runningBalance);

            return (
              <TableRow
                key={row.id}
                selected={isSelected}
                onClick={() => onRowClick?.(row)}
                className={`cursor-pointer ${isVoid ? 'opacity-50 line-through' : ''}`}
              >
                <TableCell stickyLeft alignCenter tabular className="text-[var(--ink-muted)]">
                  {rowNo}
                </TableCell>
                <TableCell tabular>{formatTxDate(row.txDate)}</TableCell>
                <TableCell tabular className="text-[var(--ink-muted)]">
                  {row.referenceNo ?? '—'}
                </TableCell>
                <TableCell className="max-w-md truncate">
                  <div className="flex items-center gap-2">
                    <span className="truncate">{row.description}</span>
                    {isVoid && <Badge tone="danger">Dibatalkan</Badge>}
                    {row.kind === 'admin_fee' && (
                      <Badge tone="neutral">Biaya admin</Badge>
                    )}
                  </div>
                </TableCell>
                <TableCell alignRight tabular>
                  {formatLedgerCellAmount(debitBig)}
                </TableCell>
                <TableCell alignRight tabular>
                  {formatLedgerCellAmount(creditBig)}
                </TableCell>
                <TableCell alignRight tabular className="font-medium">
                  {isVoid ? '—' : formatRupiah(runningBig)}
                </TableCell>
              </TableRow>
            );
          })}

          {/* Baris SISA UANG (DESIGN.md §5.3) */}
          <TableRow className="bg-[var(--neutral-subtle)] font-bold border-t-2 border-t-[var(--line-strong)]">
            <TableCell
              stickyLeft
              colSpan={4}
              className="text-right uppercase tracking-wider text-[var(--ink)] pr-4"
            >
              SISA UANG
            </TableCell>
            <TableCell alignRight tabular colSpan={3} className="text-base text-[var(--ink)]">
              {formatRupiah(closingBalance)}
            </TableCell>
          </TableRow>
        </TableBody>
      </Table>
    </div>
  );
}
