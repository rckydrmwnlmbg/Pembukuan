'use client';

import React, { useEffect, useState, use } from 'react';
import Link from 'next/link';
import { ArrowLeft, History, ShieldAlert } from 'lucide-react';
import { formatTimestampWib } from '@/lib/format';

interface AuditRecord {
  id: string;
  kitchenId: string;
  actorId: string;
  action: string;
  entity: string;
  entityId: string;
  before: Record<string, unknown> | null;
  after: Record<string, unknown>;
  createdAt: string;
}

interface KitchenInfo {
  id: string;
  name: string;
  code: string;
}

function getActionBadge(action: string) {
  switch (action) {
    case 'periods.lock':
      return {
        label: 'Kunci Periode',
        className: 'bg-[var(--surface-muted)] text-[var(--ink)] border-[var(--line)]',
      };
    case 'periods.reopen':
      return {
        label: 'Buka Periode',
        className: 'bg-[var(--warn-subtle)] text-[var(--warn)] border-[var(--warn)]',
      };
    case 'periods.insert':
      return {
        label: 'Periode Baru',
        className: 'bg-[var(--accent-subtle)] text-[var(--accent)] border-[var(--accent-line)]',
      };
    case 'kitchens.update':
      return {
        label: 'Ubah Pengaturan',
        className: 'bg-[var(--surface-muted)] text-[var(--ink)] border-[var(--line)]',
      };
    case 'transactions.void':
      return {
        label: 'Batal (Void)',
        className: 'bg-[var(--danger-subtle)] text-[var(--danger)] border-[var(--danger)]',
      };
    case 'transactions.insert':
      return {
        label: 'Tambah Transaksi',
        className: 'bg-[var(--ok-subtle)] text-[var(--ok)] border-[var(--ok)]',
      };
    case 'transactions.update':
      return {
        label: 'Ubah Transaksi',
        className: 'bg-[var(--surface)] text-[var(--ink)] border-[var(--line)]',
      };
    default:
      return {
        label: action,
        className: 'bg-[var(--surface)] text-[var(--ink-muted)] border-[var(--line)]',
      };
  }
}

