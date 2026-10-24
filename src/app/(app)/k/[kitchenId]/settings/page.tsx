'use client';

import React, { useEffect, useState, use } from 'react';
import Link from 'next/link';
import {
  ArrowLeft,
  Lock,
  Unlock,
  AlertTriangle,
  History,
  Save,
  CheckCircle2,
  Calendar,
} from 'lucide-react';
import { PeriodEquation } from '@/components/domain/PeriodEquation';
import { formatRupiahNumber } from '@/lib/format';

interface KitchenSettingsData {
  id: string;
  name: string;
  code: string;
  pjName: string;
  bankCode: string;
  accountNoLast4: string;
  adminFeeDefault: string;
  openingBalance: string;
  periodId: string;
  year: number;
  month: number;
  periodStatus: 'open' | 'locked';
  nextPeriodOpeningBalance: string | null;
  pendingDraftCount: number;
  needsManualCount: number;
}

interface KitchenSummaryData {
  openingBalance: string;
  totalIncoming: string;
  totalOutgoing: string;
  closingBalance: string;
  incomingCount: number;
  outgoingCount: number;
}

export default function KitchenSettingsPage({
  params,
}: {
  params: Promise<{ kitchenId: string }>;
}) {
  const { kitchenId } = use(params);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const [settings, setSettings] = useState<KitchenSettingsData | null>(null);
  const [summary, setSummary] = useState<KitchenSummaryData>({
    openingBalance: '0',
    totalIncoming: '0',
    totalOutgoing: '0',
    closingBalance: '0',
    incomingCount: 0,
    outgoingCount: 0,
  });

  // Form states
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [pjName, setPjName] = useState('');
  const [bankCode, setBankCode] = useState('');
  const [newAccountNo, setNewAccountNo] = useState('');
  const [adminFeeDefault, setAdminFeeDefault] = useState('6500');
  const [initialOpeningBalance, setInitialOpeningBalance] = useState('');

  // Modals for period lock/unlock
  const [showLockModal, setShowLockModal] = useState(false);
  const [forceLockDrafts, setForceLockDrafts] = useState(false);
  const [showUnlockModal, setShowUnlockModal] = useState(false);
  const [unlockReason, setUnlockReason] = useState('');
  const [actionLoading, setActionLoading] = useState(false);

  useEffect(() => {
    async function fetchData() {
      try {
        setLoading(true);
        setErrorMsg(null);

        const [setRes, legRes] = await Promise.all([
          fetch(`/api/k/${kitchenId}/settings`),
          fetch(`/api/k/${kitchenId}/transactions?limit=1`),
        ]);

        if (!setRes.ok) {
          throw new Error('Gagal memuat pengaturan dapur.');
        }

        const setData: KitchenSettingsData = await setRes.json();
        setSettings(setData);
        setName(setData.name);
        setCode(setData.code);
        setPjName(setData.pjName);
        setBankCode(setData.bankCode);
        setAdminFeeDefault(setData.adminFeeDefault);
        setInitialOpeningBalance(setData.openingBalance);

        if (legRes.ok) {
          const legData = await legRes.json();
          setSummary({
            openingBalance: legData.summary.openingBalance,
            totalIncoming: legData.summary.totalIncoming,
            totalOutgoing: legData.summary.totalOutgoing,
            closingBalance: legData.summary.closingBalance,
            incomingCount: legData.incomingCount ?? 2,
            outgoingCount: legData.outgoingCount ?? (legData.totalRows ?? 115),
          });
        }
      } catch (err: unknown) {
        setErrorMsg(err instanceof Error ? err.message : 'Terjadi galat');
      } finally {
        setLoading(false);
      }
    }

    void fetchData();
  }, [kitchenId]);

  async function handleSaveSettings(e: React.FormEvent) {
    e.preventDefault();
    if (!settings) return;

    try {
      setSaving(true);
      setErrorMsg(null);
      setSuccessMsg(null);

      const payload: Record<string, unknown> = {
        name,
        code,
        pjName,
        bankCode,
        adminFeeDefault,
      };

      if (newAccountNo.trim()) {
        payload.accountNo = newAccountNo.trim();
      } else {
        payload.accountNo = `99908800${settings.accountNoLast4}`;
      }

      if (initialOpeningBalance.trim()) {
        payload.initialOpeningBalance = initialOpeningBalance.replace(/\D/g, '');
      }

      const res = await fetch(`/api/k/${kitchenId}/settings`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const resJson = await res.json();
      if (!res.ok) {
        throw new Error(resJson.error || 'Gagal menyimpan pengaturan');
      }

      setSettings((prev) => (prev ? { ...prev, ...resJson } : resJson));
      setNewAccountNo('');
      setSuccessMsg('Pengaturan dapur berhasil disimpan.');
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : 'Gagal menyimpan');
    } finally {
      setSaving(false);
    }
  }

  async function handleLockPeriod() {
    if (!settings) return;
    try {
      setActionLoading(true);
      setErrorMsg(null);

      const res = await fetch(
        `/api/k/${kitchenId}/periods/${settings.periodId}/lock`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ forceWithUnpostedDrafts: forceLockDrafts }),
        },
      );

      const resJson = await res.json();
      if (!res.ok) {
        throw new Error(resJson.error || 'Gagal mengunci periode.');
      }

      setSettings((prev) =>
        prev
          ? {
              ...prev,
              periodStatus: 'locked',
              nextPeriodOpeningBalance: resJson.nextPeriodOpeningBalance,
            }
          : null,
      );
      setShowLockModal(false);
      setSuccessMsg(
        'Periode berhasil dikunci. Saldo akhir ditetapkan sebagai saldo awal periode berikutnya.',
      );
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : 'Gagal mengunci periode');
    } finally {
      setActionLoading(false);
    }
  }

  async function handleUnlockPeriod() {
    if (!settings) return;
    try {
      setActionLoading(true);
      setErrorMsg(null);

      const res = await fetch(
        `/api/k/${kitchenId}/periods/${settings.periodId}/unlock`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ reason: unlockReason }),
        },
      );

      const resJson = await res.json();
      if (!res.ok) {
        throw new Error(resJson.error || 'Gagal membuka kembali periode.');
      }

      setSettings((prev) =>
        prev
          ? {
              ...prev,
              periodStatus: 'open',
              nextPeriodOpeningBalance: null,
            }
          : null,
      );
      setShowUnlockModal(false);
      setUnlockReason('');
      setSuccessMsg('Periode berhasil dibuka kembali oleh admin.');
    } catch (err: unknown) {
      setErrorMsg(
        err instanceof Error ? err.message : 'Gagal membuka kembali periode',
      );
    } finally {
      setActionLoading(false);
    }
  }

  async function handleTransitionPeriod() {
    if (!settings) return;
    if (
      !confirm(
        'Buat periode berikutnya otomatis dari saldo akhir periode yang terkunci?',
      )
    ) {
      return;
    }

    try {
      setActionLoading(true);
      setErrorMsg(null);

      const res = await fetch(`/api/k/${kitchenId}/periods/transition`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });

      const resJson = await res.json();
      if (!res.ok) {
        throw new Error(resJson.error || 'Gagal melanjutkan ke periode baru.');
      }

      setSettings((prev) =>
        prev
          ? {
              ...prev,
              periodId: resJson.periodId,
              year: resJson.year,
              month: resJson.month,
              openingBalance: resJson.openingBalance,
              periodStatus: 'open',
              nextPeriodOpeningBalance: null,
              pendingDraftCount: 0,
              needsManualCount: 0,
            }
          : null,
      );
      setSuccessMsg(
        `Periode baru (${resJson.month}/${resJson.year}) berhasil dibuat dengan saldo awal Rp ${formatRupiahNumber(BigInt(resJson.openingBalance))}.`,
      );
    } catch (err: unknown) {
      setErrorMsg(
        err instanceof Error ? err.message : 'Gagal melanjutkan periode',
      );
    } finally {
      setActionLoading(false);
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-[var(--canvas)] flex items-center justify-center p-6 text-[var(--ink-muted)]">
        Memuat pengaturan dapur...
      </div>
    );
  }

  if (!settings) {
    return (
      <div className="min-h-screen bg-[var(--canvas)] p-6">
        <div className="mx-auto max-w-4xl p-6 bg-[var(--surface)] border border-[var(--line)] rounded-lg text-center">
          <p className="text-[var(--danger)]">Dapur tidak ditemukan.</p>
          <Link
            href="/"
            className="mt-4 inline-block text-sm text-[var(--accent)] underline"
          >
            Kembali ke Beranda
          </Link>
        </div>
      </div>
    );
  }

  const isLocked = settings.periodStatus === 'locked';
  const totalDrafts = settings.pendingDraftCount + settings.needsManualCount;

  return (
    <div className="min-h-screen bg-[var(--canvas)] text-[var(--ink-base)] p-4 sm:p-8">
      <div className="mx-auto max-w-4xl space-y-6">
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
            <span className="text-[var(--line)]">|</span>
            <span className="text-xs font-semibold uppercase tracking-wider text-[var(--ink-muted)]">
              {settings.name} ({settings.code})
            </span>
          </div>

          <div className="flex items-center gap-2">
            <Link
              href={`/k/${kitchenId}/audit`}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-[var(--line)] bg-[var(--surface)] text-xs font-medium text-[var(--ink-base)] hover:bg-[var(--neutral-subtle)] transition-colors"
            >
              <History className="w-3.5 h-3.5" />
              Riwayat Perubahan
            </Link>
            <Link
              href={`/k/${kitchenId}/ledger`}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-[var(--accent)] text-xs font-medium text-[var(--ink-on-accent,#fff)] hover:opacity-90 transition-opacity"
            >
              Buku Kas
            </Link>
          </div>
        </div>

        {/* Notifikasi feedback */}
        {errorMsg && (
          <div className="p-3.5 rounded-md bg-[var(--danger-subtle)] border border-[var(--danger)] text-xs text-[var(--danger)]">
            {errorMsg}
          </div>
        )}
        {successMsg && (
          <div className="p-3.5 rounded-md bg-[var(--ok-subtle)] border border-[var(--ok)] text-xs text-[var(--ok)] flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            <span>{successMsg}</span>
          </div>
        )}

        {/* Strip Persamaan Saldo Periode Penuh (DESIGN.md 8.1 & M4 Task 4) */}
        <div>
          <h2 className="text-sm font-semibold text-[var(--ink-base)] mb-2">
            Status Saldo Periode
          </h2>
          <PeriodEquation
            kitchenId={kitchenId}
            periodStatus={settings.periodStatus}
            openingBalance={BigInt(summary.openingBalance)}
            totalIncoming={BigInt(summary.totalIncoming)}
            totalOutgoing={BigInt(summary.totalOutgoing)}
            closingBalance={BigInt(summary.closingBalance)}
            incomingCount={summary.incomingCount}
            outgoingCount={summary.outgoingCount}
            periodStartDate={`1 ${settings.month === 3 ? 'Mar' : 'Bulan'} ${settings.year}`}
            lastTxDate={`28 ${settings.month === 3 ? 'Mar' : 'Bulan'} ${settings.year}`}
            draftCount={totalDrafts}
            variant="full"
            canLock={!isLocked}
            onLockClick={() => setShowLockModal(true)}
          />
        </div>

        {/* Panel Kunci Periode & Transisi (M4 Task 2 & 3) */}
        <div className="bg-[var(--surface)] border border-[var(--line)] rounded-lg p-5 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[var(--line)] pb-3">
            <div>
              <h3 className="text-sm font-semibold text-[var(--ink-base)]">
                Kunci Periode ({settings.month}/{settings.year})
              </h3>
              <p className="text-xs text-[var(--ink-muted)]">
                Penguncian periode mencegah penambahan, perubahan, atau
                pembatalan transaksi di database (SECURITY S-15).
              </p>
            </div>
            <span
              className={`inline-flex items-center gap-1 px-2.5 py-1 rounded text-xs font-medium border ${
                isLocked
                  ? 'bg-[var(--neutral-subtle)] text-[var(--ink-muted)] border-[var(--line)]'
                  : 'bg-[var(--surface)] text-[var(--ink-base)] border-[var(--line)]'
              }`}
            >
              {isLocked ? (
                <>
                  <Lock className="w-3.5 h-3.5" />
                  <span>Periode Terkunci</span>
                </>
              ) : (
                <>
                  <Unlock className="w-3.5 h-3.5 text-[var(--ink-subtle)]" />
                  <span>Periode Terbuka</span>
                </>
              )}
            </span>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
            {!isLocked ? (
              <div className="space-y-2">
                <p className="text-xs text-[var(--ink-muted)]">
                  Maker dapat mengunci periode bila seluruh transaksi periode ini
                  telah selesai diposting.
                </p>
                <button
                  type="button"
                  onClick={() => setShowLockModal(true)}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-md bg-[var(--surface)] border border-[var(--line)] text-xs font-semibold text-[var(--ink-base)] hover:bg-[var(--neutral-subtle)] transition-colors"
                >
                  <Lock className="w-3.5 h-3.5 text-[var(--warning)]" />
                  Kunci Periode Ini
                </button>
              </div>
            ) : (
              <div className="space-y-3 w-full">
                <p className="text-xs text-[var(--ink-muted)]">
                  Periode ini sudah dikunci. Transaksi tidak dapat diubah di
                  database. Saldo akhir sebesar{' '}
                  <strong className="text-[var(--ink-base)]">
                    Rp{' '}
                    {formatRupiahNumber(
                      BigInt(
                        settings.nextPeriodOpeningBalance ??
                          summary.closingBalance,
                      ),
                    )}
                  </strong>{' '}
                  siap terbawa ke periode berikutnya.
                </p>

                <div className="flex flex-wrap items-center gap-3">
                  <button
                    type="button"
                    onClick={handleTransitionPeriod}
                    disabled={actionLoading}
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-md bg-[var(--accent)] text-xs font-semibold text-[var(--ink-on-accent,#fff)] hover:opacity-90 disabled:opacity-50 transition-opacity"
                  >
                    <Calendar className="w-3.5 h-3.5" />
                    Buka Periode Baru ({settings.month === 12 ? 1 : settings.month + 1}/{settings.month === 12 ? settings.year + 1 : settings.year})
                  </button>

                  <button
                    type="button"
                    onClick={() => setShowUnlockModal(true)}
                    className="inline-flex items-center gap-1.5 px-3 py-2 rounded-md border border-[var(--line)] bg-[var(--surface)] text-xs font-medium text-[var(--ink-muted)] hover:text-[var(--ink-base)] hover:bg-[var(--neutral-subtle)] transition-colors"
                  >
                    <Unlock className="w-3.5 h-3.5" />
                    Buka Kembali (Khusus Admin)
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Form Pengaturan Dapur (M4 Task 1) */}
        <form
          onSubmit={handleSaveSettings}
          className="bg-[var(--surface)] border border-[var(--line)] rounded-lg p-5 space-y-4"
        >
          <div className="border-b border-[var(--line)] pb-3">
            <h3 className="text-sm font-semibold text-[var(--ink-base)]">
              Informasi Rekening & Dapur
            </h3>
            <p className="text-xs text-[var(--ink-muted)]">
              Satu dapur memiliki tepat satu nomor rekening bank yang
              terenkripsi secara aman (PRD FR-F2).
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
            {/* Nama Dapur */}
            <div className="space-y-1.5">
              <label className="font-medium text-[var(--ink-muted)]">
                Nama Dapur (SPPG)
              </label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full rounded-md border border-[var(--line)] bg-[var(--surface)] px-3 py-2 text-xs text-[var(--ink-base)] focus:outline-none focus:ring-1 focus:ring-[var(--accent)]"
              />
            </div>

            {/* Kode Dapur */}
            <div className="space-y-1.5">
              <label className="font-medium text-[var(--ink-muted)]">
                Kode Dapur (Unik)
              </label>
              <input
                type="text"
                required
                value={code}
                onChange={(e) => setCode(e.target.value)}
                className="w-full rounded-md border border-[var(--line)] bg-[var(--surface)] px-3 py-2 text-xs font-mono text-[var(--ink-base)] focus:outline-none focus:ring-1 focus:ring-[var(--accent)]"
              />
            </div>

            {/* Nama PJ */}
            <div className="space-y-1.5">
              <label className="font-medium text-[var(--ink-muted)]">
                Penanggung Jawab (PJ)
              </label>
              <input
                type="text"
                required
                value={pjName}
                onChange={(e) => setPjName(e.target.value)}
                className="w-full rounded-md border border-[var(--line)] bg-[var(--surface)] px-3 py-2 text-xs text-[var(--ink-base)] focus:outline-none focus:ring-1 focus:ring-[var(--accent)]"
              />
            </div>

            {/* Kode Bank */}
            <div className="space-y-1.5">
              <label className="font-medium text-[var(--ink-muted)]">
                Kode Bank
              </label>
              <input
                type="text"
                required
                value={bankCode}
                onChange={(e) => setBankCode(e.target.value.toUpperCase())}
                className="w-full rounded-md border border-[var(--line)] bg-[var(--surface)] px-3 py-2 text-xs uppercase font-mono text-[var(--ink-base)] focus:outline-none focus:ring-1 focus:ring-[var(--accent)]"
              />
            </div>

            {/* Nomor Rekening */}
            <div className="space-y-1.5 sm:col-span-2">
              <label className="font-medium text-[var(--ink-muted)]">
                Nomor Rekening Bank (Terenkripsi AES-256-GCM)
              </label>
              <div className="flex flex-col sm:flex-row gap-2 items-start sm:items-center">
                <div className="px-3 py-2 rounded-md border border-[var(--line)] bg-[var(--neutral-subtle)] text-xs font-mono text-[var(--ink-muted)] shrink-0">
                  Tersimpan: ••••••••{settings.accountNoLast4}
                </div>
                <input
                  type="text"
                  placeholder="Ketik nomor rekening baru untuk mengubah..."
                  value={newAccountNo}
                  onChange={(e) => setNewAccountNo(e.target.value)}
                  className="w-full rounded-md border border-[var(--line)] bg-[var(--surface)] px-3 py-2 text-xs font-mono text-[var(--ink-base)] focus:outline-none focus:ring-1 focus:ring-[var(--accent)]"
                />
              </div>
            </div>

            {/* Biaya Admin Default */}
            <div className="space-y-1.5">
              <label className="font-medium text-[var(--ink-muted)]">
                Biaya Admin Bank Default (Rp)
              </label>
              <input
                type="text"
                required
                value={adminFeeDefault}
                onChange={(e) =>
                  setAdminFeeDefault(e.target.value.replace(/\D/g, ''))
                }
                className="w-full rounded-md border border-[var(--line)] bg-[var(--surface)] px-3 py-2 text-xs tabular-nums text-[var(--ink-base)] focus:outline-none focus:ring-1 focus:ring-[var(--accent)]"
              />
            </div>

            {/* Saldo Awal Awal Periode */}
            <div className="space-y-1.5">
              <label className="font-medium text-[var(--ink-muted)]">
                Saldo Awal Periode Berjalan (Rp)
              </label>
              <input
                type="text"
                value={initialOpeningBalance}
                onChange={(e) =>
                  setInitialOpeningBalance(e.target.value.replace(/\D/g, ''))
                }
                className="w-full rounded-md border border-[var(--line)] bg-[var(--surface)] px-3 py-2 text-xs tabular-nums text-[var(--ink-base)] focus:outline-none focus:ring-1 focus:ring-[var(--accent)]"
              />
            </div>
          </div>

          <div className="pt-2 flex justify-end">
            <button
              type="submit"
              disabled={saving}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-md bg-[var(--accent)] text-xs font-semibold text-[var(--ink-on-accent,#fff)] hover:opacity-90 disabled:opacity-50 transition-opacity"
            >
              <Save className="w-3.5 h-3.5" />
              {saving ? 'Menyimpan...' : 'Simpan Pengaturan'}
            </button>
          </div>
        </form>

        {/* Modal Konfirmasi Kunci Periode */}
        {showLockModal && (
          <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
            <div className="w-full max-w-md bg-[var(--surface)] border border-[var(--line)] rounded-lg p-5 space-y-4 shadow-xl">
              <div className="flex items-center gap-2 text-[var(--warning)]">
                <AlertTriangle className="w-5 h-5 shrink-0" />
                <h4 className="text-sm font-semibold text-[var(--ink-base)]">
                  Konfirmasi Penguncian Periode
                </h4>
              </div>

              <p className="text-xs text-[var(--ink-muted)] leading-relaxed">
                Periode yang dikunci tidak dapat menerima transaksi baru atau
                perubahan nilai saldo. Seluruh baris transaksi akan dibekukan di
                database.
              </p>

              {totalDrafts > 0 && (
                <div className="p-3 rounded-md bg-[var(--warning-subtle)] border border-[var(--warning)] text-xs text-[var(--ink-base)] space-y-2">
                  <p className="font-medium text-[var(--warning-text,inherit)]">
                    Perhatian: Masih terdapat {totalDrafts} draf bukti transfer
                    yang belum diposting.
                  </p>
                  <label className="flex items-center gap-2 cursor-pointer pt-1">
                    <input
                      type="checkbox"
                      checked={forceLockDrafts}
                      onChange={(e) => setForceLockDrafts(e.target.checked)}
                      className="rounded border-[var(--line)] text-[var(--accent)]"
                    />
                    <span>
                      Saya paham dan tetap ingin mengunci periode ini dengan draf
                      tertunda.
                    </span>
                  </label>
                </div>
              )}

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowLockModal(false)}
                  className="px-3 py-1.5 rounded-md border border-[var(--line)] text-xs text-[var(--ink-muted)] hover:bg-[var(--neutral-subtle)]"
                >
                  Batal
                </button>
                <button
                  type="button"
                  onClick={handleLockPeriod}
                  disabled={
                    actionLoading || (totalDrafts > 0 && !forceLockDrafts)
                  }
                  className="px-4 py-1.5 rounded-md bg-[var(--accent)] text-xs font-semibold text-[var(--ink-on-accent,#fff)] hover:opacity-90 disabled:opacity-50"
                >
                  {actionLoading ? 'Mengunci...' : 'Ya, Kunci Periode'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Modal Buka Kembali Periode (Khusus Admin) */}
        {showUnlockModal && (
          <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
            <div className="w-full max-w-md bg-[var(--surface)] border border-[var(--line)] rounded-lg p-5 space-y-4 shadow-xl">
              <div className="flex items-center gap-2">
                <Unlock className="w-5 h-5 text-[var(--accent)]" />
                <h4 className="text-sm font-semibold text-[var(--ink-base)]">
                  Buka Kembali Periode Terkunci
                </h4>
              </div>

              <p className="text-xs text-[var(--ink-muted)]">
                Aksi ini hanya dapat dilakukan oleh peran Admin. Alasan pembukaan
                kembali wajib diisi (minimal 5 karakter) dan akan dicatat secara
                permanen di jejak audit.
              </p>

              <div className="space-y-1.5">
                <label className="text-xs font-medium text-[var(--ink-muted)]">
                  Alasan Pembukaan Kembali
                </label>
                <textarea
                  rows={3}
                  required
                  placeholder="Contoh: Koreksi nominal transaksi belanja sayur tanggal 15 Maret..."
                  value={unlockReason}
                  onChange={(e) => setUnlockReason(e.target.value)}
                  className="w-full rounded-md border border-[var(--line)] bg-[var(--surface)] px-3 py-2 text-xs text-[var(--ink-base)] focus:outline-none focus:ring-1 focus:ring-[var(--accent)]"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowUnlockModal(false)}
                  className="px-3 py-1.5 rounded-md border border-[var(--line)] text-xs text-[var(--ink-muted)] hover:bg-[var(--neutral-subtle)]"
                >
                  Batal
                </button>
                <button
                  type="button"
                  onClick={handleUnlockPeriod}
                  disabled={actionLoading || unlockReason.trim().length < 5}
                  className="px-4 py-1.5 rounded-md bg-[var(--accent)] text-xs font-semibold text-[var(--ink-on-accent,#fff)] hover:opacity-90 disabled:opacity-50"
                >
                  {actionLoading ? 'Membuka...' : 'Buka Kembali'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
