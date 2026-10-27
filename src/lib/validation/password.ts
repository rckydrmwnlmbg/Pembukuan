import { z } from 'zod';

const COMMON_WEAK_PASSWORDS = new Set([
  '123456789012',
  '1234567890123',
  'password1234',
  'password12345',
  'admin1234567',
  'administrator',
  'kasdapur1234',
  'kasdapur12345',
  'qwertyuiopas',
  'qwerty123456',
  'welcome12345',
  'letmein12345',
]);

/**
 * Validasi kekuatan kata sandi (PRD FR-F1.3 & SECURITY.md S-04):
 * 1. Minimal 12 karakter.
 * 2. Menolak kata sandi umum atau sekuensial sederhana.
 * 3. Menolak karakter berulang identik (misal "aaaaaaaaaaaa").
 */
export function validatePassword(password: string): {
  valid: boolean;
  error?: string;
} {
  if (!password || typeof password !== 'string') {
    return { valid: false, error: 'Kata sandi wajib diisi.' };
  }

  if (password.length < 12) {
    return {
      valid: false,
      error: 'Kata sandi minimal 12 karakter untuk memastikan keamanan pembukuan.',
    };
  }

  const normalized = password.toLowerCase().trim();

  // 1. Cek kata sandi umum terlarang
  if (COMMON_WEAK_PASSWORDS.has(normalized)) {
    return {
      valid: false,
      error: 'Kata sandi terlalu umum atau mudah ditebak. Gunakan kombinasi kata sandi yang lebih unik.',
    };
  }

  // 2. Cek karakter berulang seluruhnya (misal: "aaaaaaaaaaaa" atau "111111111111")
  if (/^(.)\1+$/.test(password)) {
    return {
      valid: false,
      error: 'Kata sandi tidak boleh hanya terdiri dari satu karakter yang berulang.',
    };
  }

  // 3. Cek sekuens sederhana angka atau huruf (misal: 123456789012, abcdefghijkl)
  if ('01234567890123456789'.includes(normalized) || 'abcdefghijklmnopqrstuvwxyz'.includes(normalized)) {
    return {
      valid: false,
      error: 'Kata sandi tidak boleh berupa urutan angka atau huruf sederhana.',
    };
  }

  // 4. Pastikan memiliki setidaknya kombinasi huruf dan angka/simbol
  const hasLetter = /[a-zA-Z]/.test(password);
  const hasDigitOrSymbol = /[\d\W_]/.test(password);
  if (!hasLetter || !hasDigitOrSymbol) {
    return {
      valid: false,
      error: 'Kata sandi harus mengandung kombinasi huruf dan angka atau simbol.',
    };
  }

  return { valid: true };
}

export const PasswordRuleSchema = z
  .string()
  .min(12, 'Kata sandi minimal 12 karakter.')
  .superRefine((val, ctx) => {
    const res = validatePassword(val);
    if (!res.valid && res.error) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: res.error,
      });
    }
  });
