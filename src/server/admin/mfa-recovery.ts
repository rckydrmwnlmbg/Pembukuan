import 'server-only';
import { z } from 'zod';
import { createAdminClient } from '@/server/supabase/admin';
import { HttpError } from '@/server/http/errors';

/**
 * ============================================================================
 * Modul Pemulihan Perangkat MFA Hilang oleh Admin (PRD E18 & SECURITY.md S-04, S-15)
 * ============================================================================
 *
 * Catatan Alasan Penggunaan Service Role:
 * 1. Sesuai PRD E18: Bila pengguna (maker/admin) kehilangan ponsel atau aplikasi
 *    autentikator mereka, pemulihan dilakukan secara terverifikasi oleh Admin Dapur.
 * 2. API `auth.admin.mfa.deleteFactor` memerlukan wewenang Service Role Supabase
 *    karena pengguna yang kehilangan perangkat tidak dapat login untuk menghapusnya sendiri.
 * 3. Modul ini secara ketat dibatasi di server (`server-only`) dan hanya boleh
 *    dieksekusi dari Route Handler yang telah memverifikasi peran pemanggil sebagai `admin`
 *    pada dapur terkait (`kitchenRoute(['admin'], ...)`).
 * 4. Setiap aksi pemulihan WAJIB menyertakan alasan tertulis (minimal 10 karakter)
 *    dan dicatat secara append-only ke dalam tabel `public.audit_logs`.
 */

export const MfaRecoveryInputSchema = z.object({
  reason: z
    .string()
    .trim()
    .min(
      10,
      'Alasan pemulihan wajib diisi minimal 10 karakter (misal: "HP maker hilang dan nomor baru").',
    ),
});

export interface ResetUserMfaParams {
  adminUserId: string;
  targetUserId: string;
  kitchenId: string;
  reason: string;
}

export interface ResetUserMfaResult {
  success: boolean;
  message: string;
  deletedFactorsCount: number;
}

export async function resetUserMfaByAdmin(
  params: ResetUserMfaParams,
): Promise<ResetUserMfaResult> {
  const { adminUserId, targetUserId, kitchenId, reason } = params;

  // Validasi input alasan
  const validated = MfaRecoveryInputSchema.parse({ reason });

  const adminClient = createAdminClient();

  // 1. Dapatkan daftar faktor MFA milik target pengguna
  const { data: factorsData, error: listErr } =
    await adminClient.auth.admin.mfa.listFactors({
      userId: targetUserId,
    });

  if (listErr) {
    throw new HttpError(
      500,
      `Gagal memeriksa faktor MFA pengguna: ${listErr.message}`,
    );
  }

  const factors = factorsData?.factors ?? [];
  let deletedCount = 0;

  // 2. Hapus setiap faktor autentikasi terdaftar
  for (const factor of factors) {
    const { error: delErr } = await adminClient.auth.admin.mfa.deleteFactor({
      id: factor.id,
      userId: targetUserId,
    });
    if (delErr) {
      throw new HttpError(
        500,
        `Gagal menghapus faktor autentikasi ${factor.id}: ${delErr.message}`,
      );
    }
    deletedCount += 1;
  }

  // 3. Catat ke tabel audit_logs (append-only, PRD E18 & SECURITY S-15)
  const { error: auditErr } = await adminClient.from('audit_logs').insert({
    kitchen_id: kitchenId,
    actor_id: adminUserId,
    action: 'user.mfa_reset',
    entity: 'user_mfa',
    entity_id: targetUserId,
    before: {
      factor_count: factors.length,
      factors: factors.map((f) => ({
        id: f.id,
        factor_type: f.factor_type,
        status: f.status,
      })),
    },
    after: {
      reason: validated.reason,
      reset_by: adminUserId,
      reset_at: new Date().toISOString(),
    },
  });

  if (auditErr) {
    // SECURITY NOTE: Pencatatan audit adalah wajib. Jika audit gagal, beri peringatan
    throw new HttpError(
      500,
      `Faktor dihapus tetapi gagal mencatat ke audit log: ${auditErr.message}`,
    );
  }

  return {
    success: true,
    message: `Faktor MFA berhasil direset (${deletedCount} faktor dihapus). Pengguna akan diminta mendaftar ulang saat login berikutnya.`,
    deletedFactorsCount: deletedCount,
  };
}
