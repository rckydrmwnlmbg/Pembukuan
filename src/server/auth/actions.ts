'use server';

import { cookies } from 'next/headers';
import { createClient } from '@/server/supabase/server';
import { getEnv } from '@/server/env';
import { validatePassword } from '@/lib/validation/password';

/**
 * Server action untuk proses login:
 * Otentikasi langsung dengan Supabase Auth pengguna nyata.
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

  // 1. Akun demo khusus testing lokal (hanya aktif jika NEXT_PUBLIC_DEMO=true dan APP_ENV !== 'production')
  const env = getEnv();
  const allowDemo = env.NEXT_PUBLIC_DEMO === 'true' && env.APP_ENV !== 'production';

  if (allowDemo && cleanEmail === 'maker@sintetis.example' && password === 'demo1234') {
    const cookieStore = await cookies();
    cookieStore.set('kasdapur_session', 'authenticated', {
      path: '/',
      httpOnly: false,
      sameSite: 'lax',
      secure: false,
      maxAge: 60 * 60 * 12,
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
    if (aal?.nextLevel === 'aal2' && aal?.currentLevel !== 'aal2') {
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
 * Server action untuk menetapkan kata sandi baru (bagi pengguna undangan atau ubah sandi).
 * Menerapkan batas minimal 12 karakter dan menolak sandi lemah umum (PRD FR-F1.3).
 */
export async function setPasswordAction(formData: {
  password: string;
}): Promise<{
  success?: boolean;
  error?: string;
}> {
  const { password } = formData;
  const validation = validatePassword(password);
  if (!validation.valid) {
    return { error: validation.error };
  }

  try {
    const supabase = await createClient();
    const { error } = await supabase.auth.updateUser({
      password,
    });

    if (error) {
      return { error: error.message };
    }

    return { success: true };
  } catch (err: unknown) {
    return {
      error:
        err instanceof Error
          ? err.message
          : 'Gagal memperbarui kata sandi di server autentikasi.',
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
 * Server action untuk menghapus sesi dan logout (SECURITY.md S-11).
 */
export async function clearSessionAction(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete('kasdapur_session');

  try {
    const supabase = await createClient();
    await supabase.auth.signOut();
  } catch {
    // Abaikan jika klien gagal
  }
}

/**
 * Helper untuk testing unit mode demo.
 */
export async function setDemoSessionAction(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.set('kasdapur_session', 'authenticated', {
    path: '/',
    httpOnly: false,
    sameSite: 'lax',
    secure: false,
    maxAge: 60 * 60 * 12,
  });
}
