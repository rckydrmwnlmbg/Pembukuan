'use client';

import React, { useState, useEffect } from 'react';
import {
  ZoomIn,
  ZoomOut,
  RotateCw,
  AlertTriangle,
  ChevronLeft,
  ChevronRight,
  Save,
} from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Input, NominalInput } from '@/components/ui/Input';
import { Badge } from '@/components/ui/Badge';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/Tabs';
import type { UploadRecord } from '@/server/upload/service';

export interface ReviewPanelProps {
  upload: UploadRecord;
  kitchenName: string;
  defaultAdminFee?: bigint;
  currentIndex?: number;
  totalCount?: number;
  onSaveAndNext: (data: {
    txDate: string;
    referenceNo: string;
    description: string;
    amount: bigint;
    counterpartyAccount?: string;
    counterpartyName?: string;
    counterpartyBank?: string;
    includeAdminFee?: boolean;
    adminFeeAmount?: bigint;
    confirmWrongKitchen?: boolean;
  }) => void;
  onSkip?: () => void;
  onPrevious?: () => void;
  isSaving?: boolean;
}

/**
 * Komponen Layar Review Bukti Transfer (DESIGN.md §8.3 & PRD F4).
 * Kiri: penampil PDF/gambar dengan zoom dan rotasi.
 * Kanan: formulir hasil bacaan AI dengan penanda keyakinan rendah dan biaya admin.
 * Bawah: bilah aksi menempel 64px dengan pintasan Ctrl/Cmd+Enter.
 * Di layar ponsel (< 768px), otomatis menjadi dua tab (Berkas dan Formulir).
 */
