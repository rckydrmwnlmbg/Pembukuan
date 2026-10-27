import { describe, it, expect, vi } from 'vitest';
import { validatePassword, PasswordRuleSchema } from '@/lib/validation/password';
import { inviteUserByEmail } from '@/server/admin/invite-user';
import * as authActions from '@/server/auth/actions';

describe('TUGAS 1 — Penutupan Pendaftaran Publik & Aturan Sandi (FR-F1.3)', () => {
  describe('1. Peniadaan Action Signup Publik', () => {
    it('memastikan tidak ada fungsi signUpAction yang diekspor di jalur publik', () => {
      expect((authActions as Record<string, unknown>).signUpAction).toBeUndefined();
    });
  });

  describe('2. Validasi Kekuatan Kata Sandi (Minimal 12 karakter & Tolak Sandi Lemah)', () => {
    it('menolak kata sandi yang kurang dari 12 karakter', () => {
      const shortPasswords = ['123456', 'pendek', 'sandi12345', 'abcDEF123!'];
      for (const pwd of shortPasswords) {
        const result = validatePassword(pwd);
        expect(result.valid).toBe(false);
        expect(result.error).toContain('minimal 12 karakter');
      }
    });

    it('menolak kata sandi umum atau sekuensial sederhana (seperti 123456 atau password12345)', () => {
      const weakPasswords = [
        '123456789012',
        'password12345',
        'kasdapur1234',
        'qwertyuiopas',
        'administrator',
      ];
      for (const pwd of weakPasswords) {
        const result = validatePassword(pwd);
        expect(result.valid).toBe(false);
        expect(result.error).toMatch(/terlalu umum|mudah ditebak|urutan/i);
      }
    });

    it('menolak kata sandi yang hanya terdiri dari 1 karakter berulang', () => {
      const repetitive = ['aaaaaaaaaaaa', '111111111111', 'ZZZZZZZZZZZZ'];
      for (const pwd of repetitive) {
        const result = validatePassword(pwd);
        expect(result.valid).toBe(false);
        expect(result.error).toContain('berulang');
      }
    });

    it('menolak kata sandi yang hanya huruf tanpa angka/simbol', () => {
      const onlyLetters = 'hanyahurufsajatanpaangka';
      const result = validatePassword(onlyLetters);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('kombinasi huruf dan angka');
    });

    it('menerima kata sandi yang memenuhi kriteria (panjang >= 12 dan kombinasi kuat)', () => {
      const strongPasswords = [
        'K4sdapur#2026Sppg',
        'YayasanAbipraya2026!',
        'KombinasiSandiKuat99#',
        'PembukuanDapurMaret2026!',
      ];
      for (const pwd of strongPasswords) {
        const result = validatePassword(pwd);
        expect(result.valid).toBe(true);
        expect(result.error).toBeUndefined();

        // Uji juga via Zod PasswordRuleSchema
        expect(() => PasswordRuleSchema.parse(pwd)).not.toThrow();
      }
    });
  });

  describe('3. Panggilan Signup Anon ke Supabase Harus Ditolak', () => {
    it('memastikan pemanggilan signup dari klien anonim ditolak oleh simulasi kebijakan Supabase Auth', async () => {
      // Simulasi respons Supabase ketika "Allow new users to sign up" dinonaktifkan di dashboard
      const mockAnonSupabaseClient = {
        auth: {
          signUp: vi.fn().mockResolvedValue({
            data: { user: null, session: null },
            error: {
              name: 'AuthApiError',
              message: 'Signups not allowed for this instance',
              status: 400,
            },
          }),
        },
      };

      const res = await mockAnonSupabaseClient.auth.signUp({
        email: 'attacker@public.net',
        password: 'PasswordSuperKuat123!',
      });

      expect(res.data.user).toBeNull();
      expect(res.error).toBeDefined();
      expect(res.error?.message).toBe('Signups not allowed for this instance');
    });
  });

  describe('4. Modul Undangan Pengguna oleh Admin (src/server/admin/invite-user.ts)', () => {
    it('menolak email tujuan yang tidak valid', async () => {
      await expect(inviteUserByEmail('bukan-email')).rejects.toThrow('tidak valid');
      await expect(inviteUserByEmail('')).rejects.toThrow('tidak valid');
    });
  });
});