export default function KitchenAuditPage({
  params,
}: {
  params: Promise<{ kitchenId: string }>;
}) {
  const { kitchenId } = use(params);

  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [kitchen, setKitchen] = useState<KitchenInfo | null>(null);
  const [logs, setLogs] = useState<AuditRecord[]>([]);

  useEffect(() => {
    async function fetchAuditLogs() {
      try {
        setLoading(true);
        setErrorMsg(null);

        const [kitchenRes, auditRes] = await Promise.all([
          fetch(`/api/k/${kitchenId}/settings`),
          fetch(`/api/k/${kitchenId}/audit`),
        ]);

        if (!kitchenRes.ok) {
          throw new Error('Gagal memuat informasi dapur.');
        }

        const kData = await kitchenRes.json();
        setKitchen({ id: kData.id, name: kData.name, code: kData.code });

        if (!auditRes.ok) {
          throw new Error('Gagal memuat catatan audit log.');
        }

        const aData = await auditRes.json();
        setLogs(aData.logs ?? []);
      } catch (err: unknown) {
        setErrorMsg(err instanceof Error ? err.message : 'Terjadi galat');
      } finally {
        setLoading(false);
      }
    }

    void fetchAuditLogs();
  }, [kitchenId]);

  if (loading) {
    return (
      <div className="min-h-screen bg-[var(--canvas)] flex items-center justify-center p-6 text-[var(--ink-muted)]">
        Memuat jejak audit...
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[var(--canvas)] text-[var(--ink-base)] p-4 sm:p-8">
      <div className="mx-auto max-w-5xl space-y-6">
        {/* Navigasi atas */}
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Link
              href={`/k/${kitchenId}/ledger`}
              className="inline-flex items-center gap-1.5 text-xs text-[var(--ink-muted)] hover:text-[var(--ink-base)] font-medium"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              Kembali ke Buku Kas
            </Link>
            <span className="text-xs font-medium text-[var(--ink-muted)]">
              {kitchen?.name} ({kitchen?.code})
            </span>
          </div>

          <div className="flex items-center gap-2">
            <Link
              href={`/k/${kitchenId}/settings`}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-[var(--line)] bg-[var(--surface)] text-xs font-medium text-[var(--ink-base)] hover:bg-[var(--neutral-subtle)] transition-colors"
            >
              Pengaturan Dapur
            </Link>
          </div>
        </div>

        {errorMsg && (
          <div className="p-3.5 rounded-md bg-[var(--danger-subtle)] border border-[var(--danger)] text-xs text-[var(--danger)]">
            {errorMsg}
          </div>
        )}

        {/* Header Judul */}
        <div className="border-b border-[var(--line)] pb-4">
          <div className="flex items-center gap-2">
            <History className="w-5 h-5 text-[var(--ink-muted)]" />
            <h1 className="text-lg font-semibold text-[var(--ink-base)]">
              Riwayat Perubahan (Audit Log)
            </h1>
          </div>
          <p className="mt-1 text-xs text-[var(--ink-muted)]">
            Catatan permanen append-only untuk setiap aksi penulisan, kunci periode,
            dan pembatalan pada dapur {kitchen?.name}. Tidak dapat diubah atau dihapus (SECURITY S-15).
          </p>
        </div>

        {/* Tabel Jejak Audit */}
        <div className="bg-[var(--surface)] border border-[var(--line)] rounded-lg overflow-hidden">
          {logs.length === 0 ? (
            <div className="p-8 text-center text-xs text-[var(--ink-muted)]">
              Belum ada riwayat aktivitas yang tercatat untuk dapur ini.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-[var(--line)] bg-[var(--neutral-subtle)] text-[var(--ink-muted)] font-medium">
                    <th className="py-2.5 px-4 w-36">Waktu (WIB)</th>
                    <th className="py-2.5 px-4 w-32">Aksi</th>
                    <th className="py-2.5 px-4 w-28">Entitas</th>
                    <th className="py-2.5 px-4">Ringkasan Perubahan</th>
                    <th className="py-2.5 px-4 w-24 text-right">Aktor</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--line)]">
                  {logs.map((log) => {
                    const badge = getActionBadge(log.action);
                    return (
                      <tr
                        key={log.id}
                        className="hover:bg-[var(--neutral-subtle)] transition-colors"
                      >
                        <td className="py-3 px-4 font-mono text-[11px] text-[var(--ink-muted)] whitespace-nowrap">
                          {formatTimestampWib(log.createdAt)}
                        </td>
                        <td className="py-3 px-4">
                          <span
                            className={`inline-block px-2 py-0.5 rounded text-[11px] font-medium border ${badge.className}`}
                          >
                            {badge.label}
                          </span>
                        </td>
                        <td className="py-3 px-4 font-mono text-[11px] text-[var(--ink-muted)]">
                          {log.entity}
                        </td>
                        <td className="py-3 px-4 text-[var(--ink-base)]">
                          {log.action === 'periods.reopen' && (
                            <span className="font-medium text-[var(--warning-text,inherit)]">
                              Alasan: {String(log.after.reason || '-')}
                            </span>
                          )}
                          {log.action === 'periods.lock' && (
                            <span>
                              Kunci periode dengan saldo akhir Rp{' '}
                              {String(log.after.closingBalance || '-')}
                            </span>
                          )}
                          {log.action === 'kitchens.update' && (
                            <span>
                              Pembaruan profil: {String(log.after.name || '')} (
                              {String(log.after.code || '')})
                            </span>
                          )}
                          {log.action === 'transactions.void' && (
                            <span>
                              Batal: {String(log.after.description || '')} (
                              {String(log.after.note || 'Dibatalkan')})
                            </span>
                          )}
                          {log.action === 'transactions.insert' && (
                            <span>
                              Input: {String(log.after.description || '')}
                            </span>
                          )}
                          {log.action === 'transactions.update' && (
                            <span>
                              Ubah: {String(log.after.description || '')}
                            </span>
                          )}
                          {!['periods.reopen', 'periods.lock', 'kitchens.update', 'transactions.void', 'transactions.insert', 'transactions.update'].includes(log.action) && (
                            <span className="text-[var(--ink-muted)] font-mono text-[11px]">
                              {JSON.stringify(log.after)}
                            </span>
                          )}
                        </td>
                        <td className="py-3 px-4 text-right font-mono text-[11px] text-[var(--ink-muted)]">
                          {log.actorId ? log.actorId.slice(0, 8) : 'sistem'}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="flex items-center gap-2 text-xs text-[var(--ink-muted)] pt-2">
          <ShieldAlert className="w-4 h-4 text-[var(--ink-subtle)] shrink-0" />
          <span>
            Jejak audit ini dilindungi oleh trigger basis data PostgreSQL
            (<code>trg_audit_logs_immutable</code>). Dilarang melakukan modifikasi atau penghapusan catatan.
          </span>
        </div>
      </div>
    </div>
  );
}
