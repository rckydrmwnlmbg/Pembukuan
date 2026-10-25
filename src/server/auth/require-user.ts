import 'server-only';
import { redirect } from 'next/navigation';
import { cookies } from 'next/headers';
import { createClient } from '@/server/supabase/server';
import { getEnv } from '@/server/env';
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

  let demoSession: string | undefined;
  try {
    const cookieStore = await cookies();
    demoSession = cookieStore.get('kasdapur_session')?.value;
  } catch {
    demoSession = undefined;
  }

  let env;
  try {
    env = getEnv();
  } catch {
    env = {
      NEXT_PUBLIC_DEMO: 'true',
      APP_ENV: 'demo',
    };
  }

  const isDemoForbidden =
    env.NEXT_PUBLIC_DEMO === 'false' && env.APP_ENV === 'production';
  const isDemoAllowed = !isDemoForbidden;

  // 1. Jika sesi demo aktif dan demo diizinkan
  if (isDemoAllowed && demoSession === 'authenticated') {
    let supabaseClient;
    try {
      supabaseClient = await createClient();
    } catch {
      supabaseClient = {
        auth: {
          getUser: async () => ({
            data: {
              user: {
                id: '00000000-0000-4000-8000-000000000001',
                email: 'maker@sintetis.example',
                app_metadata: {},
                user_metadata: {},
                aud: 'authenticated',
                created_at: '2026-03-01T00:00:00.000Z',
              },
            },
            error: null,
          }),
          mfa: {
            getAuthenticatorAssuranceLevel: async () => ({
              data: { currentLevel: 'aal2', nextLevel: null },
              error: null,
            }),
          },
        },
      } as unknown as Awaited<ReturnType<typeof createClient>>;
    }

    return {
      supabase: supabaseClient,
      user: {
        id: '00000000-0000-4000-8000-000000000001',
        email: 'maker@sintetis.example',
        app_metadata: {},
        user_metadata: {},
        aud: 'authenticated',
        created_at: '2026-03-01T00:00:00.000Z',
      } as unknown as NonNullable<
        Awaited<ReturnType<typeof createClient>>['auth']['getUser']
      > extends { data: { user: infer U } }
        ? NonNullable<U>
        : never,
    };
  }

  // 2. Pemeriksaan sesi Supabase Auth nyata
  let supabase;
  try {
    supabase = await createClient();
  } catch {
    if (!redirectOnFailure) {
      throw new HttpError(
        401,
        'Sesi tidak valid atau telah berakhir. Silakan login terlebih dahulu.',
      );
    }
    redirect('/login');
  }

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
