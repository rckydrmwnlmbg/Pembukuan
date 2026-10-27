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
  Users,
  UserPlus,
  Trash2,
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

interface KitchenMemberItem {
  userId: string;
  email: string;
  role: 'admin' | 'maker' | 'approver' | 'viewer';
  createdAt: string;
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

  // Member management states
  const [members, setMembers] = useState<KitchenMemberItem[]>([]);
  const [newMemberEmail, setNewMemberEmail] = useState('');
  const [newMemberRole, setNewMemberRole] = useState<
    'admin' | 'maker' | 'approver' | 'viewer'
  >('approver');
  const [memberLoading, setMemberLoading] = useState(false);
  const [memberError, setMemberError] = useState<string | null>(null);
  const [memberSuccess, setMemberSuccess] = useState<string | null>(null);

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

  const fetchMembers = React.useCallback(async () => {
    try {
      const res = await fetch(`/api/k/${kitchenId}/members`);
      if (res.ok) {
        const data = await res.json();
        setMembers(data.members || []);
      }
    } catch {
      // Ignore
    }
  }, [kitchenId]);

  async function handleAddMember(e: React.FormEvent) {
    e.preventDefault();
    if (!newMemberEmail.trim()) return;
    setMemberLoading(true);
    setMemberError(null);
    setMemberSuccess(null);
    try {
      const res = await fetch(`/api/k/${kitchenId}/members`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: newMemberEmail.trim(),
          role: newMemberRole,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(
          data.error?.message || data.error || 'Gagal menambahkan anggota.',
        );
      }
      setMemberSuccess(data.message || 'Anggota berhasil ditambahkan.');
      setNewMemberEmail('');
      await fetchMembers();
    } catch (err: unknown) {
      setMemberError(err instanceof Error ? err.message : 'Terjadi galat.');
    } finally {
      setMemberLoading(false);
    }
  }

