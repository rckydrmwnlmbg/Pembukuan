import 'server-only';
import { createHash, randomUUID } from 'node:crypto';
import { PDFDocument } from 'pdf-lib';
import { HttpError } from '@/server/http/errors';
import { stripControlChars } from '@/lib/schemas/common';

export const MAX_UPLOAD_BYTES = 10 * 1024 * 1024; // 10 MB per berkas (PRD FR-F3.1 & S-08)
export const MAX_PDF_PAGES = 10; // Batas halaman per PDF (SECURITY.md S-08)

export interface ValidatedPdfResult {
  bytes: Uint8Array;
  mediaType: 'application/pdf';
  sha256: string;
  storagePath: string;
  displayName: string;
  pageCount: number;
}

/**
 * Membersihkan nama berkas tampilan dari karakter kontrol dan pemisah direktori (SECURITY.md S-08).
 * Nama berkas asli tidak pernah dipakai sebagai path penyimpanan di Storage (S-03).
 */
export function sanitizeDisplayName(name: string): string {
  const cleaned = stripControlChars(name).replace(/[\\/]/g, '_').trim();
  return (cleaned || 'bukti-transfer.bin').slice(0, 120);
}

/**
 * Memeriksa apakah 5 byte pertama adalah magic bytes `%PDF-` (`0x25 0x50 0x44 0x46 0x2d`).
 */
export function hasPdfMagicBytes(bytes: Uint8Array): boolean {
  return (
    bytes.length >= 5 &&
    bytes[0] === 0x25 && // %
    bytes[1] === 0x50 && // P
    bytes[2] === 0x44 && // D
    bytes[3] === 0x46 && // F
    bytes[4] === 0x2d // -
  );
}

/**
 * Memvalidasi berkas PDF unggahan:
 * 1. Ukuran > 0 dan <= 10 MB (`413` bila melebihi batas).
 * 2. Magic bytes `%PDF-` (`415` bila bukan PDF asli).
 * 3. Bukan PDF yang diproteksi kata sandi atau rusak (`422` dengan alasan spesifik — PRD E2).
 * 4. Jumlah halaman 1..10 (`422` bila melebihi `MAX_PDF_PAGES` — S-08).
 * 5. Menghitung SHA-256 dan membuat path Storage acak `<kitchenId>/<uuid>.pdf` (S-03).
 */
export async function validatePdfBytes(
  bytes: Uint8Array,
  originalName: string,
  kitchenId: string,
): Promise<ValidatedPdfResult> {
  if (bytes.byteLength === 0) {
    throw new HttpError(
      422,
      'Berkas PDF kosong (0 byte). Pilih berkas PDF yang valid.',
    );
  }
  if (bytes.byteLength > MAX_UPLOAD_BYTES) {
    throw new HttpError(
      413,
      'Ukuran berkas melebihi batas maksimum 10 MB per file.',
    );
  }
  if (!hasPdfMagicBytes(bytes)) {
    throw new HttpError(
      415,
      'Berkas ini bukan PDF yang valid (magic bytes %PDF- tidak ditemukan). Gunakan PDF, JPG, atau PNG.',
    );
  }

  // Deteksi proteksi kata sandi (/Encrypt di trailer/dictionary) atau kerusakan struktur PDF (PRD E2)
  const rawLatin1 = Buffer.from(bytes).toString('latin1');
  if (/\/Encrypt\b/.test(rawLatin1)) {
    throw new HttpError(
      422,
      'Berkas PDF diproteksi kata sandi. Unggah berkas PDF tanpa kata sandi.',
    );
  }

  let pdfDoc: PDFDocument;
  try {
    pdfDoc = await PDFDocument.load(bytes, {
      updateMetadata: false,
      throwOnInvalidObject: false,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message.toLowerCase() : '';
    if (msg.includes('encrypt') || msg.includes('password')) {
      throw new HttpError(
        422,
        'Berkas PDF diproteksi kata sandi. Unggah berkas PDF tanpa kata sandi.',
      );
    }
    throw new HttpError(
      422,
      'Berkas PDF rusak atau tidak dapat dibaca. Coba unduh ulang bukti transfer dari aplikasi bank.',
    );
  }

  if (pdfDoc.isEncrypted) {
    throw new HttpError(
      422,
      'Berkas PDF diproteksi kata sandi. Unggah berkas PDF tanpa kata sandi.',
    );
  }

  const pageCount = pdfDoc.getPageCount();
  if (pageCount < 1) {
    throw new HttpError(422, 'Berkas PDF tidak memiliki halaman.');
  }
  if (pageCount > MAX_PDF_PAGES) {
    throw new HttpError(
      422,
      `Jumlah halaman PDF (${pageCount} halaman) melebihi batas maksimum ${MAX_PDF_PAGES} halaman untuk bukti transfer.`,
    );
  }

  const sha256 = createHash('sha256').update(bytes).digest('hex');

  return {
    bytes,
    mediaType: 'application/pdf',
    sha256,
    storagePath: `${kitchenId}/${randomUUID()}.pdf`,
    displayName: sanitizeDisplayName(originalName),
    pageCount,
  };
}

export async function validatePdfUpload(
  file: File,
  kitchenId: string,
): Promise<ValidatedPdfResult> {
  if (file.size === 0) {
    throw new HttpError(
      422,
      'Berkas PDF kosong (0 byte). Pilih berkas PDF yang valid.',
    );
  }
  if (file.size > MAX_UPLOAD_BYTES) {
    throw new HttpError(
      413,
      'Ukuran berkas melebihi batas maksimum 10 MB per file.',
    );
  }
  const bytes = new Uint8Array(await file.arrayBuffer());
  return validatePdfBytes(bytes, file.name, kitchenId);
}
