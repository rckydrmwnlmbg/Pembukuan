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
      <div className="w-full bg-[var(--surface)] border border-[var(--line)] rounded-lg px-4 py-3 text-xs flex flex-wrap items-center justify-between gap-3 shadow-2xs">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[var(--ink-muted)]">
          <div className="flex items-center gap-1.5">
            <span className="text-[var(--ink-subtle)]">Saldo Awal:</span>
            <span className="font-semibold tabular-nums text-[var(--ink)]">{formatRupiah(openingBalance)}</span>
          </div>
          <span className="text-[var(--ink-subtle)] font-semibold">+</span>
          <div className="flex items-center gap-1.5">
            <span className="text-[var(--ink-subtle)]">Dana Masuk:</span>
            <span className="font-semibold tabular-nums text-[var(--ok)]">+{formatRupiah(totalIncoming)}</span>
          </div>
          <span className="text-[var(--ink-subtle)] font-semibold">−</span>
          <div className="flex items-center gap-1.5">
            <span className="text-[var(--ink-subtle)]">Dana Keluar:</span>
            <span className="font-semibold tabular-nums text-[var(--ink)]">−{formatRupiah(totalOutgoing)}</span>
          </div>
          <span className="text-[var(--ink-subtle)] font-semibold">=</span>
          <div className="flex items-center gap-1.5 rounded-md bg-[var(--surface-muted)] px-2.5 py-1 border border-[var(--line)]">
            <span className="font-semibold text-[var(--ink)]">Saldo Akhir:</span>
            <span className="tabular-nums font-bold text-sm text-[var(--accent)]" aria-live="polite">
              {formatRupiah(closingBalance)}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {draftCount > 0 && (
            <Link
              href={`/k/${kitchenId}/review`}
              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-semibold bg-[var(--warn-subtle)] text-[var(--warn)] border border-[var(--warn)] hover:opacity-90 transition-opacity"
              title={`${draftCount} draf belum dihitung ke saldo`}
            >
              <AlertTriangle className="w-3.5 h-3.5 text-[var(--warn)]" />
              <span>{draftCount} draf menunggu</span>
            </Link>
          )}

          <span
            className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-semibold border ${
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
    );
  }

  return (
    <div className="w-full bg-[var(--surface)] border border-[var(--line)] rounded-xl p-5 sm:p-6 shadow-2xs">
      <div className="grid grid-cols-1 md:grid-cols-7 items-center gap-y-4 text-center md:text-left">
        {/* 1. Saldo Awal */}
        <div className="md:col-span-1 space-y-1">
          <div className="text-xs font-semibold text-[var(--ink-muted)] uppercase tracking-wider">Saldo awal</div>
          <div className="text-xl sm:text-2xl font-bold tabular-nums text-[var(--ink)]">
            {formatRupiah(openingBalance)}
          </div>
          <div className="text-xs text-[var(--ink-subtle)]">{periodStartDate}</div>
        </div>

        {/* Operator + */}
        <div className="md:col-span-1 flex items-center justify-center text-2xl text-[var(--ink-subtle)] font-bold">
          +
        </div>

        {/* 2. Dana Masuk */}
        <div className="md:col-span-1 space-y-1">
          <div className="text-xs font-semibold text-[var(--ink-muted)] uppercase tracking-wider">Dana masuk</div>
          <div className="text-xl sm:text-2xl font-bold tabular-nums text-[var(--ok)]">
            {formatRupiah(totalIncoming)}
          </div>
          <div className="text-xs text-[var(--ink-subtle)]">
            {incomingCount} transaksi
          </div>
        </div>

        {/* Operator − */}
        <div className="md:col-span-1 flex items-center justify-center text-2xl text-[var(--ink-subtle)] font-bold">
          −
        </div>

        {/* 3. Dana Keluar */}
        <div className="md:col-span-1 space-y-1">
          <div className="text-xs font-semibold text-[var(--ink-muted)] uppercase tracking-wider">Dana keluar</div>
          <div className="text-xl sm:text-2xl font-bold tabular-nums text-[var(--ink)]">
            {formatRupiah(totalOutgoing)}
          </div>
          <div className="text-xs text-[var(--ink-subtle)]">
            {outgoingCount} transaksi
          </div>
        </div>

        {/* Operator = */}
        <div className="md:col-span-1 flex items-center justify-center text-2xl text-[var(--ink-subtle)] font-bold">
          =
        </div>

        {/* 4. Saldo Akhir */}
        <div className="md:col-span-1 space-y-1.5" aria-live="polite">
          <div className="flex items-center justify-between md:justify-start gap-2">
            <span className="text-xs font-semibold text-[var(--ink-muted)] uppercase tracking-wider">Saldo akhir</span>
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

          <div className="text-xl sm:text-2xl font-bold tabular-nums text-[var(--accent)] transition-colors duration-200">
            {formatRupiah(closingBalance)}
          </div>

          <div className="flex items-center justify-between text-xs text-[var(--ink-subtle)]">
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
        <div className="mt-4 border-l-3 border-[var(--warn)] bg-[var(--warn-subtle)] px-3.5 py-2.5 text-xs text-[var(--ink)] rounded-r-lg flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-[var(--warn)] shrink-0" />
            <span>
              <strong>{draftCount} draf bukti transfer</strong> belum diposting ke saldo.
            </span>
          </div>
          <Link
            href={`/k/${kitchenId}/review`}
            className="font-semibold text-[var(--accent)] underline ml-2 hover:opacity-80"
          >
            Review Draf
          </Link>
        </div>
      )}
    </div>
  );
}
