import { z } from 'zod';

/**
 * Skema nominal Rupiah (SECURITY.md S-07 & S-08):
 * Diparse dari string digit (1..13 digit) ke bigint, tidak pernah melewati float/Number.
 */
export const Rupiah = z
  .string()
  .regex(/^\d{1,13}$/, 'Nominal harus berupa angka bulat tanpa titik atau koma (maks 13 digit).')
  .transform((val) => BigInt(val));

export const PositiveRupiah = Rupiah.refine((val) => val > 0n, {
  message: 'Nominal harus lebih besar dari Rp 0.',
});

/**
 * Menghapus karakter kontrol (ASCII 0x00..0x1F dan 0x7F) dari input teks pengguna (SECURITY.md S-08).
 */
export function stripControlChars(input: string): string {
  let out = '';
  for (let i = 0; i < input.length; i += 1) {
    const code = input.charCodeAt(i);
    if (code > 0x1f && code !== 0x7f) {
      out += input[i];
    }
  }
  return out;
}

/**
 * Skema deskripsi transaksi: string, dipangkas, karakter kontrol dibuang, 1..500 karakter (S-08).
 */
export const DescriptionSchema = z
  .string()
  .transform((s) => stripControlChars(s).trim())
  .pipe(
    z
      .string()
      .min(1, 'Deskripsi wajib diisi.')
      .max(500, 'Deskripsi maksimal 500 karakter.'),
  );

/**
 * Skema nomor referensi bank (SECURITY.md S-08): ^[A-Za-z0-9\-_.\/]{1,64}$
 */
export const ReferenceNoSchema = z
  .string()
  .trim()
  .regex(
    /^[A-Za-z0-9\-_./]{1,64}$/,
    'Nomor referensi hanya boleh berisi huruf, angka, atau tanda - _ . / (maks 64 karakter).',
  );

/**
 * Memeriksa apakah string YYYY-MM-DD adalah tanggal kalender yang valid.
 */
export function isValidCalendarDate(isoDate: string): boolean {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(isoDate);
  if (!match) return false;
  const year = Number.parseInt(match[1] ?? '0', 10);
  const month = Number.parseInt(match[2] ?? '0', 10);
  const day = Number.parseInt(match[3] ?? '0', 10);
  if (month < 1 || month > 12 || day < 1 || day > 31) return false;
  const d = new Date(Date.UTC(year, month - 1, day));
  return (
    d.getUTCFullYear() === year &&
    d.getUTCMonth() === month - 1 &&
    d.getUTCDate() === day
  );
}

/**
 * Skema tanggal transaksi YYYY-MM-DD yang valid (SECURITY.md S-08).
 */
export const TxDateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Tanggal harus berformat YYYY-MM-DD.')
  .refine(isValidCalendarDate, 'Tanggal kalender tidak valid.');

export const UuidSchema = z.string().uuid('ID tidak valid.');
