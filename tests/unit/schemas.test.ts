import { describe, expect, it } from 'vitest';
import {
  DescriptionSchema,
  PositiveRupiah,
  ReferenceNoSchema,
  Rupiah,
  TxDateSchema,
} from '@/lib/schemas/common';

describe('src/lib/schemas/common.ts (SECURITY.md S-07 & S-08)', () => {
  it('mengubah string digit yang valid menjadi bigint', () => {
    expect(Rupiah.parse('0')).toBe(0n);
    expect(Rupiah.parse('6500')).toBe(6500n);
    expect(PositiveRupiah.parse('2436500')).toBe(2436500n);
  });

  it('menolak nominal tidak valid sesuai verifikasi SECURITY.md S-08 (-1, 1e9, 1.000, abc, >13 digit)', () => {
    const invalidInputs = ['-1', '1e9', '1.000', 'abc', '99999999999999', ''];
    for (const bad of invalidInputs) {
      expect(Rupiah.safeParse(bad).success).toBe(false);
    }
    expect(PositiveRupiah.safeParse('0').success).toBe(false);
  });

  it('membersihkan karakter kontrol pada deskripsi dan menolak string kosong', () => {
    expect(DescriptionSchema.parse('  Belanja galon\u0000\u0007 dapur  ')).toBe(
      'Belanja galon dapur',
    );
    expect(DescriptionSchema.safeParse('   ').success).toBe(false);
  });

  it('memvalidasi nomor referensi dan tanggal kalender', () => {
    expect(ReferenceNoSchema.parse('20260302/FT-01_A.9')).toBe('20260302/FT-01_A.9');
    expect(ReferenceNoSchema.safeParse('REF; DROP TABLE').success).toBe(false);

    expect(TxDateSchema.parse('2026-03-02')).toBe('2026-03-02');
    expect(TxDateSchema.safeParse('2026-02-30').success).toBe(false);
  });
});
