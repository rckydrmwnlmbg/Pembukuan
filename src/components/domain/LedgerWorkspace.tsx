'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { UploadCloud, FileSpreadsheet, Calendar } from 'lucide-react';
import {
  formatTxDate,
  formatLedgerCellAmount,
  formatRupiah,
} from '@/lib/format';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Badge } from '@/components/ui/Badge';
import { PeriodBalanceStrip } from '@/components/domain/PeriodBalanceStrip';

export interface SerializedLedgerRow {
  id: string;
  kitchenId: string;
  periodId: string;
  parentTransactionId: string | null;
  seqNo: number;
  rowNo: number;
  txDate: string;
  kind: 'incoming' | 'outgoing' | 'admin_fee';
  referenceNo: string | null;
  description: string;
  counterpartyAccount: string | null;
  counterpartyAccountLast4: string | null;
  counterpartyName: string | null;
  counterpartyBank: string | null;
  debit: string;
  credit: string;
  runningBalance: string;
  note: string | null;
  status: 'draft' | 'posted' | 'void';
  version: number;
}

export interface SerializedPeriodSummary {
  openingBalance: string;
  totalIncoming: string;
  totalOutgoing: string;
  closingBalance: string;
}

export interface SerializedKitchenInfo {
  id: string;
  code: string;
  name: string;
  pjName: string;
  bankName: string;
  accountNumberMasked: string;
  adminFeeDefault: string;
  periodId: string;
  year: number;
  month: number;
  periodLabel: string;
  periodStatus: 'open' | 'locked';
}

export interface SerializedPeriodOption {
  id: string;
  year: number;
  month: number;
  status: 'open' | 'locked';
  label: string;
}

export interface LedgerWorkspaceProps {
  kitchen: SerializedKitchenInfo;
  availablePeriods?: SerializedPeriodOption[];
  initialRows: readonly SerializedLedgerRow[];
  initialSummary: SerializedPeriodSummary;
  reviewQueueCount?: number;
}

type PanelMode =
  | { type: 'closed' }
  | { type: 'create'; initialKind: 'incoming' | 'outgoing' }
  | { type: 'inspect'; row: SerializedLedgerRow };

