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
      <div className="w-full bg-[var(--surface)] border border-[var(--line)] rounded-lg p-3 text-xs shadow-2xs">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-2.5">
          <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1.5 text-[var(--ink-muted)]">
            <div className="flex items-center gap-1.5">
              <span className="text-[var(--ink-subtle)]">Saldo Awal:</span>
              <span className="font-semibold tabular-nums text-[var(--ink)] whitespace-nowrap">{formatRupiah(openingBalance)}</span>
            </div>
            <span className="text-[var(--ink-subtle)] font-bold">+</span>
            <div className="flex items-center gap-1.5">
              <span className="text-[var(--ink-subtle)]">Dana Masuk:</span>
              <span className="font-semibold tabular-nums text-[var(--ok)] whitespace-nowrap">+{formatRupiah(totalIncoming)}</span>
            </div>
            <span className="text-[var(--ink-subtle)] font-bold">−</span>
            <div className="flex items-center gap-1.5">
              <span className="text-[var(--ink-subtle)]">Dana Keluar:</span>
              <span className="font-semibold tabular-nums text-[var(--ink)] whitespace-nowrap">−{formatRupiah(totalOutgoing)}</span>
            </div>
            <span className="text-[var(--ink-subtle)] font-bold">=</span>
            <div className="flex items-center gap-1.5 rounded-md bg-[var(--accent-subtle)]/40 px-2.5 py-1 border border-[var(--accent-line)]">
              <span className="font-semibold text-[var(--ink)]">Saldo Akhir:</span>
              <span className="tabular-nums font-bold text-sm text-[var(--accent)] whitespace-nowrap" aria-live="polite">
                {formatRupiah(closingBalance)}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2 self-start md:self-auto shrink-0">
            {draftCount > 0 && (
              <Link
                href={`/k/${kitchenId}/review`}
                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-semibold bg-[var(--warn-subtle)] text-[var(--warn)] border border-[var(--warn)] hover:opacity-90 transition-opacity whitespace-nowrap"
                title={`${draftCount} draf belum dihitung ke saldo`}
              >
                <AlertTriangle className="w-3.5 h-3.5 text-[var(--warn)] shrink-0" />
                <span>{draftCount} draf menunggu</span>
              </Link>
            )}

            <span
              className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-semibold border whitespace-nowrap ${
                isLocked
                  ? 'bg-[var(--surface-muted)] text-[var(--ink-muted)] border-[var(--line)]'
                  : 'bg-[var(--ok-subtle)] text-[var(--ok)] border-[var(--ok)]'
              }`}
            >
              {isLocked ? (
                <>
                  <Lock className="w-3.5 h-3.5" />
                  <span>Periode Terkunci</span>
                </>
              ) : (
                <>
                  <Unlock className="w-3.5 h-3.5" />
                  <span>Periode Terbuka</span>
                </>
              )}
            </span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full bg-[var(--surface)] border border-[var(--line)] rounded-xl p-4 sm:p-5 shadow-2xs">
      <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3 lg:gap-2">
        {/* 1. Saldo Awal */}
        <div className="flex-1 min-w-0 bg-[var(--surface-muted)]/70 rounded-lg p-3 sm:p-4 border border-[var(--line-subtle)] text-left">
          <div className="text-[11px] font-semibold text-[var(--ink-muted)] uppercase tracking-wider">Saldo awal</div>
          <div
            className="mt-1 text-lg sm:text-xl xl:text-2xl font-bold tabular-nums text-[var(--ink)] whitespace-nowrap overflow-hidden text-ellipsis"
            title={formatRupiah(openingBalance)}
          >
            {formatRupiah(openingBalance)}
          </div>
          <div className="mt-0.5 text-xs text-[var(--ink-subtle)]">{periodStartDate}</div>
        </div>

        {/* Operator + */}
        <div className="hidden lg:flex items-center justify-center shrink-0 w-6 text-xl font-bold text-[var(--ink-subtle)]">
          +
        </div>

        {/* 2. Dana Masuk */}
        <div className="flex-1 min-w-0 bg-[var(--surface-muted)]/70 rounded-lg p-3 sm:p-4 border border-[var(--line-subtle)] text-left">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold text-[var(--ink-muted)] uppercase tracking-wider">Dana masuk</span>
            <span className="lg:hidden text-xs font-bold text-[var(--ok)]">+</span>
          </div>
          <div
            className="mt-1 text-lg sm:text-xl xl:text-2xl font-bold tabular-nums text-[var(--ok)] whitespace-nowrap overflow-hidden text-ellipsis"
            title={formatRupiah(totalIncoming)}
          >
            +{formatRupiah(totalIncoming)}
          </div>
          <div className="mt-0.5 text-xs text-[var(--ink-subtle)]">{incomingCount} transaksi</div>
        </div>

        {/* Operator − */}
        <div className="hidden lg:flex items-center justify-center shrink-0 w-6 text-xl font-bold text-[var(--ink-subtle)]">
          −
        </div>

        {/* 3. Dana Keluar */}
        <div className="flex-1 min-w-0 bg-[var(--surface-muted)]/70 rounded-lg p-3 sm:p-4 border border-[var(--line-subtle)] text-left">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold text-[var(--ink-muted)] uppercase tracking-wider">Dana keluar</span>
            <span className="lg:hidden text-xs font-bold text-[var(--ink-muted)]">−</span>
          </div>
          <div
            className="mt-1 text-lg sm:text-xl xl:text-2xl font-bold tabular-nums text-[var(--ink)] whitespace-nowrap overflow-hidden text-ellipsis"
            title={formatRupiah(totalOutgoing)}
          >
            −{formatRupiah(totalOutgoing)}
          </div>
          <div className="mt-0.5 text-xs text-[var(--ink-subtle)]">{outgoingCount} transaksi</div>
        </div>

        {/* Operator = */}
        <div className="hidden lg:flex items-center justify-center shrink-0 w-6 text-xl font-bold text-[var(--ink-subtle)]">
          =
        </div>

        {/* 4. Saldo Akhir */}
        <div className="flex-1 min-w-0 bg-[var(--accent-subtle)]/40 rounded-lg p-3 sm:p-4 border border-[var(--accent-line)] text-left" aria-live="polite">
          <div className="flex items-center justify-between gap-2">
            <span className="text-[11px] font-semibold text-[var(--ink-muted)] uppercase tracking-wider">Saldo akhir</span>
            <span
              className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold border ${
                isLocked
                  ? 'bg-[var(--surface-muted)] text-[var(--ink-muted)] border-[var(--line)]'
                  : 'bg-[var(--ok-subtle)] text-[var(--ok)] border-[var(--ok)]'
              }`}
            >
              {isLocked ? (
                <>
                  <Lock className="w-3 h-3" />
                  <span>Terkunci</span>
                </>
              ) : (
                <>
                  <Unlock className="w-3 h-3" />
                  <span>Terbuka</span>
                </>
              )}
            </span>
          </div>

          <div
            className="mt-1 text-lg sm:text-xl xl:text-2xl font-bold tabular-nums text-[var(--accent)] whitespace-nowrap overflow-hidden text-ellipsis transition-colors duration-200"
            title={formatRupiah(closingBalance)}
          >
            {formatRupiah(closingBalance)}
          </div>

          <div className="mt-0.5 flex items-center justify-between text-xs text-[var(--ink-subtle)]">
            <span>{lastTxDate ? `per ${lastTxDate}` : 'akhir periode'}</span>
            {!isLocked && canLock && onLockClick && (
              <button
                type="button"
                onClick={onLockClick}
                className="text-xs font-semibold text-[var(--accent)] hover:underline ml-2"
              >
                Kunci
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Baris Keterangan Draf */}
      {draftCount > 0 && (
        <div className="mt-3.5 border-l-3 border-[var(--warn)] bg-[var(--warn-subtle)] px-3.5 py-2.5 text-xs text-[var(--ink)] rounded-r-lg flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-[var(--warn)] shrink-0" />
            <span>
              <strong>{draftCount} draf bukti transfer</strong> belum diposting ke saldo.
            </span>
          </div>
          <Link
            href={`/k/${kitchenId}/review`}
            className="font-semibold text-[var(--accent)] underline ml-2 hover:opacity-80 whitespace-nowrap"
          >
            Review Draf
          </Link>
        </div>
      )}
    </div>
  );
}
