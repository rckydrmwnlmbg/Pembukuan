'use client';

import React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Upload,
  Lock,
  Unlock,
  AlertCircle,
  Settings,
} from 'lucide-react';
import { formatRupiah } from '@/lib/format';
import type { DemoKitchen } from '@/lib/demo-data';
import type { PeriodBalanceSummary } from '@/lib/ledger-math';

export interface DashboardKitchenItem extends Omit<DemoKitchen, 'entries'> {
  summary: PeriodBalanceSummary;
}

export interface DashboardSummaryProps {
  kitchens: readonly DashboardKitchenItem[];
  selectedPeriodLabel?: string;
}

/**
 * Dasbor Ringkasan Pembukuan (DESIGN.md §8.2 & PRD F10).
 * Aturan keras (AGENTS.md #1):
 * - Saldo tiap dapur dihitung terpisah.
 * - TIDAK ADA baris total gabungan.
 * - TIDAK ADA grafik gabungan.
 * - TIDAK ADA saldo bank.
 * - BUKAN deretan 4 kartu KPI identik.
 */
export function DashboardSummary({
  kitchens,
  selectedPeriodLabel = 'Maret 2026',
}: DashboardSummaryProps) {
  const router = useRouter();

  // Kumpulkan item "Perlu tindakan" (DESIGN.md 8.2)
  const actionItems: Array<{
    id: string;
    kitchenId: string;
    kitchenName: string;
    label: string;
    actionUrl: string;
    actionLabel: string;
    tone: 'warning' | 'info';
  }> = [];

  for (const k of kitchens) {
    if (k.pendingDraftCount > 0) {
      actionItems.push({
        id: `draft-${k.id}`,
        kitchenId: k.id,
        kitchenName: k.name,
        label: `${k.pendingDraftCount} draf menunggu review`,
        actionUrl: `/k/${k.id}/review`,
        actionLabel: 'Buka',
        tone: 'warning',
      });
    }
    if (k.needsManualCount > 0) {
      actionItems.push({
        id: `manual-${k.id}`,
        kitchenId: k.id,
        kitchenName: k.name,
        label: `${k.needsManualCount} berkas perlu input manual`,
        actionUrl: `/k/${k.id}/review`,
        actionLabel: 'Buka',
        tone: 'warning',
      });
    }
    if (k.periodStatus === 'open' && k.month === 2) {
      actionItems.push({
        id: `period-${k.id}`,
        kitchenId: k.id,
        kitchenName: k.name,
        label: `Periode Februari 2026 belum dikunci`,
        actionUrl: `/k/${k.id}/settings`,
        actionLabel: 'Buka',
        tone: 'info',
      });
    }
  }

  return (
    <div className="space-y-6">
      {/* Header Halaman (DESIGN.md 8.2) */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-[var(--line)] pb-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-semibold tracking-tight text-[var(--ink-base)]">
            Ringkasan
          </h1>
          <p className="mt-1 text-xs text-[var(--ink-muted)]">
            Saldo tiap dapur dihitung terpisah.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          {/* Pemilih Periode */}
          <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-[var(--line)] bg-[var(--surface)] text-xs text-[var(--ink-base)]">
            <span className="text-[var(--ink-muted)]">Periode:</span>
            <span className="font-medium">{selectedPeriodLabel}</span>
          </div>

          {/* Tombol Unggah */}
          {kitchens[0] && (
            <Link
              href={`/k/${kitchens[0].id}/review`}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-md bg-[var(--accent)] text-xs font-semibold text-[var(--ink-on-accent,#fff)] hover:opacity-90 transition-opacity"
            >
              <Upload className="w-3.5 h-3.5" />
              Unggah bukti transfer
            </Link>
          )}
        </div>
      </div>

      {/* Panel "Perlu tindakan" (DESIGN.md 8.2) */}
      <section
        aria-labelledby="perlu-tindakan-heading"
        className="rounded-lg border border-[var(--line)] bg-[var(--surface)] overflow-hidden"
      >
        <div className="px-4 py-2.5 bg-[var(--surface-muted)] border-b border-[var(--line)] flex items-center gap-2">
          <AlertCircle className="w-4 h-4 text-[var(--warning)] shrink-0" />
          <h2
            id="perlu-tindakan-heading"
            className="text-xs font-semibold text-[var(--ink-base)]"
          >
            Perlu tindakan
          </h2>
        </div>

        {actionItems.length === 0 ? (
          <div className="p-4 text-xs text-[var(--ink-muted)] text-center">
            Semua dapur dalam keadaan mutakhir. Tidak ada draf yang menunggu review.
          </div>
        ) : (
          <ul className="divide-y divide-[var(--line)]">
            {actionItems.map((item) => (
              <li
                key={item.id}
                className="px-4 py-3 flex items-center justify-between gap-4 text-xs hover:bg-[var(--neutral-subtle)] transition-colors"
              >
                <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-4 min-w-0">
                  <span className="font-semibold text-[var(--ink-base)] w-44 shrink-0 truncate">
                    {item.kitchenName}
                  </span>
                  <span className="text-[var(--ink-muted)]">{item.label}</span>
                </div>
                <Link
                  href={item.actionUrl}
                  className="inline-flex items-center px-3 py-1 rounded border border-[var(--line)] bg-[var(--surface)] font-medium text-xs text-[var(--accent)] hover:underline shrink-0"
                >
                  <span>{item.actionLabel}</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Tabel "Dapur" (DESIGN.md 8.2) */}
      <section
        aria-labelledby="dapur-table-heading"
        className="rounded-lg border border-[var(--line)] bg-[var(--surface)] overflow-hidden"
      >
        <div className="px-4 py-2.5 bg-[var(--surface-muted)] border-b border-[var(--line)] flex items-center justify-between">
          <h2
            id="dapur-table-heading"
            className="text-xs font-semibold text-[var(--ink-base)]"
          >
            Dapur
          </h2>
          <span className="text-[11px] text-[var(--ink-muted)]">
            Klik baris untuk membuka buku kas
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-[var(--line)] text-[var(--ink-muted)] bg-[var(--surface)]">
                <th className="py-2.5 px-4 font-medium">Dapur</th>
                <th className="py-2.5 px-4 font-medium text-right">Saldo akhir</th>
                <th className="py-2.5 px-4 font-medium text-center">Menunggu review</th>
                <th className="py-2.5 px-4 font-medium">Terakhir diunggah</th>
                <th className="py-2.5 px-4 font-medium">Periode</th>
                <th className="py-2.5 px-4 font-medium text-right">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--line)]">
              {kitchens.map((k) => {
                const isLocked = k.periodStatus === 'locked';
                const totalPending = k.pendingDraftCount + k.needsManualCount;

                return (
                  <tr
                    key={k.id}
                    tabIndex={0}
                    role="button"
                    onClick={() => router.push(`/k/${k.id}/ledger`)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        router.push(`/k/${k.id}/ledger`);
                      }
                    }}
                    className="hover:bg-[var(--surface-muted)] cursor-pointer transition-colors focus:outline-none focus:bg-[var(--surface-muted)]"
                  >
                    {/* Dapur */}
                    <td className="py-3 px-4">
                      <div className="font-semibold text-[var(--ink-base)]">
                        {k.name}
                      </div>
                      <div className="text-[11px] text-[var(--ink-subtle)]">
                        {k.code} ({k.pjName})
                      </div>
                    </td>

                    {/* Saldo Akhir */}
                    <td className="py-3 px-4 text-right tabular-nums font-semibold text-[var(--ink-base)]">
                      {formatRupiah(k.summary.closingBalance)}
                    </td>

                    {/* Menunggu Review */}
                    <td className="py-3 px-4 text-center">
                      {totalPending > 0 ? (
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold bg-[var(--warning-subtle)] text-[var(--warning-text,inherit)] border border-[var(--warning)]">
                          {totalPending}
                        </span>
                      ) : (
                        <span className="text-[var(--ink-subtle)]">0</span>
                      )}
                    </td>

                    {/* Terakhir Diunggah */}
                    <td className="py-3 px-4 text-[var(--ink-muted)]">
                      {k.lastUploadDate}
                    </td>

                    {/* Periode Status Badge */}
                    <td className="py-3 px-4">
                      <span
                        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium border ${
                          isLocked
                            ? 'bg-[var(--neutral-subtle)] text-[var(--ink-muted)] border-[var(--line)]'
                            : 'bg-[var(--surface)] text-[var(--ink-base)] border-[var(--line)]'
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
                    </td>

                    {/* Aksi */}
                    <td className="py-3 px-4 text-right">
                      <div
                        className="inline-flex items-center gap-2"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <Link
                          href={`/k/${k.id}/settings`}
                          title="Pengaturan Dapur"
                          className="p-1 rounded text-[var(--ink-muted)] hover:text-[var(--ink-base)] hover:bg-[var(--neutral-subtle)]"
                        >
                          <Settings className="w-4 h-4" />
                        </Link>
                        <Link
                          href={`/k/${k.id}/ledger`}
                          className="px-2.5 py-1 rounded bg-[var(--surface)] border border-[var(--line)] text-xs font-medium text-[var(--ink-base)] hover:bg-[var(--neutral-subtle)]"
                        >
                          Buka
                        </Link>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <div className="p-3 bg-[var(--neutral-subtle)] text-[11px] text-[var(--ink-muted)] border-t border-[var(--line)] flex items-center justify-between">
          <span>
            Aturan Emas #1: Tidak ada baris total lintas dapur. Saldo setiap dapur berdiri sendiri.
          </span>
          <span>5 Dapur Terisolasi</span>
        </div>
      </section>
    </div>
  );
}