function formatRecipientColumn(row: SerializedLedgerRow): string {
  if (row.counterpartyAccount && row.counterpartyName) {
    return `${row.counterpartyAccount} a.n ${row.counterpartyName}`;
  }
  if (row.counterpartyName) {
    return row.counterpartyName;
  }
  if (row.counterpartyAccount) {
    return row.counterpartyAccount;
  }
  return '';
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

export function LedgerWorkspace({
  kitchen,
  availablePeriods = [],
  initialRows,
  initialSummary,
  reviewQueueCount = 0,
}: LedgerWorkspaceProps) {
  const router = useRouter();
  const [rows, setRows] = useState< readonly SerializedLedgerRow[]>(initialRows);
  const [summary, setSummary] =
    useState<SerializedPeriodSummary>(initialSummary);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'posted' | 'void'>(
    'all',
  );
  const [isLoading, setIsLoading] = useState(false);
  const [bannerMessage, setBannerMessage] = useState<{
    tone: 'success' | 'error';
    text: string;
  } | null>(null);
  const [copiedRefId, setCopiedRefId] = useState<string | null>(null);
  const [panel, setPanel] = useState<PanelMode>({ type: 'closed' });

  // State form tambah/edit transaksi di panel samping 480px
  const [formKind, setFormKind] = useState<'incoming' | 'outgoing'>('outgoing');
  const [formDate, setFormDate] = useState('2026-03-25');
  const [formRefNo, setFormRefNo] = useState('');
  const [formDesc, setFormDesc] = useState('');
  const [formAmount, setFormAmount] = useState('');
  const [formAccount, setFormAccount] = useState('');
  const [formRecipientName, setFormRecipientName] = useState('');
  const [formBank, setFormBank] = useState('BRI');
  const [formNote, setFormNote] = useState('');
  const [formIncludeFee, setFormIncludeFee] = useState(true);
  const [formFeeAmount, setFormFeeAmount] = useState(kitchen.adminFeeDefault);
  const [voidReason, setVoidReason] = useState('');
  const [showVoidConfirm, setShowVoidConfirm] = useState(false);
  const [panelError, setPanelError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const isLocked = kitchen.periodStatus === 'locked';

  async function fetchFilteredRows(
    nextQuery: string,
    nextStatus: 'all' | 'posted' | 'void',
  ) {
    setIsLoading(true);
    setBannerMessage(null);
    try {
      const params = new URLSearchParams();
      params.set('periodId', kitchen.periodId);
      params.set('status', nextStatus);
      if (nextQuery.trim()) {
        params.set('q', nextQuery.trim());
      }
      const res = await fetch(
        `/api/k/${kitchen.id}/transactions?${params.toString()}`,
        {
          method: 'GET',
          headers: { Accept: 'application/json' },
        },
      );
      const data = (await res.json()) as {
        rows?: SerializedLedgerRow[];
        summary?: SerializedPeriodSummary;
        error?: { message?: string };
      };
      if (!res.ok) {
        setBannerMessage({
          tone: 'error',
          text:
            data.error?.message ??
            'Gagal memuat data buku kas. Periksa koneksi lalu coba lagi.',
        });
        return;
      }
      if (data.rows) setRows(data.rows);
      if (data.summary) setSummary(data.summary);
    } catch {
      setBannerMessage({
        tone: 'error',
        text: 'Gagal menghubungi server saat memuat buku kas.',
      });
    } finally {
      setIsLoading(false);
    }
  }

  function openCreatePanel(initialKind: 'incoming' | 'outgoing') {
    setFormKind(initialKind);
    setFormDate('2026-03-25');
    setFormRefNo('');
    setFormDesc(
      initialKind === 'incoming' ? 'PENERIMAAN DANA OPERASIONAL SPPG' : '',
    );
    setFormAmount('');
    setFormAccount('');
    setFormRecipientName('');
    setFormBank(initialKind === 'incoming' ? '' : 'BRI');
    setFormNote('');
    setFormIncludeFee(initialKind === 'outgoing');
    setFormFeeAmount(kitchen.adminFeeDefault);
    setPanelError(null);
    setShowVoidConfirm(false);
    setPanel({ type: 'create', initialKind });
  }

  function openInspectPanel(row: SerializedLedgerRow) {
    setFormDate(row.txDate);
    setFormRefNo(row.referenceNo ?? '');
    setFormDesc(row.description);
    setFormAmount(row.kind === 'incoming' ? row.debit : row.credit);
    setFormAccount(row.counterpartyAccount ?? '');
    setFormRecipientName(row.counterpartyName ?? '');
    setFormBank(row.counterpartyBank ?? '');
    setFormNote(row.note ?? '');
    setVoidReason('');
    setShowVoidConfirm(false);
    setPanelError(null);
    setPanel({ type: 'inspect', row });
  }

  async function handleCreateSubmit(e: React.FormEvent) {
    e.preventDefault();
    setPanelError(null);
    setIsSubmitting(true);
    try {
      const res = await fetch(`/api/k/${kitchen.id}/transactions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          periodId: kitchen.periodId,
          txDate: formDate,
          kind: formKind,
          referenceNo: formRefNo.trim() || null,
          description: formDesc.trim(),
          amount: formAmount.trim(),
          counterpartyAccount: formAccount.trim() || null,
          counterpartyName: formRecipientName.trim() || null,
          counterpartyBank: formBank.trim() || null,
          note: formNote.trim() || null,
          includeAdminFee: formKind === 'outgoing' ? formIncludeFee : false,
          adminFeeAmount:
            formKind === 'outgoing' && formIncludeFee
              ? formFeeAmount.trim()
              : undefined,
        }),
      });
      const data = (await res.json()) as {
        error?: { message?: string };
      };
      if (!res.ok) {
        setPanelError(
          data.error?.message ??
            'Transaksi tidak dapat disimpan. Periksa kembali isian Anda.',
        );
        return;
      }
      setPanel({ type: 'closed' });
      setBannerMessage({
        tone: 'success',
        text:
          formKind === 'incoming'
            ? 'Dana masuk berhasil dicatat ke buku kas.'
            : formIncludeFee
              ? 'Transaksi dana keluar beserta baris biaya admin bank berpasangan berhasil dicatat.'
              : 'Transaksi dana keluar berhasil dicatat ke buku kas.',
      });
      await fetchFilteredRows(searchQuery, statusFilter);
    } catch {
      setPanelError('Gagal menghubungi server. Silakan coba kembali.');
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleUpdateSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (panel.type !== 'inspect') return;
    setPanelError(null);
    setIsSubmitting(true);
    try {
      const res = await fetch(
        `/api/k/${kitchen.id}/transactions/${panel.row.id}`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'update',
            version: panel.row.version,
            txDate: formDate,
            referenceNo: formRefNo.trim() || null,
            description: formDesc.trim(),
            amount: formAmount.trim(),
            counterpartyAccount: formAccount.trim() || null,
            counterpartyName: formRecipientName.trim() || null,
            counterpartyBank: formBank.trim() || null,
            note: formNote.trim() || null,
          }),
        },
      );
      const data = (await res.json()) as {
        error?: { message?: string };
      };
      if (!res.ok) {
        setPanelError(
          data.error?.message ??
            'Perubahan tidak dapat disimpan. Periksa kembali isian Anda.',
        );
        return;
      }
      setPanel({ type: 'closed' });
      setBannerMessage({
        tone: 'success',
        text: 'Perubahan transaksi berhasil disimpan dan tercatat di log audit.',
      });
      await fetchFilteredRows(searchQuery, statusFilter);
    } catch {
      setPanelError('Gagal menghubungi server saat menyimpan perubahan.');
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleVoidSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (panel.type !== 'inspect') return;
    setPanelError(null);
    setIsSubmitting(true);
    try {
      const res = await fetch(
        `/api/k/${kitchen.id}/transactions/${panel.row.id}`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'void',
            version: panel.row.version,
            reason: voidReason.trim(),
          }),
        },
      );
      const data = (await res.json()) as {
        voidedIds?: string[];
        error?: { message?: string };
      };
      if (!res.ok) {
        setPanelError(
          data.error?.message ?? 'Gagal membatalkan transaksi.',
        );
        return;
      }
      const count = data.voidedIds?.length ?? 1;
      setPanel({ type: 'closed' });
      setBannerMessage({
        tone: 'success',
        text:
          count > 1
            ? 'Transaksi induk beserta baris biaya admin bank pasangannya berhasil dibatalkan (void).'
            : 'Transaksi berhasil dibatalkan (void) dan dicatat di log audit.',
      });
      await fetchFilteredRows(searchQuery, statusFilter);
    } catch {
      setPanelError('Gagal menghubungi server saat membatalkan transaksi.');
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleCopyReference(refNo: string, rowId: string) {
    try {
      await navigator.clipboard.writeText(refNo);
      setCopiedRefId(rowId);
      setTimeout(() => setCopiedRefId(null), 1500);
    } catch {
      // Abaikan bila clipboard tidak diizinkan oleh browser
    }
  }

  const openingBalanceBig = BigInt(summary.openingBalance);
  const totalDebitBig = BigInt(summary.totalIncoming);
  const totalCreditBig = BigInt(summary.totalOutgoing);
  const closingBalanceBig = BigInt(summary.closingBalance);
  const openingDateIso = `${kitchen.year}-${String(kitchen.month).padStart(2, '0')}-01`;

  return (
    <div className="space-y-4">
      {/* Header Konteks Dapur Aktif */}
      <div className="flex flex-col gap-4 rounded-xl border border-[var(--line)] bg-[var(--surface)] p-5 shadow-2xs lg:flex-row lg:items-center lg:justify-between">
        <div className="space-y-1">
          <div className="flex flex-wrap items-center gap-2.5">
            <h1 className="text-xl font-bold tracking-tight text-[var(--ink)]">
              {kitchen.name}
            </h1>
            <Badge tone="neutral">{kitchen.code}</Badge>
            <Badge tone={isLocked ? 'neutral' : 'accent'}>
              {isLocked ? 'Periode Terkunci' : 'Periode Terbuka'}
            </Badge>

            {availablePeriods.length > 1 && (
              <div className="flex items-center gap-1.5 rounded-lg border border-[var(--line-strong)] bg-[var(--surface-muted)] px-2.5 py-1">
                <Calendar className="h-3.5 w-3.5 text-[var(--accent)] shrink-0" />
                <span className="text-[11px] font-medium text-[var(--ink-muted)]">Pilih Periode:</span>
                <select
                  value={kitchen.periodId}
                  onChange={(e) => router.push(`/k/${kitchen.id}/ledger?periodId=${e.target.value}`)}
                  aria-label="Pilih Periode Pembukuan"
                  className="bg-transparent text-xs font-semibold text-[var(--ink)] focus:outline-none cursor-pointer"
                >
                  {availablePeriods.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.label} {p.status === 'locked' ? '(Terkunci)' : '(Aktif)'}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>
          <p className="text-xs text-[var(--ink-muted)] leading-relaxed">
            Buku kas {kitchen.periodLabel} &bull; PJ: <span className="font-semibold text-[var(--ink)]">{kitchen.pjName}</span> &bull; Rekening {kitchen.bankName} {kitchen.accountNumberMasked} &bull; Biaya admin{' '}
            <span className="font-semibold tabular-nums text-[var(--ink)]">
              {formatRupiah(BigInt(kitchen.adminFeeDefault))}
            </span>
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Link
            href={`/k/${kitchen.id}/review`}
            className="inline-flex h-9 items-center justify-center gap-1.5 rounded-lg bg-[var(--accent)] px-3.5 text-xs font-semibold text-white shadow-2xs hover:bg-[var(--accent-hover)] transition-colors"
          >
            <UploadCloud className="h-4 w-4" />
            <span>Unggah Bukti</span>
            {reviewQueueCount > 0 && (
              <span className="ml-1 rounded-full bg-white/25 px-1.5 py-0.5 text-[10px] font-bold">
                {reviewQueueCount}
              </span>
            )}
          </Link>
          <a
            href={`/api/k/${kitchen.id}/export/xlsx?periodId=${kitchen.periodId}`}
            className="inline-flex h-9 items-center justify-center gap-1.5 rounded-lg border border-[var(--line-strong)] bg-[var(--surface)] px-3 text-xs font-semibold text-[var(--ink)] hover:bg-[var(--surface-muted)] transition-colors"
          >
            <FileSpreadsheet className="h-3.5 w-3.5 text-[var(--ok)]" />
            <span>Unduh Excel (.xlsx)</span>
          </a>
          <Button
            variant="secondary"
            size="sm"
            disabled={isLocked}
            onClick={() => openCreatePanel('incoming')}
          >
            + Catat Dana Masuk
          </Button>
          <Button
            variant="secondary"
            size="sm"
            disabled={isLocked}
            onClick={() => openCreatePanel('outgoing')}
          >
            + Transaksi Manual
          </Button>
        </div>
      </div>

      {/* Strip Persamaan Saldo Periode (DESIGN.md §8.1 & §8.4) */}
      <PeriodBalanceStrip
        kitchenId={kitchen.id}
        periodLabel={kitchen.periodLabel}
        periodStatus={kitchen.periodStatus}
        openingBalance={openingBalanceBig}
        totalDebit={totalDebitBig}
        totalCredit={totalCreditBig}
        closingBalance={closingBalanceBig}
        compact
      />

      {/* Umpan balik aksi */}
      {bannerMessage ? (
        <div
          role="status"
          className={`flex items-center justify-between rounded-md border px-4 py-2.5 text-sm ${
            bannerMessage.tone === 'error'
              ? 'border-danger bg-danger-subtle text-danger'
              : 'border-line-strong bg-accent-subtle text-accent-primary'
          }`}
        >
          <span>{bannerMessage.text}</span>
          <button
            type="button"
            onClick={() => setBannerMessage(null)}
            className="ml-4 text-xs font-medium underline"
          >
            Tutup
          </button>
        </div>
      ) : null}

      {/* Bilah Alat Pencarian & Filter (48px, SECURITY.md S-05) */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void fetchFilteredRows(searchQuery, statusFilter);
        }}
        className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-line-subtle bg-surface px-3.5 py-2"
      >
        <div className="flex flex-1 flex-wrap items-center gap-2">
          <div className="w-full sm:w-80">
            <Input
              aria-label="Cari transaksi di buku kas"
              placeholder="Cari deskripsi, no. referensi, atau penerima..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          <label htmlFor="ledger-status-filter" className="sr-only">
            Filter status transaksi
          </label>
          <select
            id="ledger-status-filter"
            value={statusFilter}
            onChange={(e) => {
              const nextStatus = e.target.value as 'all' | 'posted' | 'void';
              setStatusFilter(nextStatus);
              void fetchFilteredRows(searchQuery, nextStatus);
            }}
            className="h-9 rounded-md border border-line-strong bg-surface px-3 text-sm text-ink-primary focus-visible:outline-2 focus-visible:outline-focus-ring"
          >
            <option value="all">Semua status</option>
            <option value="posted">Hanya tercatat</option>
            <option value="void">Hanya dibatalkan (void)</option>
          </select>
          <Button type="submit" variant="secondary" size="sm" disabled={isLoading}>
            {isLoading ? 'Memuat...' : 'Cari'}
          </Button>
          {searchQuery || statusFilter !== 'all' ? (
            <Button
              type="button"
              variant="tertiary"
              size="sm"
              onClick={() => {
                setSearchQuery('');
                setStatusFilter('all');
                void fetchFilteredRows('', 'all');
              }}
            >
              Reset filter
            </Button>
          ) : null}
        </div>

        <div className="text-xs text-ink-secondary tabular-nums">
          Menampilkan <span className="font-semibold text-ink-primary">{rows.length}</span> baris transaksi + 1 baris saldo awal
        </div>
      </form>

      {/* Tabel Buku Kas 11 Kolom Format Plombokan (DESIGN.md §5.3) */}
      <div className="overflow-hidden rounded-lg border border-[var(--line)] bg-[var(--surface)] shadow-2xs">
        <div className="max-h-[640px] overflow-auto">
          <table className="w-full min-w-[1360px] border-collapse text-left text-sm table-fixed">
            <colgroup>
              <col className="w-[52px]" />
              <col className="w-[112px]" />
              <col className="w-[170px]" />
              <col className="w-[300px]" />
              <col className="w-[200px]" />
              <col className="w-[90px]" />
              <col className="w-[130px]" />
              <col className="w-[130px]" />
              <col className="w-[140px]" />
              <col className="w-[140px]" />
              <col className="w-[120px]" />
            </colgroup>
            <thead className="sticky top-0 z-20 border-b border-[var(--line-strong)] bg-[var(--surface-muted)] text-xs font-semibold text-[var(--ink-secondary)]">
              <tr>
                <th
                  scope="col"
                  className="sticky left-0 top-0 z-30 w-[52px] min-w-[52px] max-w-[52px] border-r border-[var(--line-subtle)] bg-[var(--surface-muted)] px-2.5 py-2.5 text-right tabular-nums shadow-[1px_0_0_0_var(--line)]"
                >
                  NO
                </th>
                <th
                  scope="col"
                  className="sticky left-[52px] top-0 z-30 w-[112px] min-w-[112px] max-w-[112px] border-r border-[var(--line-subtle)] bg-[var(--surface-muted)] px-2.5 py-2.5 shadow-[1px_0_0_0_var(--line)]"
                >
                  TANGGAL
                </th>
                <th
                  scope="col"
                  className="w-[170px] border-r border-[var(--line-subtle)] px-2.5 py-2.5"
                >
                  NO. REFERENCE
                </th>
                <th
                  scope="col"
                  className="w-[300px] border-r border-[var(--line-subtle)] px-3 py-2.5"
                >
                  DESKRIPSI
                </th>
                <th
                  scope="col"
                  className="w-[200px] border-r border-[var(--line-subtle)] px-2.5 py-2.5"
                >
                  REKENING PENERIMA
                </th>
                <th
                  scope="col"
                  className="w-[90px] border-r border-[var(--line-subtle)] px-2.5 py-2.5"
                >
                  BANK
                </th>
                <th
                  scope="col"
                  className="w-[130px] border-r border-[var(--line-subtle)] px-2.5 py-2.5 text-right"
                >
                  DEBIT
                </th>
                <th
                  scope="col"
                  className="w-[130px] border-r border-[var(--line-subtle)] px-2.5 py-2.5 text-right"
                >
                  KREDIT
                </th>
                <th
                  scope="col"
                  className="w-[140px] border-r border-[var(--line-subtle)] px-2.5 py-2.5 text-right"
                >
                  TOTAL
                </th>
                <th
                  scope="col"
                  className="w-[140px] border-r border-[var(--line-subtle)] px-2.5 py-2.5"
                >
                  KET
                </th>
                <th scope="col" className="w-[120px] px-2.5 py-2.5">
                  DOKUMENTASI NOTA
                </th>
              </tr>
            </thead>

            <tbody className="divide-y divide-[var(--line-subtle)]">
              {/* Baris 1 (NO = 1): PERPINDAHAN SALDO BULAN SEBELUMNYA (OI-04) */}
              <tr className="bg-[var(--surface-subtle)] font-medium text-[var(--ink-primary)]">
                <td className="sticky left-0 z-10 w-[52px] min-w-[52px] max-w-[52px] border-r border-[var(--line-subtle)] bg-[var(--surface-subtle)] px-2.5 py-2 text-right tabular-nums shadow-[1px_0_0_0_var(--line)]">
                  1
                </td>
                <td className="sticky left-[52px] z-10 w-[112px] min-w-[112px] max-w-[112px] border-r border-[var(--line-subtle)] bg-[var(--surface-subtle)] px-2.5 py-2 tabular-nums shadow-[1px_0_0_0_var(--line)] whitespace-nowrap">
                  {formatTxDate(openingDateIso)}
                </td>
                <td className="border-r border-[var(--line-subtle)] px-2.5 py-2 font-mono text-xs text-[var(--ink-muted)]">
                  —
                </td>
                <td
                  colSpan={3}
                  className="border-r border-[var(--line-subtle)] px-3 py-2 text-center font-semibold tracking-tight text-[var(--ink-primary)] truncate"
                >
                  {getOpeningRowDescription(
                    kitchen.year,
                    kitchen.month,
                    availablePeriods.some(
                      (p) =>
                        (p.year < kitchen.year ||
                          (p.year === kitchen.year && p.month < kitchen.month)) &&
                        p.status === 'locked',
                    ),
                  )}
                </td>
                <td className="border-r border-[var(--line-subtle)] px-2.5 py-2 text-right tabular-nums text-[var(--ok)] whitespace-nowrap">
                  {formatLedgerCellAmount(openingBalanceBig)}
                </td>
                <td className="border-r border-[var(--line-subtle)] px-2.5 py-2 text-right tabular-nums text-[var(--ink)] whitespace-nowrap">
                  {formatLedgerCellAmount(0n)}
                </td>
                <td className="border-r border-[var(--line-subtle)] px-2.5 py-2 text-right font-semibold tabular-nums text-[var(--ink-primary)] whitespace-nowrap">
                  {formatRupiah(openingBalanceBig)}
                </td>
                <td className="border-r border-[var(--line-subtle)] px-2.5 py-2 text-xs text-[var(--ink-secondary)] truncate">
                  Saldo awal periode
                </td>
                <td className="px-2.5 py-2 text-xs text-[var(--ink-muted)]" />
              </tr>

              {/* Baris Kosong bila belum ada transaksi atau hasil filter 0 */}
              {rows.length === 0 && (
                <tr>
                  <td
                    colSpan={11}
                    className="px-6 py-10 text-center text-xs text-[var(--ink-muted)] bg-[var(--surface)]"
                  >
                    <div className="flex flex-col items-center justify-center gap-1.5">
                      <p className="font-semibold text-[var(--ink)] text-sm">
                        {searchQuery.trim() || statusFilter !== 'all'
                          ? 'Tidak ada transaksi yang cocok dengan filter pencarian.'
                          : 'Belum ada transaksi operasional pada periode ini.'}
                      </p>
                      <p className="text-[var(--ink-muted)]">
                        {searchQuery.trim() || statusFilter !== 'all'
                          ? 'Periksa kembali ejaan atau klik tombol "Reset filter" di atas.'
                          : 'Mulai dengan mengunggah berkas bukti transfer (PDF/JPG) atau catat transaksi manual.'}
                      </p>
                    </div>
                  </td>
                </tr>
              )}

              {/* Baris 2..N: Transaksi Buku Kas */}
              {rows.map((row) => {
                const isVoid = row.status === 'void';
                const debitBig = BigInt(row.debit);
                const creditBig = BigInt(row.credit);
                const runningBig = BigInt(row.runningBalance);
                const recipientText = formatRecipientColumn(row);

                return (
                  <tr
                    key={row.id}
                    onClick={() => openInspectPanel(row)}
                    className={`group cursor-pointer transition-colors hover:bg-[var(--surface-muted)] ${
                      isVoid ? 'bg-[var(--surface-subtle)]/50 text-[var(--ink-muted)]' : 'bg-[var(--surface)]'
                    }`}
                  >
                    <td className="sticky left-0 z-10 w-[52px] min-w-[52px] max-w-[52px] border-r border-[var(--line-subtle)] bg-[var(--surface)] px-2.5 py-2 text-right tabular-nums group-hover:bg-[var(--surface-muted)] shadow-[1px_0_0_0_var(--line)]">
                      {isVoid ? '—' : row.rowNo + 1}
                    </td>
                    <td className="sticky left-[52px] z-10 w-[112px] min-w-[112px] max-w-[112px] border-r border-[var(--line-subtle)] bg-[var(--surface)] px-2.5 py-2 tabular-nums group-hover:bg-[var(--surface-muted)] shadow-[1px_0_0_0_var(--line)] whitespace-nowrap">
                      {formatTxDate(row.txDate)}
                    </td>
                    <td
                      className="border-r border-[var(--line-subtle)] px-2.5 py-2 font-mono text-xs overflow-hidden"
                      onClick={(e) => {
                        if (row.referenceNo) {
                          e.stopPropagation();
                          void handleCopyReference(row.referenceNo, row.id);
                        }
                      }}
                    >
                      {row.referenceNo ? (
                        <div className="flex items-center justify-between gap-1 overflow-hidden">
                          <span
                            className={`truncate ${isVoid ? 'line-through' : ''}`}
                            title={row.referenceNo}
                          >
                            {row.referenceNo}
                          </span>
                          <span className="invisible text-[11px] text-[var(--accent)] group-hover:visible shrink-0">
                            {copiedRefId === row.id ? 'Disalin' : 'Salin'}
                          </span>
                        </div>
                      ) : (
                        <span className="text-[var(--ink-muted)]">—</span>
                      )}
                    </td>
                    <td
                      className="border-r border-[var(--line-subtle)] px-3 py-2 overflow-hidden"
                      title={row.description}
                    >
                      <div className="flex flex-col gap-0.5 overflow-hidden">
                        <span
                          className={`truncate ${
                            isVoid ? 'line-through text-[var(--ink-muted)]' : 'text-[var(--ink-primary)]'
                          }`}
                        >
                          {row.description}
                        </span>
                        {row.kind === 'admin_fee' ? (
                          <span className="text-[11px] text-[var(--ink-secondary)] truncate">
                            Biaya admin berpasangan (Ref: {row.referenceNo ?? '—'})
                          </span>
                        ) : null}
                      </div>
                    </td>
                    <td
                      className="border-r border-[var(--line-subtle)] px-2.5 py-2 text-xs overflow-hidden"
                      title={recipientText}
                    >
                      <span className={`truncate block ${isVoid ? 'line-through' : ''}`}>
                        {recipientText}
                      </span>
                    </td>
                    <td className="border-r border-[var(--line-subtle)] px-2.5 py-2 text-xs truncate">
                      {row.counterpartyBank ?? ''}
                    </td>
                    <td
                      className={`border-r border-[var(--line-subtle)] px-2.5 py-2 text-right tabular-nums whitespace-nowrap ${
                        isVoid ? 'line-through text-[var(--ink-muted)]' : 'text-[var(--ok)]'
                      }`}
                    >
                      {formatLedgerCellAmount(debitBig)}
                    </td>
                    <td
                      className={`border-r border-[var(--line-subtle)] px-2.5 py-2 text-right tabular-nums whitespace-nowrap ${
                        isVoid ? 'line-through text-[var(--ink-muted)]' : 'text-[var(--ink)]'
                      }`}
                    >
                      {formatLedgerCellAmount(creditBig)}
                    </td>
                    <td className="border-r border-[var(--line-subtle)] px-2.5 py-2 text-right font-medium tabular-nums text-[var(--ink-primary)] whitespace-nowrap">
                      {isVoid ? '—' : formatRupiah(runningBig)}
                    </td>
                    <td className="border-r border-[var(--line-subtle)] px-2.5 py-2 text-xs overflow-hidden">
                      <div className="flex flex-wrap items-center gap-1 overflow-hidden">
                        {isVoid ? <Badge tone="danger">Dibatalkan</Badge> : null}
                        {row.note ? (
                          <span className="text-[var(--ink-secondary)] truncate">{row.note}</span>
                        ) : null}
                      </div>
                    </td>
                    <td className="px-2.5 py-2 text-xs text-[var(--ink-muted)]" />
                  </tr>
                );
              })}
            </tbody>

            {/* Baris Penutup SISA UANG (DESIGN.md §5.3 & PRD Lampiran A) */}
            <tfoot className="sticky bottom-0 z-20 border-t-2 border-[var(--line-strong)] bg-[var(--surface-muted)] font-semibold text-[var(--ink-primary)]">
              <tr>
                <td
                  colSpan={8}
                  className="border-r border-[var(--line-subtle)] px-3 py-2.5 text-center tracking-wide"
                >
                  SISA UANG
                </td>
                <td
                  data-testid="ledger-sisa-uang"
                  className="border-r border-[var(--line-subtle)] px-2.5 py-2.5 text-right tabular-nums text-[var(--ink-primary)] whitespace-nowrap"
                >
                  {formatRupiah(closingBalanceBig)}
                </td>
                <td colSpan={2} className="px-2.5 py-2.5 text-xs font-normal text-[var(--ink-secondary)] truncate">
                  *Biaya admin bank :{' '}
                  {formatRupiah(BigInt(kitchen.adminFeeDefault))}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      {/* Panel Samping 480px untuk Tambah / Edit / Batalkan Transaksi (DESIGN.md §8.4) */}
      {panel.type !== 'closed' ? (
        <div className="fixed inset-0 z-40 flex justify-end bg-ink-primary/25">
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="side-panel-title"
            className="flex h-full w-full max-w-[480px] flex-col justify-between border-l border-line-strong bg-surface p-5 shadow-md overflow-y-auto"
          >
            <div>
              <div className="flex items-center justify-between border-b border-line-subtle pb-3">
                <div>
                  <h2
                    id="side-panel-title"
                    className="text-base font-semibold text-ink-primary"
                  >
                    {panel.type === 'create'
                      ? formKind === 'incoming'
                        ? 'Catat Dana Masuk (Debit)'
                        : 'Tambah Transaksi Manual (Kredit)'
                      : 'Detail & Edit Transaksi Buku Kas'}
                  </h2>
                  <p className="text-xs text-ink-secondary">
                    {kitchen.name} · Periode {kitchen.periodLabel}
                  </p>
                </div>
                <Button
                  variant="tertiary"
                  size="sm"
                  onClick={() => setPanel({ type: 'closed' })}
                >
                  Tutup
                </Button>
              </div>

              {panelError ? (
                <div
                  role="alert"
                  className="mt-3 rounded-md border border-danger bg-danger-subtle p-3 text-xs text-danger"
                >
                  {panelError}
                </div>
              ) : null}

              {panel.type === 'create' ? (
                <form
                  id="ledger-create-form"
                  onSubmit={(e) => void handleCreateSubmit(e)}
                  className="mt-4 space-y-3.5"
                >
                  <div className="grid grid-cols-2 gap-2">
                    <Button
                      type="button"
                      variant={formKind === 'incoming' ? 'primary' : 'secondary'}
                      onClick={() => {
                        setFormKind('incoming');
                        setFormIncludeFee(false);
                      }}
                    >
                      Dana Masuk (Debit)
                    </Button>
                    <Button
                      type="button"
                      variant={formKind === 'outgoing' ? 'primary' : 'secondary'}
                      onClick={() => {
                        setFormKind('outgoing');
                        setFormIncludeFee(true);
                      }}
                    >
                      Dana Keluar (Kredit)
                    </Button>
                  </div>

                  <Input
                    label="Tanggal transaksi (WIB)"
                    type="date"
                    required
                    value={formDate}
                    onChange={(e) => setFormDate(e.target.value)}
                  />

                  <Input
                    label={
                      formKind === 'incoming'
                        ? 'Nomor referensi (opsional untuk dana masuk)'
                        : 'Nomor referensi bukti transfer'
                    }
                    placeholder="Contoh: 056586490488"
                    value={formRefNo}
                    onChange={(e) => setFormRefNo(e.target.value)}
                  />

                  <Input
                    label="Deskripsi pembukuan"
                    placeholder="Contoh: PEMBAYARAN BERAS 500 KG"
                    required
                    value={formDesc}
                    onChange={(e) => setFormDesc(e.target.value)}
                  />

                  <Input
                    label="Nominal Rupiah (bilangan bulat tanpa titik)"
                    placeholder="Contoh: 7250000"
                    required
                    inputMode="numeric"
                    value={formAmount}
                    onChange={(e) => setFormAmount(e.target.value)}
                  />

                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <Input
                      label="Nomor rekening penerima"
                      placeholder="Contoh: 184601001020501"
                      value={formAccount}
                      onChange={(e) => setFormAccount(e.target.value)}
                    />
                    <Input
                      label="Nama pemilik rekening"
                      placeholder="Contoh: BUDI SANTOSO"
                      value={formRecipientName}
                      onChange={(e) => setFormRecipientName(e.target.value)}
                    />
                  </div>

                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <Input
                      label="Bank penerima"
                      placeholder="BRI / BCA / MANDIRI / BNI"
                      value={formBank}
                      onChange={(e) => setFormBank(e.target.value)}
                    />
                    <Input
                      label="Keterangan (KET)"
                      placeholder="Opsional"
                      value={formNote}
                      onChange={(e) => setFormNote(e.target.value)}
                    />
                  </div>

                  {formKind === 'outgoing' ? (
                    <div className="rounded-md border border-line-subtle bg-surface-subtle p-3 space-y-2.5">
                      <label className="flex items-start gap-2 text-xs font-medium text-ink-primary cursor-pointer">
                        <input
                          type="checkbox"
                          checked={formIncludeFee}
                          onChange={(e) => setFormIncludeFee(e.target.checked)}
                          className="mt-0.5 rounded border-line-strong"
                        />
                        <span>
                          Buat baris <code className="font-mono">ADMIN BANK</code>{' '}
                          berpasangan secara atomik dengan nomor referensi yang sama
                        </span>
                      </label>
                      {formIncludeFee ? (
                        <Input
                          label="Nominal biaya admin bank (Rp)"
                          inputMode="numeric"
                          value={formFeeAmount}
                          onChange={(e) => setFormFeeAmount(e.target.value)}
                        />
                      ) : null}
                    </div>
                  ) : null}
                </form>
              ) : (
                <div className="mt-4 space-y-4">
                  <div className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-line-subtle bg-surface-subtle px-3 py-2 text-xs">
                    <span>
                      Jenis:{' '}
                      <strong className="text-ink-primary">
                        {panel.row.kind === 'incoming'
                          ? 'Dana Masuk (Debit)'
                          : panel.row.kind === 'admin_fee'
                            ? 'Biaya Admin Bank (Kredit)'
                            : 'Dana Keluar (Kredit)'}
                      </strong>
                    </span>
                    <div className="flex items-center gap-2">
                      <Badge
                        tone={panel.row.status === 'void' ? 'danger' : 'accent'}
                      >
                        {panel.row.status === 'void' ? 'Dibatalkan' : 'Tercatat'}
                      </Badge>
                      <span className="font-mono text-ink-secondary">
                        Versi #{panel.row.version}
                      </span>
                    </div>
                  </div>

                  <form
                    id="ledger-edit-form"
                    onSubmit={(e) => void handleUpdateSubmit(e)}
                    className="space-y-3"
                  >
                    <Input
                      label="Tanggal transaksi (WIB)"
                      type="date"
                      required
                      disabled={isLocked || panel.row.status === 'void'}
                      value={formDate}
                      onChange={(e) => setFormDate(e.target.value)}
                    />

                    <Input
                      label="Nomor referensi"
                      disabled={isLocked || panel.row.status === 'void'}
                      value={formRefNo}
                      onChange={(e) => setFormRefNo(e.target.value)}
                    />

                    <Input
                      label="Deskripsi pembukuan"
                      required
                      disabled={isLocked || panel.row.status === 'void'}
                      value={formDesc}
                      onChange={(e) => setFormDesc(e.target.value)}
                    />

                    <Input
                      label="Nominal Rupiah (bilangan bulat)"
                      required
                      inputMode="numeric"
                      disabled={isLocked || panel.row.status === 'void'}
                      value={formAmount}
                      onChange={(e) => setFormAmount(e.target.value)}
                    />

                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                      <Input
                        label="Nomor rekening penerima"
                        disabled={isLocked || panel.row.status === 'void'}
                        value={formAccount}
                        onChange={(e) => setFormAccount(e.target.value)}
                      />
                      <Input
                        label="Nama pemilik rekening"
                        disabled={isLocked || panel.row.status === 'void'}
                        value={formRecipientName}
                        onChange={(e) => setFormRecipientName(e.target.value)}
                      />
                    </div>

                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                      <Input
                        label="Bank penerima"
                        disabled={isLocked || panel.row.status === 'void'}
                        value={formBank}
                        onChange={(e) => setFormBank(e.target.value)}
                      />
                      <Input
                        label="Keterangan (KET)"
                        disabled={isLocked || panel.row.status === 'void'}
                        value={formNote}
                        onChange={(e) => setFormNote(e.target.value)}
                      />
                    </div>
                  </form>

                  {/* Panel Pembatalan Transaksi (Void dengan Audit Log, tanpa hapus permanen) */}
                  {panel.row.status !== 'void' && !isLocked ? (
                    <div className="border-t border-line-subtle pt-3">
                      {!showVoidConfirm ? (
                        <Button
                          variant="danger"
                          size="sm"
                          onClick={() => setShowVoidConfirm(true)}
                        >
                          Batalkan Transaksi (Void)...
                        </Button>
                      ) : (
                        <form
                          onSubmit={(e) => void handleVoidSubmit(e)}
                          className="space-y-2.5 rounded-md border border-danger bg-danger-subtle/50 p-3"
                        >
                          <p className="text-xs font-medium text-danger">
                            Transaksi tidak dihapus permanen, melainkan ditandai{' '}
                            <code>void</code> dan dicatat di log audit.
                            {panel.row.kind === 'outgoing'
                              ? ' Baris ADMIN BANK pasangannya (jika ada) juga akan dibatalkan otomatis.'
                              : ''}
                          </p>
                          <Input
                            label="Alasan pembatalan (wajib)"
                            placeholder="Contoh: Salah input nominal bukti transfer"
                            required
                            value={voidReason}
                            onChange={(e) => setVoidReason(e.target.value)}
                          />
                          <div className="flex items-center gap-2">
                            <Button
                              type="submit"
                              variant="danger"
                              size="sm"
                              disabled={isSubmitting || voidReason.trim().length < 3}
                            >
                              Konfirmasi Batalkan Transaksi
                            </Button>
                            <Button
                              type="button"
                              variant="tertiary"
                              size="sm"
                              onClick={() => setShowVoidConfirm(false)}
                            >
                              Batal
                            </Button>
                          </div>
                        </form>
                      )}
                    </div>
                  ) : null}
                </div>
              )}
            </div>

            <div className="mt-6 flex items-center justify-end gap-2 border-t border-line-subtle pt-3">
              <Button
                variant="secondary"
                onClick={() => setPanel({ type: 'closed' })}
              >
                Tutup
              </Button>
              {panel.type === 'create' ? (
                <Button
                  type="submit"
                  form="ledger-create-form"
                  variant="primary"
                  disabled={isSubmitting || isLocked}
                >
                  {isSubmitting ? 'Menyimpan...' : 'Simpan ke Buku Kas'}
                </Button>
              ) : panel.row.status !== 'void' && !isLocked ? (
                <Button
                  type="submit"
                  form="ledger-edit-form"
                  variant="primary"
                  disabled={isSubmitting}
                >
                  {isSubmitting ? 'Menyimpan...' : 'Simpan Perubahan'}
                </Button>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
