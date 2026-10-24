import 'server-only';
import { redirect } from 'next/navigation';
import { createClient } from '@/server/supabase/server';

/**
 * Memastikan sesi pengguna valid (lewat getUser(), BUKAN getSession())
 * dan telah menyelesaikan verifikasi MFA TOTP (AAL2) sesuai SECURITY.md S-01 & OI-02.
 */
export async function requireUser() {
  const supabase = await createClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) {
    redirect('/login');
  }

  const { data: aal } =
    await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
  if (aal?.currentLevel !== 'aal2') {
    redirect('/login/mfa');
  }

  return { supabase, user };
}
