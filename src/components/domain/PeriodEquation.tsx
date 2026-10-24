'use client';

import React from 'react';
import Link from 'next/link';
import { Lock, Unlock, AlertTriangle } from 'lucide-react';
import { formatRupiah } from '@/lib/format';

export interface PeriodEquationProps {
  kitchenId: string;
  periodStatus: 'open' | 'locked';
  openingBalance: bigint;
  totalIncoming: bigint;
  totalOutgoing: bigint;
  closingBalance: bigint;
  incomingCount?: number;
  outgoingCount?: number;
  periodStartDate?: string;
  lastTxDate?: string;
  draftCount?: number;
  variant?: 'full' | 'compact';
  onLockClick?: () => void;
  canLock?: boolean;
}

/**
 * Komponen strip persamaan saldo periode (elemen khas Kasdapur — DESIGN.md 8.1).
 * Saldo awal + Dana masuk − Dana keluar = Saldo akhir.
 * Isolasi ketat per dapur; saldo hanya menghitung transaksi yang sudah diposting.
 */
export function PeriodEquation({
  kitchenId,
  periodStatus,
  openingBalance,
  totalIncoming,
  totalOutgoing,
  closingBalance,
  incomingCount = 0,
  outgoingCount = 0,
  periodStartDate = '1 Mar 2026',
  lastTxDate,
  draftCount = 0,
  variant = 'full',
  onLockClick,
  canLock = false,
}: PeriodEquationProps) {
  const isLocked = periodStatus === 'locked';

  if (variant === 'compact') {
    return (
      <div className="w-full bg-[var(--surface)] border border-[var(--line)] rounded-md px-3 py-2 text-xs flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-x-2 text-[var(--ink-muted)]">
          <span>
            Awal: <span className="font-medium tabular-nums text-[var(--ink-base)]">{formatRupiah(openingBalance)}</span>
          </span>
          <span className="text-[var(--ink-subtle)] font-medium">+</span>
          <span>
            Masuk: <span className="font-medium tabular-nums text-[var(--ink-base)]">{formatRupiah(totalIncoming)}</span>
          </span>
          <span className="text-[var(--ink-subtle)] font-medium">−</span>
          <span>
            Keluar: <span className="font-medium tabular-nums text-[var(--ink-base)]">{formatRupiah(totalOutgoing)}</span>
          </span>
          <span className="text-[var(--ink-subtle)] font-medium">=</span>
          <span className="font-semibold text-[var(--ink-base)]">
            Akhir:{' '}
            <span className="tabular-nums text-sm text-[var(--ink-base)]" aria-live="polite">
              {formatRupiah(closingBalance)}
            </span>
          </span>
        </div>

        <div className="flex items-center gap-2">
          {draftCount > 0 && (
            <Link
              href={`/k/${kitchenId}/review`}
              className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] bg-[var(--warning-subtle)] text-[var(--warning-text,inherit)] border border-[var(--warning)] hover:underline"
              title={`${draftCount} draf belum dihitung ke saldo`}
            >
              <AlertTriangle className="w-3 h-3 text-[var(--warning)]" />
              <span>{draftCount} draf</span>
            </Link>
          )}

          <span
            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium border ${
              isLocked
                ? 'bg-[var(--neutral-subtle)] text-[var(--ink-muted)] border-[var(--line)]'
                : 'bg-[var(--surface)] text-[var(--ink-muted)] border-[var(--line)]'
            }`}
          >
            {isLocked ? (
              <>
                <Lock className="w-3 h-3" />
                <span>Terkunci</span>
              </>
            ) : (
              <>
                <Unlock className="w-3 h-3 text-[var(--ink-subtle)]" />
                <span>Terbuka</span>
              </>
            )}
          </span>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full bg-[var(--surface)] border border-[var(--line)] rounded-lg p-5 sm:p-6">
      <div className="grid grid-cols-1 md:grid-cols-7 items-center gap-y-4 text-center md:text-left">
        {/* 1. Saldo Awal */}
        <div className="md:col-span-1 space-y-1">
          <div className="text-[13px] text-[var(--ink-muted)]">Saldo awal</div>
          <div className="text-xl sm:text-2xl font-medium tabular-nums text-[var(--ink-base)]">
            {formatRupiah(openingBalance)}
          </div>
          <div className="text-xs text-[var(--ink-subtle)]">{periodStartDate}</div>
        </div>

        {/* Operator + */}
        <div className="md:col-span-1 flex items-center justify-center text-xl sm:text-2xl text-[var(--ink-subtle)] font-medium">
          +
        </div>

        {/* 2. Dana Masuk */}
        <div className="md:col-span-1 space-y-1">
          <div className="text-[13px] text-[var(--ink-muted)]">Dana masuk</div>
          <div className="text-xl sm:text-2xl font-medium tabular-nums text-[var(--ink-base)]">
            {formatRupiah(totalIncoming)}
          </div>
          <div className="text-xs text-[var(--ink-subtle)]">
            {incomingCount} transaksi
          </div>
        </div>

        {/* Operator − */}
        <div className="md:col-span-1 flex items-center justify-center text-xl sm:text-2xl text-[var(--ink-subtle)] font-medium">
          −
        </div>

        {/* 3. Dana Keluar */}
        <div className="md:col-span-1 space-y-1">
          <div className="text-[13px] text-[var(--ink-muted)]">Dana keluar</div>
          <div className="text-xl sm:text-2xl font-medium tabular-nums text-[var(--ink-base)]">
            {formatRupiah(totalOutgoing)}
          </div>
          <div className="text-xs text-[var(--ink-subtle)]">
            {outgoingCount} transaksi
          </div>
        </div>

        {/* Operator = */}
        <div className="md:col-span-1 flex items-center justify-center text-xl sm:text-2xl text-[var(--ink-subtle)] font-medium">
          =
        </div>

        {/* 4. Saldo Akhir */}
        <div className="md:col-span-1 space-y-1.5" aria-live="polite">
          <div className="flex items-center justify-between md:justify-start gap-2">
            <span className="text-[13px] text-[var(--ink-muted)]">Saldo akhir</span>
            <span
              className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium border ${
                isLocked
                  ? 'bg-[var(--neutral-subtle)] text-[var(--ink-muted)] border-[var(--line)]'
                  : 'bg-[var(--surface)] text-[var(--ink-muted)] border-[var(--line)]'
              }`}
            >
              {isLocked ? (
                <>
                  <Lock className="w-3 h-3" />
                  <span>Terkunci</span>
                </>
              ) : (
                <>
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-600 dark:bg-emerald-400 inline-block" />
                  <span>Terbuka</span>
                </>
              )}
            </span>
          </div>

          <div className="text-xl sm:text-2xl font-medium tabular-nums text-[var(--ink-base)] transition-colors duration-200">
            {formatRupiah(closingBalance)}
          </div>

          <div className="flex items-center justify-between text-xs text-[var(--ink-subtle)]">
            <span>{lastTxDate ? `per ${lastTxDate}` : 'akhir periode'}</span>
            {!isLocked && canLock && onLockClick && (
              <button
                type="button"
                onClick={onLockClick}
                className="text-xs font-medium text-[var(--accent)] hover:underline ml-2"
              >
                Kunci
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Baris Keterangan Draf (DESIGN.md 8.1) */}
      {draftCount > 0 && (
        <div className="mt-4 border-l-2 border-[var(--warning)] bg-[var(--warning-subtle)] px-3 py-2 text-xs text-[var(--ink-base)] rounded-r flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-[var(--warning)] shrink-0" />
            <span>
              <strong>{draftCount} draf</strong> belum dihitung.
            </span>
          </div>
          <Link
            href={`/k/${kitchenId}/review`}
            className="font-medium text-[var(--accent)] underline ml-2 hover:opacity-80"
          >
            Tinjau
          </Link>
        </div>
      )}
    </div>
  );
}
