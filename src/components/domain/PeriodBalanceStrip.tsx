import React from 'react';
import { formatRupiah } from '@/lib/format';
import { Badge } from '@/components/ui/Badge';

export interface PeriodBalanceStripProps {
  periodLabel: string;
  periodStatus: 'open' | 'locked';
  openingBalance: bigint;
  totalDebit: bigint;
  totalCredit: bigint;
  closingBalance: bigint;
  compact?: boolean;
  draftCount?: number;
}

/**
 * Strip persamaan saldo periode satu dapur (`DESIGN.md` §5.2):
 * `Saldo awal + Dana masuk − Dana keluar = Saldo akhir`.
 * Seluruh angka menggunakan `tabular-nums` dan diformat melalui `formatRupiah`.
 */
export function PeriodBalanceStrip({
  periodLabel,
  periodStatus,
  openingBalance,
  totalDebit,
  totalCredit,
  closingBalance,
  compact = false,
  draftCount = 0,
}: PeriodBalanceStripProps) {
  return (
    <section
      aria-label={`Ringkasan saldo periode ${periodLabel}`}
      aria-live="polite"
      className="rounded-lg border border-line-subtle bg-surface p-4"
    >
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2 border-b border-line-subtle pb-2.5">
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold text-ink-secondary">
            Persamaan Saldo Periode — {periodLabel}
          </span>
          <Badge tone={periodStatus === 'locked' ? 'neutral' : 'accent'}>
            {periodStatus === 'locked' ? 'Periode Terkunci' : 'Periode Terbuka'}
          </Badge>
        </div>
        <p className="text-xs text-ink-muted">
          Hanya transaksi yang sudah disimpan di buku kas yang dihitung dalam
          saldo periode.
          {draftCount > 0 ? ` (${draftCount} draf belum disimpan)` : ''}
        </p>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-md border border-line-subtle bg-surface-subtle px-3.5 py-2.5">
          <div className="text-xs text-ink-secondary">
            Saldo awal ({periodLabel})
          </div>
          <div
            className={`mt-1 font-semibold tabular-nums text-ink-primary ${
              compact ? 'text-base' : 'text-lg'
            }`}
          >
            {formatRupiah(openingBalance)}
          </div>
        </div>

        <div className="rounded-md border border-line-subtle bg-surface-subtle px-3.5 py-2.5">
          <div className="flex items-center justify-between text-xs text-ink-secondary">
            <span>+ Dana masuk (Debit)</span>
            <span className="font-mono text-debit">+</span>
          </div>
          <div
            className={`mt-1 font-semibold tabular-nums text-debit ${
              compact ? 'text-base' : 'text-lg'
            }`}
          >
            {formatRupiah(totalDebit)}
          </div>
        </div>

        <div className="rounded-md border border-line-subtle bg-surface-subtle px-3.5 py-2.5">
          <div className="flex items-center justify-between text-xs text-ink-secondary">
            <span>− Dana keluar (Kredit)</span>
            <span className="font-mono text-credit">−</span>
          </div>
          <div
            className={`mt-1 font-semibold tabular-nums text-credit ${
              compact ? 'text-base' : 'text-lg'
            }`}
          >
            {formatRupiah(totalCredit)}
          </div>
        </div>

        <div className="rounded-md border border-line-strong bg-accent-subtle px-3.5 py-2.5">
          <div className="flex items-center justify-between text-xs font-medium text-accent-primary">
            <span>= Saldo akhir (Sisa uang)</span>
            <span className="font-mono">=</span>
          </div>
          <div
            data-testid="period-closing-balance"
            className={`mt-1 font-semibold tabular-nums text-ink-primary ${
              compact ? 'text-base' : 'text-xl'
            }`}
          >
            {formatRupiah(closingBalance)}
          </div>
        </div>
      </div>
    </section>
  );
}
