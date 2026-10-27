import { describe, expect, it, vi, beforeEach } from 'vitest';
import {
  getMfaSetupAction,
  verifyMfaAction,
  signInAction,
} from '@/server/auth/actions';
import {
  resetUserMfaByAdmin,
  MfaRecoveryInputSchema,
} from '@/server/admin/mfa-recovery';
import { requireUser } from '@/server/auth/require-user';

// Mock cookies store
const mockCookiesStore = new Map<string, { value: string }>();
vi.mock('next/headers', () => ({
  cookies: vi.fn(async () => ({
    get: (name: string) => mockCookiesStore.get(name),
    set: (name: string, value: string) =>
      mockCookiesStore.set(name, { value }),
    delete: (name: string) => mockCookiesStore.delete(name),
  })),
}));

// Mock Supabase Server Client
const mockGetUser = vi.fn();
const mockGetAal = vi.fn();
const mockListFactors = vi.fn();
const mockEnroll = vi.fn();
const mockUnenroll = vi.fn();
const mockChallengeAndVerify = vi.fn();
const mockSignInWithPassword = vi.fn();

vi.mock('@/server/supabase/server', () => ({
  createClient: vi.fn(async () => ({
    auth: {
      getUser: mockGetUser,
      signInWithPassword: mockSignInWithPassword,
      mfa: {
        getAuthenticatorAssuranceLevel: mockGetAal,
        listFactors: mockListFactors,
        enroll: mockEnroll,
        unenroll: mockUnenroll,
        challengeAndVerify: mockChallengeAndVerify,
      },
    },
  })),
}));

// Mock Supabase Admin Client
const mockAdminListFactors = vi.fn();
const mockAdminDeleteFactor = vi.fn();
const mockAdminInsert = vi.fn();

vi.mock('@/server/supabase/admin', () => ({
  createAdminClient: vi.fn(() => ({
    auth: {
      admin: {
        mfa: {
          listFactors: mockAdminListFactors,
          deleteFactor: mockAdminDeleteFactor,
        },
      },
    },
    from: vi.fn(() => ({
      insert: mockAdminInsert,
    })),
  })),
}));

