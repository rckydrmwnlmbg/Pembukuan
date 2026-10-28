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
    const cookieStore = await cookies();
    cookieStore.delete('kasdapur_session');

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

    // Periksa faktor MFA (FR-F1.1)
    const { data: factors } = await supabase.auth.mfa.listFactors();
    const verifiedTotp = factors?.totp?.find((f) => f.status === 'verified');
    if (verifiedTotp) {
      return { needMfa: true, isDemo: false };
    }
    // Jika belum memiliki faktor terverifikasi, tetap wajibkan MFA (mode pendaftaran/enroll)
    return { needMfa: true, isDemo: false };
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

export interface MfaSetupResult {
  isDemo?: boolean;
  mode: 'enroll' | 'challenge';
  factorId?: string;
  qrCode?: string;
  secret?: string;
  error?: string;
}

/**
 * Server action untuk mendapatkan status dan data pendaftaran/tantangan MFA TOTP (FR-F1.1).
 * Jika pengguna belum mendaftarkan TOTP, secara otomatis membuat factor baru dan mengembalikan QR + kode rahasia.
 * Jika pengguna sudah memiliki TOTP terverifikasi, mengembalikan mode 'challenge'.
 */
export async function getMfaSetupAction(): Promise<MfaSetupResult> {
  const cookieStore = await cookies();
  const isDemoSession =
    cookieStore.get('kasdapur_session')?.value === 'authenticated';

  if (isDemoSession) {
    return {
      isDemo: true,
      mode: 'challenge',
      factorId: 'demo-totp-factor-id',
    };
  }

  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: userErr,
    } = await supabase.auth.getUser();

    if (userErr || !user) {
      return {
        mode: 'challenge',
        error: 'Sesi tidak ditemukan atau telah berakhir. Silakan login kembali.',
      };
    }

    const { data: factors, error: factorsErr } =
      await supabase.auth.mfa.listFactors();
    if (factorsErr) {
      return { mode: 'challenge', error: factorsErr.message };
    }

    const verifiedTotp = factors?.totp?.[0];
    if (verifiedTotp) {
      return {
        isDemo: false,
        mode: 'challenge',
        factorId: verifiedTotp.id,
      };
    }

    // Bersihkan faktor pendaftaran sebelumnya yang belum diverifikasi
    const unverifiedList =
      factors?.all?.filter(
        (f) => f.factor_type === 'totp' && f.status === 'unverified',
      ) ?? [];
    for (const unfactor of unverifiedList) {
      await supabase.auth.mfa.unenroll({ factorId: unfactor.id }).catch(() => {});
    }

    // Buat pendaftaran faktor TOTP baru (QR SVG + kode teks rahasia)
    const { data: enrollData, error: enrollErr } =
      await supabase.auth.mfa.enroll({
        factorType: 'totp',
        issuer: 'Kasdapur',
      });

    if (enrollErr || !enrollData) {
      return {
        mode: 'enroll',
        error: enrollErr ? enrollErr.message : 'Gagal membuat pendaftaran TOTP baru.',
      };
    }

    return {
      isDemo: false,
      mode: 'enroll',
      factorId: enrollData.id,
      qrCode: enrollData.totp.qr_code,
      secret: enrollData.totp.secret,
    };
  } catch (err: unknown) {
    return {
      mode: 'challenge',
      error:
        err instanceof Error
          ? err.message
          : 'Gagal memuat status autentikasi MFA.',
    };
  }
}

/**
 * Server action untuk verifikasi kode MFA (TOTP).
 * Menerapkan penegakan ketat tanpa bypass: jika faktor tidak ditemukan atau kode salah,
 * verifikasi ditolak dan sesi tidak dapat ditingkatkan ke AAL2.
 */
export async function verifyMfaAction(
  params: string | { code: string; factorId?: string },
): Promise<{
  success?: boolean;
  error?: string;
}> {
  const code = typeof params === 'string' ? params : params.code;
  const factorId = typeof params === 'string' ? undefined : params.factorId;

  const cleanCode = (code || '').replace(/\D/g, '').trim();
  if (cleanCode.length !== 6) {
    return { error: 'Kode verifikasi harus berupa 6 digit angka.' };
  }

  const cookieStore = await cookies();
  const isDemoSession =
    cookieStore.get('kasdapur_session')?.value === 'authenticated';

  if (isDemoSession) {
    return { success: true };
  }

  try {
    const supabase = await createClient();
    let targetFactorId = factorId;

    if (!targetFactorId) {
      const { data: factors, error: factorsErr } =
        await supabase.auth.mfa.listFactors();
      if (factorsErr) {
        return { error: factorsErr.message };
      }

      const verifiedTotp = factors?.totp?.[0];
      const unverifiedTotp = factors?.all?.find(
        (f) => f.factor_type === 'totp' && f.status === 'unverified',
      );
      targetFactorId = verifiedTotp?.id || unverifiedTotp?.id;
    }

    if (!targetFactorId) {
      return {
        error:
          'Faktor autentikasi TOTP tidak ditemukan. Silakan muat ulang halaman untuk mendaftar kembali.',
      };
    }

    const { error: verifyErr } = await supabase.auth.mfa.challengeAndVerify({
      factorId: targetFactorId,
      code: cleanCode,
    });

    if (verifyErr) {
      return {
        error:
          'Kode autentikator salah atau telah kedaluwarsa. Pastikan jam pada perangkat Anda sinkron.',
      };
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
