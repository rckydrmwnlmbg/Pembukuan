'use client';

import React, { useRef, useState } from 'react';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import type { UploadRecord } from '@/server/upload/service';

export interface FileUploadFeedback {
  name: string;
  state: 'processing' | 'parsed' | 'needs_manual' | 'rejected';
  detail?: string;
}

export interface UploadDropzoneProps {
  kitchenId: string;
  kitchenName: string;
  onUploaded: (newUploads: UploadRecord[]) => void;
}

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i += 1) {
    binary += String.fromCharCode(bytes[i]!);
  }
  return btoa(binary);
}

/**
 * Area unggah bukti transfer sesuai `DESIGN.md` §5.5:
 * Panel dengan batas 1px solid, padding 24px, tanpa kotak putus-putus raksasa atau ikon awan.
 * Menampilkan nama dapur aktif dan status per berkas setelah diunggah.
 */
export function UploadDropzone({
  kitchenId,
  kitchenName,
  onUploaded,
}: UploadDropzoneProps) {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [feedbackList, setFeedbackList] = useState<FileUploadFeedback[]>([]);

  async function processSelectedFiles(fileList: FileList | null) {
    if (!fileList || fileList.length === 0) return;

    const files = Array.from(fileList);
    if (files.length > 20) {
      setFeedbackList([
        {
          name: `${files.length} berkas dipilih`,
          state: 'rejected',
          detail:
            'Maksimal 20 berkas per unggahan (PRD FR-F3.1). Kurangi jumlah berkas lalu coba lagi.',
        },
      ]);
      return;
    }

    setIsUploading(true);
    setFeedbackList(
      files.map((f) => ({
        name: f.name,
        state: 'processing',
        detail: 'Memvalidasi dan mengekstrak bukti transfer...',
      })),
    );

    const nextFeedback: FileUploadFeedback[] = [];
    const createdRecords: UploadRecord[] = [];

    for (const file of files) {
      if (file.size > 10 * 1024 * 1024) {
        nextFeedback.push({
          name: file.name,
          state: 'rejected',
          detail: 'Ukuran berkas melebihi batas maksimum 10 MB per file.',
        });
        continue;
      }

      try {
        const ab = await file.arrayBuffer();
        const base64 = arrayBufferToBase64(ab);
        const res = await fetch(`/api/k/${kitchenId}/uploads`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            files: [{ name: file.name, base64 }],
          }),
        });

        const data = (await res.json()) as {
          uploaded?: UploadRecord[];
          error?: string | { message?: string };
        };

        if (!res.ok || !data.uploaded?.[0]) {
          const errMsg =
            typeof data.error === 'string'
              ? data.error
              : (data.error?.message ??
                'Berkas ditolak oleh server. Pastikan format PDF, JPG, atau PNG.');
          nextFeedback.push({
            name: file.name,
            state: 'rejected',
            detail: errMsg,
          });
          continue;
        }

        const record = data.uploaded[0];
        createdRecords.push(record);
        nextFeedback.push({
          name: record.originalName,
          state: record.status === 'needs_manual' ? 'needs_manual' : 'parsed',
          detail:
            record.status === 'needs_manual'
              ? (record.fallbackReason ?? 'Perlu input manual di layar review.')
              : 'Siap direview',
        });
      } catch {
        nextFeedback.push({
          name: file.name,
          state: 'rejected',
          detail: 'Gagal menghubungi server saat mengunggah berkas.',
        });
      }
    }

    setFeedbackList(nextFeedback);
    setIsUploading(false);
    if (createdRecords.length > 0) {
      onUploaded(createdRecords);
    }
  }

  return (
    <section
      aria-label={`Unggah bukti transfer untuk ${kitchenName}`}
      onDragOver={(e) => {
        e.preventDefault();
        setIsDragging(true);
      }}
      onDragLeave={() => setIsDragging(false)}
      onDrop={(e) => {
        e.preventDefault();
        setIsDragging(false);
        void processSelectedFiles(e.dataTransfer.files);
      }}
      className={`rounded-lg border p-6 transition-colors ${
        isDragging
          ? 'border-accent-primary bg-accent-subtle'
          : 'border-line-strong bg-surface'
      }`}
    >
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-base font-semibold text-ink-primary">
            Unggah bukti transfer untuk {kitchenName}
          </h2>
          <p className="mt-1 text-xs text-ink-secondary">
            PDF, JPG, atau PNG, maksimal 10 MB per file, sampai 20 file
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <input
            ref={fileInputRef}
            type="file"
            multiple
            aria-label={`Pilih berkas bukti transfer untuk ${kitchenName}`}
            accept=".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png"
            className="sr-only"
            onChange={(e) => {
              void processSelectedFiles(e.target.files);
              e.target.value = '';
            }}
          />
          <Button
            variant="secondary"
            disabled={isUploading}
            onClick={() => fileInputRef.current?.click()}
          >
            {isUploading ? 'Memproses berkas...' : 'Pilih file'}
          </Button>
          <span className="text-xs text-ink-muted">atau seret file ke sini</span>
        </div>
      </div>

      {feedbackList.length > 0 ? (
        <ul
          aria-label="Status berkas yang baru diunggah"
          className="mt-4 divide-y divide-line-subtle rounded-md border border-line-subtle bg-surface-subtle"
        >
          {feedbackList.map((item, idx) => (
            <li
              key={`${item.name}-${idx}`}
              className="flex flex-wrap items-center justify-between gap-2 px-3.5 py-2 text-xs"
            >
              <span className="font-medium text-ink-primary">{item.name}</span>
              <div className="flex flex-wrap items-center gap-2">
                {item.detail ? (
                  <span className="text-ink-secondary">{item.detail}</span>
                ) : null}
                {item.state === 'processing' ? (
                  <Badge tone="neutral">Diproses</Badge>
                ) : item.state === 'parsed' ? (
                  <Badge tone="warning">Menunggu review</Badge>
                ) : item.state === 'needs_manual' ? (
                  <Badge tone="warning">Perlu input manual</Badge>
                ) : (
                  <Badge tone="danger">Ditolak</Badge>
                )}
              </div>
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}
