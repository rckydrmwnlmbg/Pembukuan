import sharp from 'sharp';
import { describe, expect, it } from 'vitest';
import {
  validateAndNormalizeImageBytes,
  validateAndNormalizeTransferProofBytes,
  validatePdfBytes,
} from '@/server/extraction/normalize-image';
import {
  createPasswordProtectedSyntheticPdfBytes,
  createSyntheticHeicBytes,
  createSyntheticProofJpegWithExif,
  createSyntheticProofPdf,
  createSyntheticProofPng,
  type SyntheticProofSpec,
} from '@/lib/synthetic-proofs';
import { HttpError } from '@/server/http/errors';

const KITCHEN_ID = '10000000-0000-4000-8000-000000000001';

const SAMPLE_SPEC: SyntheticProofSpec = {
  txDate: '2026-03-25',
  referenceNo: '202603250001',
  senderAccount: '999088001001',
  recipientAccount: '999010018821',
  recipientName: 'UD Pangan Segar Nusantara (Contoh)',
  recipientBank: 'BCA',
  amountFormatted: 'Rp 2.450.000',
  memo: 'Pembelian bahan baku sayur dapur',
};

describe('Validasi dan normalisasi berkas bukti transfer PDF/JPG/PNG (M3 S-03, S-08, E2, E21, E22)', () => {
  it('menerima PDF sintetis valid, menghitung SHA-256, dan membuat path Storage acak berawalan kitchen_id', async () => {
    const pdfBytes = await createSyntheticProofPdf(SAMPLE_SPEC);
    const res = await validatePdfBytes(
      pdfBytes,
      '../../bukti-transfer-maret.pdf',
      KITCHEN_ID,
    );

    expect(res.mediaType).toBe('application/pdf');
    expect(res.pageCount).toBe(1);
    expect(res.sha256).toMatch(/^[a-f0-9]{64}$/);
    expect(res.storagePath.startsWith(`${KITCHEN_ID}/`)).toBe(true);
    expect(res.storagePath.endsWith('.pdf')).toBe(true);
    // Nama file asli yang mengandung ../ tidak pernah masuk ke storagePath (S-03 & S-05)
    expect(res.storagePath).not.toContain('..');
    expect(res.storagePath).not.toContain('bukti-transfer-maret');
  });

  it('membuang seluruh metadata EXIF pada gambar JPEG setelah normalisasi sharp (PRD E22 & S-08)', async () => {
    const rawJpegWithExif = await createSyntheticProofJpegWithExif(SAMPLE_SPEC);
    const metaBefore = await sharp(rawJpegWithExif).metadata();
    expect(metaBefore.exif).toBeDefined();

    const normalized = await validateAndNormalizeImageBytes(
      new Uint8Array(rawJpegWithExif),
      'foto-bukti-dengan-exif.jpg',
      KITCHEN_ID,
    );

    expect(normalized.mediaType).toBe('image/jpeg');
    expect(normalized.storagePath.startsWith(`${KITCHEN_ID}/`)).toBe(true);
    expect(normalized.storagePath.endsWith('.jpg')).toBe(true);

    const metaAfter = await sharp(normalized.bytes).metadata();
    expect(metaAfter.exif).toBeUndefined();
    // Pastikan string penanda EXIF yang disisipkan sebelum normalisasi benar-benar hilang
    expect(
      Buffer.from(normalized.bytes)
        .toString('latin1')
        .includes('Fake EXIF Location'),
    ).toBe(false);
  });

  it('menerima gambar PNG sintetis dan mempertahankan format PNG agar angka tetap tajam', async () => {
    const pngBuf = await createSyntheticProofPng(SAMPLE_SPEC);
    const normalized = await validateAndNormalizeTransferProofBytes(
      new Uint8Array(pngBuf),
      'tangkapan-layar.png',
      KITCHEN_ID,
    );

    expect(normalized.mediaType).toBe('image/png');
    expect(normalized.storagePath.startsWith(`${KITCHEN_ID}/`)).toBe(true);
    expect(normalized.storagePath.endsWith('.png')).toBe(true);
  });

  it('menolak berkas HEIC dengan kode 415 dan pesan jelas agar diubah ke JPG atau PNG (PRD E21)', async () => {
    const heicBytes = createSyntheticHeicBytes();
    await expect(
      validateAndNormalizeTransferProofBytes(
        heicBytes,
        'IMG_9912.HEIC',
        KITCHEN_ID,
      ),
    ).rejects.toThrowError(/HEIC tidak didukung.*JPG atau PNG/i);

    try {
      await validateAndNormalizeTransferProofBytes(
        heicBytes,
        'IMG_9912.jpg',
        KITCHEN_ID,
      );
    } catch (err) {
      expect((err as HttpError).status).toBe(415);
    }
  });

  it('menolak berkas teks/SVG yang disamarkan dengan ekstensi .pdf atau .jpg (magic bytes check S-08)', async () => {
    const fakePdf = new Uint8Array(
      Buffer.from('<html><body>Bukan PDF</body></html>', 'utf8'),
    );
    await expect(
      validatePdfBytes(fakePdf, 'palsu.pdf', KITCHEN_ID),
    ).rejects.toThrowError(/magic bytes %PDF-/i);

    const fakeJpg = new Uint8Array(
      Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"></svg>', 'utf8'),
    );
    await expect(
      validateAndNormalizeImageBytes(fakeJpg, 'palsu.jpg', KITCHEN_ID),
    ).rejects.toThrowError(/Format gambar tidak didukung/i);
  });

  it('menolak berkas berukuran > 10 MB dengan status 413 (S-08)', async () => {
    const overLimit = new Uint8Array(10 * 1024 * 1024 + 1024);
    overLimit[0] = 0x25; // %PDF-
    overLimit[1] = 0x50;
    overLimit[2] = 0x44;
    overLimit[3] = 0x46;
    overLimit[4] = 0x2d;

    try {
      await validatePdfBytes(overLimit, 'besar.pdf', KITCHEN_ID);
      expect.fail('Seharusnya menolak berkas > 10 MB');
    } catch (err) {
      expect((err as HttpError).status).toBe(413);
    }
  });

  it('menolak PDF berproteksi kata sandi (/Encrypt) dan PDF rusak dengan alasan spesifik (PRD E2)', async () => {
    const encryptedPdf = createPasswordProtectedSyntheticPdfBytes();
    await expect(
      validatePdfBytes(encryptedPdf, 'terkunci.pdf', KITCHEN_ID),
    ).rejects.toThrowError(/diproteksi kata sandi/i);

    const corruptedPdf = new Uint8Array(
      Buffer.from('%PDF-1.7\n1 0 obj\n<<RUSAK_TOTAL>>', 'latin1'),
    );
    await expect(
      validatePdfBytes(corruptedPdf, 'rusak.pdf', KITCHEN_ID),
    ).rejects.toThrowError(/rusak atau tidak dapat dibaca/i);
  });

  it('menolak PDF yang melebihi batas 10 halaman (S-08)', async () => {
    const twelvePagesPdf = await createSyntheticProofPdf(SAMPLE_SPEC, {
      pageCount: 12,
    });
    await expect(
      validatePdfBytes(twelvePagesPdf, '12-halaman.pdf', KITCHEN_ID),
    ).rejects.toThrowError(/melebihi batas maksimum 10 halaman/i);
  });
});
