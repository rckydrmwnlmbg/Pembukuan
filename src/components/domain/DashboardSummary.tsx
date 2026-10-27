'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Upload,
  Lock,
  Unlock,
  AlertCircle,
  Settings,
  Plus,
  BookOpen,
} from 'lucide-react';
import { formatRupiah } from '@/lib/format';
import type { DemoKitchen } from '@/lib/demo-data';
import type { PeriodBalanceSummary } from '@/lib/ledger-math';
import { AddKitchenModal } from '@/components/domain/AddKitchenModal';

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
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);

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
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-[var(--ink)]">
            Ringkasan Dapur
          </h1>
          <p className="mt-1 text-xs text-[var(--ink-muted)]">
            Setiap dapur memiliki buku kas dan saldo terpisah.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          {/* Pemilih Periode */}
          <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[var(--line)] bg-[var(--surface)] text-xs text-[var(--ink)] shadow-2xs">
            <span className="text-[var(--ink-muted)]">Periode:</span>
            <span className="font-semibold">{selectedPeriodLabel}</span>
          </div>

          {/* Tombol Tambah Dapur */}
          <button
            type="button"
            onClick={() => setIsAddModalOpen(true)}
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg border border-[var(--line-strong)] bg-[var(--surface)] text-xs font-semibold text-[var(--ink)] hover:bg-[var(--surface-muted)] transition-colors shadow-2xs"
          >
            <Plus className="w-3.5 h-3.5 text-[var(--accent)]" />
            Tambah Dapur
          </button>

          {/* Tombol Unggah */}
          {kitchens[0] && (
            <Link
              href={`/k/${kitchens[0].id}/review`}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-[var(--accent)] text-xs font-semibold text-[var(--ink-on-accent,#fff)] hover:bg-[var(--accent-hover)] transition-colors shadow-2xs"
            >
              <Upload className="w-3.5 h-3.5" />
              Unggah Bukti Transfer
            </Link>
          )}
        </div>
      </div>

      {/* Panel "Perlu tindakan" (DESIGN.md 8.2) */}
      <section
        aria-labelledby="perlu-tindakan-heading"
        className="rounded-xl border border-[var(--line)] bg-[var(--surface)] overflow-hidden shadow-2xs"
      >
        <div className="px-4 py-3 bg-[var(--surface-muted)] border-b border-[var(--line)] flex items-center gap-2">
          <AlertCircle className="w-4 h-4 text-[var(--warn)] shrink-0" />
          <h2
            id="perlu-tindakan-heading"
            className="text-xs font-semibold text-[var(--ink)]"
          >
            Perlu Tindakan
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
                className="px-4 py-3 flex items-center justify-between gap-4 text-xs hover:bg-[var(--surface-muted)] transition-colors"
              >
                <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-4 min-w-0">
                  <span className="font-semibold text-[var(--ink)] w-48 shrink-0 truncate">
                    {item.kitchenName}
                  </span>
                  <span className="text-[var(--ink-muted)]">{item.label}</span>
                </div>
                <Link
                  href={item.actionUrl}
                  className="inline-flex items-center px-3 py-1 rounded-md border border-[var(--line)] bg-[var(--surface)] font-semibold text-xs text-[var(--accent)] hover:bg-[var(--accent-subtle)] shrink-0 transition-colors"
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
        className="rounded-xl border border-[var(--line)] bg-[var(--surface)] overflow-hidden shadow-2xs"
      >
        <div className="px-4 py-3 bg-[var(--surface-muted)] border-b border-[var(--line)] flex items-center justify-between">
          <h2
            id="dapur-table-heading"
            className="text-xs font-semibold text-[var(--ink)]"
          >
            Daftar Dapur ({kitchens.length})
          </h2>
          <span className="text-[11px] text-[var(--ink-muted)]">
            Klik baris untuk membuka Buku Kas
          </span>
        </div>

        {kitchens.length === 0 ? (
          <div className="p-8 text-center space-y-3">
            <p className="text-xs text-[var(--ink-muted)]">
              Belum ada dapur yang terdaftar. Buat dapur pertama Anda untuk mulai mencatat buku kas.
            </p>
            <button
              type="button"
              onClick={() => setIsAddModalOpen(true)}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-[var(--accent)] text-xs font-semibold text-white hover:bg-[var(--accent-hover)] transition-colors shadow-2xs"
            >
              <Plus className="w-4 h-4" />
              Tambah Dapur Pertama
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[700px] text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-[var(--line)] text-[var(--ink-muted)] bg-[var(--surface)] font-medium">
                  <th className="py-2.5 px-4">Dapur</th>
                  <th className="py-2.5 px-4 text-right">Saldo Akhir</th>
                  <th className="py-2.5 px-4 text-center">Menunggu Review</th>
                  <th className="py-2.5 px-4">Terakhir Diunggah</th>
                  <th className="py-2.5 px-4">Status Periode</th>
                  <th className="py-2.5 px-4 text-right">Aksi</th>
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
                      <td className="py-3.5 px-4">
                        <div className="font-semibold text-[var(--ink)]">
                          {k.name}
                        </div>
                        <div className="text-[11px] text-[var(--ink-muted)]">
                          {k.code} &bull; PJ: {k.pjName} &bull; Rekening {k.bankCode} ****{k.accountNoLast4}
                        </div>
                      </td>

                      {/* Saldo Akhir */}
                      <td className="py-3.5 px-4 text-right tabular-nums font-bold text-sm text-[var(--ink)]">
                        {formatRupiah(k.summary.closingBalance)}
                      </td>

                      {/* Menunggu Review */}
                      <td className="py-3.5 px-4 text-center">
                        {totalPending > 0 ? (
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold bg-[var(--warn-subtle)] text-[var(--warn)] border border-[var(--warn)]">
                            {totalPending} draf
                          </span>
                        ) : (
                          <span className="text-[var(--ink-subtle)]">0</span>
                        )}
                      </td>

                      {/* Terakhir Diunggah */}
                      <td className="py-3.5 px-4 text-[var(--ink-muted)]">
                        {k.lastUploadDate}
                      </td>

                      {/* Periode Status Badge */}
                      <td className="py-3.5 px-4">
                        <span
                          className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded text-[11px] font-semibold border ${
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
                      </td>

                      {/* Aksi */}
                      <td className="py-3.5 px-4 text-right">
                        <div
                          className="inline-flex items-center gap-1.5"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <Link
                            href={`/k/${k.id}/settings`}
                            title="Pengaturan Dapur"
                            className="p-1.5 rounded-md text-[var(--ink-muted)] hover:text-[var(--ink)] hover:bg-[var(--line)] transition-colors"
                          >
                            <Settings className="w-4 h-4" />
                          </Link>
                          <Link
                            href={`/k/${k.id}/ledger`}
                            className="inline-flex items-center gap-1 px-3 py-1 rounded-md bg-[var(--surface)] border border-[var(--line-strong)] text-xs font-semibold text-[var(--ink)] hover:bg-[var(--surface-muted)] transition-colors"
                          >
                            <BookOpen className="w-3.5 h-3.5 text-[var(--accent)]" />
                            <span>Buka Buku Kas</span>
                          </Link>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        <div className="p-3 bg-[var(--surface-muted)] text-[11px] text-[var(--ink-muted)] border-t border-[var(--line)] flex items-center justify-between">
          <span>
            Buku kas dan saldo terisolasi per dapur (tidak ada penjumlahan saldo lintas dapur).
          </span>
          <span className="font-medium">{kitchens.length} Dapur Terdaftar</span>
        </div>
      </section>

      {/* Modal Tambah Dapur */}
      <AddKitchenModal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
      />
    </div>
  );
}
