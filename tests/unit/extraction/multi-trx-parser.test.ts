import { describe, it, expect } from 'vitest';
import { PDFDocument, StandardFonts } from 'pdf-lib';
import { detectAndParseMultiTrxPdf } from '@/server/extraction/multi-trx-parser';

describe('BNI Direct Multi-Transaction PDF Table Parser', () => {
  it('mengembalikan array kosong jika berkas bukan laporan multi transaksi BNI Direct', async () => {
    const doc = await PDFDocument.create();
    const page = doc.addPage([600, 400]);
    const font = await doc.embedFont(StandardFonts.Helvetica);
    page.drawText('BUKTI TRANSFER BIASA', { x: 50, y: 350, font, size: 14 });
    const bytes = await doc.save();

    const result = await detectAndParseMultiTrxPdf(bytes);
    expect(result).toEqual([]);
  });

  it('mendeteksi dan mengekstrak baris transaksi dari teks tabel sintetis BNI Direct', async () => {
    const doc = await PDFDocument.create();
    const page = doc.addPage([800, 600]);
    const font = await doc.embedFont(StandardFonts.Helvetica);

    // Header laporan
    page.drawText('TRANSACTION STATUS REPORT', { x: 50, y: 550, font, size: 10 });

    // Baris 1: Online Transfer ke BCA
    const row1Tokens = [
      '202610020000000001',
      'Online Transfer',
      'IDR',
      '2,500,000',
      '02-Oct-2026',
      'Berhasil',
      'Dijalankan',
      'Bank',
      'BCA',
      'REKANAN SINTETIS SATU',
      '9876543210',
      'Web',
    ];
    let x = 50;
    for (const t of row1Tokens) {
      page.drawText(t, { x, y: 500, font, size: 9 });
      x += 40;
    }

    // Baris 2: In House ke BNI
    const row2Tokens = [
      '202610020000000002',
      'In House Transfer to Third Party Account',
      'IDR',
      '1,000,000',
      '02-Oct-2026',
      'Berhasil',
      'Dijalankan',
      'REKANAN SINTETIS DUA',
      '1122334455',
      'Web',
    ];
    x = 50;
    for (const t of row2Tokens) {
      page.drawText(t, { x, y: 450, font, size: 9 });
      x += 40;
    }

    const bytes = await doc.save();
    const result = await detectAndParseMultiTrxPdf(bytes);

    expect(result.length).toBe(2);

    expect(result[0]!.referenceNo).toBe('202610020000000001');
    expect(result[0]!.amount).toBe('2500000');
    expect(result[0]!.txDate).toBe('2026-10-02');
    expect(result[0]!.isOnlineTransfer).toBe(true);
    expect(result[0]!.recipientBank).toContain('BCA');
    expect(result[0]!.recipientName).toBe('REKANAN SINTETIS SATU');
    expect(result[0]!.recipientAccount).toBe('9876543210');

    expect(result[1]!.referenceNo).toBe('202610020000000002');
    expect(result[1]!.amount).toBe('1000000');
    expect(result[1]!.txDate).toBe('2026-10-02');
    expect(result[1]!.isOnlineTransfer).toBe(false);
    expect(result[1]!.recipientBank).toBe('BNI');
    expect(result[1]!.recipientName).toBe('REKANAN SINTETIS DUA');
    expect(result[1]!.recipientAccount).toBe('1122334455');
  });

  it('mengabaikan transaksi Ditolak dan mendukung baris Payroll massal', async () => {
    const doc = await PDFDocument.create();
    const page = doc.addPage([800, 600]);
    const font = await doc.embedFont(StandardFonts.Helvetica);

    page.drawText('TRANSACTION STATUS REPORT', { x: 50, y: 550, font, size: 10 });

    // Baris 1: Transaksi Ditolak (gagal bank) -> harus diabaikan
    const rejectedTokens = [
      '202610090000000099',
      'Online Transfer',
      'IDR',
      '80,000',
      '09-Oct-2026',
      'Ditolak',
      'Bank',
      'BCA',
      'REKANAN GAGAL',
      '4090527245',
      'Web',
    ];
    let x = 50;
    for (const t of rejectedTokens) {
      page.drawText(t, { x, y: 500, font, size: 9 });
      x += 40;
    }

    // Baris 2: In House Payroll
    const payrollTokens = [
      '202610090000000100',
      'In House Payroll',
      'IDR',
      '4,920,000',
      '09-Oct-2026',
      'Berhasil',
      'Dijalankan',
      'Web',
    ];
    x = 50;
    for (const t of payrollTokens) {
      page.drawText(t, { x, y: 450, font, size: 9 });
      x += 40;
    }

    const bytes = await doc.save();
    const result = await detectAndParseMultiTrxPdf(bytes);

    // Hanya baris payroll yang masuk (baris ditolak diabaikan)
    expect(result.length).toBe(1);
    expect(result[0]!.referenceNo).toBe('202610090000000100');
    expect(result[0]!.amount).toBe('4920000');
    expect(result[0]!.recipientName).toBe('Rekening Masing-Masing Karyawan/Relawan');
    expect(result[0]!.recipientBank).toBe('BNI');
  });
});
