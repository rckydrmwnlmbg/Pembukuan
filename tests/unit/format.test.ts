import { describe, expect, it } from 'vitest';
import {
  formatLedgerCellAmount,
  formatPeriodLabel,
  formatRupiah,
  formatRupiahNumber,
  formatTimestampWib,
  formatTxDate,
} from '@/lib/format';

describe('src/lib/format.ts', () => {
  it('memformat nominal bigint positif menjadi Rupiah dengan titik ribuan', () => {
    expect(formatRupiah(0n)).toBe('Rp 0');
    expect(formatRupiah(6500n)).toBe('Rp 6.500');
    expect(formatRupiah(1234567n)).toBe('Rp 1.234.567');
    expect(formatRupiah(132550000n)).toBe('Rp 132.550.000');
  });

  it('memformat nominal bigint negatif dengan tanda minus (−)', () => {
    expect(formatRupiah(-50000n)).toBe('−Rp 50.000');
    expect(formatRupiahNumber(-6500n)).toBe('−6.500');
  });

  it('mengosongkan sel buku kas bila nominal 0n sesuai DESIGN.md 5.3', () => {
    expect(formatLedgerCellAmount(0n)).toBe('');
    expect(formatLedgerCellAmount(2436500n)).toBe('Rp 2.436.500');
  });

  it('memformat tanggal transaksi YYYY-MM-DD ke format Indonesia singkat', () => {
    expect(formatTxDate('2026-03-02')).toBe('02 Mar 2026');
    expect(formatTxDate('2026-08-17')).toBe('17 Agu 2026');
    expect(formatTxDate('2026-12-31')).toBe('31 Des 2026');
    expect(() => formatTxDate('02-03-2026')).toThrow();
  });

  it('memformat label periode bulan dan tahun', () => {
    expect(formatPeriodLabel(2026, 3)).toBe('Maret 2026');
    expect(formatPeriodLabel(2026, 10)).toBe('Oktober 2026');
    expect(() => formatPeriodLabel(2026, 13)).toThrow();
  });

  it('memformat timestamp UTC ke zona waktu WIB (Asia/Jakarta)', () => {
    expect(formatTimestampWib('2026-03-02T07:30:00.000Z')).toBe(
      '02 Mar 2026, 14.30 WIB',
    );
  });
});
