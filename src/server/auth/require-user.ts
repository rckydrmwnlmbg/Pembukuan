import 'server-only';
import { redirect } from 'next/navigation';
import { createClient } from '@/server/supabase/server';
import { HttpError } from '@/server/http/errors';

export interface RequireUserOptions {
  /**
   * Jika true (default untuk halaman / Server Component), lakukan redirect('/login') atau redirect('/login/mfa').
   * Jika false (default untuk Route Handler API), lemparkan HttpError(401) atau HttpError(403).
   */
  redirectOnFailure?: boolean;
}

/**
 * Memastikan sesi pengguna valid (lewat getUser(), BUKAN getSession())
 * dan telah menyelesaikan verifikasi MFA TOTP (AAL2) sesuai SECURITY.md S-01 & OI-02.
 */
export async function requireUser(options: RequireUserOptions = {}) {
  const { redirectOnFailure = true } = options;
  const supabase = await createClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) {
    if (!redirectOnFailure) {
      throw new HttpError(
        401,
        'Sesi tidak valid atau telah berakhir. Silakan login terlebih dahulu.',
      );
    }
    redirect('/login');
  }

  const { data: aal } =
    await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
  if (aal?.currentLevel !== 'aal2') {
    if (!redirectOnFailure) {
      throw new HttpError(
        403,
        'Verifikasi autentikasi dua faktor (MFA AAL2) diperlukan.',
      );
    }
    redirect('/login/mfa');
  }

  return { supabase, user };
}
