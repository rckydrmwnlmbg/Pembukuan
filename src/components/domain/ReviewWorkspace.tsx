'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { formatRupiah } from '@/lib/format';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Badge } from '@/components/ui/Badge';
import { UploadDropzone } from '@/components/domain/UploadDropzone';
import type { UploadRecord } from '@/server/upload/service';

export interface ReviewWorkspaceProps {
  kitchen: {
    id: string;
    code: string;
    name: string;
    bankCode: string;
    accountNoLast4: string;
    adminFeeDefault: string;
    periodId: string;
    periodLabel: string;
    periodStatus: 'open' | 'locked';
  };
  initialUploads: readonly UploadRecord[];
}

export function ReviewWorkspace({
  kitchen,
  initialUploads,
}: ReviewWorkspaceProps) {
  const router = useRouter();
  const [queue, setQueue] = useState<UploadRecord[]>(
    initialUploads.filter((u) => u.status !== 'posted'),
  );

  useEffect(() => {
    setQueue(initialUploads.filter((u) => u.status !== 'posted'));
  }, [initialUploads]);
  const [activeIndex, setActiveIndex] = useState(0);
  const [mobileTab, setMobileTab] = useState<'file' | 'form'>('form');

  // State zoom dan geser (pan) untuk berkas di panel kiri (DESIGN.md §8.3)
  const [zoomPercent, setZoomPercent] = useState(100);
  const [panOffset, setPanOffset] = useState<{ x: number; y: number }>({
    x: 0,
    y: 0,
  });
  const [dragStart, setDragStart] = useState<{ x: number; y: number } | null>(
    null,
  );

  // State form hasil bacaan di panel kanan
  const [txDate, setTxDate] = useState('');
  const [referenceNo, setReferenceNo] = useState('');
  const [amount, setAmount] = useState('');
  const [recipientAccount, setRecipientAccount] = useState('');
  const [recipientName, setRecipientName] = useState('');
  const [recipientBank, setRecipientBank] = useState('');
  const [description, setDescription] = useState('');
  const [note, setNote] = useState('');
  const [includeAdminFee, setIncludeAdminFee] = useState(true);
  const [adminFeeAmount, setAdminFeeAmount] = useState(kitchen.adminFeeDefault);
  const [confirmWrongKitchen, setConfirmWrongKitchen] = useState(false);
  const [saveCounterpartyRule, setSaveCounterpartyRule] = useState(true);
  const [isPayrollMassal, setIsPayrollMassal] = useState(false);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showRejectConfirm, setShowRejectConfirm] = useState(false);
  const [isRejecting, setIsRejecting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const activeItem = queue[activeIndex] ?? null;

  // Sinkronkan form ketika item aktif berubah
  useEffect(() => {
    if (!activeItem) return;
    setTxDate(activeItem.txDate ?? '2026-03-28');
    setReferenceNo(activeItem.referenceNo ?? '');
    setAmount(activeItem.amount ?? '');
    setRecipientAccount(activeItem.recipientAccount ?? '');
    setRecipientName(activeItem.recipientName ?? '');
    setRecipientBank(activeItem.recipientBank ?? '');
    setDescription(
      activeItem.suggestedDescription ?? activeItem.memo ?? '',
    );
    setNote('');
    setIncludeAdminFee(activeItem.suggestedIncludeAdminFee);
    setAdminFeeAmount(
      activeItem.suggestedAdminFeeAmount || kitchen.adminFeeDefault,
    );
    setConfirmWrongKitchen(false);
    setSaveCounterpartyRule(true);
    setIsPayrollMassal(false);
    setZoomPercent(100);
    setPanOffset({ x: 0, y: 0 });
    setErrorMessage(null);
  }, [activeItem, kitchen.adminFeeDefault]);

  // Pintasan papan ketik: ↑/↓ pindah berkas, Ctrl/⌘+Enter simpan dan lanjut (DESIGN.md §8.3)
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter' && activeItem) {
        e.preventDefault();
        const formEl = document.getElementById(
          'review-post-form',
        ) as HTMLFormElement | null;
        formEl?.requestSubmit();
        return;
      }

      const targetTag = (e.target as HTMLElement | null)?.tagName;
      if (targetTag === 'INPUT' || targetTag === 'TEXTAREA' || targetTag === 'SELECT') {
        return;
      }

      if (e.key === 'ArrowDown' && activeIndex < queue.length - 1) {
        e.preventDefault();
        setActiveIndex((prev) => Math.min(queue.length - 1, prev + 1));
      } else if (e.key === 'ArrowUp' && activeIndex > 0) {
        e.preventDefault();
        setActiveIndex((prev) => Math.max(0, prev - 1));
      }
    }

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [activeIndex, activeItem, queue.length]);

  function handleUploaded(newRecords: UploadRecord[]) {
    setQueue((prev) => {
      const next = [...newRecords, ...prev];
      return next;
    });
    setActiveIndex(0);
    setToastMessage(
      `${newRecords.length} berkas bukti transfer ditambahkan ke antrean review.`,
    );
    router.refresh();
  }

  async function handlePostSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!activeItem) return;

    setErrorMessage(null);
    setIsSubmitting(true);

    try {
      const res = await fetch(
        `/api/k/${kitchen.id}/uploads/${activeItem.id}/post`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            periodId: kitchen.periodId,
            txDate: txDate.trim(),
            kind: 'outgoing',
            referenceNo: referenceNo.trim() || null,
            description: description.trim(),
            amount: amount.replace(/\D/g, ''),
            counterpartyAccount: recipientAccount.trim() || null,
            counterpartyName: isPayrollMassal
              ? 'Rekening Masing-Masing Relawan'
              : recipientName.trim() || null,
            counterpartyBank: recipientBank.trim() || null,
            note: note.trim() || null,
            includeAdminFee,
            adminFeeAmount: includeAdminFee
              ? adminFeeAmount.replace(/\D/g, '')
              : undefined,
            confirmWrongKitchen,
            saveCounterpartyRule,
            isPayrollMassal,
          }),
        },
      );

      const data = (await res.json()) as {
        error?: string | { message?: string };
      };

      if (!res.ok) {
        const msg =
          typeof data.error === 'string'
            ? data.error
            : (data.error?.message ??
              'Transaksi tidak dapat diposting. Periksa kembali isian formulir.');
        setErrorMessage(msg);
        return;
      }

      setToastMessage('Transaksi disimpan ke buku kas.');
      const nextQueue = queue.filter((u) => u.id !== activeItem.id);
      setQueue(nextQueue);
      setActiveIndex((prev) =>
        nextQueue.length === 0 ? 0 : Math.min(prev, nextQueue.length - 1),
      );
      router.refresh();
    } catch {
      setErrorMessage('Gagal menghubungi server saat menyimpan transaksi.');
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleRejectSubmit() {
    if (!activeItem) return;

    setErrorMessage(null);
    setIsRejecting(true);

    try {
      const res = await fetch(
        `/api/k/${kitchen.id}/uploads/${activeItem.id}`,
        {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({}),
        },
      );

      const data = (await res.json()) as {
        error?: string | { message?: string };
      };

      if (!res.ok) {
        const msg =
          typeof data.error === 'string'
            ? data.error
            : (data.error?.message ??
              'Gagal menolak dan menghapus berkas dari antrean.');
        setErrorMessage(msg);
        return;
      }

      setToastMessage(
        `Berkas "${activeItem.originalName}" ditolak dan dihapus dari antrean.`,
      );
      setShowRejectConfirm(false);
      const nextQueue = queue.filter((u) => u.id !== activeItem.id);
      setQueue(nextQueue);
      setActiveIndex((prev) =>
        nextQueue.length === 0 ? 0 : Math.min(prev, nextQueue.length - 1),
      );
      router.refresh();
    } catch {
      setErrorMessage('Gagal menghubungi server saat menolak berkas.');
    } finally {
      setIsRejecting(false);
    }
  }

  function isLowConfidence(field: string): boolean {
    return activeItem?.lowConfidenceFields.includes(field) ?? false;
  }

  const cleanAmountDigits = amount.replace(/\D/g, '');
  const parsedAmountPreview =
    cleanAmountDigits.length > 0 && cleanAmountDigits.length <= 13
      ? formatRupiah(BigInt(cleanAmountDigits))
      : null;

  return (
    <div className="space-y-4 pb-20">
      {/* Header Halaman Review */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-line-subtle bg-surface p-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-semibold tracking-tight text-ink-primary">
              Review bukti transfer {kitchen.name}
            </h1>
            <Badge tone="neutral">{kitchen.code}</Badge>
            <Badge tone={kitchen.periodStatus === 'locked' ? 'neutral' : 'accent'}>
              Periode {kitchen.periodLabel} (
              {kitchen.periodStatus === 'locked' ? 'Terkunci' : 'Terbuka'})
            </Badge>
          </div>
          <p className="mt-1 text-xs text-ink-secondary">
            Periksa hasil bacaan bukti transfer berdampingan dengan berkas asli
            sebelum disimpan ke buku kas.
          </p>
        </div>

        <Link
          href={`/k/${kitchen.id}/ledger`}
          className="inline-flex h-9 items-center justify-center rounded-md border border-line-strong bg-surface px-3.5 text-sm font-medium text-ink-primary transition-colors hover:bg-surface-subtle"
        >
          Lihat Buku Kas
        </Link>
      </div>

      {/* Area Unggah Bukti Transfer (DESIGN.md §5.5) */}
      <UploadDropzone
        kitchenId={kitchen.id}
        kitchenName={kitchen.name}
        onUploaded={handleUploaded}
      />

      {toastMessage ? (
        <div
          role="status"
          aria-live="polite"
          className="flex items-center justify-between rounded-md border border-line-strong bg-accent-subtle px-4 py-2.5 text-sm text-accent-primary"
        >
          <span>{toastMessage}</span>
          <button
            type="button"
            onClick={() => setToastMessage(null)}
            className="text-xs font-medium underline"
          >
            Tutup
          </button>
        </div>
      ) : null}

      {/* Kondisi Kosong bila semua draf sudah direview (DESIGN.md §5.6) */}
      {!activeItem ? (
        <section className="rounded-lg border border-line-subtle bg-surface p-8 text-center space-y-3">
          <h2 className="text-base font-semibold text-ink-primary">
            Tidak ada bukti transfer yang menunggu review di {kitchen.name}.
          </h2>
          <p className="text-xs text-ink-secondary">
            Unggah bukti transfer baru di panel atas atau buka buku kas untuk
            melihat transaksi yang sudah disimpan.
          </p>
          <div>
            <Link
              href={`/k/${kitchen.id}/ledger`}
              className="inline-flex h-9 items-center justify-center rounded-md bg-accent-primary px-4 text-sm font-medium text-ink-on-accent hover:bg-accent-primary-hover"
            >
              Buka Buku Kas {kitchen.name}
            </Link>
          </div>
        </section>
      ) : (
        <>
          {/* Tab Mobile (< 768px) sesuai DESIGN.md §8.3 */}
          <div className="flex gap-2 md:hidden">
            <Button
              variant={mobileTab === 'file' ? 'primary' : 'secondary'}
              size="sm"
              onClick={() => setMobileTab('file')}
            >
              Berkas ({activeItem.mime === 'application/pdf' ? 'PDF' : 'Gambar'})
            </Button>
            <Button
              variant={mobileTab === 'form' ? 'primary' : 'secondary'}
              size="sm"
              onClick={() => setMobileTab('form')}
            >
              Formulir Hasil Bacaan
            </Button>
          </div>

          {/* Tampilan Dua Panel 50/50 (DESIGN.md §8.3) */}
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {/* Panel Kiri: Pratinjau Berkas PDF / Gambar dengan Zoom & Geser */}
            <section
              aria-label="Pratinjau berkas bukti transfer"
              className={`flex flex-col rounded-lg border border-line-strong bg-surface overflow-hidden ${
                mobileTab === 'form' ? 'hidden md:flex' : 'flex'
              }`}
            >
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line-subtle bg-surface-subtle px-3.5 py-2.5 text-xs">
                <div className="flex items-center gap-2">
                  <Button
                    variant="secondary"
                    size="sm"
                    disabled={activeIndex === 0}
                    onClick={() => setActiveIndex((i) => Math.max(0, i - 1))}
                  >
                    Sebelumnya
                  </Button>
                  <span className="font-medium tabular-nums text-ink-primary">
                    {activeIndex + 1} / {queue.length}
                  </span>
                  <Button
                    variant="secondary"
                    size="sm"
                    disabled={activeIndex >= queue.length - 1}
                    onClick={() =>
                      setActiveIndex((i) => Math.min(queue.length - 1, i + 1))
                    }
                  >
                    Berikutnya
                  </Button>
                </div>

                <div className="flex items-center gap-1.5">
                  <Button
                    variant="secondary"
                    size="sm"
                    aria-label="Perkecil tampilan berkas"
                    onClick={() =>
                      setZoomPercent((z) => Math.max(50, z - 25))
                    }
                  >
                    −
                  </Button>
                  <span className="w-12 text-center font-mono tabular-nums text-ink-primary">
                    {zoomPercent}%
                  </span>
                  <Button
                    variant="secondary"
                    size="sm"
                    aria-label="Perbesar tampilan berkas"
                    onClick={() =>
                      setZoomPercent((z) => Math.min(250, z + 25))
                    }
                  >
                    +
                  </Button>
                  <Button
                    variant="tertiary"
                    size="sm"
                    onClick={() => {
                      setZoomPercent(100);
                      setPanOffset({ x: 0, y: 0 });
                    }}
                  >
                    Reset
                  </Button>
                </div>
              </div>

              <div className="border-b border-line-subtle bg-surface px-3.5 py-1.5 text-xs text-ink-secondary flex items-center justify-between">
                <span className="truncate font-mono">{activeItem.originalName}</span>
                <Badge
                  tone={
                    activeItem.status === 'needs_manual' ? 'warning' : 'accent'
                  }
                >
                  {activeItem.status === 'needs_manual'
                    ? 'Perlu input manual'
                    : 'Menunggu review'}
                </Badge>
              </div>

              <div
                onMouseDown={(e) =>
                  setDragStart({
                    x: e.clientX - panOffset.x,
                    y: e.clientY - panOffset.y,
                  })
                }
                onMouseMove={(e) => {
                  if (!dragStart) return;
                  setPanOffset({
                    x: e.clientX - dragStart.x,
                    y: e.clientY - dragStart.y,
                  });
                }}
                onMouseUp={() => setDragStart(null)}
                onMouseLeave={() => setDragStart(null)}
                className="relative flex min-h-[540px] flex-1 cursor-grab items-center justify-center overflow-auto bg-surface-subtle p-4 active:cursor-grabbing"
              >
                {activeItem.mime === 'application/pdf' ? (
                  <object
                    data={`/api/k/${kitchen.id}/uploads/${activeItem.id}/file`}
                    type="application/pdf"
                    className="h-[520px] w-full rounded border border-line-subtle bg-surface"
                    style={{
                      transform: `scale(${zoomPercent / 100})`,
                      transformOrigin: 'top center',
                    }}
                  >
                    <iframe
                      title={`Pratinjau PDF ${activeItem.originalName}`}
                      src={`/api/k/${kitchen.id}/uploads/${activeItem.id}/file`}
                      className="h-[520px] w-full rounded border border-line-subtle bg-surface"
                    >
                      <div className="flex flex-col items-center justify-center p-8 text-center text-ink-secondary">
                        <p className="mb-2">Pratinjau PDF tidak didukung otomatis di peramban ini.</p>
                        <a
                          href={`/api/k/${kitchen.id}/uploads/${activeItem.id}/file`}
                          target="_blank"
                          rel="noreferrer"
                          className="font-medium text-brand hover:underline"
                        >
                          Buka berkas PDF di tab baru
                        </a>
                      </div>
                    </iframe>
                  </object>
                ) : (
                  <img
                    src={`/api/k/${kitchen.id}/uploads/${activeItem.id}/file`}
                    alt={`Bukti transfer ${activeItem.originalName}`}
                    draggable={false}
                    className="max-h-[520px] rounded border border-line-subtle bg-surface shadow-xs transition-transform duration-75"
                    style={{
                      transform: `translate(${panOffset.x}px, ${panOffset.y}px) scale(${zoomPercent / 100})`,
                    }}
                  />
                )}
              </div>
            </section>

            {/* Panel Kanan: Formulir Hasil Bacaan & Pemeriksaan Konsistensi */}
            <section
              aria-label="Formulir hasil bacaan bukti transfer"
              className={`rounded-lg border border-line-strong bg-surface p-5 space-y-4 ${
                mobileTab === 'file' ? 'hidden md:block' : 'block'
              }`}
            >
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line-subtle pb-3">
                <div>
                  <span className="text-xs text-ink-secondary">Dapur tujuan:</span>
                  <h2 className="text-base font-semibold text-ink-primary">
                    {kitchen.name} ({kitchen.bankCode} ****{kitchen.accountNoLast4})
                  </h2>
                </div>
                <Badge
                  tone={
                    activeItem.status === 'needs_manual' ? 'warning' : 'accent'
                  }
                >
                  {activeItem.status === 'needs_manual'
                    ? 'Perlu input manual'
                    : 'Draf hasil bacaan'}
                </Badge>
              </div>

              {/* Banner Peringatan Dapur Salah (PRD FR-F3.4 & E7, DESIGN.md §8.3) */}
              {activeItem.wrongKitchenWarning ? (
                <div
                  role="alert"
                  className="rounded-md border border-warning bg-warning-subtle p-3.5 text-xs text-ink-primary space-y-2"
                >
                  <p className="font-semibold text-warning">
                    Peringatan Kesesuaian Rekening Pengirim (FR-F3.4)
                  </p>
                  <p>{activeItem.wrongKitchenWarning}</p>
                  <label className="flex items-start gap-2 pt-1 font-medium cursor-pointer">
                    <input
                      type="checkbox"
                      checked={confirmWrongKitchen}
                      onChange={(e) => setConfirmWrongKitchen(e.target.checked)}
                      className="mt-0.5 rounded border-line-strong"
                    />
                    <span>
                      Saya sudah memeriksa berkas dan yakin ingin menyimpan
                      transaksi ini ke {kitchen.name}.
                    </span>
                  </label>
                </div>
              ) : null}

              {/* Penjelasan Fallback bila needs_manual (PRD FR-F3.5, E1, E3, E19, E25) */}
              {activeItem.fallbackReason ? (
                <div className="rounded-md border border-line-strong bg-surface-subtle p-3 text-xs text-ink-secondary">
                  <strong className="text-ink-primary">Perlu diisi manual: </strong>
                  {activeItem.fallbackReason}
                </div>
              ) : null}

              {/* Daftar Pemeriksaan Konsistensi beserta Alasannya (PRD FR-F3.7 & DESIGN.md §8.3) */}
              {activeItem.consistencyReasons.length > 0 ? (
                <div className="rounded-md border border-warning bg-warning-subtle/60 p-3 text-xs space-y-1.5">
                  <p className="font-semibold text-warning">
                    Catatan pemeriksaan konsistensi:
                  </p>
                  <ul className="list-disc pl-4 space-y-1 text-ink-primary">
                    {activeItem.consistencyReasons.map((item) => (
                      <li key={item.code}>{item.message}</li>
                    ))}
                  </ul>
                </div>
              ) : null}

              {errorMessage ? (
                <div
                  role="alert"
                  className="rounded-md border border-danger bg-danger-subtle p-3 text-xs text-danger"
                >
                  {errorMessage}
                </div>
              ) : null}

              <form
                id="review-post-form"
                onSubmit={(e) => void handlePostSubmit(e)}
                className="space-y-3.5"
              >
                <div
                  className={
                    isLowConfidence('txDate')
                      ? 'border-l-2 border-warning pl-3'
                      : ''
                  }
                >
                  <Input
                    label="Tanggal transaksi (WIB)"
                    type="date"
                    required
                    value={txDate}
                    onChange={(e) => setTxDate(e.target.value)}
                    helperText={
                      isLowConfidence('txDate')
                        ? 'Terbaca dengan keyakinan rendah. Cocokkan dengan berkas.'
                        : 'Dapat disesuaikan bila tanggal catat berbeda dari tanggal transfer (PRD E8).'
                    }
                  />
                </div>

                <div
                  className={
                    isLowConfidence('referenceNo')
                      ? 'border-l-2 border-warning pl-3'
                      : ''
                  }
                >
                  <Input
                    label="No. referensi bukti transfer"
                    placeholder="Contoh: 202603289901"
                    value={referenceNo}
                    onChange={(e) => setReferenceNo(e.target.value)}
                    helperText={
                      isLowConfidence('referenceNo')
                        ? 'Terbaca dengan keyakinan rendah. Cocokkan dengan berkas.'
                        : undefined
                    }
                  />
                </div>

                <div
                  className={
                    isLowConfidence('amount')
                      ? 'border-l-2 border-warning pl-3'
                      : ''
                  }
                >
                  <Input
                    label="Nominal Rupiah (bilangan bulat tanpa titik)"
                    placeholder="Contoh: 2450000"
                    required
                    inputMode="numeric"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    helperText={
                      isLowConfidence('amount')
                        ? `Terbaca dengan keyakinan rendah. Cocokkan dengan berkas.${parsedAmountPreview ? ` Pratinjau: ${parsedAmountPreview}` : ''}`
                        : parsedAmountPreview
                          ? `Pratinjau nominal: ${parsedAmountPreview}`
                          : 'Masukkan angka penuh tanpa titik atau koma.'
                    }
                  />
                </div>

                <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                  <div
                    className={
                      isLowConfidence('recipientAccount')
                        ? 'border-l-2 border-warning pl-2.5'
                        : ''
                    }
                  >
                    <Input
                      label="Rekening penerima"
                      placeholder="9990..."
                      value={recipientAccount}
                      onChange={(e) => setRecipientAccount(e.target.value)}
                    />
                  </div>
                  <div
                    className={
                      isLowConfidence('recipientName')
                        ? 'border-l-2 border-warning pl-2.5'
                        : ''
                    }
                  >
                    <Input
                      label="Nama penerima"
                      placeholder="Nama pemilik rekening"
                      disabled={isPayrollMassal}
                      value={
                        isPayrollMassal
                          ? 'Rekening Masing-Masing Relawan'
                          : recipientName
                      }
                      onChange={(e) => setRecipientName(e.target.value)}
                    />
                  </div>
                  <div
                    className={
                      isLowConfidence('recipientBank')
                        ? 'border-l-2 border-warning pl-2.5'
                        : ''
                    }
                  >
                    <Input
                      label="Bank penerima"
                      placeholder="BCA / BRI / BNI / MANDIRI"
                      value={recipientBank}
                      onChange={(e) => setRecipientBank(e.target.value)}
                    />
                  </div>
                </div>

                <label className="flex items-center gap-2 text-xs text-ink-secondary cursor-pointer">
                  <input
                    type="checkbox"
                    checked={isPayrollMassal}
                    onChange={(e) => setIsPayrollMassal(e.target.checked)}
                    className="rounded border-line-strong"
                  />
                  <span>
                    Bukti payroll massal (simpan sebagai satu transaksi total ke{' '}
                    <strong className="text-ink-primary">
                      Rekening Masing-Masing Relawan
                    </strong>{' '}
                    — PRD E4)
                  </span>
                </label>

                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    <label
                      htmlFor="review-description-input"
                      className="text-xs font-medium text-ink-secondary"
                    >
                      Deskripsi pembukuan
                    </label>
                    {activeItem.matchedRuleId ? (
                      <Badge tone="accent">Usulan dari aturan penerima</Badge>
                    ) : null}
                  </div>
                  <Input
                    id="review-description-input"
                    required
                    placeholder="Contoh: Pembelian bahan baku sayur & bumbu dapur"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                  />
                  <label className="flex items-center gap-2 pt-1 text-xs text-ink-secondary cursor-pointer">
                    <input
                      type="checkbox"
                      checked={saveCounterpartyRule}
                      onChange={(e) =>
                        setSaveCounterpartyRule(e.target.checked)
                      }
                      className="rounded border-line-strong"
                    />
                    <span>
                      Simpan deskripsi ini sebagai aturan penerima untuk nomor
                      rekening tersebut (FR-F4.2)
                    </span>
                  </label>
                </div>

                <Input
                  label="Keterangan tambahan (KET)"
                  placeholder="Opsional"
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                />

                {/* Usulan Baris Biaya Admin Bank (PRD FR-F4.3 & DESIGN.md §8.3) */}
                <div className="rounded-md border border-line-subtle bg-surface-subtle p-3 space-y-2">
                  <label className="flex items-start gap-2 text-xs font-medium text-ink-primary cursor-pointer">
                    <input
                      type="checkbox"
                      checked={includeAdminFee}
                      onChange={(e) => setIncludeAdminFee(e.target.checked)}
                      className="mt-0.5 rounded border-line-strong"
                    />
                    <span>
                      Tambahkan biaya admin{' '}
                      {formatRupiah(
                        BigInt(
                          adminFeeAmount.replace(/\D/g, '') ||
                            kitchen.adminFeeDefault,
                        ),
                      )}{' '}
                      (nomor referensi sama)
                    </span>
                  </label>
                  {includeAdminFee ? (
                    <Input
                      label="Nominal biaya admin bank (Rp)"
                      inputMode="numeric"
                      value={adminFeeAmount}
                      onChange={(e) => setAdminFeeAmount(e.target.value)}
                    />
                  ) : null}
                </div>
              </form>
            </section>
          </div>

          {/* Bilah Aksi Bawah Menempel 64px (DESIGN.md §8.3) */}
          <div className="fixed bottom-0 left-0 right-0 z-30 h-16 border-t border-line-strong bg-surface px-4 sm:px-6">
            <div className="mx-auto flex h-full max-w-[1440px] items-center justify-between gap-4">
              <div className="flex items-center gap-3 text-xs text-ink-secondary">
                <span className="font-semibold tabular-nums text-ink-primary">
                  {activeIndex + 1} dari {queue.length}
                </span>
                <span className="hidden sm:inline text-ink-muted">
                  Pintasan: ↑/↓ pindah berkas, Ctrl+Enter simpan dan lanjut
                </span>
              </div>

              <div className="flex items-center gap-2.5">
                <Button
                  type="button"
                  variant="danger"
                  disabled={isSubmitting || isRejecting}
                  onClick={() => setShowRejectConfirm(true)}
                >
                  Tolak Berkas
                </Button>
                <Button
                  variant="secondary"
                  disabled={queue.length <= 1}
                  onClick={() =>
                    setActiveIndex((prev) => (prev + 1) % queue.length)
                  }
                >
                  Lewati
                </Button>
                <Button
                  type="submit"
                  form="review-post-form"
                  variant="primary"
                  disabled={
                    isSubmitting || isRejecting || kitchen.periodStatus === 'locked'
                  }
                >
                  {isSubmitting ? 'Menyimpan...' : 'Simpan dan lanjut'}
                </Button>
              </div>
            </div>
          </div>

          {/* Modal Konfirmasi Tolak Berkas */}
          {showRejectConfirm && activeItem && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-xs">
              <div className="w-full max-w-md rounded-xl border border-[var(--line)] bg-[var(--surface)] p-6 shadow-xl space-y-4">
                <div className="space-y-1">
                  <h3 className="text-sm font-bold text-[var(--danger,#c5221f)]">
                    Tolak dan Hapus Berkas dari Antrean?
                  </h3>
                  <p className="text-xs text-[var(--ink-muted)] truncate" title={activeItem.originalName}>
                    {activeItem.originalName}
                  </p>
                </div>

                <p className="text-xs text-[var(--ink-secondary)] leading-relaxed">
                  Berkas ini akan disingkirkan dari antrean review dan{' '}
                  <strong className="text-[var(--ink-primary)]">
                    tidak akan dicatat ke buku kas
                  </strong>
                  . Tindakan ini berguna untuk membersihkan berkas yang salah unggah, buram, atau tidak valid.
                </p>

                <div className="flex items-center justify-end gap-2 border-t border-[var(--line)] pt-3">
                  <Button
                    variant="secondary"
                    size="sm"
                    disabled={isRejecting}
                    onClick={() => setShowRejectConfirm(false)}
                  >
                    Batal
                  </Button>
                  <Button
                    variant="danger"
                    size="sm"
                    disabled={isRejecting}
                    loading={isRejecting}
                    onClick={() => void handleRejectSubmit()}
                  >
                    {isRejecting ? 'Menghapus...' : 'Ya, Tolak Berkas'}
                  </Button>
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