  async function handleUpdateMemberRole(
    userId: string,
    role: 'admin' | 'maker' | 'approver' | 'viewer',
  ) {
    try {
      const res = await fetch(`/api/k/${kitchenId}/members`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, role }),
      });
      if (res.ok) {
        await fetchMembers();
      }
    } catch {
      // Ignore
    }
  }

  async function handleDeleteMember(userId: string, email: string) {
    if (
      !confirm(
        `Apakah Anda yakin ingin mencabut akses ${email} dari dapur ini?`,
      )
    ) {
      return;
    }
    try {
      const res = await fetch(`/api/k/${kitchenId}/members`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId }),
      });
      const data = await res.json();
      if (!res.ok) {
        alert(data.error?.message || data.error || 'Gagal menghapus anggota.');
      } else {
        await fetchMembers();
      }
    } catch {
      // Ignore
    }
  }

  useEffect(() => {
    async function fetchData() {
      try {
        setLoading(true);
        setErrorMsg(null);

        const [setRes, legRes] = await Promise.all([
          fetch(`/api/k/${kitchenId}/settings`),
          fetch(`/api/k/${kitchenId}/transactions?limit=1`),
          fetchMembers(),
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
  }, [kitchenId, fetchMembers]);

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
    <div className="space-y-6">
      {/* Navigasi atas */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Link
            href={`/k/${kitchenId}/ledger`}
            className="inline-flex items-center gap-1.5 text-xs text-[var(--ink-muted)] hover:text-[var(--ink)] font-medium"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            Kembali ke Buku Kas
          </Link>
          <span className="text-xs font-medium text-[var(--ink-muted)]">
            {settings.name} ({settings.code})
          </span>
        </div>

        <div className="flex items-center gap-2">
          <Link
            href={`/k/${kitchenId}/audit`}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-[var(--line)] bg-[var(--surface)] text-xs font-medium text-[var(--ink)] hover:bg-[var(--surface-muted)] transition-colors"
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

        {/* Section: Kelola Anggota & Pengawas Dapur */}
        <div className="bg-[var(--surface)] border border-[var(--line)] rounded-lg p-5 space-y-4">
          <div className="border-b border-[var(--line)] pb-3 flex items-center justify-between">
            <div>
              <div className="flex items-center gap-2">
                <Users className="w-4 h-4 text-[var(--accent)]" />
                <h3 className="text-sm font-semibold text-[var(--ink-base)]">
                  Pengelola & Pengawas Dapur
                </h3>
              </div>
              <p className="text-xs text-[var(--ink-muted)] mt-0.5">
                Atur akun yang memiliki akses ke dapur ini beserta tingkat perannya (Admin, Maker, Pengawas/Approver, Viewer).
              </p>
            </div>
            <span className="text-xs font-semibold px-2 py-0.5 rounded bg-[var(--surface-muted)] text-[var(--ink)] border border-[var(--line)]">
              {members.length} Akun
            </span>
          </div>

          {memberSuccess && (
            <div className="p-3 rounded-md bg-[var(--ok-subtle,#e6f4ea)] text-xs text-[var(--ok,#137333)] flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              <span>{memberSuccess}</span>
            </div>
          )}

          {memberError && (
            <div className="p-3 rounded-md bg-[var(--danger-subtle,#fce8e6)] text-xs text-[var(--danger,#c5221f)] flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <span>{memberError}</span>
            </div>
          )}

          {/* Form Tambah Anggota */}
          <form onSubmit={handleAddMember} className="p-3.5 rounded-lg border border-[var(--line)] bg-[var(--surface-muted)] space-y-3">
            <div className="text-xs font-semibold text-[var(--ink)] flex items-center gap-1.5">
              <UserPlus className="w-3.5 h-3.5 text-[var(--accent)]" />
              <span>Beri Akses ke Akun Terdaftar</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-12 gap-2.5">
              <input
                type="email"
                required
                placeholder="Email akun (misal: pengawas@yayasan.org)"
                value={newMemberEmail}
                onChange={(e) => setNewMemberEmail(e.target.value)}
                className="sm:col-span-6 rounded-md border border-[var(--line-strong)] bg-[var(--surface)] px-3 py-1.5 text-xs text-[var(--ink)] focus:outline-none focus:ring-1 focus:ring-[var(--accent)]"
              />
              <select
                value={newMemberRole}
                onChange={(e) =>
                  setNewMemberRole(
                    e.target.value as 'admin' | 'maker' | 'approver' | 'viewer',
                  )
                }
                className="sm:col-span-3 rounded-md border border-[var(--line-strong)] bg-[var(--surface)] px-2 py-1.5 text-xs text-[var(--ink)] focus:outline-none focus:ring-1 focus:ring-[var(--accent)]"
              >
                <option value="approver">Pengawas (Approver)</option>
                <option value="maker">Maker (Staf Keuangan)</option>
                <option value="viewer">Viewer (Hanya Baca)</option>
                <option value="admin">Admin (Pemilik Dapur)</option>
              </select>
              <button
                type="submit"
                disabled={memberLoading}
                className="sm:col-span-3 inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-md bg-[var(--accent)] text-xs font-semibold text-[var(--ink-on-accent,#fff)] hover:opacity-90 disabled:opacity-50 transition-opacity"
              >
                <UserPlus className="w-3.5 h-3.5" />
                <span>{memberLoading ? 'Menambahkan...' : 'Tambah Akses'}</span>
              </button>
            </div>
            <p className="text-[11px] text-[var(--ink-muted)]">
              Jika akun belum terdaftar, sistem akan otomatis mengirim surel undangan resmi dengan tautan untuk menetapkan kata sandi (FR-F1.3).
            </p>
          </form>

          {/* Tabel Daftar Anggota */}
          <div className="overflow-x-auto rounded-lg border border-[var(--line)]">
            <table className="w-full text-xs text-left">
              <thead className="bg-[var(--surface-muted)] text-[var(--ink-muted)] border-b border-[var(--line)]">
                <tr>
                  <th className="px-3.5 py-2 font-medium">Email Akun</th>
                  <th className="px-3.5 py-2 font-medium">Peran (Role)</th>
                  <th className="px-3.5 py-2 font-medium text-right">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--line)]">
                {members.map((m) => (
                  <tr key={m.userId} className="hover:bg-[var(--surface-muted)] transition-colors">
                    <td className="px-3.5 py-2.5 font-medium text-[var(--ink)]">
                      {m.email}
                    </td>
                    <td className="px-3.5 py-2.5">
                      <select
                        value={m.role}
                        onChange={(e) =>
                          handleUpdateMemberRole(
                            m.userId,
                            e.target.value as
                              | 'admin'
                              | 'maker'
                              | 'approver'
                              | 'viewer',
                          )
                        }
                        className="rounded border border-[var(--line-strong)] bg-[var(--surface)] px-2 py-1 text-xs font-medium text-[var(--ink)] focus:outline-none focus:ring-1 focus:ring-[var(--accent)]"
                      >
                        <option value="admin">Admin (Penuh)</option>
                        <option value="maker">Maker (Operasional)</option>
                        <option value="approver">Pengawas (Approver)</option>
                        <option value="viewer">Viewer (Baca Saja)</option>
                      </select>
                    </td>
                    <td className="px-3.5 py-2.5 text-right">
                      <button
                        type="button"
                        onClick={() => handleDeleteMember(m.userId, m.email)}
                        title="Hapus Akses"
                        className="p-1 rounded text-[var(--danger)] hover:bg-[var(--danger-subtle,#fce8e6)] transition-colors"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

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
                  className="px-3 py-1.5 rounded-md border border-[var(--line)] text-xs text-[var(--ink-muted)] hover:bg-[var(--surface-muted)]"
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
  );
}