describe('FR-F1.1 & SECURITY S-01: Penegakan MFA TOTP AAL2 & Alur Pendaftaran', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCookiesStore.clear();
  });

  describe('1. Penegakan AAL di requireUser (Direct API / Server Guard)', () => {
    it('menolak sesi AAL1 dengan HttpError 403 saat redirectOnFailure=false (Route Handler API)', async () => {
      mockGetUser.mockResolvedValueOnce({
        data: {
          user: { id: 'user-aal1-uuid', email: 'maker@sintetis.example' },
        },
        error: null,
      });

      // Sesi hanya AAL1 (belum verifikasi faktor TOTP)
      mockGetAal.mockResolvedValueOnce({
        data: { currentLevel: 'aal1', nextLevel: 'aal2' },
        error: null,
      });

      await expect(
        requireUser({ redirectOnFailure: false }),
      ).rejects.toMatchObject({
        status: 403,
        message: expect.stringContaining('MFA AAL2'),
      });
    });

    it('mengizinkan sesi AAL2 untuk membaca data dapur', async () => {
      mockGetUser.mockResolvedValueOnce({
        data: {
          user: { id: 'user-aal2-uuid', email: 'maker@sintetis.example' },
        },
        error: null,
      });

      // Sesi sudah AAL2
      mockGetAal.mockResolvedValueOnce({
        data: { currentLevel: 'aal2', nextLevel: null },
        error: null,
      });

      const res = await requireUser({ redirectOnFailure: false });
      expect(res.user.id).toBe('user-aal2-uuid');
    });
  });

  describe('2. Alur Pendaftaran & Tantangan MFA (getMfaSetupAction)', () => {
    it('mengembalikan mode enroll beserta QR code dan secret jika pengguna belum memiliki TOTP', async () => {
      mockGetUser.mockResolvedValueOnce({
        data: { user: { id: 'new-user-uuid' } },
        error: null,
      });

      // Belum ada faktor terverifikasi
      mockListFactors.mockResolvedValueOnce({
        data: {
          all: [],
          totp: [],
        },
        error: null,
      });

      mockEnroll.mockResolvedValueOnce({
        data: {
          id: 'new-factor-uuid',
          type: 'totp',
          totp: {
            qr_code: 'data:image/svg+xml;base64,mockqr',
            secret: 'JBSWY3DPEHPK3PXP',
            uri: 'otpauth://totp/Kasdapur?secret=JBSWY3DPEHPK3PXP',
          },
        },
        error: null,
      });

      const setup = await getMfaSetupAction();
      expect(setup.mode).toBe('enroll');
      expect(setup.factorId).toBe('new-factor-uuid');
      expect(setup.qrCode).toContain('data:image/svg');
      expect(setup.secret).toBe('JBSWY3DPEHPK3PXP');
    });

    it('mengembalikan mode challenge jika pengguna sudah memiliki TOTP terverifikasi', async () => {
      mockGetUser.mockResolvedValueOnce({
        data: { user: { id: 'enrolled-user-uuid' } },
        error: null,
      });

      mockListFactors.mockResolvedValueOnce({
        data: {
          all: [{ id: 'existing-factor-uuid', status: 'verified', factor_type: 'totp' }],
          totp: [{ id: 'existing-factor-uuid', status: 'verified', factor_type: 'totp' }],
        },
        error: null,
      });

      const setup = await getMfaSetupAction();
      expect(setup.mode).toBe('challenge');
      expect(setup.factorId).toBe('existing-factor-uuid');
      expect(setup.qrCode).toBeUndefined();
    });
  });

  describe('3. Verifikasi Kode MFA (verifyMfaAction)', () => {
    it('menolak kode kurang dari 6 digit', async () => {
      const res = await verifyMfaAction({ code: '123' });
      expect(res.error).toContain('6 digit');
    });

    it('menolak kode jika verifikasi Supabase challenge gagal', async () => {
      mockListFactors.mockResolvedValueOnce({
        data: {
          totp: [{ id: 'factor-1' }],
        },
        error: null,
      });

      mockChallengeAndVerify.mockResolvedValueOnce({
        error: { message: 'Invalid TOTP code' },
      });

      const res = await verifyMfaAction({ code: '999999', factorId: 'factor-1' });
      expect(res.error).toContain('salah atau telah kedaluwarsa');
      expect(res.success).toBeUndefined();
    });

    it('berhasil memverifikasi jika kode TOTP benar', async () => {
      mockChallengeAndVerify.mockResolvedValueOnce({
        error: null,
      });

      const res = await verifyMfaAction({ code: '123456', factorId: 'factor-1' });
      expect(res.success).toBe(true);
      expect(res.error).toBeUndefined();
    });
  });

  describe('4. Login Wajibkan MFA (signInAction)', () => {
    it('selalu mengembalikan needMfa: true dan tidak pernah langsung success tanpa MFA', async () => {
      mockSignInWithPassword.mockResolvedValueOnce({
        data: { user: { id: 'user-uuid', email: 'maker@example.com' } },
        error: null,
      });

      mockListFactors.mockResolvedValueOnce({
        data: { totp: [] },
        error: null,
      });

      const res = await signInAction({
        email: 'maker@example.com',
        password: 'Password12345!',
      });

      expect(res.needMfa).toBe(true);
      expect(res.success).toBeUndefined();
    });
  });

  describe('5. Pemulihan Perangkat Hilang oleh Admin (E18)', () => {
    it('menolak alasan pemulihan yang kurang dari 10 karakter', () => {
      expect(() =>
        MfaRecoveryInputSchema.parse({ reason: 'pendek' }),
      ).toThrow('minimal 10 karakter');
    });

    it('menghapus faktor MFA lama pengguna dan mencatat ke audit_logs dengan alasan', async () => {
      mockAdminListFactors.mockResolvedValueOnce({
        data: {
          factors: [
            { id: 'lost-phone-factor-1', factor_type: 'totp', status: 'verified' },
          ],
        },
        error: null,
      });

      mockAdminDeleteFactor.mockResolvedValueOnce({ error: null });
      mockAdminInsert.mockResolvedValueOnce({ error: null });

      const result = await resetUserMfaByAdmin({
        adminUserId: 'admin-uuid',
        targetUserId: 'target-user-uuid',
        kitchenId: '10000000-0000-4000-8000-000000000001',
        reason: 'Ponsel maker hilang saat tugas dinas luar kota',
      });

      expect(result.success).toBe(true);
      expect(result.deletedFactorsCount).toBe(1);
      expect(mockAdminDeleteFactor).toHaveBeenCalledWith({
        id: 'lost-phone-factor-1',
        userId: 'target-user-uuid',
      });
      expect(mockAdminInsert).toHaveBeenCalledWith(
        expect.objectContaining({
          kitchen_id: '10000000-0000-4000-8000-000000000001',
          actor_id: 'admin-uuid',
          action: 'user.mfa_reset',
          entity: 'user_mfa',
          entity_id: 'target-user-uuid',
          after: expect.objectContaining({
            reason: 'Ponsel maker hilang saat tugas dinas luar kota',
          }),
        }),
      );
    });
  });
});
