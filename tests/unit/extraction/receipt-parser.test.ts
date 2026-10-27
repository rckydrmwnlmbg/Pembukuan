import { describe, expect, it } from 'vitest';
import { parseReceiptText } from '@/server/extraction/receipt-parser';

describe('Deterministic Indonesian Bank Receipt Parser (receipt-parser)', () => {
  it('berhasil mengekstrak data bukti transfer BCA / sintetis dengan lengkap', () => {
    const raw = `
      BUKTI TRANSAKSI TRANSFER
      Tanggal Transaksi : 2026-03-25
      No. Referensi     : 202603250001
      Rekening Pengirim : 999088001001
      Rekening Penerima : 999010018821 a.n UD Pangan Segar
      Bank Tujuan       : BCA
      Nominal Transfer  : Rp 2.450.000
      Berita            : Pembelian bahan baku dapur
    `;

    const res = parseReceiptText(raw);
    expect(res).not.toBeNull();
    expect(res?.txDate).toBe('2026-03-25');
    expect(res?.referenceNo).toBe('202603250001');
    expect(res?.amount).toBe('2450000');
    expect(res?.senderAccount).toBe('999088001001');
    expect(res?.recipientAccount).toBe('999010018821');
    expect(res?.recipientName).toContain('UD Pangan Segar');
    expect(res?.recipientBank).toBe('BCA');
    expect(res?.memo).toBe('Pembelian bahan baku dapur');
    expect(res?.confidence.txDate).toBeGreaterThanOrEqual(0.95);
    expect(res?.confidence.amount).toBeGreaterThanOrEqual(0.95);
  });

  it('berhasil mengekstrak format tanggal DD/MM/YYYY dan DD Mon YYYY khas Livin Mandiri dan BRImo', () => {
    const mandiri = `
      Transfer Berhasil
      25 Mar 2026, 14:20 WIB
      No. Resi: 20260325123499
      Rekening Tujuan: 1370019283748 a.n TOKO SAYUR BERKAH
      Bank: MANDIRI
      Total Transaksi: Rp2.450.000,00
      Catatan: Belanja sayur mingguan
    `;
    const resM = parseReceiptText(mandiri);
    expect(resM).not.toBeNull();
    expect(resM?.txDate).toBe('2026-03-25');
    expect(resM?.amount).toBe('2450000');
    expect(resM?.referenceNo).toBe('20260325123499');
    expect(resM?.recipientBank).toBe('MANDIRI');

    const brimo = `
      TRANSAKSI BERHASIL
      25/03/2026 10:15:30
      No. Referensi: BR202603259988
      Tujuan: 001201992837192
      Nama Penerima: UD PANGAN SEGAR
      Nominal: Rp 1.500.000
      Bank: BRI
    `;
    const resB = parseReceiptText(brimo);
    expect(resB).not.toBeNull();
    expect(resB?.txDate).toBe('2026-03-25');
    expect(resB?.amount).toBe('1500000');
    expect(resB?.referenceNo).toBe('BR202603259988');
    expect(resB?.recipientBank).toBe('BRI');
  });

  it('berhasil mengekstrak format corporate / CMS In-House Transfer (DD-Mon-YYYY & IDR nominal)', () => {
    const cms = `
      TRANSACTION HISTORY
      Action Date
      Action Type
      Execute
      22-Jan-2026 20:48:51
      Sukses
      6,000,000.00 IDR
      In House Transfer
      Reference No. : 20260122131628675842
      From Account : 999088001001/PT Dapur Sejahtera (IDR)
      Amount : IDR 6,000,000.00
      To Account : 999010018821/YAYASAN CONTOH AMANAH (IDR)
      Remark : INSENTIF FASILITAS SPPG BULAN JANUARI
    `;
    const res = parseReceiptText(cms);
    expect(res).not.toBeNull();
    expect(res?.txDate).toBe('2026-01-22');
    expect(res?.amount).toBe('6000000');
    expect(res?.referenceNo).toBe('20260122131628675842');
    expect(res?.senderAccount).toBe('999088001001');
    expect(res?.recipientAccount).toBe('999010018821');
    expect(res?.recipientName).toContain('YAYASAN CONTOH AMANAH');
    expect(res?.recipientBank).toBe('BNI');
    expect(res?.memo).toContain('INSENTIF FASILITAS SPPG');
  });

  it('gagal aman (mengembalikan null) jika teks tidak memiliki tanggal atau nominal valid (AGENTS.md #5)', () => {
    expect(parseReceiptText('')).toBeNull();
    expect(parseReceiptText('Ini bukan bukti transfer hanya dokumen acak')).toBeNull();
    expect(parseReceiptText('Tanggal: 2026-03-25 tetapi tidak ada nominal uang')).toBeNull();
    expect(parseReceiptText('Nominal Rp 1.000.000 tetapi tanpa tanggal')).toBeNull();
  });
});
