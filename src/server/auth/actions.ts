'use server';

import { cookies } from 'next/headers';
import { createClient } from '@/server/supabase/server';

/**
 * Server action untuk proses login:
 * Mendukung kredensial pengguna nyata Supabase Auth maupun kredensial demo sintetis.
 */
export async function signInAction(formData: {
  email: string;
  password: string;
}): Promise<{
  success?: boolean;
  needMfa?: boolean;
  error?: string;
  isDemo?: boolean;
}> {
  const { email, password } = formData;

  if (!email || !password) {
    return { error: 'Email dan kata sandi wajib diisi.' };
  }

  const cleanEmail = email.trim().toLowerCase();

  // 1. Kredensial akun demo sintetis
  if (cleanEmail === 'maker@sintetis.example' && password === 'demo1234') {
    const cookieStore = await cookies();
    cookieStore.set('kasdapur_session', 'authenticated', {
      path: '/',
      httpOnly: false,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      maxAge: 60 * 60 * 12, // 12 jam
    });
    return { needMfa: true, isDemo: true };
  }

  // 2. Kredensial pengguna Supabase Auth nyata
  try {
    const supabase = await createClient();
    const { data, error } = await supabase.auth.signInWithPassword({
      email: cleanEmail,
      password,
    });

    if (error) {
      return { error: error.message };
    }

    if (!data.user) {
      return { error: 'Autentikasi gagal: data pengguna tidak ditemukan.' };
    }

    // Periksa tingkat jaminan autentikasi (MFA)
    const { data: aal } =
      await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
    if (aal?.nextLevel === 'aal2') {
      return { needMfa: true, isDemo: false };
    }

    return { success: true, isDemo: false };
  } catch (err: unknown) {
    return {
      error:
        err instanceof Error
          ? err.message
          : 'Gagal menghubungi server Supabase. Pastikan NEXT_PUBLIC_SUPABASE_URL dan NEXT_PUBLIC_SUPABASE_ANON_KEY telah diatur di Vercel.',
    };
  }
}

/**
 * Server action untuk verifikasi kode MFA (TOTP).
 */
export async function verifyMfaAction(code: string): Promise<{
  success?: boolean;
  error?: string;
}> {
  const cookieStore = await cookies();
  const isDemoSession =
    cookieStore.get('kasdapur_session')?.value === 'authenticated';

  if (isDemoSession) {
    if (code.length === 6) {
      return { success: true };
    }
    return { error: 'Kode verifikasi harus berupa 6 digit angka.' };
  }

  try {
    const supabase = await createClient();
    const { data: factors, error: factorsErr } =
      await supabase.auth.mfa.listFactors();
    if (factorsErr) {
      return { error: factorsErr.message };
    }

    if (!factors.totp || factors.totp.length === 0) {
      // Belum ada TOTP terdaftar di Supabase, langsung sukses
      return { success: true };
    }

    const firstTotp = factors.totp[0];
    if (!firstTotp) {
      return { success: true };
    }
    const factorId = firstTotp.id;
    const { error: verifyErr } = await supabase.auth.mfa.challengeAndVerify({
      factorId,
      code,
    });

    if (verifyErr) {
      return { error: verifyErr.message };
    }

    return { success: true };
  } catch (err: unknown) {
    return {
      error:
        err instanceof Error
          ? err.message
          : 'Gagal memverifikasi kode MFA pada server Supabase.',
    };
  }
}

/**
 * Server action untuk mengaktifkan sesi login demo di lingkungan browser.
 */
export async function setDemoSessionAction(): Promise<{ ok: boolean }> {
  const cookieStore = await cookies();
  cookieStore.set('kasdapur_session', 'authenticated', {
    path: '/',
    httpOnly: false,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    maxAge: 60 * 60 * 12,
  });
  return { ok: true };
}

/**
 * Server action untuk menghapus sesi dan keluar (logout).
 */
export async function clearSessionAction(): Promise<{ ok: boolean }> {
  const cookieStore = await cookies();
  cookieStore.delete('kasdapur_session');
  try {
    const supabase = await createClient();
    await supabase.auth.signOut();
  } catch {
    // Abaikan jika Supabase tidak terhubung
  }
  return { ok: true };
}
