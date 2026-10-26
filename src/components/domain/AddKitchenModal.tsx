'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { X, Building2, AlertCircle } from 'lucide-react';
import { formatRupiah } from '@/lib/format';

interface AddKitchenModalProps {
  isOpen: boolean;
  onClose: () => void;
  hasDemoData?: boolean;
}

export function AddKitchenModal({ isOpen, onClose, hasDemoData }: AddKitchenModalProps) {
  const router = useRouter();

  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [pjName, setPjName] = useState('');
  const [bankCode, setBankCode] = useState('BCA');
  const [accountNo, setAccountNo] = useState('');
  const [openingBalance, setOpeningBalance] = useState('0');
  const [adminFeeDefault, setAdminFeeDefault] = useState('6500');
  const [clearDemo, setClearDemo] = useState(hasDemoData ?? false);

  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  if (!isOpen) return null;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErrorMsg(null);

    const cleanBalance = openingBalance.replace(/\D/g, '') || '0';
    const cleanFee = adminFeeDefault.replace(/\D/g, '') || '6500';

    if (!name.trim()) {
      setErrorMsg('Nama dapur wajib diisi.');
      return;
    }
    if (!code.trim()) {
      setErrorMsg('Kode dapur wajib diisi (misal: DPR-01).');
      return;
    }
    if (!pjName.trim()) {
      setErrorMsg('Nama penanggung jawab wajib diisi.');
      return;
    }
    if (!accountNo.trim()) {
      setErrorMsg('Nomor rekening bank dapur wajib diisi.');
      return;
    }

    setIsLoading(true);
    try {
      // 1. Bersihkan demo jika dipilih
      if (clearDemo) {
        await fetch('/api/kitchens', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'clear_demo' }),
        });
      }

      // 2. Buat dapur baru
      const res = await fetch('/api/kitchens', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'create',
          name: name.trim(),
          code: code.trim().toUpperCase(),
          pjName: pjName.trim(),
          bankCode: bankCode.trim().toUpperCase(),
          accountNo: accountNo.trim(),
          openingBalance: cleanBalance,
          adminFeeDefault: cleanFee,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error?.message || data.error || 'Gagal membuat dapur.');
      }

      setIsLoading(false);
      onClose();
      // Arahkan langsung ke Buku Kas dapur baru
      if (data.kitchen?.id) {
        router.push(`/k/${data.kitchen.id}/ledger`);
      } else {
        router.refresh();
      }
    } catch (err: unknown) {
      setIsLoading(false);
      setErrorMsg(err instanceof Error ? err.message : 'Terjadi kesalahan saat menyimpan dapur.');
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-xs">
      <div className="w-full max-w-lg rounded-xl border border-[var(--line)] bg-[var(--surface)] shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Header Modal */}
        <div className="flex items-center justify-between border-b border-[var(--line)] px-6 py-4 bg-[var(--surface-muted)]">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[var(--accent-subtle)] text-[var(--accent)]">
              <Building2 className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-base font-semibold tracking-tight text-[var(--ink)]">
                Tambah Dapur Baru
              </h2>
              <p className="text-xs text-[var(--ink-muted)]">
                Setiap dapur memiliki buku kas dan saldo terisolasi sendiri.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md p-1.5 text-[var(--ink-muted)] hover:bg-[var(--surface)] hover:text-[var(--ink)] transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {errorMsg && (
            <div className="flex items-start gap-2.5 rounded-lg border border-[var(--danger)] bg-[var(--danger-subtle)] p-3 text-xs text-[var(--danger)]">
              <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
              <span>{errorMsg}</span>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="sm:col-span-2 space-y-1">
              <label className="text-xs font-semibold text-[var(--ink)]">
                Nama Dapur <span className="text-[var(--danger)]">*</span>
              </label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Contoh: Dapur Utama SPPG"
                className="h-9 w-full rounded-md border border-[var(--line-strong)] bg-[var(--surface)] px-3 text-xs text-[var(--ink)] focus:outline-none focus:ring-2 focus:ring-[var(--focus-ring)]"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-semibold text-[var(--ink)]">
                Kode Dapur <span className="text-[var(--danger)]">*</span>
              </label>
              <input
                type="text"
                required
                value={code}
                onChange={(e) => setCode(e.target.value)}
                placeholder="DPR-01"
                className="h-9 w-full rounded-md border border-[var(--line-strong)] bg-[var(--surface)] px-3 text-xs text-[var(--ink)] uppercase focus:outline-none focus:ring-2 focus:ring-[var(--focus-ring)]"
              />
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-xs font-semibold text-[var(--ink)]">
              Penanggung Jawab (PJ) <span className="text-[var(--danger)]">*</span>
            </label>
            <input
              type="text"
              required
              value={pjName}
              onChange={(e) => setPjName(e.target.value)}
              placeholder="Contoh: Ibu Siti Rahma / Pak Budi"
              className="h-9 w-full rounded-md border border-[var(--line-strong)] bg-[var(--surface)] px-3 text-xs text-[var(--ink)] focus:outline-none focus:ring-2 focus:ring-[var(--focus-ring)]"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-xs font-semibold text-[var(--ink)]">
                Bank Dapur <span className="text-[var(--danger)]">*</span>
              </label>
              <select
                value={bankCode}
                onChange={(e) => setBankCode(e.target.value)}
                className="h-9 w-full rounded-md border border-[var(--line-strong)] bg-[var(--surface)] px-2.5 text-xs text-[var(--ink)] focus:outline-none focus:ring-2 focus:ring-[var(--focus-ring)]"
              >
                <option value="BCA">Bank Central Asia (BCA)</option>
                <option value="BRI">Bank Rakyat Indonesia (BRI)</option>
                <option value="Mandiri">Bank Mandiri</option>
                <option value="BNI">Bank Negara Indonesia (BNI)</option>
                <option value="BSI">Bank Syariah Indonesia (BSI)</option>
                <option value="Jateng">Bank Jateng</option>
                <option value="DKI">Bank DKI</option>
                <option value="Lainnya">Bank Lainnya</option>
              </select>
            </div>
            <div className="space-y-1">
              <label className="text-xs font-semibold text-[var(--ink)]">
                Nomor Rekening <span className="text-[var(--danger)]">*</span>
              </label>
              <input
                type="text"
                required
                value={accountNo}
                onChange={(e) => setAccountNo(e.target.value)}
                placeholder="Contoh: 1234567890"
                className="h-9 w-full rounded-md border border-[var(--line-strong)] bg-[var(--surface)] px-3 text-xs text-[var(--ink)] tabular-nums focus:outline-none focus:ring-2 focus:ring-[var(--focus-ring)]"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <label className="text-xs font-semibold text-[var(--ink)]">
                  Saldo Awal Buku Kas
                </label>
                <span className="text-[11px] text-[var(--ink-muted)]">
                  {formatRupiah(BigInt(openingBalance.replace(/\D/g, '') || '0'))}
                </span>
              </div>
              <input
                type="text"
                value={openingBalance}
                onChange={(e) => setOpeningBalance(e.target.value.replace(/\D/g, ''))}
                placeholder="0"
                className="h-9 w-full rounded-md border border-[var(--line-strong)] bg-[var(--surface)] px-3 text-xs text-[var(--ink)] tabular-nums focus:outline-none focus:ring-2 focus:ring-[var(--focus-ring)]"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-semibold text-[var(--ink)]">
                Biaya Admin Bawaan
              </label>
              <input
                type="text"
                value={adminFeeDefault}
                onChange={(e) => setAdminFeeDefault(e.target.value.replace(/\D/g, ''))}
                placeholder="6500"
                className="h-9 w-full rounded-md border border-[var(--line-strong)] bg-[var(--surface)] px-3 text-xs text-[var(--ink)] tabular-nums focus:outline-none focus:ring-2 focus:ring-[var(--focus-ring)]"
              />
            </div>
          </div>

          {/* Opsi bersihkan demo */}
          <div className="rounded-lg border border-[var(--line)] bg-[var(--surface-muted)] p-3">
            <label className="flex items-start gap-2.5 cursor-pointer">
              <input
                type="checkbox"
                checked={clearDemo}
                onChange={(e) => setClearDemo(e.target.checked)}
                className="mt-0.5 h-4 w-4 rounded border-[var(--line-strong)] text-[var(--accent)] focus:ring-[var(--focus-ring)]"
              />
              <div className="text-xs">
                <span className="font-semibold text-[var(--ink)]">
                  Gunakan data murni (Hapus 5 dapur contoh sintetis)
                </span>
                <p className="mt-0.5 text-[11px] text-[var(--ink-muted)] leading-relaxed">
                  Centang untuk memulai pembukuan bersih khusus dapur riil Anda tanpa data demo buatan.
                </p>
              </div>
            </label>
          </div>

          {/* Tombol Aksi */}
          <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-[var(--line)]">
            <button
              type="button"
              disabled={isLoading}
              onClick={onClose}
              className="h-9 rounded-md border border-[var(--line-strong)] bg-[var(--surface)] px-4 text-xs font-semibold text-[var(--ink)] hover:bg-[var(--surface-muted)] transition-colors"
            >
              Batal
            </button>
            <button
              type="submit"
              disabled={isLoading}
              className="h-9 rounded-md bg-[var(--accent)] px-4 text-xs font-semibold text-[var(--ink-on-accent,#fff)] hover:bg-[var(--accent-hover)] transition-colors disabled:opacity-50"
            >
              {isLoading ? 'Menyimpan...' : 'Simpan Dapur'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
