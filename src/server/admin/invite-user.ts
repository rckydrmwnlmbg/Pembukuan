import 'server-only';
import { createAdminClient } from '@/server/supabase/admin';
import { HttpError } from '@/server/http/errors';

/**
 * ============================================================================
 * Modul Undangan Pengguna oleh Admin (PRD FR-F1.3 & SECURITY.md S-01, S-04)
 * ============================================================================
 *
 * Catatan Alasan Penggunaan Service Role:
 * 1. Pendaftaran publik telah ditutup secara permanen (FR-F1.3). Pengguna baru hanya
 *    dapat bergabung ke sistem jika diundang atau dibuat oleh Administrator.
 * 2. API `auth.admin.inviteUserByEmail` memerlukan wewenang Service Role Supabase
 *    karena berjalan tanpa kredensial awal dari pengguna yang diundang.
 * 3. Modul ini secara ketat dibatasi di server (`server-only`) dan hanya boleh
 *    dieksekusi dari alur yang telah memverifikasi peran pemanggil sebagai `admin`.
 * 4. Pengguna yang diundang akan menerima surel berisikan tautan token aman sekali
 *    pakai untuk menetapkan kata sandi mereka sendiri (minimal 12 karakter).
 */

export interface InviteUserResult {
  userId: string;
  email: string;
  invitedAt: string;
}

export async function inviteUserByEmail(
  email: string,
  redirectTo?: string,
): Promise<InviteUserResult> {
  const cleanEmail = email.trim().toLowerCase();
  if (!cleanEmail || !cleanEmail.includes('@')) {
    throw new HttpError(400, 'Alamat email tujuan undangan tidak valid.');
  }

  const adminClient = createAdminClient();

  const options: { redirectTo?: string } = {};
  if (redirectTo) {
    options.redirectTo = redirectTo;
  }

  const { data, error } = await adminClient.auth.admin.inviteUserByEmail(
    cleanEmail,
    options,
  );

  if (error) {
    // Tangani jika pengguna sudah terdaftar sebelumnya
    if (error.message?.includes('already been registered') || error.message?.includes('already exists')) {
      throw new HttpError(409, `Pengguna dengan email ${cleanEmail} sudah terdaftar di sistem.`);
    }
    throw new HttpError(500, `Gagal mengirim undangan ke pengguna: ${error.message}`);
  }

  if (!data?.user) {
    throw new HttpError(500, 'Supabase tidak mengembalikan data pengguna setelah undangan.');
  }

  return {
    userId: data.user.id,
    email: data.user.email ?? cleanEmail,
    invitedAt: data.user.invited_at ?? new Date().toISOString(),
  };
}