export function ReviewPanel({
  upload,
  kitchenName,
  defaultAdminFee = 6500n,
  currentIndex = 1,
  totalCount = 1,
  onSaveAndNext,
  onSkip,
  onPrevious,
  isSaving = false,
}: ReviewPanelProps) {
  // Form states
  const [txDate, setTxDate] = useState(upload.txDate ?? '2026-03-28');
  const [referenceNo, setReferenceNo] = useState(upload.referenceNo ?? '');
  const [description, setDescription] = useState(
    upload.suggestedDescription ?? '',
  );
  const [amount, setAmount] = useState<bigint>(
    upload.amount ? BigInt(upload.amount) : 0n,
  );
  const [recipientAccount, setRecipientAccount] = useState(
    upload.recipientAccount ?? '',
  );
  const [recipientName, setRecipientName] = useState(
    upload.recipientName ?? '',
  );
  const [recipientBank, setRecipientBank] = useState(
    upload.recipientBank ?? '',
  );
  const [includeAdminFee, setIncludeAdminFee] = useState(
    upload.suggestedIncludeAdminFee ?? false,
  );
  const [confirmWrongKitchen, setConfirmWrongKitchen] = useState(false);

  // Viewer controls
  const [zoomLevel, setZoomLevel] = useState(100);
  const [rotation, setRotation] = useState(0);

  // Keyboard shortcut listener (Ctrl/Cmd + Enter)
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
        e.preventDefault();
        handleSubmit();
      }
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  });

  function handleSubmit() {
    onSaveAndNext({
      txDate,
      referenceNo,
      description,
      amount,
      counterpartyAccount: recipientAccount || undefined,
      counterpartyName: recipientName || undefined,
      counterpartyBank: recipientBank || undefined,
      includeAdminFee,
      adminFeeAmount: defaultAdminFee,
      confirmWrongKitchen,
    });
  }

  const lowConfidenceFields = new Set(upload.lowConfidenceFields ?? []);

  // Komponen Viewer Berkas
  const DocumentViewer = (
    <div className="flex flex-col h-full bg-[var(--surface-muted)] rounded-lg border border-[var(--line)] overflow-hidden">
      {/* Toolbar viewer */}
      <div className="flex items-center justify-between px-3 py-2 bg-[var(--surface)] border-b border-[var(--line)] text-xs text-[var(--ink-muted)]">
        <span className="truncate max-w-[200px] font-mono text-[11px]">
          {upload.originalName}
        </span>
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => setZoomLevel((z) => Math.max(50, z - 25))}
            className="p-1 rounded hover:bg-[var(--surface-muted)] text-[var(--ink-muted)] hover:text-[var(--ink)]"
            title="Perkecil"
          >
            <ZoomOut className="w-3.5 h-3.5" />
          </button>
          <span className="font-mono text-[11px] w-12 text-center">
            {zoomLevel}%
          </span>
          <button
            type="button"
            onClick={() => setZoomLevel((z) => Math.min(250, z + 25))}
            className="p-1 rounded hover:bg-[var(--surface-muted)] text-[var(--ink-muted)] hover:text-[var(--ink)]"
            title="Perbesar"
          >
            <ZoomIn className="w-3.5 h-3.5" />
          </button>
          <span className="text-[var(--line)]">|</span>
          <button
            type="button"
            onClick={() => setRotation((r) => (r + 90) % 360)}
            className="p-1 rounded hover:bg-[var(--surface-muted)] text-[var(--ink-muted)] hover:text-[var(--ink)]"
            title="Putar 90°"
          >
            <RotateCw className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Render area berkas */}
      <div className="flex-1 overflow-auto p-4 flex items-center justify-center min-h-[360px]">
        <div
          style={{
            transform: `scale(${zoomLevel / 100}) rotate(${rotation}deg)`,
            transition: 'transform 150ms ease-out',
          }}
          className="max-w-full max-h-full rounded border border-[var(--line)] bg-[var(--surface)] p-4 shadow-sm"
        >
          {upload.mime === 'application/pdf' ? (
            <div className="w-[320px] sm:w-[400px] h-[480px] bg-white text-ink flex flex-col justify-between p-6 border text-xs font-mono">
              <div className="border-b pb-3">
                <div className="font-bold text-sm">BUKTI TRANSFER BANK</div>
                <div className="text-[10px] text-gray-500">DOKUMEN SINTETIS CONTOH</div>
              </div>
              <div className="space-y-3 py-4">
                <div>Tanggal: {upload.txDate ?? '—'}</div>
                <div>No. Ref: {upload.referenceNo ?? '—'}</div>
                <div>Nominal: Rp {upload.amount ?? '—'}</div>
                <div>Penerima: {upload.recipientName ?? '—'}</div>
                <div>Rekening: {upload.recipientAccount ?? '—'}</div>
              </div>
              <div className="text-[9px] text-gray-400 border-t pt-2">
                Data sintetis deterministik untuk pengujian M3/M5
              </div>
            </div>
          ) : (
            <div className="w-[300px] sm:w-[380px] min-h-[440px] bg-white text-ink flex flex-col justify-between p-6 border text-xs font-mono">
              <div className="border-b pb-3">
                <div className="font-bold text-sm">BUKTI TRANSFER (GAMBAR)</div>
                <div className="text-[10px] text-gray-500">SINTETIS DEMO</div>
              </div>
              <div className="space-y-3 py-4">
                <div>Tanggal: {upload.txDate ?? '—'}</div>
                <div>No. Ref: {upload.referenceNo ?? '—'}</div>
                <div>Nominal: Rp {upload.amount ?? '—'}</div>
                <div>Penerima: {upload.recipientName ?? '—'}</div>
                <div>Rekening: {upload.recipientAccount ?? '—'}</div>
              </div>
              <div className="text-[9px] text-gray-400 border-t pt-2">
                EXIF dibersihkan · Normalisasi Sharp aktif
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );

  // Komponen Formulir Hasil Bacaan
  const FormEditor = (
    <div className="flex flex-col h-full bg-[var(--surface)] rounded-lg border border-[var(--line)] p-5 space-y-4 text-xs">
      <div className="flex items-center justify-between border-b border-[var(--line)] pb-3">
        <div>
          <span className="text-[var(--ink-muted)]">Dapur tujuan:</span>{' '}
          <strong className="text-[var(--ink)]">{kitchenName}</strong>
        </div>
        <Badge tone={upload.status === 'parsed' ? 'ok' : 'warn'}>
          {upload.status === 'parsed' ? 'Terbaca AI' : 'Perlu Input Manual'}
        </Badge>
      </div>

      {/* Peringatan salah dapur (PRD F3.4) */}
      {upload.wrongKitchenWarning && (
        <div className="p-3 rounded-md bg-[var(--warn-subtle)] border border-[var(--warn)] text-xs text-[var(--ink)] space-y-2">
          <div className="flex items-center gap-1.5 font-semibold text-[var(--warn)]">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            <span>Peringatan Dapur Tidak Cocok</span>
          </div>
          <p className="text-[11px] leading-relaxed">
            {upload.wrongKitchenWarning}
          </p>
          <label className="flex items-center gap-2 cursor-pointer pt-1">
            <input
              type="checkbox"
              checked={confirmWrongKitchen}
              onChange={(e) => setConfirmWrongKitchen(e.target.checked)}
              className="rounded border-[var(--line)] text-[var(--accent)]"
            />
            <span>Saya yakin ingin memposting ke dapur ini</span>
          </label>
        </div>
      )}

      {/* Form Fields */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
        <Input
          label="Tanggal Transaksi"
          type="date"
          required
          value={txDate}
          onChange={(e) => setTxDate(e.target.value)}
          lowConfidence={lowConfidenceFields.has('txDate')}
        />

        <Input
          label="Nomor Referensi"
          required
          value={referenceNo}
          onChange={(e) => setReferenceNo(e.target.value)}
          lowConfidence={lowConfidenceFields.has('referenceNo')}
        />

        <div className="sm:col-span-2">
          <NominalInput
            label="Nominal (Rupiah)"
            required
            value={amount}
            onValueChange={setAmount}
            lowConfidence={lowConfidenceFields.has('amount')}
          />
        </div>

        <Input
          label="Nomor Rekening Penerima"
          value={recipientAccount}
          onChange={(e) => setRecipientAccount(e.target.value)}
          lowConfidence={lowConfidenceFields.has('recipientAccount')}
        />

        <Input
          label="Bank Penerima"
          value={recipientBank}
          onChange={(e) => setRecipientBank(e.target.value.toUpperCase())}
          lowConfidence={lowConfidenceFields.has('recipientBank')}
        />

        <div className="sm:col-span-2">
          <Input
            label="Nama Penerima"
            value={recipientName}
            onChange={(e) => setRecipientName(e.target.value)}
            lowConfidence={lowConfidenceFields.has('recipientName')}
          />
        </div>

        <div className="sm:col-span-2">
          <Input
            label="Deskripsi Pembukuan"
            required
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            helperText="Usulan template deskripsi dari aturan penerima otomatis"
          />
        </div>

        {/* Checkbox Biaya Admin Bank Berpasangan (PRD FR-F4.3) */}
        <div className="sm:col-span-2 pt-1 border-t border-[var(--line)]">
          <label className="flex items-center gap-2 cursor-pointer text-xs">
            <input
              type="checkbox"
              checked={includeAdminFee}
              onChange={(e) => setIncludeAdminFee(e.target.checked)}
              className="rounded border-[var(--line)] text-[var(--accent)]"
            />
            <span className="text-[var(--ink)]">
              Tambahkan baris biaya admin bank (Rp 6.500)
            </span>
          </label>
        </div>
      </div>
    </div>
  );

  return (
    <div className="flex flex-col h-full space-y-4">
      {/* Tampilan Desktop (≥ 768px): 2 kolom berdampingan */}
      <div className="hidden md:grid md:grid-cols-2 gap-4 flex-1">
        <div>{DocumentViewer}</div>
        <div>{FormEditor}</div>
      </div>

      {/* Tampilan Ponsel (< 768px): Dua Tab (DESIGN.md §8.3 & §4) */}
      <div className="block md:hidden flex-1">
        <Tabs defaultValue="form">
          <TabsList className="w-full justify-center">
            <TabsTrigger value="file" className="flex-1">
              Bukti Transfer
            </TabsTrigger>
            <TabsTrigger value="form" className="flex-1">
              Hasil Bacaan Form
            </TabsTrigger>
          </TabsList>
          <TabsContent value="file">{DocumentViewer}</TabsContent>
          <TabsContent value="form">{FormEditor}</TabsContent>
        </Tabs>
      </div>

      {/* Bilah Aksi Bawah Menempel 64px (DESIGN.md §8.3) */}
      <div className="h-16 bg-[var(--surface)] border border-[var(--line)] rounded-lg px-4 flex items-center justify-between shrink-0 shadow-sm">
        <div className="flex items-center gap-3 text-xs text-[var(--ink-muted)]">
          <span className="font-semibold text-[var(--ink)]">
            {currentIndex} dari {totalCount} berkas
          </span>
          <div className="flex items-center gap-1">
            <button
              type="button"
              disabled={currentIndex <= 1}
              onClick={onPrevious}
              className="p-1 rounded hover:bg-[var(--surface-muted)] disabled:opacity-40"
              title="Berkas sebelumnya"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              type="button"
              disabled={currentIndex >= totalCount}
              onClick={onSkip}
              className="p-1 rounded hover:bg-[var(--surface-muted)] disabled:opacity-40"
              title="Berkas selanjutnya"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {onSkip && (
            <Button variant="ghost" size="sm" onClick={onSkip}>
              Lewati
            </Button>
          )}
          <Button
            variant="primary"
            size="sm"
            loading={isSaving}
            onClick={handleSubmit}
            disabled={
              upload.wrongKitchenWarning && !confirmWrongKitchen ? true : false
            }
          >
            <Save className="w-3.5 h-3.5" />
            <span>Simpan dan lanjut (Ctrl+Enter)</span>
          </Button>
        </div>
      </div>
    </div>
  );
}
